import express from "express";
import { requireRole } from "../utils/auth.js";
import prisma from "../prisma.js";

const router = express.Router();
const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock) {
  const s = Number(stock ?? 0);
  if (s <= 0) return "Out of Stock";
  if (s <= LOW_STOCK_THRESHOLD) return "Low Stock";
  return "In Stock";
}

/**
 * GET /admin/inventory
 * Returns one row per product variant.
 * Each row: { productId, productName, variantType: 'variant', variantLabel, variantId, sku, stock, status, rowId }
 */
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ name: "asc" }],
      include: {
        variants: {
          include: { color: { select: { name: true } } },
          orderBy: [{ isActive: "desc" }, { id: "asc" }],
        },
      },
    });

    const list = [];
    for (const p of products) {
      const productName = p.name;

      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const stock = Math.max(0, Number(v.stock ?? 0));
          const colorName = v.color?.name || null;
          const sizeLabel = v.sizeLabel || "Standard";
          const variantLabel = colorName ? `${colorName} / ${sizeLabel}` : sizeLabel;

          list.push({
            productId: p.id,
            productName,
            variantType: "variant",
            variantLabel,
            variantId: v.id,
            sku: v.sku,
            colorName,
            sizeLabel,
            price: Number(v.price ?? 0),
            originalPrice: v.originalPrice != null ? Number(v.originalPrice) : null,
            isActive: Boolean(v.isActive),
            stock,
            status: getStockStatus(stock),
            rowId: `${p.id}_variant_${v.id}`,
          });
        }
      }
    }

    res.json(list);
  } catch (error) {
    console.error("Inventory list error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch inventory" });
  }
});

export default router;
