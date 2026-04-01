import express from "express";
import { requireRole, requireCustomerAuth, optionalCustomerAuth } from "../utils/auth.js";
import prisma from "../prisma.js";
import { getCartItemsForOrder } from "./cart.js";
import { validateStockForItems, deductStockForOrder } from "../utils/stock.js";
import { calculateDeliveryCharges, getEstimatedDeliveryForOrder, estimateDeliveryTime } from "./delivery.js";
import { tryAssignDriverToOrder, releaseDriverIfAssigned } from "../utils/driverAssignment.js";

const router = express.Router();

function parseProductImage(product) {
  if (!product?.images) return null;
  try {
    const raw = product.images;
    const arr = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : []);
    return arr.length ? arr[0] : null;
  } catch {
    return null;
  }
}


function paymentStatus(order) {
  if (order.paymentMethod === "cod") return "COD";
  if (order.razorpayPaymentId) return "Paid";
  return "Pending";
}

function orderStatusDisplay(status) {
  const map = {
    pending: "Processing",
    processing: "Processing",
    confirmed: "Confirmed",
    // UI should not show "Shipped"; treat it as the "Out for Delivery" stage.
    shipped: "Out for Delivery",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return map[String(status).toLowerCase()] || status;
}

// POST /orders/create — create order from cart (guest or logged-in)
// Body: { sessionId, customerDetails, paymentMethod?, deliverySlotId? }
// Delivery fee and ETA computed server-side; slot validated and booked.
router.post("/create", optionalCustomerAuth, async (req, res) => {
  try {
    const { sessionId, customerDetails, deliverySlotId: bodySlotId } = req.body || {};
    if (!sessionId || !customerDetails || typeof customerDetails !== "object") {
      return res.status(400).json({ error: "sessionId and customerDetails required" });
    }

    const { name, phone, address, city, state, pincode, email, latitude, longitude, notes: notesFromDetails } = customerDetails;
    if (!name?.trim()) return res.status(400).json({ error: "Full name is required" });
    if (!phone?.trim()) return res.status(400).json({ error: "Phone number is required" });
    if (!address?.trim()) return res.status(400).json({ error: "Address is required" });
    if (!city?.trim()) return res.status(400).json({ error: "City is required" });
    if (!state?.trim()) return res.status(400).json({ error: "State is required" });
    if (!pincode?.trim()) return res.status(400).json({ error: "Pincode is required" });

    const addressLat = latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null;
    const addressLng = longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null;

    const items = await getCartItemsForOrder(sessionId);
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const stockCheck = await validateStockForItems(items);
    if (!stockCheck.ok) {
      return res.status(400).json({ error: stockCheck.error || "Insufficient stock" });
    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const { deliveryFee } = await calculateDeliveryCharges(subtotal);
    const total = Math.max(0, subtotal + deliveryFee);

    let deliverySlotId = null;
    let estimatedDeliveryDate = null;
    if (bodySlotId != null && Number.isInteger(Number(bodySlotId))) {
      const slotId = Number(bodySlotId);
      const slot = await prisma.deliverySlot.findFirst({
        where: { id: slotId, isActive: true },
      });
      if (!slot) {
        return res.status(400).json({ error: "Invalid or inactive delivery slot. Please choose another slot." });
      }
      const today = new Date();
      // IMPORTANT: deliverySlot.date is a date-only field (@db.Date).
      // Normalizing using local midnight can shift the UTC date by +/-1 day.
      // Use UTC midnight to keep the calendar day stable.
      today.setUTCHours(0, 0, 0, 0);
      const slotDate = typeof slot.date === "string" ? new Date(slot.date) : new Date(slot.date);
      slotDate.setUTCHours(0, 0, 0, 0);
      if (slotDate < today) {
        return res.status(400).json({ error: "Selected delivery slot date has passed. Please choose another slot." });
      }
      if (slot.maxOrders != null && slot.bookedCount >= slot.maxOrders) {
        return res.status(400).json({ error: "This delivery slot is full. Please choose another slot." });
      }
      deliverySlotId = slotId;
      estimatedDeliveryDate = slotDate.toISOString().slice(0, 10);
    }
    if (!estimatedDeliveryDate) {
      estimatedDeliveryDate = await getEstimatedDeliveryForOrder(null);
    }

    const addressLine = [address.trim(), city.trim(), state.trim(), pincode.trim()].filter(Boolean).join(", ");
    const paymentMethod = req.body.paymentMethod === "cod" ? "cod" : "online";
    const userId = req.customerUserId || null;
    const orderNotes =
      (typeof req.body.notes === "string" && req.body.notes.trim()) ||
      (typeof notesFromDetails === "string" && notesFromDetails.trim()) ||
      null;

    const order = await prisma.$transaction(async (tx) => {
      await deductStockForOrder(tx, items);
      if (deliverySlotId != null) {
        await tx.deliverySlot.update({
          where: { id: deliverySlotId },
          data: { bookedCount: { increment: 1 } },
        });
      }
      const newOrder = await tx.order.create({
        data: {
          customer: name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: addressLine,
          addressLatitude: addressLat,
          addressLongitude: addressLng,
          total,
          status: "pending",
          paymentMethod,
          userId,
          deliveryFee,
          estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
          deliverySlotId,
          notes: orderNotes,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId ?? null,
              productName: item.productName,
              colorName: item.colorName ?? null,
              sizeLabel: item.sizeLabel,
              quantity: item.quantity,
              price: Number(item.price),
              subtotal: Number(item.subtotal),
            })),
          },
        },
      });
      await tryAssignDriverToOrder(tx, newOrder.id);

      // ── Compute delivery-time estimate if we have customer coordinates ──
      let estimateData = {};
      if (addressLat != null && addressLng != null) {
        try {
          const est = await estimateDeliveryTime(addressLat, addressLng);
          if (est.serviceable) {
            // Check if a driver was actually assigned to THIS order
            const refreshed = await tx.order.findUnique({ where: { id: newOrder.id }, select: { driverUserId: true } });
            const wasDriverAssigned = refreshed?.driverUserId != null;
            estimateData = {
              estimatedDeliveryMinutes: est.estimatedMinutes,
              nearestShopName: est.nearestShop,
              distanceKm: est.distanceKm,
              driverAvailable: wasDriverAssigned,
            };
            await tx.order.update({
              where: { id: newOrder.id },
              data: estimateData,
            });
          }
        } catch (e) {
          console.error("Non-fatal: delivery estimate failed for order", newOrder.id, e.message);
        }
      }

      return { ...newOrder, ...estimateData };
    });

    res.json({
      orderId: order.id,
      success: true,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes ?? null,
      driverAvailable: order.driverAvailable ?? null,
      nearestShopName: order.nearestShopName ?? null,
    });
  } catch (error) {
    console.error("Order create error:", error);
    res.status(400).json({ error: error.message || "Failed to create order" });
  }
});

