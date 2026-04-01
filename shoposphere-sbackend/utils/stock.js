import prisma from "../prisma.js";

/**
 * Normalize incoming variant key for transition period.
 * Preferred input is item.variantId; sizeId is treated as legacy alias.
 * @param {{ variantId?: number | null, sizeId?: number | null }} item
 * @returns {number | null}
 */
function getVariantId(item) {
  const raw = item?.variantId ?? item?.sizeId ?? null;
  if (raw == null || raw === 0 || raw === "") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Build a user-friendly label for stock messages.
 * @param {import("@prisma/client").ProductVariant & { product?: { name?: string } | null, color?: { name?: string } | null }} variant
 * @returns {string}
 */
function variantLabel(variant) {
  const productName = variant?.product?.name || "Product";
  const colorName = variant?.color?.name || null;
  const sizeLabel = variant?.sizeLabel || "Standard";
  return colorName ? `${productName} (${colorName}, ${sizeLabel})` : `${productName} (${sizeLabel})`;
}

/**
 * Deduct stock for order items by variant. Uses transaction.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx - Prisma transaction client
 * @param {Array<{ productId?: number, quantity: number, variantId?: number | null, sizeId?: number | null }>} items - Hydrated cart items with variant info
 * @throws {Error} If any variant has insufficient stock
 */
export async function deductStockForOrder(tx, items) {
  // Group by variant id so we deduct once per variant.
  const key = (item) => String(getVariantId(item));
  const byVariant = new Map();

  for (const item of items) {
    if (item.skipStockDeduction) continue;
    const qty = Math.max(0, Number(item.quantity) || 0);
    const variantId = getVariantId(item);
    if (!qty || !variantId) {
      throw new Error("Cart contains an item without a valid variant. Please refresh cart and try again.");
    }
    const k = key(item);
    byVariant.set(k, { ...item, variantId, quantity: (byVariant.get(k)?.quantity || 0) + qty });
  }

  const variantIds = [...new Set([...byVariant.values()].map((i) => i.variantId))];
  const variants = await tx.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: { select: { id: true, name: true } },
      color: { select: { name: true } },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (const item of byVariant.values()) {
    const variant = variantMap.get(item.variantId);
    if (!variant) {
      throw new Error("One or more selected variants are no longer available. Please refresh cart.");
    }
    if (item.productId != null && Number(item.productId) !== Number(variant.productId)) {
      throw new Error("Cart contains mismatched product variant. Please refresh cart.");
    }
    const qty = item.quantity;

    const result = await tx.productVariant.updateMany({
      where: { id: variant.id, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });

    if (result.count === 0) {
      const row = await tx.productVariant.findUnique({
        where: { id: variant.id },
        select: {
          stock: true,
          sizeLabel: true,
          product: { select: { name: true } },
          color: { select: { name: true } },
        },
      });
      const label = row
        ? `${row.product?.name || "Product"}${row.color?.name ? ` (${row.color.name}, ${row.sizeLabel})` : ` (${row.sizeLabel})`}`
        : variantLabel(variant);
      throw new Error(`Insufficient stock for "${label}". Available: ${Number(row?.stock ?? 0)}`);
    }
  }
}

/**
 * Validate that cart items have sufficient stock (read-only).
 * @param {Array<{ productId?: number, quantity: number, variantId?: number | null, sizeId?: number | null }>} items - Hydrated cart items
 * @returns {{ ok: boolean, error?: string }}
 */
export async function validateStockForItems(items) {
  const key = (item) => String(getVariantId(item));
  const byVariant = new Map();

  for (const item of items) {
    if (item.skipStockDeduction) continue;
    const qty = Math.max(0, Number(item.quantity) || 0);
    const variantId = getVariantId(item);
    if (!qty || !variantId) {
      return { ok: false, error: "Cart contains an item without a valid variant. Please refresh cart." };
    }
    const k = key(item);
    const existing = byVariant.get(k);
    byVariant.set(k, { ...item, variantId, quantity: (existing ? existing.quantity : 0) + qty });
  }

  const variantIds = [...new Set([...byVariant.values()].map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: { select: { id: true, name: true } },
      color: { select: { name: true } },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (const item of byVariant.values()) {
    const variant = variantMap.get(item.variantId);
    if (!variant) {
      return { ok: false, error: "One or more selected variants are no longer available. Please refresh cart." };
    }
    if (item.productId != null && Number(item.productId) !== Number(variant.productId)) {
      return { ok: false, error: "Cart contains mismatched product variant. Please refresh cart." };
    }

    const available = Math.max(0, Number(variant.stock ?? 0));
    const required = item.quantity;

    if (required > available) {
      const label = variantLabel(variant);
      return {
        ok: false,
        error: available === 0
          ? `"${label}" is out of stock`
          : `Insufficient stock for "${label}". Available: ${available}`,
      };
    }
  }

  return { ok: true };
}
