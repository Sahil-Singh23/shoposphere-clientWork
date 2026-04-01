import express from "express";
import prisma from "../prisma.js";
import { cacheMiddleware } from "../utils/cache.js";
import { getPriceRange, getRecommendationsForProduct } from "../utils/recommendationEngine.js";

const router = express.Router();

/**
 * GET /recommendations/:productId?limit=10
 * Returns product recommendations: same category → similar price → popular → high-rated → fallbacks.
 */
router.get("/:productId", cacheMiddleware(10 * 60 * 1000), async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 4), 20);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: { include: { category: true } },
        sizes: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const categoryIds = product.categories.map((pc) => pc.category.id);
    const priceRange = getPriceRange(product);

    const recommendations = await getRecommendationsForProduct(
      productId,
      categoryIds,
      priceRange,
      limit
    );

    res.json(recommendations);
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

export default router;
