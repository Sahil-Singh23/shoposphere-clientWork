import express from "express";
import { requireRole } from "../utils/auth.js";
import { uploadProductMedia, getImageUrl, getVideoUrl } from "../utils/upload.js";
import prisma from "../prisma.js";
import { cacheMiddleware, invalidateCache } from "../utils/cache.js";
import { validateInstagramEmbeds } from "../utils/instagram.js";
import { getPriceRange, getRecommendationsForProduct } from "../utils/recommendationEngine.js";

const router = express.Router();
const COLOR_UPLOAD_TOKEN_PREFIX = "__COLOR_UPLOAD_";

function deriveSizesFromVariants(variants = []) {
  const byLabel = new Map();
  for (const v of variants) {
    if (!v?.sizeLabel) continue;
    const key = String(v.sizeLabel).trim();
    if (!key) continue;
    if (!byLabel.has(key)) {
      byLabel.set(key, {
        id: v.id,
        label: key,
        price: Number(v.price || 0),
        originalPrice: v.originalPrice != null ? Number(v.originalPrice) : null,
        stock: Math.max(0, Number(v.stock || 0)),
      });
      continue;
    }
    const current = byLabel.get(key);
    const nextPrice = Number(v.price || 0);
    if (nextPrice < current.price) {
      current.price = nextPrice;
      current.id = v.id;
      current.originalPrice = v.originalPrice != null ? Number(v.originalPrice) : current.originalPrice;
    }
    current.stock += Math.max(0, Number(v.stock || 0));
  }
  return [...byLabel.values()];
}

function normalizeProductResponse(p) {
  return {
    ...p,
    images: p.images ? JSON.parse(p.images) : [],
    videos: p.videos ? JSON.parse(p.videos) : [],
    instagramEmbeds: p.instagramEmbeds ? JSON.parse(p.instagramEmbeds) : [],
    keywords: p.keywords ? JSON.parse(p.keywords) : [],
    categories: p.categories ? p.categories.map((pc) => pc.category) : [],
    sizes: deriveSizesFromVariants(p.variants || []),
  };
}

function buildVariantsFromSizes(sizesArray = [], productName = "SKU") {
  return sizesArray
    .filter((size) => String(size?.label || "").trim() !== "")
    .map((size, idx) => {
      const label = String(size.label).trim();
      const price = parseFloat(size.price) || 0;
      const originalPrice = size.originalPrice != null && size.originalPrice !== "" ? parseFloat(size.originalPrice) : null;
      const stock = Math.max(0, parseInt(size.stock, 10) || 0);
      const safeName = String(productName || "SKU")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
      const base = safeName || "SKU";
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();

      return {
        sizeLabel: label,
        price,
        originalPrice,
        stock,
        sku: `${base}-${idx + 1}-${random}`,
      };
    });
}

