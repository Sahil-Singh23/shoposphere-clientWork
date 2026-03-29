import prisma from "../prisma.js";

/**
 * Get effective stock for a single item (by variant: size or product-level).
 * @param {object} product - Product with sizes
 * @param {{ sizeId?: number | null }} variant
 * @returns {number}
 */
function getVariantStock(product, variant) {
  const sizeId = variant.sizeId != null && variant.sizeId !== 0 ? Number(variant.sizeId) : null;
  if (sizeId && product.sizes?.length) {
    const size = product.sizes.find((s) => s.id === sizeId);
    if (size) return Math.max(0, Number(size.stock ?? 0));
    return 0;
  }
  return Math.max(0, Number(product.stock ?? 0));
}

/**
 * Deduct stock for order items by variant (size / product). Uses transaction.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx - Prisma transaction client
 * @param {Array<{ productId: number, quantity: number, sizeId?: number | null }>} items - Hydrated cart items with variant info
 * @throws {Error} If any variant has insufficient stock
 */
export async function deductStockForOrder(tx, items) {
  // Group by variant key so we deduct once per (productId, sizeId)
  const key = (item) => `${item.productId}|${item.sizeId ?? ""}`;
  const byVariant = new Map();
  for (const item of items) {
    if (item.skipStockDeduction) continue;
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (!qty || !item.productId) continue;
    const k = key(item);
    byVariant.set(k, { ...item, quantity: (byVariant.get(k)?.quantity || 0) + qty });
  }

  const productIds = [...new Set([...byVariant.values()].map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { sizes: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of byVariant.values()) {
    const product = productMap.get(item.productId);
    if (!product) throw new Error("Product not found");

    const sizeId = item.sizeId != null && item.sizeId !== 0 ? Number(item.sizeId) : null;
    const qty = item.quantity;

    if (sizeId) {
      const size = product.sizes?.find((s) => s.id === sizeId);
      if (!size) throw new Error(`Size not found for "${product.name}"`);
      const result = await tx.productSize.updateMany({
        where: { id: sizeId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (result.count === 0) {
        const row = await tx.productSize.findUnique({ where: { id: sizeId }, select: { stock: true } });
        throw new Error(
          `Insufficient stock for "${product.name}" (${size.label}). Available: ${Number(row?.stock ?? 0)}`
        );
      }
      continue;
    }

    const result = await tx.product.updateMany({
      where: { id: product.id, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (result.count === 0) {
      const p = await tx.product.findUnique({
        where: { id: product.id },
        select: { name: true, stock: true },
      });
      throw new Error(
        p
          ? `Insufficient stock for "${p.name}". Available: ${p.stock}`
          : "Insufficient stock for one or more items"
      );
    }
  }
}

/**
 * Validate that cart items have sufficient stock (read-only). Items must include sizeId when applicable.
 * @param {Array<{ productId: number, quantity: number, sizeId?: number | null }>} items - Hydrated cart items
 * @returns {{ ok: boolean, error?: string }}
 */
export async function validateStockForItems(items) {
  const key = (item) => `${item.productId}|${item.sizeId ?? ""}`;
  const byVariant = new Map();
  for (const item of items) {
    if (item.skipStockDeduction) continue;
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (!qty || !item.productId) continue;
    const k = key(item);
    const existing = byVariant.get(k);
    byVariant.set(k, { ...item, quantity: (existing ? existing.quantity : 0) + qty });
  }

  const productIds = [...new Set([...byVariant.values()].map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { sizes: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of byVariant.values()) {
    const product = productMap.get(item.productId);
    if (!product) {
      return { ok: false, error: "One or more products are no longer available" };
    }
    const available = getVariantStock(product, { sizeId: item.sizeId });
    const required = item.quantity;
    if (required > available) {
      const label = product.sizes?.find((s) => s.id === item.sizeId)?.label || "item";
      return {
        ok: false,
        error: available === 0
          ? `"${product.name}" (${label}) is out of stock`
          : `Insufficient stock for "${product.name}" (${label}). Available: ${available}`,
      };
    }
  }
  return { ok: true };
}
