import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { memo, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";

function ProductCard({ product, compact = false }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist, togglingId } = useWishlist();
  const toast = useToast();
  const isWishlisted = isInWishlist(product?.id);
  const isToggling = togglingId === product?.id;
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const images = useMemo(() => {
    if (!product?.images) return [];
    if (Array.isArray(product.images)) return product.images;
    try {
      const parsed = JSON.parse(product.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [product?.images]);

  const normalizedSizes = useMemo(() => {
    if (Array.isArray(product?.sizes) && product.sizes.length > 0) {
      return product.sizes;
    }

    if (!Array.isArray(product?.variants) || product.variants.length === 0) {
      return [];
    }

    const byLabel = new Map();
    for (const v of product.variants) {
      const label = String(v?.sizeLabel || v?.label || "").trim() || "Standard";
      const price = Number(v?.price ?? 0);
      const stock = Math.max(0, Number(v?.stock ?? 0));
      const originalPrice = v?.originalPrice != null && v?.originalPrice !== "" ? Number(v.originalPrice) : null;

      if (!byLabel.has(label)) {
        byLabel.set(label, {
          id: v?.id,
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
        current.price = price;
        current.id = v?.id;
        current.originalPrice = originalPrice != null ? originalPrice : current.originalPrice;
      }
    }

    return [...byLabel.values()];
  }, [product?.sizes, product?.variants]);

  // Get selling price and optional MRP from size variants.
  const getPriceInfo = () => {
    if (normalizedSizes.length === 0) return null;
    const withMrp = normalizedSizes.map((s) => ({
      selling: parseFloat(s.price),
      mrp: s.originalPrice != null && s.originalPrice !== "" ? parseFloat(s.originalPrice) : null,
    }));
    const minSelling = Math.min(...withMrp.map((x) => x.selling));
    const minWithMrp = withMrp.find((x) => x.selling === minSelling);
    return minWithMrp ? { selling: minWithMrp.selling, mrp: minWithMrp.mrp } : { selling: minSelling, mrp: null };
  };

  const priceInfo = getPriceInfo();
  const displayPrice = priceInfo ? priceInfo.selling : null;
  const displayMrp = priceInfo && priceInfo.mrp != null && priceInfo.mrp > displayPrice ? priceInfo.mrp : null;
  const discountPct =
    displayMrp != null && displayMrp > 0 && displayPrice < displayMrp
      ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
      : null;

  const colorOptions = useMemo(() => {
    if (!Array.isArray(product?.colors)) return [];
    return product.colors
      .map((color) => {
        return {
          id: color?.id,
          name: color?.name || "Color",
          hexCode: color?.hexCode || "#d1d5db",
        };
      })
      .filter((color) => color.name)
      .slice(0, 4);
  }, [product?.colors]);

  // Variant-aware stock: aggregate per-size stock.
  const stock = useMemo(() => {
    if (normalizedSizes.length) {
      const total = normalizedSizes.reduce((sum, s) => sum + Math.max(0, Number(s.stock ?? 0)), 0);
      if (total > 0) return total;
    }
    return Math.max(0, typeof product.stock === "number" ? product.stock : 0);
  }, [normalizedSizes, product]);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;

  const badges = useMemo(() => {
    const list = [];

    // Limited Stock (urgent)
    if (lowStock && !outOfStock) list.push({ key: "limited", label: "Limited Stock", tone: "limited" });

    // Keep it clean
    return list.slice(0, 2);
  }, [lowStock, outOfStock]);

  const handleAddToCart = async () => {
    if (outOfStock) {
      toast.error("This product is out of stock");
      return;
    }
    if (isAdding) return;

    if (normalizedSizes.length === 0) {
      toast.error("This product has no sizes available");
      return;
    }

    setIsAdding(true);

    try {
      if (normalizedSizes.length === 1) {
        const ok = await addToCart(product, normalizedSizes[0], 1);
        if (ok) {
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 1200);
        }
        return;
      }

      navigate(`/product/${product.id}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className={`group overflow-hidden rounded-none bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(17,24,39,0.08)] ${
        compact ? "flex gap-1" : "border border-black/5 shadow-[0_10px_30px_rgba(17,24,39,0.06)]"
      }`}
    >
      <Link
        to={`/product/${product.id}`}
        className={`${compact ? "shrink-0" : "block"} hover:opacity-95 transition-opacity duration-200`}
      >
        <div className={`relative bg-[#f6f4ef] ${compact ? "h-20 w-20" : "aspect-4/5"}`}>
          <img
            src={images[0] || "/logo.png"}
            alt={product?.name || "Product image"}
            className={`h-full w-full object-cover ${images.length > 0 ? "" : "p-6 object-contain opacity-60"}`}
            loading="lazy"
            decoding="async"
          />

          {/* Micro lift on image hover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18) 100%)",
            }}
          />

          {!compact && (
            <button
              type="button"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              disabled={isToggling}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(17,24,39,0.12)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {isWishlisted ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          )}

          {/* Badges - Top Left */}
          {!compact && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {badges.map((b) => {
                const style =
                  b.tone === "limited"
                    ? {
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                        border: "1px solid var(--separator-subtle)",
                        boxShadow: "0 8px 24px -8px rgba(26,28,29,0.12)",
                      }
                    : {};

                return (
                  <span
                    key={b.key}
                    className="px-2 py-0.5 text-[11px] rounded-full font-semibold shadow-sm backdrop-blur-sm flex items-center gap-1"
                    style={style}
                  >
                    {b.tone === "limited" && (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </Link>

      <div className={compact ? "min-w-0 flex-1 py-1 pr-2" : "px-4 py-4"}>
        <Link to={`/product/${product.id}`}>
          <h3
            className={`font-medium tracking-tight text-slate-900 transition-colors group-hover:text-black truncate ${
              compact ? "text-sm" : "text-[15px] leading-6"
            }`}
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {product?.name}
          </h3>
        </Link>

        {displayPrice != null && (
          <div className={`mt-2 flex items-center gap-1 ${compact ? "text-sm" : "text-base"}`}>
            <span className="font-bold text-lg text-slate-900">₹{Number(displayPrice).toLocaleString("en-IN")}</span>
            {displayMrp != null && displayMrp > displayPrice && (
              <>
                <span className="text-sm text-slate-400 line-through">₹{Number(displayMrp).toLocaleString("en-IN")}</span>
                {discountPct != null && discountPct > 0 && (
                  <span className="text-xs font-bold text-emerald-600">{discountPct}% OFF</span>
                )}
              </>
            )}
          </div>
        )}

        {!compact && colorOptions.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5" aria-label="Available colors">
            {colorOptions.map((color) => {
              return (
                <span
                  key={color.id ?? color.name}
                  title={color.name}
                  aria-label={color.name}
                  className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  style={{
                    backgroundColor: color.hexCode,
                  }}
                />
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddToCart}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-none font-semibold transition-all duration-300 active:scale-[0.99] min-h-11 text-sm md:text-sm ${
            compact ? "mt-3 px-3 py-1.5 text-xs" : "py-2.5"
          } ${outOfStock ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={outOfStock || isAdding}
          style={{
            borderRadius: 0,
            background: outOfStock ? "var(--muted)" : "var(--btn-primary-bg)",
            color: outOfStock ? "var(--foreground-muted)" : "var(--btn-primary-fg)",
            boxShadow: outOfStock ? "none" : "var(--shadow-soft)",
            border: "none",
          }}
          onMouseEnter={(e) => {
            if (isAdding || outOfStock) return;
            e.currentTarget.style.filter = "brightness(1.08)";
          }}
          onMouseLeave={(e) => {
            if (isAdding || outOfStock) return;
            e.currentTarget.style.filter = "none";
          }}
        >
          {isAdding ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : justAdded ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          )}
          Add to cart
        </button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton({ compact = false }) {
  return (
    <div className={`overflow-hidden rounded-none bg-white ${compact ? "flex gap-1" : "border border-black/5 shadow-[0_10px_30px_rgba(17,24,39,0.06)]"}`}>
      <div className={`animate-pulse bg-slate-100 ${compact ? "h-20 w-20" : "aspect-4/5"}`} />

      <div className={compact ? "min-w-0 flex-1 py-1 pr-2" : "px-4 py-4"}>
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        {!compact && <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />}
      </div>
    </div>
  );
}

export default memo(ProductCard);