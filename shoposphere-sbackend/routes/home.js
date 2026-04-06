import express from "express";
import prisma from "../prisma.js";
import { cacheMiddleware } from "../utils/cache.js";
import { publicBrowseRateLimiter } from "../utils/rateLimit.js";

const router = express.Router();

const HOME_PRODUCT_LIMIT = 40;
const HOME_REEL_LIMIT = 16;

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function deriveSizesFromVariants(variants = []) {
  const byLabel = new Map();
  for (const v of variants) {
    if (!v?.sizeLabel) continue;
    const label = String(v.sizeLabel).trim() || "Standard";
    const price = Number(v.price || 0);
    const stock = Math.max(0, Number(v.stock || 0));
    const originalPrice = v.originalPrice != null && v.originalPrice !== "" ? Number(v.originalPrice) : null;

    if (!byLabel.has(label)) {
      byLabel.set(label, {
        id: v.id,
        label,
        price,
        originalPrice,
        stock,
      });
      continue;
    }

    const current = byLabel.get(label);
    current.stock += stock;
    if (price < current.price) {
      current.id = v.id;
      current.price = price;
      current.originalPrice = originalPrice != null ? originalPrice : current.originalPrice;
    }
  }
  return [...byLabel.values()];
}

function compactHomeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    images: parseJsonArray(p.images),
    categories: (p.categories || []).map((pc) => ({
      id: pc.category.id,
      name: pc.category.name,
      slug: pc.category.slug,
    })),
    colors: (p.colors || []).map((c) => ({
      id: c.id,
      name: c.name,
      hexCode: c.hexCode,
    })),
    sizes: deriveSizesFromVariants(p.variants || []),
  };
}

function compactHomeReel(reel) {
  return {
    id: reel.id,
    title: reel.title,
    url: reel.url,
    thumbnail: reel.thumbnail,
    platform: reel.platform,
    videoUrl: reel.videoUrl,
    isTrending: reel.isTrending,
    isFeatured: reel.isFeatured,
    discountPct: reel.discountPct,
    placement: reel.placement,
    product: reel.product ? compactHomeProduct(reel.product) : null,
  };
}

/**
 * GET /home — Single request for homepage: categories, products, reels.
 * Keeps payload compact and avoids duplicate banner fetches handled by BannerSlider.
 * Cached 5 minutes.
 */
router.get("/", publicBrowseRateLimiter, cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const [categories, products, reels] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          _count: { select: { products: true } },
        },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          images: true,
          variants: {
            select: {
              id: true,
              sizeLabel: true,
              price: true,
              originalPrice: true,
              stock: true,
            },
          },
          colors: {
            select: {
              id: true,
              name: true,
              hexCode: true,
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: HOME_PRODUCT_LIMIT,
      }),
      prisma.reel.findMany({
        where: { isActive: true, placement: "home" },
        orderBy: { order: "asc" },
        take: HOME_REEL_LIMIT,
        select: {
          id: true,
          title: true,
          url: true,
          thumbnail: true,
          platform: true,
          videoUrl: true,
          isTrending: true,
          isFeatured: true,
          discountPct: true,
          placement: true,
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              variants: {
                select: {
                  id: true,
                  sizeLabel: true,
                  price: true,
                  originalPrice: true,
                  stock: true,
                },
              },
              colors: {
                select: {
                  id: true,
                  name: true,
                  hexCode: true,
                },
              },
              categories: {
                select: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    res.json({
      categories,
      products: products.map(compactHomeProduct),
      reels: reels.map(compactHomeReel),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
