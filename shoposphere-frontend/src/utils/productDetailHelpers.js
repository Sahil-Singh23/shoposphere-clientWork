/** Pure helpers for product detail page — keeps the page component readable. */

const APPAREL_SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

const APPAREL_SIZE_INDEX = new Map(APPAREL_SIZE_ORDER.map((label, idx) => [label, idx]));

function normalizeSizeLabel(label) {
  return String(label || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^(\d)X?L$/, (_, n) => `${"X".repeat(Number(n) - 1)}XL`);
}

export function getMinPriceForProduct(p) {
  if (!p) return null;
  if (p.hasSinglePrice && p.singlePrice != null) return Number(p.singlePrice);
  if (Array.isArray(p.variants) && p.variants.length)
    return Math.min(...p.variants.map((v) => Number(v.price)));
  if (Array.isArray(p.sizes) && p.sizes.length)
    return Math.min(...p.sizes.map((s) => Number(s.price)));
  return null;
}

export function normalizeImageList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function firstProductImageUrl(p) {
  const list = normalizeImageList(p?.images);
  return list[0] ?? null;
}

export function deriveSizeOptionsFromVariants(variants = []) {
  const byLabel = new Map();
  for (const variant of variants) {
    const label = String(variant?.sizeLabel || "").trim();
    if (!label) continue;

    const next = {
      id: variant.id,
      label,
      price: Number(variant.price || 0),
      originalPrice:
        variant.originalPrice != null && variant.originalPrice !== ""
          ? Number(variant.originalPrice)
          : null,
      stock: Math.max(0, Number(variant.stock || 0)),
    };

    if (!byLabel.has(label)) {
      byLabel.set(label, next);
      continue;
    }

    const current = byLabel.get(label);
    current.stock += next.stock;
    if (next.price < current.price) {
      current.id = next.id;
      current.price = next.price;
      current.originalPrice = next.originalPrice;
    }
  }

  return [...byLabel.values()].sort((a, b) => {
    const aNorm = normalizeSizeLabel(a.label);
    const bNorm = normalizeSizeLabel(b.label);
    const aIdx = APPAREL_SIZE_INDEX.has(aNorm) ? APPAREL_SIZE_INDEX.get(aNorm) : Number.MAX_SAFE_INTEGER;
    const bIdx = APPAREL_SIZE_INDEX.has(bNorm) ? APPAREL_SIZE_INDEX.get(bNorm) : Number.MAX_SAFE_INTEGER;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function pickPreferredSize(sizes = []) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const inStock = sizes.find((s) => Math.max(0, Number(s?.stock ?? 0)) > 0);
  return inStock || sizes[0] || null;
}

export function parseWeightOptions(product) {
  if (!product?.weightOptions) return [];
  try {
    const raw = product.weightOptions;
    return Array.isArray(raw) ? raw : JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

/** Distinguishes JSON parse errors (show error UI) from an empty list. */
export function parseWeightOptionsSafe(product) {
  if (!product?.weightOptions) return { ok: true, options: [] };
  try {
    const raw = product.weightOptions;
    const options = Array.isArray(raw) ? raw : JSON.parse(raw);
    return { ok: true, options: Array.isArray(options) ? options : [] };
  } catch {
    return { ok: false, options: [] };
  }
}

export function findWeightOption(weightOptions, selectedWeight) {
  if (selectedWeight == null || !Array.isArray(weightOptions)) return null;
  const want = String(selectedWeight).trim();
  return weightOptions.find((o) => String(o.weight).trim() === want) ?? null;
}

export function getCheapestSizeOption(sizeOptions) {
  if (!Array.isArray(sizeOptions) || sizeOptions.length === 0) return null;
  return sizeOptions.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
}

export function formatInr(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function discountPercent(mrp, selling) {
  return mrp != null && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : 0;
}

export function getPrimaryCategory(product) {
  if (!product) return null;
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories[0];
  }
  return product.category ?? null;
}

export function parseInstagramEmbedsList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((e) => e.enabled);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e.enabled) : [];
  } catch {
    return [];
  }
}

/**
 * Selling price, MRP, and “From …” flag for the PDP price area and sticky bar.
 * Mirrors the previous inline logic exactly.
 */
export function resolveDisplayedPricing(product, selectedWeight, selectedSize, sizeOptions) {
  let selling = null;
  let mrp = null;

  if (selectedWeight && product?.weightOptions) {
    const weightOpts = parseWeightOptions(product);
    const w = findWeightOption(weightOpts, selectedWeight);
    if (w) {
      selling = Number(w.price);
      mrp = w.originalPrice != null && w.originalPrice !== "" ? Number(w.originalPrice) : null;
    }
  } else if (selectedSize) {
    selling = Number(selectedSize.price);
    mrp =
      selectedSize.originalPrice != null && selectedSize.originalPrice !== ""
        ? Number(selectedSize.originalPrice)
        : product?.hasSinglePrice
          ? product?.originalPrice != null
            ? Number(product.originalPrice)
            : null
          : null;
  } else if (product?.hasSinglePrice && product?.singlePrice != null) {
    selling = Number(product.singlePrice);
    mrp = product.originalPrice != null && product.originalPrice !== "" ? Number(product.originalPrice) : null;
  } else if (sizeOptions.length) {
    const minSize = getCheapestSizeOption(sizeOptions);
    if (minSize) {
      selling = Number(minSize.price);
      mrp = minSize.originalPrice != null && minSize.originalPrice !== "" ? Number(minSize.originalPrice) : null;
    }
  }

  const showFrom =
    sizeOptions.length > 0 && !selectedSize && !selectedWeight && !(product?.hasSinglePrice && product?.singlePrice);

  return { selling, mrp, showFrom };
}

/** Keys match API / Prisma camelCase fields for optional “Top highlights” on PDP */
export const PRODUCT_HIGHLIGHT_FIELDS = [
  { key: "materialComposition", label: "Material composition" },
  { key: "pattern", label: "Pattern" },
  { key: "fitType", label: "Fit type" },
  { key: "sleeveType", label: "Sleeve type" },
  { key: "collarStyle", label: "Collar style" },
  { key: "lengthDetail", label: "Length" },
  { key: "countryOfOrigin", label: "Country of origin" },
];

/** Rows with only non-empty values, for product detail “Top highlights” */
export function getProductHighlightRows(product) {
  if (!product) return [];
  return PRODUCT_HIGHLIGHT_FIELDS.map(({ key, label }) => {
    const raw = product[key];
    const value = raw != null ? String(raw).trim() : "";
    return value ? { label, value } : null;
  }).filter(Boolean);
}
