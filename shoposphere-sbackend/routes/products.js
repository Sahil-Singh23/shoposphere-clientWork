import express from "express";
import { requireRole } from "../utils/auth.js";
import { uploadProductMedia, getImageUrl, getVideoUrl } from "../utils/upload.js";
import prisma from "../prisma.js";
import { cacheMiddleware, invalidateCache } from "../utils/cache.js";
import { validateInstagramEmbeds } from "../utils/instagram.js";
import { getPriceRange, getRecommendationsForProduct } from "../utils/recommendationEngine.js";

const router = express.Router();

// Get all products (public) - Cached 5 min. Supports ?ids=1,2,3 for bulk fetch (preserves order).
router.get("/", cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const { category, isNew, isFestival, isTrending, search, ids: idsParam } = req.query;
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const limit = typeof limitRaw === "string" ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 0), 50) : 0;
    const offset = typeof offsetRaw === "string" ? Math.max(parseInt(offsetRaw, 10) || 0, 0) : 0;

    const requestedIds = typeof idsParam === "string"
      ? idsParam.split(",").map((id) => parseInt(id.trim(), 10)).filter((n) => !Number.isNaN(n))
      : [];

    // Build where clause
    const where = {};
    if (requestedIds.length > 0) {
      where.id = { in: requestedIds };
    }
    if (category) {
      where.categories = {
        some: {
          category: {
            slug: category
          }
        }
      };
    }
    if (isNew === "true") {
      where.isNew = true;
    }
    if (isFestival === "true") {
      where.isFestival = true;
    }
    if (isTrending === "true") {
      where.isTrending = true;
    }
    if (search) {
      // Search in name and description.
      const searchConditions = [
        { name: { contains: search } },
        { description: { contains: search } },
        { name: { startsWith: search } }, // Partial match at start
      ];

      where.OR = searchConditions;
    }

    const include = {
      sizes: true,
      categories: {
        include: {
          category: true,
        },
      },
    };

    const queryBase = {
      where,
      include,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    };

    let products = [];
    if (limit > 0) {
      const [items, total] = await prisma.$transaction([
        prisma.product.findMany({
          ...queryBase,
          skip: offset,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);
      products = items;
      res.setHeader("X-Total-Count", String(total));
      res.setHeader("X-Limit", String(limit));
      res.setHeader("X-Offset", String(offset));
    } else {
      products = await prisma.product.findMany(queryBase);
    }

    // Preserve order when fetching by ids
    if (requestedIds.length > 0 && products.length > 1) {
      const orderMap = new Map(requestedIds.map((id, i) => [id, i]));
      products.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }

    // Parse JSON fields
    const parsed = products.map(p => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
      videos: p.videos ? JSON.parse(p.videos) : [],
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
      categories: p.categories ? p.categories.map(pc => pc.category) : [],
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /products/top-rated — products with reviews, sorted by average rating (public)
router.get("/top-rated", cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 24);
    const grouped = await prisma.review.groupBy({
      by: ["productId"],
      _avg: { rating: true },
      _count: { id: true },
    });
    const sorted = grouped
      .sort((a, b) => (b._avg.rating ?? 0) - (a._avg.rating ?? 0))
      .slice(0, limit)
      .map((r) => r.productId);
    if (sorted.length === 0) {
      return res.json([]);
    }
    const products = await prisma.product.findMany({
      where: { id: { in: sorted } },
      include: { sizes: true, categories: { include: { category: true } } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = sorted.map((id) => byId.get(id)).filter(Boolean);
    const parsed = ordered.map((p) => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
      videos: p.videos ? JSON.parse(p.videos) : [],
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
      categories: p.categories ? p.categories.map((pc) => pc.category) : [],
    }));
    res.json(parsed);
  } catch (error) {
    console.error("Top-rated products error:", error);
    res.status(500).json({ error: "Failed to fetch top-rated products" });
  }
});

// GET /products/:id/recommendations — same category → similar price → popular → high-rated (public)
router.get("/:id/recommendations", cacheMiddleware(10 * 60 * 1000), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 4), 20);
    if (!productId || Number.isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
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
    const parsed = recommendations.map((p) => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
      videos: p.videos ? JSON.parse(p.videos) : [],
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
      categories: p.categories ? p.categories.map((pc) => pc.category) : [],
    }));
    res.json(parsed);
  } catch (error) {
    console.error("Product recommendations error:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// GET /products/:id/reviews — averageRating, totalReviews, reviews list (public)
router.get("/:id/reviews", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!productId || Number.isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
      },
    });
    const totalReviews = reviews.length;
    const sumRating = reviews.reduce((s, r) => s + r.rating, 0);
    const averageRating = totalReviews > 0 ? Math.round((sumRating / totalReviews) * 10) / 10 : 0;
    res.json({
      averageRating,
      totalReviews,
      reviews: reviews.map((r) => ({
        id: r.id,
        userName: r.user?.name ?? "Anonymous",
        rating: r.rating,
        comment: r.comment ?? "",
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Product reviews GET error:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get single product (public) - Cached for 5 minutes
router.get("/:id", cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: { 
        sizes: true,
        categories: {
          include: {
            category: true
          }
        }
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      ...product,
      images: product.images ? JSON.parse(product.images) : [],
      videos: product.videos ? JSON.parse(product.videos) : [],
      instagramEmbeds: product.instagramEmbeds ? JSON.parse(product.instagramEmbeds) : [],
      keywords: product.keywords ? JSON.parse(product.keywords) : [],
      categories: product.categories ? product.categories.map(pc => pc.category) : [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add product (Admin only)
router.post("/", requireRole("admin"), uploadProductMedia, async (req, res) => {
  try {
    // Invalidate products cache on create
    invalidateCache("/products");
    
    const { name, description, badge, isFestival, isNew, isTrending, isReady60Min, originalPrice, categoryIds, sizes, keywords, existingImages, existingVideos, instagramEmbeds } = req.body;

    // Upload images; for duplicate/create, existingImages can provide initial URLs
    let imageUrls = [];
    if (existingImages) {
      try {
        const parsed = typeof existingImages === "string" ? JSON.parse(existingImages) : existingImages;
        if (Array.isArray(parsed)) imageUrls = parsed;
      } catch (_) {}
    }
    const imageFiles = req.files?.images || [];
    for (const file of imageFiles) {
      const url = await getImageUrl(file);
      imageUrls.push(url);
    }
    // Upload videos; existingVideos can provide initial URLs (e.g. duplicate)
    let videoUrls = [];
    if (existingVideos) {
      try {
        const parsed = typeof existingVideos === "string" ? JSON.parse(existingVideos) : existingVideos;
        if (Array.isArray(parsed)) videoUrls = parsed;
      } catch (_) {}
    }
    const videoFiles = req.files?.videos || [];
    for (const file of videoFiles) {
      const url = await getVideoUrl(file);
      videoUrls.push(url);
    }

    // Parse sizes, keywords, and Instagram embeds
    const sizesArray = sizes ? JSON.parse(sizes) : [];
    const keywordsArray = keywords ? JSON.parse(keywords) : [];
    const instagramEmbedsArray = instagramEmbeds ? JSON.parse(instagramEmbeds) : [];
    const validatedInstagramEmbeds = validateInstagramEmbeds(instagramEmbedsArray);

    // Convert price strings to floats for sizes; support originalPrice (MRP) and stock
    const sizesWithFloatPrices = sizesArray.map(size => ({
      label: size.label,
      price: parseFloat(size.price) || 0,
      originalPrice: size.originalPrice != null && size.originalPrice !== "" ? parseFloat(size.originalPrice) : null,
      stock: Math.max(0, parseInt(size.stock, 10) || 0),
    }));

    if (!sizesWithFloatPrices.length) {
      return res.status(400).json({ error: "At least one size is required" });
    }
    const categoryIdsArray = categoryIds ? JSON.parse(categoryIds) : [];

    const product = await prisma.product.create({
      data: {
        name,
        description,
        badge: badge || null,
        isFestival: isFestival === "true" || isFestival === true,
        isNew: isNew === "true" || isNew === true,
        isTrending: isTrending === "true" || isTrending === true,
        isReady60Min: isReady60Min === "true" || isReady60Min === true,
        originalPrice: originalPrice != null && originalPrice !== "" ? parseFloat(originalPrice) : null,
        images: JSON.stringify(imageUrls),
        videos: videoUrls.length > 0 ? JSON.stringify(videoUrls) : null,
        instagramEmbeds: validatedInstagramEmbeds.length > 0 ? JSON.stringify(validatedInstagramEmbeds) : null,
        keywords: JSON.stringify(keywordsArray),
        categories: {
          create: categoryIdsArray.map(categoryId => ({
            categoryId: Number(categoryId)
          }))
        },
        sizes: {
          create: sizesWithFloatPrices,
        }
      },
      include: {
        sizes: true,
        categories: {
          include: {
            category: true
          }
        }
      },
    });

    res.json({
      ...product,
      images: imageUrls,
      videos: videoUrls,
      keywords: keywordsArray,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update product (Admin only)
router.put("/:id", requireRole("admin"), uploadProductMedia, async (req, res) => {
  try {
    // Invalidate products cache on update
    invalidateCache("/products");
    
    const { name, description, badge, isFestival, isNew, isTrending, isReady60Min, originalPrice, categoryIds, sizes, keywords, existingImages, existingVideos, instagramEmbeds } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Handle images
    let imageUrls = existingImages ? JSON.parse(existingImages) : [];
    const imageFiles = req.files?.images || [];
    for (const file of imageFiles) {
      const url = await getImageUrl(file);
      imageUrls.push(url);
    }
    // Handle videos
    let videoUrls = existingVideos ? JSON.parse(existingVideos) : [];
    const videoFiles = req.files?.videos || [];
    for (const file of videoFiles) {
      const url = await getVideoUrl(file);
      videoUrls.push(url);
    }

    // Parse sizes, keywords, and Instagram embeds
    const sizesArray = sizes ? JSON.parse(sizes) : [];
    const keywordsArray = keywords ? JSON.parse(keywords) : [];
    const instagramEmbedsArray = instagramEmbeds ? JSON.parse(instagramEmbeds) : [];
    const validatedInstagramEmbeds = validateInstagramEmbeds(instagramEmbedsArray);

    // Convert price strings to floats for sizes; support originalPrice (MRP) and stock
    const sizesWithFloatPrices = sizesArray.map(size => ({
      label: size.label,
      price: parseFloat(size.price) || 0,
      originalPrice: size.originalPrice != null && size.originalPrice !== "" ? parseFloat(size.originalPrice) : null,
      stock: Math.max(0, parseInt(size.stock, 10) || 0),
    }));

    if (!sizesWithFloatPrices.length) {
      return res.status(400).json({ error: "At least one size is required" });
    }
    await prisma.productSize.deleteMany({
      where: { productId: Number(req.params.id) },
    });

    // Delete old category links
    await prisma.productCategory.deleteMany({
      where: { productId: Number(req.params.id) },
    });

    // Parse category IDs
    const categoryIdsArray = categoryIds ? JSON.parse(categoryIds) : [];

    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        description,
        badge: badge || null,
        isFestival: isFestival === "true" || isFestival === true,
        isNew: isNew === "true" || isNew === true,
        isTrending: isTrending === "true" || isTrending === true,
        isReady60Min: isReady60Min === "true" || isReady60Min === true,
        originalPrice: originalPrice != null && originalPrice !== "" ? parseFloat(originalPrice) : null,
        images: JSON.stringify(imageUrls),
        videos: videoUrls.length > 0 ? JSON.stringify(videoUrls) : null,
        instagramEmbeds: validatedInstagramEmbeds.length > 0 ? JSON.stringify(validatedInstagramEmbeds) : null,
        keywords: JSON.stringify(keywordsArray),
        categories: {
          create: categoryIdsArray.map(categoryId => ({
            categoryId: Number(categoryId)
          }))
        },
        sizes: {
          create: sizesWithFloatPrices,
        }
      },
      include: {
        sizes: true,
        categories: {
          include: {
            category: true
          }
        }
      },
    });

    res.json({
      ...product,
      images: imageUrls,
      videos: videoUrls,
      instagramEmbeds: validatedInstagramEmbeds,
      keywords: keywordsArray,
      categories: product.categories ? product.categories.map(pc => pc.category) : [],
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update order for multiple products (Admin only)
router.post("/reorder", requireRole("admin"), async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array" });
    }

    // Invalidate products cache
    invalidateCache("/products");

    // Update all products in a transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.product.update({
          where: { id: Number(item.id) },
          data: { order: Number(item.order) },
        })
      )
    );

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("Reorder products error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Admin only)
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    // Invalidate products cache on delete
    invalidateCache("/products");
    
    await prisma.product.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
