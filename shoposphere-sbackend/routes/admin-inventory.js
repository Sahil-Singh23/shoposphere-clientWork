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
 * Returns one row per size variant.
 * Each row: { productId, productName, variantType: 'size', variantLabel, sizeId, stock, status, rowId }
 */
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ name: "asc" }],
      include: { sizes: true },
    });

    const list = [];
    for (const p of products) {
      const productName = p.name;

      // Size variants
      if (p.sizes && p.sizes.length > 0) {
        for (const s of p.sizes) {
          const stock = Math.max(0, Number(s.stock ?? 0));
          list.push({
            productId: p.id,
            productName,
            variantType: "size",
            variantLabel: s.label,
            sizeId: s.id,
            stock,
            status: getStockStatus(stock),
            rowId: `${p.id}_size_${s.id}`,
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
