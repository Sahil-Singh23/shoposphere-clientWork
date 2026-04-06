import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API } from "../api";
import { shuffleArray } from "../utils/shuffle";
import { Link } from "react-router-dom";
import Categories from "../components/Categories";
import ProductCard from "../components/ProductCard";
import { FilterSortButtonRow } from "../components/FilterSortButtons";

const SORT_OPTIONS = [
  { value: "default", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name-asc", label: "Name: A–Z" },
  { value: "name-desc", label: "Name: Z–A" },
];

function getProductPriceExtent(product) {
  const variants = product?.variants;
  if (Array.isArray(variants) && variants.length > 0) {
    const prices = variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n));
    if (prices.length) return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  if (Array.isArray(product?.sizes) && product.sizes.length > 0) {
    const prices = product.sizes.map((s) => Number(s.price)).filter((n) => !Number.isNaN(n));
    if (prices.length) return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  return null;
}

function getMinVariantPrice(product) {
  const ext = getProductPriceExtent(product);
  return ext ? ext.min : null;
}

function formatInr(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function parseManualPrice(s) {
  const t = String(s).trim().replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function productHasStock(product) {
  const variants = product?.variants;
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.some((v) => Number(v.stock) > 0);
  }
  if (Array.isArray(product?.sizes) && product.sizes.length > 0) {
    return product.sizes.some((s) => Number(s.stock) > 0);
  }
  return true;
}

function compareProducts(a, b, sortKey) {
  switch (sortKey) {
    case "price-asc": {
      const pa = getMinVariantPrice(a);
      const pb = getMinVariantPrice(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    }
    case "price-desc": {
      const pa = getMinVariantPrice(a);
      const pb = getMinVariantPrice(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pb - pa;
    }
    case "name-asc":
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    case "name-desc":
      return String(b.name || "").localeCompare(String(a.name || ""), undefined, { sensitivity: "base" });
    default:
      return 0;
  }
}

function CategoryFilterSortPanel({
  filterOpen,
  sortOpen,
  sortKey,
  inStockOnly,
  onSortKeyChange,
  onInStockChange,
  priceBounds,
  priceFilterMin,
  priceFilterMax,
  onPriceFilterMinChange,
  onPriceFilterMaxChange,
}) {
  const minInputFocused = useRef(false);
  const maxInputFocused = useRef(false);
  const [minStr, setMinStr] = useState(() => String(priceFilterMin));
  const [maxStr, setMaxStr] = useState(() => String(priceFilterMax));

  useEffect(() => {
    if (!minInputFocused.current) setMinStr(String(priceFilterMin));
  }, [priceFilterMin]);

  useEffect(() => {
    if (!maxInputFocused.current) setMaxStr(String(priceFilterMax));
  }, [priceFilterMax]);

  if (!filterOpen && !sortOpen) return null;

  const hasPriceSpread = priceBounds.max > priceBounds.min;
  const priceStep =
    hasPriceSpread && priceBounds.max - priceBounds.min > 500
      ? Math.max(1, Math.round((priceBounds.max - priceBounds.min) / 100))
      : 1;

  const inputClass =
    "mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

  const commitMinFromField = () => {
    const n = parseManualPrice(minStr);
    if (n === null) {
      setMinStr(String(priceFilterMin));
      return;
    }
    const clamped = Math.min(Math.max(n, priceBounds.min), Math.min(priceBounds.max, priceFilterMax));
    onPriceFilterMinChange(clamped);
    setMinStr(String(clamped));
  };

  const commitMaxFromField = () => {
    const n = parseManualPrice(maxStr);
    if (n === null) {
      setMaxStr(String(priceFilterMax));
      return;
    }
    const clamped = Math.max(Math.min(n, priceBounds.max), Math.max(priceBounds.min, priceFilterMin));
    onPriceFilterMaxChange(clamped);
    setMaxStr(String(clamped));
  };

  return (
    <div
      className="relative z-20 mb-4 rounded-xl border p-4 shadow-sm"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card-white)" }}
    >
      {filterOpen ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
            Filter
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border shrink-0"
              style={{ accentColor: "var(--primary)" }}
              checked={inStockOnly}
              onChange={(e) => onInStockChange(e.target.checked)}
            />
            In stock only
          </label>
          {hasPriceSpread ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                Price range
              </p>
              <p className="text-[11px] leading-snug" style={{ color: "var(--foreground-muted)" }}>
                Type amounts or use sliders ({formatInr(priceBounds.min)} – {formatInr(priceBounds.max)} in this list)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Min (₹)
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={inputClass}
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                    }}
                    value={minStr}
                    onFocus={() => {
                      minInputFocused.current = true;
                    }}
                    onBlur={() => {
                      minInputFocused.current = false;
                      commitMinFromField();
                    }}
                    onChange={(e) => setMinStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                <label className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Max (₹)
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={inputClass}
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                    }}
                    value={maxStr}
                    onFocus={() => {
                      maxInputFocused.current = true;
                    }}
                    onBlur={() => {
                      maxInputFocused.current = false;
                      commitMaxFromField();
                    }}
                    onChange={(e) => setMaxStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Minimum
                  <input
                    type="range"
                    className="mt-1 block w-full"
                    style={{ accentColor: "var(--primary)" }}
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={priceStep}
                    value={priceFilterMin}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      onPriceFilterMinChange(Math.min(v, priceFilterMax));
                    }}
                  />
                </label>
                <label className="block text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Maximum
                  <input
                    type="range"
                    className="mt-1 block w-full"
                    style={{ accentColor: "var(--primary)" }}
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={priceStep}
                    value={priceFilterMax}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      onPriceFilterMaxChange(Math.max(v, priceFilterMin));
                    }}
                  />
                </label>
              </div>
            </div>
          ) : priceBounds.max > 0 && priceBounds.min === priceBounds.max ? (
            <p className="text-sm pt-1" style={{ color: "var(--foreground-muted)" }}>
              All items {formatInr(priceBounds.min)}
            </p>
          ) : null}
        </div>
      ) : null}
      {filterOpen && sortOpen ? <div className="my-4 border-t" style={{ borderColor: "var(--border)" }} /> : null}
      {sortOpen ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
            Sort by
          </p>
          <div className="flex flex-col gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--secondary)]"
                style={{ color: "var(--foreground)" }}
              >
                <input
                  type="radio"
                  name="category-sort"
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: "var(--primary)" }}
                  checked={sortKey === opt.value}
                  onChange={() => onSortKeyChange(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CategoriesPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const trendingFilter = searchParams.get("trending") === "true";
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortKey, setSortKey] = useState("default");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceFilterMin, setPriceFilterMin] = useState(0);
  const [priceFilterMax, setPriceFilterMax] = useState(0);

  const priceBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of products) {
      const ext = getProductPriceExtent(p);
      if (ext) {
        min = Math.min(min, ext.min);
        max = Math.max(max, ext.max);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
    return { min, max };
  }, [products]);

  useEffect(() => {
    setPriceFilterMin(priceBounds.min);
    setPriceFilterMax(priceBounds.max);
  }, [priceBounds.min, priceBounds.max]);

  const priceFilterActive = useMemo(
    () =>
      priceBounds.max > priceBounds.min &&
      (priceFilterMin > priceBounds.min || priceFilterMax < priceBounds.max),
    [priceBounds.min, priceBounds.max, priceFilterMin, priceFilterMax]
  );

  const displayedProducts = useMemo(() => {
    let list = Array.isArray(products) ? [...products] : [];
    if (inStockOnly) {
      list = list.filter(productHasStock);
    }
    const fullPriceRange =
      priceBounds.max <= priceBounds.min ||
      (priceFilterMin <= priceBounds.min && priceFilterMax >= priceBounds.max);
    if (!fullPriceRange) {
      list = list.filter((p) => {
        const ext = getProductPriceExtent(p);
        if (!ext) return false;
        return ext.min <= priceFilterMax && ext.max >= priceFilterMin;
      });
    }
    if (sortKey !== "default") {
      list.sort((a, b) => compareProducts(a, b, sortKey));
    }
    return list;
  }, [products, inStockOnly, sortKey, priceBounds.min, priceBounds.max, priceFilterMin, priceFilterMax]);

  useEffect(() => {
    setFilterOpen(false);
    setSortOpen(false);
    setSortKey("default");
    setInStockOnly(false);
  }, [slug, selectedCategory?.id, trendingFilter]);

  useEffect(() => {
    fetch(`${API}/categories`)
      .then((res) => res.json())
      .then((categoriesData) => {
        setCategories(categoriesData);
        if (slug) {
          const category = categoriesData.find(cat => cat.slug === slug);
          if (category) {
            setSelectedCategory(category);
          } else if (categoriesData.length > 0) {
            setSelectedCategory(categoriesData[0]);
          }
        } else if (categoriesData.length > 0) {
          setSelectedCategory(categoriesData[0]);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (slug && selectedCategory) {
      fetchCategoryProducts(selectedCategory.slug, trendingFilter);
      return;
    }

    // No slug (e.g. /categories): show all products (optionally filtered by trending)
    if (!slug) {
      fetchAllProducts(trendingFilter);
      return;
    }

    setProducts([]);
    setLoading(false);
  }, [selectedCategory, slug, trendingFilter]);

  const fetchCategoryProducts = async (categorySlug, trending = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("category", categorySlug);
      if (trending) {
        params.append("trending", "true");
      }
      const res = await fetch(`${API}/products?${params.toString()}`);
      const data = await res.json();
      // If backend doesn't support trending filter, filter on frontend
      const filteredData = trending 
        ? (Array.isArray(data) ? data.filter(p => p.isTrending) : [])
        : (Array.isArray(data) ? data : []);
      setProducts(shuffleArray(filteredData));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProducts = async (trending = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (trending) {
        params.append("trending", "true");
      }
      const qs = params.toString();
      const res = await fetch(`${API}/products${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      // If backend doesn't support trending filter, filter on frontend
      const filteredData = trending 
        ? (Array.isArray(data) ? data.filter(p => p.isTrending) : [])
        : (Array.isArray(data) ? data : []);
      setProducts(shuffleArray(filteredData));
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Removed getCategoryEmoji - all categories use logo as fallback

  if (loading && !selectedCategory) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div
          className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)" }}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-page-products">
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl font-bold mb-4" style={{ color: "var(--foreground)" }}>
            Shop by Category
          </h2>
        </div>

        <div className="relative z-0 mb-12">
          <Categories categories={categories} selectedCategoryId={selectedCategory?.id} />
        </div>

        {/* Products for Selected Category */}
        {selectedCategory && slug && (
          <div className="relative z-10 mt-12">
            <div className="mb-8">
              <h3 className="font-display text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
                {selectedCategory.name}
              </h3>
              {selectedCategory.description && (
                <p className="text-lg mb-4" style={{ color: "var(--foreground-muted)" }}>
                  {selectedCategory.description}
                </p>
              )}

            </div>
            <FilterSortButtonRow
              className="relative z-20 mb-4"
              buttonProps={{
                filter: {
                  type: "button",
                  active: filterOpen || inStockOnly || priceFilterActive,
                  onClick: () => setFilterOpen((o) => !o),
                  "aria-expanded": filterOpen,
                },
                sort: {
                  type: "button",
                  active: sortOpen || sortKey !== "default",
                  onClick: () => setSortOpen((o) => !o),
                  "aria-expanded": sortOpen,
                },
              }}
            />
            <CategoryFilterSortPanel
              filterOpen={filterOpen}
              sortOpen={sortOpen}
              sortKey={sortKey}
              inStockOnly={inStockOnly}
              onSortKeyChange={setSortKey}
              onInStockChange={setInStockOnly}
              priceBounds={priceBounds}
              priceFilterMin={priceFilterMin}
              priceFilterMax={priceFilterMax}
              onPriceFilterMinChange={setPriceFilterMin}
              onPriceFilterMaxChange={setPriceFilterMax}
            />
            {products.length > 0 ? (
              displayedProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>
                    No products match these filters
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-16">
                <div className="inline-block p-4 rounded-lg mb-4" style={{ backgroundColor: "var(--muted)" }}>
                  <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain" />
                </div>
                <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>
                  No products available in this category yet
                </p>
              </div>
            )}
          </div>
        )}

        {/* All products when no category slug is selected (e.g. /categories) */}
        {!slug && (
          <div className="relative z-10 mt-12">
            <div className="mb-8">
              <h3 className="font-display text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
                {trendingFilter ? "Trending Products" : "All Products"}
              </h3>

            </div>

            <FilterSortButtonRow
              className="relative z-20 mb-4"
              buttonProps={{
                filter: {
                  type: "button",
                  active: filterOpen || inStockOnly || priceFilterActive,
                  onClick: () => setFilterOpen((o) => !o),
                  "aria-expanded": filterOpen,
                },
                sort: {
                  type: "button",
                  active: sortOpen || sortKey !== "default",
                  onClick: () => setSortOpen((o) => !o),
                  "aria-expanded": sortOpen,
                },
              }}
            />
            <CategoryFilterSortPanel
              filterOpen={filterOpen}
              sortOpen={sortOpen}
              sortKey={sortKey}
              inStockOnly={inStockOnly}
              onSortKeyChange={setSortKey}
              onInStockChange={setInStockOnly}
              priceBounds={priceBounds}
              priceFilterMin={priceFilterMin}
              priceFilterMax={priceFilterMax}
              onPriceFilterMinChange={setPriceFilterMin}
              onPriceFilterMaxChange={setPriceFilterMax}
            />
            {products.length > 0 ? (
              displayedProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2">
                  {displayedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>
                    No products match these filters
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-16">
                <div className="inline-block p-4 rounded-lg mb-4" style={{ backgroundColor: "var(--muted)" }}>
                  <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain" />
                </div>
                <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>
                  No products available yet
                </p>
              </div>
            )}
          </div>
        )}

        {/* Show all categories if none selected */}
        {!selectedCategory && categories.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block p-4 rounded-lg mb-4" style={{ backgroundColor: "var(--muted)" }}>
              <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain" />
            </div>
            <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>
              No categories available yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
