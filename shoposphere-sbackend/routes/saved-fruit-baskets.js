import express from "express";
import prisma from "../prisma.js";
import { requireCustomerOnly } from "../utils/auth.js";

const router = express.Router();

function parseFruitsPayload(fruits) {
  if (!Array.isArray(fruits) || fruits.length === 0) {
    return { ok: false, error: "fruits must be a non-empty array" };
  }
  const normalized = [];
  for (const f of fruits) {
    const productId = Number(f.productId);
    const quantity = Math.max(1, Number(f.quantity) || 1);
    if (!productId) return { ok: false, error: "Each fruit needs a valid productId" };
    const productSizeId =
      f.productSizeId === undefined || f.productSizeId === null || f.productSizeId === ""
        ? null
        : Number(f.productSizeId);
    if (productSizeId != null && Number.isNaN(productSizeId)) {
      return { ok: false, error: "Invalid productSizeId" };
    }
    normalized.push({ productId, quantity, productSizeId });
  }
  return { ok: true, fruits: normalized };
}

function serializeSaved(row) {
  let fruits = [];
  try {
    fruits = JSON.parse(row.fruitsJson || "[]");
    if (!Array.isArray(fruits)) fruits = [];
  } catch {
    fruits = [];
  }
  return {
    id: row.id,
    name: row.name,
    fruitBasketId: row.fruitBasketId,
    fruits,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fruitBasket: row.fruitBasket
      ? {
          id: row.fruitBasket.id,
          title: row.fruitBasket.title,
          price: row.fruitBasket.price,
          emptyImageUrl: row.fruitBasket.emptyImageUrl,
          filledImageUrl: row.fruitBasket.filledImageUrl,
        }
      : null,
  };
}

// GET /saved-fruit-baskets — list current user's saved baskets
router.get("/", requireCustomerOnly, async (req, res) => {
  try {
    const rows = await prisma.savedFruitBasket.findMany({
      where: { userId: req.customerUserId },
      include: { fruitBasket: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(rows.map(serializeSaved));
  } catch (error) {
    console.error("saved-fruit-baskets GET:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /saved-fruit-baskets/:id — one saved basket (must belong to user)
router.get("/:id", requireCustomerOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.savedFruitBasket.findFirst({
      where: { id, userId: req.customerUserId },
      include: { fruitBasket: true },
    });
    if (!row) return res.status(404).json({ error: "Saved basket not found" });
    res.json(serializeSaved(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /saved-fruit-baskets
router.post("/", requireCustomerOnly, async (req, res) => {
  try {
    const { name, fruitBasketId, fruits } = req.body || {};
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) return res.status(400).json({ error: "name is required" });
    if (trimmedName.length > 255) return res.status(400).json({ error: "name too long" });

    const basketId = Number(fruitBasketId);
    if (!basketId) return res.status(400).json({ error: "fruitBasketId is required" });

    const basket = await prisma.fruitBasket.findFirst({
      where: { id: basketId, isActive: true },
    });
    if (!basket) return res.status(404).json({ error: "Basket not found" });

    const parsed = parseFruitsPayload(fruits);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const row = await prisma.savedFruitBasket.create({
      data: {
        userId: req.customerUserId,
        name: trimmedName,
        fruitBasketId: basketId,
        fruitsJson: JSON.stringify(parsed.fruits),
      },
      include: { fruitBasket: true },
    });
    res.status(201).json(serializeSaved(row));
  } catch (error) {
    console.error("saved-fruit-baskets POST:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /saved-fruit-baskets/:id
router.patch("/:id", requireCustomerOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.savedFruitBasket.findFirst({
      where: { id, userId: req.customerUserId },
    });
    if (!existing) return res.status(404).json({ error: "Saved basket not found" });

    const { name, fruitBasketId, fruits } = req.body || {};
    const data = {};

    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) return res.status(400).json({ error: "name cannot be empty" });
      if (trimmed.length > 255) return res.status(400).json({ error: "name too long" });
      data.name = trimmed;
    }

    if (fruitBasketId !== undefined) {
      const basketId = Number(fruitBasketId);
      const basket = await prisma.fruitBasket.findFirst({
        where: { id: basketId, isActive: true },
      });
      if (!basket) return res.status(404).json({ error: "Basket not found" });
      data.fruitBasketId = basketId;
    }

    if (fruits !== undefined) {
      const parsed = parseFruitsPayload(fruits);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      data.fruitsJson = JSON.stringify(parsed.fruits);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const row = await prisma.savedFruitBasket.update({
      where: { id },
      data,
      include: { fruitBasket: true },
    });
    res.json(serializeSaved(row));
  } catch (error) {
    console.error("saved-fruit-baskets PATCH:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /saved-fruit-baskets/:id
router.delete("/:id", requireCustomerOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.savedFruitBasket.findFirst({
      where: { id, userId: req.customerUserId },
    });
    if (!existing) return res.status(404).json({ error: "Saved basket not found" });

    await prisma.savedFruitBasket.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
