import prisma from "../prisma.js";

/**
 * Calculate price range (±20%)
 */
export function getPriceRange(product) {
  let basePrice = 0;
  if (product.sizes && product.sizes.length > 0) {
    const prices = product.sizes.map((s) => parseFloat(s.price));
    basePrice = Math.min(...prices);
  }
  const tolerance = basePrice * 0.2;
  return {
    min: Math.max(0, basePrice - tolerance),
    max: basePrice + tolerance,
    base: basePrice,
  };
}

/**
 * Get product price (for filtering)
 */
export function getProductPrice(product) {
  if (product.sizes && product.sizes.length > 0) {
    return Math.min(...product.sizes.map((s) => parseFloat(s.price)));
  }
  return 0;
}

const productInclude = {
  sizes: true,
  categories: { include: { category: true } },
};

/**
 * Main recommendation algorithm.
 * Priority: 1) Same category 2) Similar price 3) Popular (trending) 4) High-rated 5) Fallbacks.
 */
export async function getRecommendationsForProduct(productId, categoryIds, priceRange, limit) {
  const recommendations = [];
  const seen = new Set([productId]);

  // Priority 1: Same category + similar price
  const sameCategory = await prisma.product.findMany({
    where: {
      id: { not: productId },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    include: productInclude,
    orderBy: [{ isTrending: "desc" }, { createdAt: "desc" }],
    take: limit * 2,
  });

  for (const p of sameCategory) {
    if (recommendations.length >= limit) break;
    const price = getProductPrice(p);
    if (price >= priceRange.min && price <= priceRange.max && !seen.has(p.id)) {
      recommendations.push(p);
      seen.add(p.id);
    }
  }

  if (recommendations.length < limit) {
    for (const p of sameCategory) {
      if (recommendations.length >= limit) break;
      if (!seen.has(p.id)) {
        recommendations.push(p);
        seen.add(p.id);
      }
    }
  }

  // Priority 2: Popular (trending)
  if (recommendations.length < limit) {
    const trending = await prisma.product.findMany({
      where: { id: { not: productId }, isTrending: true },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }],
      take: limit * 2,
    });
    for (const p of trending) {
      if (recommendations.length >= limit) break;
      if (!seen.has(p.id)) {
        recommendations.push(p);
        seen.add(p.id);
      }
    }
  }

  // Priority 3: High-rated (products with reviews, by average rating)
  if (recommendations.length < limit) {
    const grouped = await prisma.review.groupBy({
      by: ["productId"],
      _avg: { rating: true },
      _count: { id: true },
    });
    const sorted = grouped
      .filter((r) => r.productId !== productId && !seen.has(r.productId))
      .sort((a, b) => (b._avg.rating ?? 0) - (a._avg.rating ?? 0))
      .slice(0, limit * 2);
    const ids = sorted.map((r) => r.productId);
    if (ids.length > 0) {
      const highRated = await prisma.product.findMany({
        where: { id: { in: ids } },
        include: productInclude,
      });
      const byId = new Map(highRated.map((p) => [p.id, p]));
      for (const id of ids) {
        if (recommendations.length >= limit) break;
        const p = byId.get(id);
        if (p && !seen.has(p.id)) {
          recommendations.push(p);
          seen.add(p.id);
        }
      }
    }
  }

  // Priority 4: New products
  if (recommendations.length < limit) {
    const newProducts = await prisma.product.findMany({
      where: { id: { not: productId }, isNew: true },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }],
      take: limit * 2,
    });
    for (const p of newProducts) {
      if (recommendations.length >= limit) break;
      if (!seen.has(p.id)) {
        recommendations.push(p);
        seen.add(p.id);
      }
    }
  }

  // Priority 5: Any product
  if (recommendations.length < limit) {
    const anyProducts = await prisma.product.findMany({
      where: { id: { not: productId } },
      include: productInclude,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: limit * 2,
    });
    for (const p of anyProducts) {
      if (recommendations.length >= limit) break;
      if (!seen.has(p.id)) {
        recommendations.push(p);
        seen.add(p.id);
      }
    }
  }

  return recommendations.slice(0, limit);
}
