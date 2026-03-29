import prisma from "../prisma.js";

/** Name of the system product used for cart packaging lines. Exported for filtering in public product APIs. */
export const PACKAGING_PRODUCT_NAME = "Fruit Basket (Packaging)";

const PACKAGING_NAME = PACKAGING_PRODUCT_NAME;

let cachedId = null;

/**
 * Ensures a system product exists for fruit-basket packaging cart lines.
 * Price is always taken from FruitBasket + packagingPrice on CartItem, not from this product.
 */
export async function getFruitBasketPackagingProductId() {
  if (cachedId) return cachedId;
  try {
    let p = await prisma.product.findFirst({
      where: { name: PACKAGING_NAME },
      select: { id: true },
    });
    if (!p) {
      p = await prisma.product.create({
        data: {
          name: PACKAGING_NAME,
          description:
            "System line item for custom fruit basket packaging fee. Do not delete or use as a regular product.",
          images: "[]",
          keywords: "[]",
          stock: 999999,
          sizes: {
            create: [
              {
                label: "Packaging",
                price: 0,
                stock: 999999,
              },
            ],
          },
        },
        select: { id: true },
      });
      console.log(`fruitBasketPackaging: created packaging product id=${p.id}`);
    }
    cachedId = p.id;
    return cachedId;
  } catch (e) {
    console.error("getFruitBasketPackagingProductId:", e.message);
    return null;
  }
}
