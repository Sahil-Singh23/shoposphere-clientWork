import express from "express";
import prisma from "../prisma.js";
import { randomUUID } from "crypto";
import { optionalCustomerAuth } from "../utils/auth.js";

const router = express.Router();
const CART_SESSION_HEADER = "x-cart-session-id";

function getSessionId(req) {
  return req.headers[CART_SESSION_HEADER]?.trim() || req.body?.sessionId?.trim() || null;
}

function getIncomingVariantId(payload = {}) {
  const raw = payload.variantId ?? payload.productVariantId ?? payload.productSizeId ?? payload.sizeId ?? null;
  if (raw == null || raw === "" || raw === 0) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPrimaryColorPhotoUrl(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed[0] || "";
  } catch {
    // legacy single URL string
  }
  return raw;
}

/** Hydrate cart items to frontend shape with variant metadata. */
async function hydrateCartItems(items) {
  if (!items?.length) return [];
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId).filter((id) => id != null))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { colors: true },
  });
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { color: true },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      const variant = item.variantId != null ? variantMap.get(item.variantId) : null;
      if (!variant || variant.productId !== product.id) return null;

      const images = (() => {
        try {
          const raw = product.images;
          if (Array.isArray(raw)) return raw;
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();
      const productImage = getPrimaryColorPhotoUrl(variant.color?.photoUrl) || (images.length ? images[0] : null);
      const sizeLabel = variant.sizeLabel || "Standard";
      const price = parseFloat(variant.price || 0);
      const variantId = variant.id;

      const quantity = Math.max(1, item.quantity);
      const subtotal = price * quantity;
      const stock = Math.max(0, Number(variant.stock ?? 0));
      return {
        id: String(item.id),
        productId: product.id,
        productName: product.name,
        productImage,
        sizeId: variantId,
        variantId,
        sku: variant.sku,
        colorName: variant.color?.name || null,
        colorHex: variant.color?.hexCode || null,
        sizeLabel,
        price,
        quantity,
        subtotal,
        stock,
        skipStockDeduction: false,
      };
    })
    .filter(Boolean);
}

