import express from "express";
import { requireRole } from "../utils/auth.js";
import prisma from "../prisma.js";
import { invalidateCache } from "../utils/cache.js";

const router = express.Router();

/** PUT /admin/products/update-stock/:id — body { stock, variantId: number } */
router.put("/update-stock/:id", requireRole("admin"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    let stock = req.body?.stock;
    const variantId = req.body?.variantId != null ? Number(req.body.variantId) : null;

    if (productId <= 0 || !Number.isInteger(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    if (stock === undefined || stock === null) {
      return res.status(400).json({ error: "stock is required" });
    }
    stock = Number(stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: "stock must be a non-negative integer" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (variantId != null) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { color: { select: { name: true } } },
      });
      if (!variant || variant.productId !== productId) {
        return res.status(404).json({ error: "Variant not found for this product" });
      }
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { stock },
      });
      invalidateCache("/products");
      return res.json({
        id: productId,
        variantType: "variant",
        variantId,
        stock,
        sizeLabel: variant.sizeLabel,
        colorName: variant.color?.name || null,
      });
    }

    return res.status(400).json({ error: "variantId is required" });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({ error: error.message || "Failed to update stock" });
  }
});

export default router;
