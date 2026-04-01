import express from "express";
import { requireRole } from "../utils/auth.js";
import upload, { getImageUrl } from "../utils/upload.js";
import prisma from "../prisma.js";
import { cacheMiddleware, invalidateCache } from "../utils/cache.js";
const router = express.Router();

// Get all categories (public) - Cached for 5 minutes
router.get("/", cacheMiddleware(5 * 60 * 1000), async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single category (public)
router.get("/:id", async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: Number(req.params.id) },
      include: { products: { include: { variants: true, colors: true } } },
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category (Admin only)
router.post("/", requireRole("admin"), upload.single("image"), async (req, res) => {
  try {
    // Invalidate categories cache on create
    invalidateCache("/categories");
    
    const { name, slug, description, order } = req.body;
    
    let imageUrl = null;
    if (req.file) {
      imageUrl = await getImageUrl(req.file);
    }

    const category = await prisma.category.create({
      data: { 
        name, 
        slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
        description: description || null,
        imageUrl: imageUrl || null,
        order: order !== undefined && order !== null && order !== "" ? Number(order) : 0,
      },
    });
    res.json(category);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Slug already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update category (Admin only)
router.put("/:id", requireRole("admin"), upload.single("image"), async (req, res) => {
  try {
    // Invalidate categories cache on update
    invalidateCache("/categories");
    
    const { name, slug, description, existingImageUrl, order } = req.body;
    
    let imageUrl = existingImageUrl || null;
    if (req.file) {
      imageUrl = await getImageUrl(req.file);
    }

    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { 
        name, 
        slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
        description: description || null,
        imageUrl: imageUrl || null,
        order: order !== undefined && order !== null && order !== "" ? Number(order) : 0,
      },
    });
    res.json(category);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Slug already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update order for multiple categories (Admin only)
router.post("/reorder", requireRole("admin"), async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array" });
    }

    // Invalidate categories cache
    invalidateCache("/categories");

    // Update all categories in a transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.category.update({
          where: { id: Number(item.id) },
          data: { order: Number(item.order) },
        })
      )
    );

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("Reorder categories error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete category (Admin only)
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    
    // Check if any products are using this category (Product links via ProductCategory)
    const productsCount = await prisma.product.count({
      where: { categories: { some: { categoryId } } },
    });
    
    if (productsCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. ${productsCount} product(s) are still using this category. Please delete or reassign the products first.` 
      });
    }
    
    // Invalidate categories cache on delete
    invalidateCache("/categories");
    
    await prisma.category.delete({
      where: { id: categoryId },
    });
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    // Handle Prisma foreign key constraint error
    if (error.code === "P2003") {
      return res.status(400).json({ 
        message: "Cannot delete category. It is still being used by products. Please delete or reassign the products first." 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