/** Get cart items hydrated for order creation (used by orders/create). Returns null if no cart or empty. */
export async function getCartItemsForOrder(sessionId) {
  if (!sessionId?.trim()) return null;
  const cart = await prisma.cart.findUnique({
    where: { sessionId: sessionId.trim() },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!cart || !cart.items.length) return null;
  return hydrateCartItems(cart.items);
}

/** Get or create cart by sessionId (guest) */
async function getOrCreateCart(sessionId) {
  if (sessionId) {
    const cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: { items: { orderBy: { id: "asc" } } },
    });
    if (cart) return cart;
  }
  const newSessionId = sessionId || randomUUID();
  const cart = await prisma.cart.create({
    data: { sessionId: newSessionId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  return cart;
}

/** Get or create cart by userId (logged-in customer) */
async function getOrCreateCartByUserId(userId) {
  const uid = Number(userId);
  let cart = await prisma.cart.findFirst({
    where: { userId: uid },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (cart) return cart;
  // Verify user exists before creating cart (avoids FK violation from stale/deleted users)
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
  if (!user) {
    throw Object.assign(new Error("User not found. Please log in again."), { statusCode: 401 });
  }
  cart = await prisma.cart.create({
    data: { sessionId: `user-${uid}-${randomUUID()}`, userId: uid },
    include: { items: { orderBy: { id: "asc" } } },
  });
  return cart;
}

// GET /cart — get cart for session or user (create if needed); returns { sessionId, items }
router.get("/", optionalCustomerAuth, async (req, res) => {
  try {
    if (req.customerUserId) {
      const cart = await getOrCreateCartByUserId(req.customerUserId);
      const items = await hydrateCartItems(cart.items);
      res.setHeader(CART_SESSION_HEADER, cart.sessionId);
      return res.json({ sessionId: cart.sessionId, items });
    }
    const sessionId = getSessionId(req);
    const cart = await getOrCreateCart(sessionId);
    const items = await hydrateCartItems(cart.items);
    res.setHeader(CART_SESSION_HEADER, cart.sessionId);
    res.json({ sessionId: cart.sessionId, items });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /cart/items — add or update item: { productId, variantId, quantity }
router.post("/items", optionalCustomerAuth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body || {};
    const variantId = getIncomingVariantId(req.body || {});
    if (!productId || quantity < 1) {
      return res.status(400).json({ error: "productId and positive quantity required" });
    }
    if (!variantId) {
      return res.status(400).json({ error: "variantId is required" });
    }

    const cart = req.customerUserId
      ? await getOrCreateCartByUserId(req.customerUserId)
      : await getOrCreateCart(getSessionId(req));

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant || variant.productId !== Number(productId)) {
      return res.status(404).json({ error: "Variant not found for this product" });
    }

    const variantStock = Math.max(0, Number(variant.stock ?? 0));
    if (variantStock <= 0) {
      return res.status(400).json({ error: "This variant is out of stock" });
    }

    const currentQtySameVariant = cart.items
      .filter(
        (i) =>
          i.productId === Number(productId) &&
          (i.variantId ?? null) === variantId
      )
      .reduce((sum, i) => sum + i.quantity, 0);

    if (currentQtySameVariant + quantity > variantStock) {
      return res.status(400).json({
        error: `Only ${variantStock} unit(s) available for this variant`,
        available: variantStock,
      });
    }

    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: Number(productId),
        variantId,
      },
    });

    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: Number(productId),
          variantId,
          quantity,
        },
      });
    }

    const hydrated = await hydrateCartItems([item]);
    res.setHeader(CART_SESSION_HEADER, cart.sessionId);
    res.status(201).json({ sessionId: cart.sessionId, item: hydrated[0] });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// PATCH /cart/items/:id — update quantity; body { quantity }. If quantity <= 0, item is removed.
router.patch("/items/:id", optionalCustomerAuth, async (req, res) => {
  try {
    const cart = req.customerUserId
      ? await getOrCreateCartByUserId(req.customerUserId)
      : await getOrCreateCart(getSessionId(req));
    const id = Number(req.params.id);
    const { quantity } = req.body || {};

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ error: "quantity required" });
    }

    const existing = await prisma.cartItem.findFirst({
      where: { id, cartId: cart.id },
    });
    if (!existing) return res.status(404).json({ error: "Cart item not found" });

    const product = await prisma.product.findUnique({
      where: { id: existing.productId },
      select: { id: true },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    const variant = await prisma.productVariant.findUnique({
      where: { id: Number(existing.variantId) },
      select: { stock: true, productId: true },
    });
    if (!variant || variant.productId !== existing.productId) {
      return res.status(400).json({ error: "Selected variant is no longer available" });
    }
    const variantStock = Math.max(0, Number(variant.stock ?? 0));

    const otherQtySameVariant = cart.items
      .filter(
        (i) =>
          i.productId === existing.productId &&
          (i.variantId ?? null) === (existing.variantId ?? null) &&
          i.id !== id
      )
      .reduce((sum, i) => sum + i.quantity, 0);
    if (quantity > 0 && otherQtySameVariant + quantity > variantStock) {
      return res.status(400).json({
        error: variantStock === 0 ? "This variant is out of stock" : `Only ${variantStock} unit(s) available for this variant`,
        available: variantStock,
      });
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id } });
      res.setHeader(CART_SESSION_HEADER, cart.sessionId);
      return res.json({ sessionId: cart.sessionId, removed: true });
    }

    const item = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
    });
    const hydrated = await hydrateCartItems([item]);
    res.setHeader(CART_SESSION_HEADER, cart.sessionId);
    res.json({ sessionId: cart.sessionId, item: hydrated[0] });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// DELETE /cart/items/:id
