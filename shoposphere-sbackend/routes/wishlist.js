import express from "express";
import prisma from "../prisma.js";
import { requireCustomerAuth } from "../utils/auth.js";

const router = express.Router();

/** GET /wishlist — Fetch authenticated user's wishlist (products with full details). */
router.get("/", requireCustomerAuth, async (req, res) => {
  try {
    const userId = req.customerUserId;
    const items = await prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: { variants: true, colors: true },
        },
      },
    });
    const list = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: item.product,
    }));
    res.json(list);
  } catch (error) {
    console.error("Wishlist GET error:", error);
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

/** POST /wishlist/add — Add product to wishlist. Body: { productId }. Prevents duplicates. */
router.post("/add", requireCustomerAuth, async (req, res) => {
  try {
    const userId = req.customerUserId;
    const productId = Number(req.body?.productId);
    if (!productId || Number.isNaN(productId)) {
      return res.status(400).json({ error: "productId is required" });
    }
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      return res.status(200).json({ message: "Already in wishlist", item: existing });
    }
    const item = await prisma.wishlist.create({
      data: { userId, productId },
      include: { product: true },
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("Wishlist add error:", error);
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

/** DELETE /wishlist/remove/:productId — Remove product from wishlist. */
router.delete("/remove/:productId", requireCustomerAuth, async (req, res) => {
  try {
    const userId = req.customerUserId;
    const productId = Number(req.params.productId);
    if (!productId || Number.isNaN(productId)) {
      return res.status(400).json({ error: "Invalid productId" });
    }
    await prisma.wishlist.deleteMany({
      where: { userId, productId },
    });
    res.status(200).json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error("Wishlist remove error:", error);
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

export default router;