function parseJsonArray(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeColorInput(colorsArray = []) {
  return colorsArray
    .map((c, idx) => ({
      key: c?.key != null && String(c.key).trim() !== "" ? String(c.key).trim() : `c-${idx + 1}`,
      name: String(c?.name || "").trim(),
      hexCode: String(c?.hexCode || "").trim() || "#000000",
      photoUrl: String(c?.photoUrl || "").trim(),
      order: Number.isInteger(Number(c?.order)) ? Number(c.order) : idx,
    }))
    .filter((c) => c.name && c.photoUrl);
}

function normalizeVariantInput(variantsArray = [], productName = "SKU") {
  return variantsArray
    .map((v, idx) => {
      const sizeLabel = String(v?.sizeLabel || v?.label || "").trim();
      const price = parseFloat(v?.price) || 0;
      const originalPrice = v?.originalPrice != null && v?.originalPrice !== "" ? parseFloat(v.originalPrice) : null;
      const stock = Math.max(0, parseInt(v?.stock, 10) || 0);
      const explicitSku = String(v?.sku || "").trim();
      const safeName = String(productName || "SKU")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
      const base = safeName || "SKU";
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const sku = explicitSku || `${base}-${idx + 1}-${random}`;

      return {
        sizeLabel,
        price,
        originalPrice,
        stock,
        sku,
        colorKey: v?.colorKey != null ? String(v.colorKey).trim() : "",
        colorName: v?.colorName != null ? String(v.colorName).trim() : "",
        colorId: v?.colorId != null && Number.isInteger(Number(v.colorId)) ? Number(v.colorId) : null,
      };
    })
    .filter((v) => v.sizeLabel && v.price > 0);
}

function didVariantSpecifyColor(v) {
  return Boolean(v.colorId || v.colorKey || v.colorName);
}

async function resolveColorPhotos(colorsToCreate = [], colorPhotoFiles = []) {
  if (!colorsToCreate.length) return colorsToCreate;

  const uploadedUrls = [];
  for (const file of colorPhotoFiles) {
    const url = await getImageUrl(file);
    uploadedUrls.push(url);
  }

  let fallbackCursor = 0;
  return colorsToCreate.map((c) => {
    let resolved = c.photoUrl;
    if (resolved?.startsWith(COLOR_UPLOAD_TOKEN_PREFIX) && resolved.endsWith("__")) {
      const idxRaw = resolved.slice(COLOR_UPLOAD_TOKEN_PREFIX.length, -2);
      const idx = Number(idxRaw);
      if (Number.isInteger(idx) && idx >= 0 && idx < uploadedUrls.length) {
        resolved = uploadedUrls[idx];
      } else {
        resolved = "";
      }
    }
    if (!resolved && fallbackCursor < uploadedUrls.length) {
      resolved = uploadedUrls[fallbackCursor++];
    }
    return { ...c, photoUrl: resolved };
  });
}

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
      variants: { include: { color: true } },
      colors: true,
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
    const parsed = products.map(normalizeProductResponse);

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
      include: {
        variants: { include: { color: true } },
        colors: true,
        categories: { include: { category: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = sorted.map((id) => byId.get(id)).filter(Boolean);
    const parsed = ordered.map(normalizeProductResponse);
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
        variants: { include: { color: true } },
        colors: true,
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
    const parsed = recommendations.map(normalizeProductResponse);
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
        variants: { include: { color: true } },
        colors: true,
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

    res.json(normalizeProductResponse(product));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add product (Admin only)
router.post("/", requireRole("admin"), uploadProductMedia, async (req, res) => {
  try {
    // Invalidate products cache on create
    invalidateCache("/products");
    
    const {
      name,
      description,
      badge,
      isFestival,
      isNew,
      isTrending,
      isReady60Min,
      originalPrice,
      categoryIds,
      sizes,
      variants,
      colors,
      keywords,
      existingImages,
      existingVideos,
      instagramEmbeds,
    } = req.body;

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
    const colorPhotoFiles = req.files?.colorPhotos || [];
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
    const sizesArray = parseJsonArray(sizes);
    const variantsArrayRaw = parseJsonArray(variants);
    const colorsArrayRaw = parseJsonArray(colors);
    const keywordsArray = parseJsonArray(keywords);
    const instagramEmbedsArray = parseJsonArray(instagramEmbeds);
    const validatedInstagramEmbeds = validateInstagramEmbeds(instagramEmbedsArray);

    let colorsToCreate = normalizeColorInput(colorsArrayRaw);
    colorsToCreate = await resolveColorPhotos(colorsToCreate, colorPhotoFiles);
    colorsToCreate = colorsToCreate.filter((c) => c.name && c.photoUrl);
    const hasExplicitVariants = variantsArrayRaw.length > 0;
    const variantsToCreate = hasExplicitVariants
      ? normalizeVariantInput(variantsArrayRaw, name)
      : buildVariantsFromSizes(sizesArray, name);

    if (!variantsToCreate.length) {
      return res.status(400).json({ error: "At least one variant is required" });
    }

    if (colorsToCreate.length > 0) {
      imageUrls = [...new Set(colorsToCreate.map((c) => c.photoUrl).filter(Boolean))];
    }
    const categoryIdsArray = parseJsonArray(categoryIds);

    const skuSet = new Set();
    for (const v of variantsToCreate) {
      const skuKey = String(v.sku).toUpperCase();
      if (skuSet.has(skuKey)) {
        return res.status(400).json({ error: `Duplicate SKU in request: ${v.sku}` });
      }
      skuSet.add(skuKey);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
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
            create: categoryIdsArray.map((categoryId) => ({
              categoryId: Number(categoryId),
            })),
          },
        },
        select: { id: true },
      });

      const colorByKey = new Map();
      const colorByName = new Map();
      for (const c of colorsToCreate) {
        const createdColor = await tx.productColor.create({
          data: {
            productId: created.id,
            name: c.name,
            hexCode: c.hexCode,
            photoUrl: c.photoUrl,
            order: c.order,
          },
        });
        colorByKey.set(c.key, createdColor.id);
        colorByName.set(c.name.toLowerCase(), createdColor.id);
      }

      for (const v of variantsToCreate) {
        let resolvedColorId = null;
        if (colorByKey.size > 0 || colorByName.size > 0) {
          if (v.colorKey && colorByKey.has(v.colorKey)) resolvedColorId = colorByKey.get(v.colorKey);
          if (resolvedColorId == null && v.colorName && colorByName.has(v.colorName.toLowerCase())) {
            resolvedColorId = colorByName.get(v.colorName.toLowerCase());
          }
        }
        if (didVariantSpecifyColor(v) && resolvedColorId == null) {
          throw new Error(`Variant color mapping failed for size "${v.sizeLabel}"`);
        }

        await tx.productVariant.create({
          data: {
            productId: created.id,
            colorId: resolvedColorId,
            sizeLabel: v.sizeLabel,
            price: v.price,
            originalPrice: v.originalPrice,
            stock: v.stock,
            sku: v.sku,
          },
        });
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: {
          variants: { include: { color: true } },
          colors: true,
          categories: { include: { category: true } },
        },
      });
    });

    if (!product) {
      return res.status(500).json({ error: "Failed to create product" });
    }

    res.json({
      ...normalizeProductResponse(product),
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
    
    const {
      name,
      description,
      badge,
      isFestival,
      isNew,
      isTrending,
      isReady60Min,
      originalPrice,
      categoryIds,
      sizes,
      variants,
      colors,
      keywords,
      existingImages,
      existingVideos,
      instagramEmbeds,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Handle images
    let imageUrls = parseJsonArray(existingImages);
    const imageFiles = req.files?.images || [];
    for (const file of imageFiles) {
      const url = await getImageUrl(file);
      imageUrls.push(url);
    }
    const colorPhotoFiles = req.files?.colorPhotos || [];
    // Handle videos
    let videoUrls = parseJsonArray(existingVideos);
    const videoFiles = req.files?.videos || [];
    for (const file of videoFiles) {
      const url = await getVideoUrl(file);
      videoUrls.push(url);
    }

    // Parse sizes, keywords, and Instagram embeds
    const sizesArray = parseJsonArray(sizes);
    const variantsArrayRaw = parseJsonArray(variants);
    const colorsArrayRaw = parseJsonArray(colors);
    const keywordsArray = parseJsonArray(keywords);
    const instagramEmbedsArray = parseJsonArray(instagramEmbeds);
    const validatedInstagramEmbeds = validateInstagramEmbeds(instagramEmbedsArray);

    let colorsToCreate = normalizeColorInput(colorsArrayRaw);
    colorsToCreate = await resolveColorPhotos(colorsToCreate, colorPhotoFiles);
    colorsToCreate = colorsToCreate.filter((c) => c.name && c.photoUrl);
    const hasExplicitVariants = variantsArrayRaw.length > 0;
    const variantsToCreate = hasExplicitVariants
      ? normalizeVariantInput(variantsArrayRaw, name || existingProduct.name)
      : buildVariantsFromSizes(sizesArray, name || existingProduct.name);

    if (!variantsToCreate.length) {
      return res.status(400).json({ error: "At least one variant is required" });
    }

    if (colorsToCreate.length > 0) {
      imageUrls = [...new Set(colorsToCreate.map((c) => c.photoUrl).filter(Boolean))];
    }
    const skuSet = new Set();
    for (const v of variantsToCreate) {
      const skuKey = String(v.sku).toUpperCase();
      if (skuSet.has(skuKey)) {
        return res.status(400).json({ error: `Duplicate SKU in request: ${v.sku}` });
      }
      skuSet.add(skuKey);
    }

    const categoryIdsArray = parseJsonArray(categoryIds);
    const productId = Number(req.params.id);

    const product = await prisma.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId } });
      await tx.productCategory.deleteMany({ where: { productId } });

      const updated = await tx.product.update({
        where: { id: productId },
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
            create: categoryIdsArray.map((categoryId) => ({
              categoryId: Number(categoryId),
            })),
          },
        },
        select: { id: true },
      });

      let existingColors = await tx.productColor.findMany({ where: { productId } });
      if (colorsArrayRaw.length > 0) {
        await tx.productColor.deleteMany({ where: { productId } });
        existingColors = [];
        for (const c of colorsToCreate) {
          const createdColor = await tx.productColor.create({
            data: {
              productId,
              name: c.name,
              hexCode: c.hexCode,
              photoUrl: c.photoUrl,
              order: c.order,
            },
          });
          existingColors.push(createdColor);
        }
      }

      const colorByKey = new Map();
      const colorByName = new Map();
      for (const c of colorsToCreate) {
        const found = existingColors.find((ec) => ec.name.toLowerCase() === c.name.toLowerCase());
        if (!found) continue;
        colorByKey.set(c.key, found.id);
        colorByName.set(c.name.toLowerCase(), found.id);
      }
      const colorById = new Map(existingColors.map((c) => [c.id, c.id]));
      for (const c of existingColors) {
        if (!colorByName.has(c.name.toLowerCase())) {
          colorByName.set(c.name.toLowerCase(), c.id);
        }
      }

      for (const v of variantsToCreate) {
        let resolvedColorId = null;
        if (v.colorId != null && colorById.has(v.colorId)) {
          resolvedColorId = v.colorId;
        }
        if (resolvedColorId == null && v.colorKey && colorByKey.has(v.colorKey)) {
          resolvedColorId = colorByKey.get(v.colorKey);
        }
        if (resolvedColorId == null && v.colorName && colorByName.has(v.colorName.toLowerCase())) {
          resolvedColorId = colorByName.get(v.colorName.toLowerCase());
        }
        if (didVariantSpecifyColor(v) && resolvedColorId == null) {
          throw new Error(`Variant color mapping failed for size "${v.sizeLabel}"`);
        }

        await tx.productVariant.create({
          data: {
            productId: updated.id,
            colorId: resolvedColorId,
            sizeLabel: v.sizeLabel,
            price: v.price,
            originalPrice: v.originalPrice,
            stock: v.stock,
            sku: v.sku,
          },
        });
      }

      return tx.product.findUnique({
        where: { id: updated.id },
        include: {
          variants: { include: { color: true } },
          colors: true,
          categories: { include: { category: true } },
        },
      });
    });

    if (!product) {
      return res.status(500).json({ error: "Failed to update product" });
    }

    res.json({
      ...normalizeProductResponse(product),
      images: imageUrls,
      videos: videoUrls,
      instagramEmbeds: validatedInstagramEmbeds,
      keywords: keywordsArray,
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