router.delete("/items/:id", optionalCustomerAuth, async (req, res) => {
  try {
    const cart = req.customerUserId
      ? await getOrCreateCartByUserId(req.customerUserId)
      : await getOrCreateCart(getSessionId(req));
    const id = Number(req.params.id);

    const existing = await prisma.cartItem.findFirst({
      where: { id, cartId: cart.id },
    });
    if (!existing) return res.status(404).json({ error: "Cart item not found" });

    await prisma.cartItem.delete({ where: { id } });
    res.setHeader(CART_SESSION_HEADER, cart.sessionId);
    res.json({ sessionId: cart.sessionId, removed: true });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// DELETE /cart — clear all items for this session's cart
router.delete("/", optionalCustomerAuth, async (req, res) => {
  try {
    if (req.customerUserId) {
      const cart = await prisma.cart.findFirst({ where: { userId: req.customerUserId } });
      if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      res.json({ sessionId: null, items: [] });
      return;
    }
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.json({ sessionId: null, items: [] });
    }
    const cart = await prisma.cart.findUnique({ where: { sessionId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    res.setHeader(CART_SESSION_HEADER, sessionId);
    res.json({ sessionId, items: [] });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /cart/merge — merge guest cart into user cart (requires customer auth)
router.post("/merge", optionalCustomerAuth, async (req, res) => {
  try {
    const userId = req.customerUserId;
    if (!userId) return res.status(401).json({ error: "Login required to merge cart" });

    const guestSessionId = req.body?.guestSessionId?.trim() || getSessionId(req);
    if (!guestSessionId) {
      const cart = await getOrCreateCartByUserId(userId);
      const items = await hydrateCartItems(cart.items);
      return res.json({ sessionId: cart.sessionId, items });
    }

    const guestCart = await prisma.cart.findUnique({
      where: { sessionId: guestSessionId },
      include: { items: true },
    });

    const userCart = await getOrCreateCartByUserId(userId);

    if (guestCart?.items?.length) {
      for (const gi of guestCart.items) {
        const existing = await prisma.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: gi.productId,
            variantId: gi.variantId,
          },
        });
        if (existing) {
          await prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + gi.quantity },
          });
        } else {
          await prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: gi.productId,
              variantId: gi.variantId,
              quantity: gi.quantity,
            },
          });
        }
      }
      await prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await prisma.cart.delete({ where: { id: guestCart.id } });
    }

    const updated = await prisma.cart.findUnique({
      where: { id: userCart.id },
      include: { items: { orderBy: { id: "asc" } } },
    });
    const items = await hydrateCartItems(updated.items);
    res.setHeader(CART_SESSION_HEADER, updated.sessionId);
    res.json({ sessionId: updated.sessionId, items });
  } catch (error) {
    console.error("Cart merge error:", error);
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

// Legacy: POST /cart/sync — keep for backwards compatibility (existing product APIs unchanged)
router.post("/sync", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items array" });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: { include: { color: true } },
        categories: { include: { category: true } },
      },
    });

    const productsMap = {};
    products.forEach((p) => {
      productsMap[p.id] = {
        ...p,
        images: p.images ? JSON.parse(p.images) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
      };
    });

    const syncedItems = items
      .map((item) => {
        const product = productsMap[item.productId];
        if (!product) return null;
        const variantId = getIncomingVariantId(item);
        const variant = product.variants.find((v) => v.id === variantId);
        if (!variant) return null;
        return {
          id: `${item.productId}-${variant.id}`,
          productId: product.id,
          productName: product.name,
          productImage: getPrimaryColorPhotoUrl(variant.color?.photoUrl) || (product.images?.length ? product.images[0] : null),
          sizeId: variant.id,
          variantId: variant.id,
          sizeLabel: variant.sizeLabel,
          colorName: variant.color?.name || null,
          price: parseFloat(variant.price),
          quantity: item.quantity,
          subtotal: parseFloat(variant.price) * item.quantity,
        };
      })
      .filter((item) => item !== null);

    res.json({ items: syncedItems });
  } catch (error) {
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;