// Create order (public) — legacy shape; keep for backwards compatibility
router.post("/", async (req, res) => {
  try {
    const { customer, phone, email, address, items, notes } = req.body;

    if (!items?.length) return res.status(400).json({ error: "Items required" });
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    const order = await prisma.order.create({
      data: {
        customer,
        phone: phone || null,
        email: email || null,
        address: address || null,
        total,
        notes: notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sizeLabel: item.sizeLabel,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /orders/my-orders — authenticated user's orders (newest first)
router.get("/my-orders", requireCustomerAuth, async (req, res) => {
  try {
    const userId = req.customerUserId;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { product: true },
        },
        driver: true,
        driverUser: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const list = orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      totalAmount: order.total,
      deliveryFee: order.deliveryFee,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      nearestShopName: order.nearestShopName,
      distanceKm: order.distanceKm,
      driverAvailable: order.driverAvailable,
      paymentStatus: paymentStatus(order),
      orderStatus: orderStatusDisplay(order.status),
      driver: order.driverUser ? { name: order.driverUser.name, phone: order.driverUser.phone ?? null } : (order.driver ? { name: order.driver.name, phone: order.driver.phone } : null),
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.productName,
        sizeLabel: item.sizeLabel,
        image: parseProductImage(item.product),
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
    }));
    res.json(list);
  } catch (error) {
    console.error("My orders error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch orders" });
  }
});

// GET /orders/:id — single order (must own it)
router.get("/:id", requireCustomerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid order id" });
    const userId = req.customerUserId;
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { product: true },
        },
        driver: true,
        driverUser: true,
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    const driverInfo = order.driverUser ? { name: order.driverUser.name, phone: order.driverUser.phone ?? null } : (order.driver ? { name: order.driver.name, phone: order.driver.phone } : null);
    res.json({
      id: order.id,
      customer: order.customer,
      phone: order.phone,
      email: order.email,
      address: order.address,
      total: order.total,
      deliveryFee: order.deliveryFee,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
      nearestShopName: order.nearestShopName,
      distanceKm: order.distanceKm,
      driverAvailable: order.driverAvailable,
      status: order.status,
      orderStatus: orderStatusDisplay(order.status),
      paymentMethod: order.paymentMethod,
      paymentStatus: paymentStatus(order),
      razorpayOrderId: order.razorpayOrderId,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      driver: driverInfo,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.productName,
        sizeLabel: item.sizeLabel,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        image: parseProductImage(item.product),
      })),
    });
  } catch (error) {
    console.error("Order details error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch order" });
  }
});

// Get all orders (Admin only)
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /orders/:id/cancel — customer cancels own order (only if not yet shipped)
router.patch("/:id/cancel", requireCustomerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.customerUserId;
    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    const s = String(order.status).toLowerCase();
    const cancellable = ["pending", "processing", "confirmed"].includes(s);
    if (!cancellable) return res.status(400).json({ error: "Order can no longer be cancelled" });
    const updated = await prisma.order.update({
      where: { id },
      data: { status: "cancelled" },
    });
    res.json(updated);
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel order" });
  }
});

// Update order status (Admin only)
router.patch("/:id/status", requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status },
    });

    const normalizedStatus = String(order.status).toLowerCase().replace(/\s+/g, "_");
    if (normalizedStatus === "delivered") {
      await releaseDriverIfAssigned(prisma, { driverUserId: order.driverUserId, driverId: order.driverId });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
