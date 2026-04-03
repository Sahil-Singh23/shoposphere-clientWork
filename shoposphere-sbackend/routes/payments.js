import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import prisma from "../prisma.js";
import { getCartItemsForOrder } from "./cart.js";
import { optionalCustomerAuth } from "../utils/auth.js";
import { validateStockForItems, deductStockForOrder } from "../utils/stock.js";
import { calculateDeliveryCharges, getEstimatedDeliveryForOrder } from "./delivery.js";
import { tryAssignDriverToOrder } from "../utils/driverAssignment.js";

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const CART_SESSION_HEADER = "x-cart-session-id";
const CURRENCY = "INR";

function getSessionId(req) {
  return req.headers[CART_SESSION_HEADER]?.trim() || req.body?.sessionId?.trim() || null;
}

/** GET /payments/config — return Razorpay key_id for frontend checkout (public, safe to expose) */
router.get("/config", (req, res) => {
  res.json({ razorpayKeyId: RAZORPAY_KEY_ID || "" });
});


//creating a new razor pay instance 
function getRazorpayInstance() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured");
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

/**
 * POST /payments/create-order
 * Body: { sessionId? or X-Cart-Session-Id header, deliverySlotId? }
 * Validates cart server-side, calculates subtotal + delivery fee (server-side), creates Razorpay order.
 */
router.post("/create-order", async (req, res) => {
  try {
    const sessionId = getSessionId(req) || req.body?.sessionId;
    if (!sessionId?.trim()) {
      return res.status(400).json({ error: "Cart session required" });
    }

    const items = await getCartItemsForOrder(sessionId.trim());
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
    if (total <= 0) {
      return res.status(400).json({ error: "Invalid cart total" });
    }

    const bodySlotId = req.body?.deliverySlotId != null ? Number(req.body.deliverySlotId) : null;
    if (bodySlotId != null && Number.isInteger(bodySlotId)) {
      const slot = await prisma.deliverySlot.findFirst({
        where: { id: bodySlotId, isActive: true },
      });
      if (!slot) {
        return res.status(400).json({ error: "Invalid or inactive delivery slot. Please choose another slot." });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const slotDate = typeof slot.date === "string" ? new Date(slot.date) : new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      if (slotDate < today) {
        return res.status(400).json({ error: "Selected delivery slot date has passed. Please choose another slot." });
      }
      if (slot.maxOrders != null && slot.bookedCount >= slot.maxOrders) {
        return res.status(400).json({ error: "This delivery slot is full. Please choose another slot." });
      }
    }

    const amountInPaise = Math.round(total * 100);
    let razorpay;
    try {
      razorpay = getRazorpayInstance();
    } catch (e) {
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: CURRENCY,
      receipt: `shoposphere_${Date.now()}_${sessionId.slice(0, 8)}`,
    });
    //if order was created , send order id amount currency to the frontend 
    res.json({
      razorpayOrderId: order.id,
      amount: amountInPaise,
      currency: order.currency || CURRENCY,
      subtotal,
      deliveryFee,
      total,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: error.message || "Failed to create payment order" });
  }
});


/**
 * Verify Razorpay signature: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!RAZORPAY_KEY_SECRET) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
  return expected === signature;
}

/**
 * POST /payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, checkoutData: { sessionId, customerDetails, deliverySlotId? } }
 * Verifies signature, then creates Order + OrderItems with delivery fee/ETA/slot. Idempotent by razorpay_payment_id.
 */
router.post("/verify", optionalCustomerAuth, async (req, res) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      checkoutData,
    } = req.body || {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const sessionId = checkoutData?.sessionId?.trim();
    const customerDetails = checkoutData?.customerDetails;
    if (!sessionId || !customerDetails || typeof customerDetails !== "object") {
      return res.status(400).json({ error: "checkoutData.sessionId and checkoutData.customerDetails required" });
    }

    const { name, phone, address, city, state, pincode, email, latitude, longitude } = customerDetails;
    if (!name?.trim() || !phone?.trim() || !address?.trim() || !city?.trim() || !state?.trim() || !pincode?.trim()) {
      return res.status(400).json({ error: "Invalid customer details" });
    }
    const addressLat = latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null;
    const addressLng = longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null;

    const existingOrder = await prisma.order.findUnique({
      where: { razorpayPaymentId },
    });
    if (existingOrder) {
      return res.json({ orderId: existingOrder.id, success: true });
    }

    const items = await getCartItemsForOrder(sessionId);
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty or expired" });
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
    const bodySlotId = checkoutData?.deliverySlotId;
    if (bodySlotId != null && Number.isInteger(Number(bodySlotId))) {
      const slotId = Number(bodySlotId);
      const slot = await prisma.deliverySlot.findFirst({
        where: { id: slotId, isActive: true },
      });
      if (slot) {
        const today = new Date();
        // IMPORTANT: deliverySlot.date is a date-only field (@db.Date).
        // Normalize using UTC midnight to avoid +/-1 day shifts.
        today.setUTCHours(0, 0, 0, 0);
        const slotDate = typeof slot.date === "string" ? new Date(slot.date) : new Date(slot.date);
        slotDate.setUTCHours(0, 0, 0, 0);
        if (slotDate >= today && (slot.maxOrders == null || slot.bookedCount < slot.maxOrders)) {
          deliverySlotId = slotId;
          estimatedDeliveryDate = slotDate.toISOString().slice(0, 10);
        }
        // if slot invalid/full we continue without slot (default ETA)
      }
    }
    if (!estimatedDeliveryDate) {
      estimatedDeliveryDate = await getEstimatedDeliveryForOrder(null);
    }

    const addressLine = [address.trim(), city.trim(), state.trim(), pincode.trim()].filter(Boolean).join(", ");

    const userId = req.customerUserId || null;
    const notesFromCheckout =
      (typeof checkoutData?.notes === "string" && checkoutData.notes.trim()) ||
      (typeof customerDetails?.notes === "string" && customerDetails.notes.trim()) ||
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
          status: "confirmed",
          paymentMethod: "online",
          razorpayOrderId,
          razorpayPaymentId,
          userId,
          deliveryFee,
          estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
          deliverySlotId,
          notes: notesFromCheckout,
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
      return newOrder;
    });

    const cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
    if (cart?.items?.length) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    res.json({ orderId: order.id, success: true });
  } catch (error) {
    console.error("Payment verify error:", error);
    res.status(500).json({ error: error.message || "Payment verification failed" });
  }
});

export default router;
