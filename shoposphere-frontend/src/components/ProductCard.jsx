import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { memo, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";

function ProductCard({ product, compact = false }) {
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

  // Get selling price and optional MRP from size variants.
  const getPriceInfo = () => {
    if (!product.sizes || product.sizes.length === 0) return null;
    const withMrp = product.sizes.map((s) => ({
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

  // Variant-aware stock: aggregate per-size stock.
  const stock = useMemo(() => {
    if (product.sizes?.length) {
      const total = product.sizes.reduce((sum, s) => sum + Math.max(0, Number(s.stock ?? 0)), 0);
      if (total > 0) return total;
    }
    return Math.max(0, typeof product.stock === "number" ? product.stock : 0);
  }, [product]);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;

  const badges = useMemo(() => {
    const list = [];

    // Fresh Today
    if (product?.isReady60Min) list.push({ key: "fresh", label: "Fresh Today", tone: "fresh" });

    // Bestseller
    if (product?.isTrending) list.push({ key: "best", label: "Bestseller", tone: "bestseller" });

    // Limited Stock (urgent)
    if (lowStock && !outOfStock) list.push({ key: "limited", label: "Limited Stock", tone: "limited" });

    // Keep it clean
    return list.slice(0, 2);
  }, [product?.isReady60Min, product?.isTrending, lowStock, outOfStock]);

  const handleAddToCart = async () => {
    if (outOfStock) {
      toast.error("This product is out of stock");
      return;
    }

    if (isAdding) return;
    setIsAdding(true);
    setJustAdded(false);
    
    if (!product.sizes || product.sizes.length === 0) {
      toast.error("This product has no sizes available");
      setIsAdding(false);
      return;
    }
    if (product.sizes.length === 1) {
      const ok = await addToCart(product, product.sizes[0], 1);
      if (ok) {
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1300);
      }
      setIsAdding(false);
    } else {
      window.location.href = `/product/${product.id}`;
      setIsAdding(false);
    }
  };

  const handleQuickAdd = async () => {
    if (outOfStock) return;
    if (isAdding) return;
    setIsAdding(true);
    setJustAdded(false);

    try {
      // Size-based products: choose the cheapest available size.
      if (product.sizes?.length) {
        const sizes = Array.isArray(product.sizes) ? product.sizes : [];
        const chosen = sizes.reduce((min, s) => {
          const sPrice = Number(s.price ?? Number.MAX_SAFE_INTEGER);
          const sStock = Number(s.stock ?? 0);
          if (sStock <= 0) return min;
          return sPrice < min.price ? { ...s, price: sPrice } : min;
        }, { price: Number.MAX_SAFE_INTEGER });

        if (chosen?.id != null && chosen?.id !== "" && chosen?.id !== undefined && chosen?.price !== Number.MAX_SAFE_INTEGER) {
          const ok = await addToCart(product, chosen, 1);
          if (ok) {
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 1300);
          }
          return;
        }
        window.location.href = `/product/${product.id}`;
        return;
      }

      toast.error("This product is not available for quick add");
    } finally {
      setIsAdding(false);
    }
  };

  const handleWhatsAppOrder = () => {
    const phone = "917976948872";
    const priceText = displayPrice != null ? `Price: ₹${Number(displayPrice).toLocaleString("en-IN")}` : "Price: varies by size";
    const msg = `Hi! I want to order ${product?.name || "this product"}. ${priceText}. Please share available options and delivery details.`;

    // Store last product context for the floating WhatsApp button.
    try {
      localStorage.setItem("shoposphere_last_whatsapp_product", product?.name || "");
      localStorage.setItem("shoposphere_last_whatsapp_price", priceText);
    } catch {
      // ignore
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`card-soft overflow-hidden group relative ${
        compact ? "flex gap-3" : ""
      } transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
    >
      {/* Product Image */}
      <Link to={`/product/${product.id}`} className={`${compact ? "shrink-0" : "block"} hover:opacity-95 transition-opacity duration-200`}>
        {/* Basket frame */}
        <div
          className={`relative flex items-center justify-center cursor-pointer ${
            compact ? "h-20 w-20 rounded-md p-1.5" : "h-64 rounded-lg p-1.5"
          }`}
          style={{
            background: `linear-gradient(145deg, rgba(107,62,38,0.95) 0%, rgba(107,62,38,0.75) 45%, rgba(244,196,48,0.14) 100%)`,
            boxShadow: "inset 0 0 0 1px rgba(245,230,211,0.14)",
          }}
        >
          {/* Weave hint */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[0.5px] rounded-lg opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(245,230,211,0.55) 0 2px, rgba(0,0,0,0) 2px 8px), repeating-linear-gradient(0deg, rgba(245,230,211,0.35) 0 2px, rgba(0,0,0,0) 2px 10px)",
              mixBlendMode: "overlay",
            }}
          />

          {/* Basket liner */}
          <div
            className={`relative overflow-hidden w-full h-full rounded-md`}
            style={{
              backgroundColor: "var(--secondary)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            {images.length > 0 ? (
              <img
                src={images[0]}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  compact ? "group-hover:scale-[1.04]" : ""
                }`}
                loading="lazy"
                decoding="async"
                width={320}
                height={320}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-transparent">
                <img src="/logo.png" alt="shoposphere" className="h-12 w-auto object-contain opacity-50" />
              </div>
            )}

            {/* Micro lift on image hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18) 100%)",
              }}
            />
          </div>

        {/* Quick add + WhatsApp (image overlays) */}
        {!compact && (
          <>
            <button
              type="button"
              aria-label="Quick add to cart"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleQuickAdd();
              }}
              disabled={outOfStock || isAdding}
              className="absolute bottom-3 right-3 z-20 rounded-full h-9 w-9 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group-hover:opacity-100 opacity-0 translate-y-2 group-hover:translate-y-0"
              style={{
                background: outOfStock ? "var(--muted)" : "var(--btn-primary-bg)",
                color: outOfStock ? "var(--foreground-muted)" : "var(--btn-primary-fg)",
                border: "none",
                boxShadow: outOfStock ? "none" : "var(--shadow-soft)",
              }}
            >
              {isAdding ? (
                <span className="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              ) : justAdded ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              aria-label="Order on WhatsApp"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleWhatsAppOrder();
              }}
              disabled={outOfStock}
              className="absolute bottom-3 left-3 z-20 rounded-full h-9 w-9 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group-hover:opacity-100 opacity-0 translate-y-2 group-hover:translate-y-0"
              style={{
                backgroundColor: "var(--accent)",
                color: "white",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  fill="currentColor"
                  d="M19.11 17.52c-.16-.08-.97-.48-1.12-.54-.15-.06-.26-.08-.37.08-.1.16-.42.54-.51.65-.1.1-.19.12-.35.04-.16-.08-.68-.25-1.3-.8-.48-.43-.8-.96-.9-1.13-.09-.16-.01-.25.07-.33.08-.08.16-.19.25-.28.08-.1.1-.16.15-.27.05-.11.02-.21-.02-.29-.04-.08-.37-.95-.51-1.29-.14-.34-.29-.29-.39-.3h-.34c-.11 0-.29.04-.44.19-.15.15-.57.56-.57 1.36 0 .8.58 1.57.66 1.68.08.11 1.13 1.72 2.74 2.41.38.17.68.27.91.35.38.12.72.1.99.06.31-.05.97-.4 1.11-.79.14-.39.14-.72.1-.79-.04-.08-.15-.12-.31-.2Z"
                />
                <path
                  fill="currentColor"
                  d="M16.03 4.78c-6.21 0-11.25 5.04-11.25 11.25 0 2.02.55 3.96 1.59 5.66l-1.07 3.94 4.07-1.05c1.64.9 3.49 1.37 5.39 1.37 6.21 0 11.25-5.04 11.25-11.25S22.24 4.78 16.03 4.78Zm0 20.02c-1.75 0-3.44-.46-4.91-1.34l-.35-.21-2.53.65.65-2.46-.22-.36c-.94-1.5-1.44-3.25-1.44-5.03 0-5.02 4.09-9.11 9.11-9.11s9.11 4.09 9.11 9.11-4.09 9.11-9.11 9.11Z"
                />
              </svg>
            </button>
          </>
        )}

          {/* Wishlist heart - Top Left (so it doesn't overlap badges) */}
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
              className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-60 wishlist-heart-btn"
              style={{
                backgroundColor: "var(--background)",
                color: isWishlisted ? "var(--destructive)" : "var(--foreground)",
                boxShadow: "var(--shadow-soft, 0 2px 8px rgba(0,0,0,0.08))",
              }}
            >
              {isWishlisted ? (
                <svg className="w-5 h-5 wishlist-heart-filled" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 wishlist-heart-outline" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </button>
          )}

          {/* Badges - Top Right */}
          {!compact && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            {badges.map((b) => {
              const style =
                b.tone === "fresh"
                  ? {
                      backgroundColor: "var(--green-bg-soft)",
                      color: "var(--accent)",
                      border: "1px solid var(--separator-subtle)",
                      boxShadow: "0 8px 24px -8px rgba(26,28,29,0.08)",
                    }
                  : b.tone === "bestseller"
                    ? {
                        backgroundColor: "var(--secondary)",
                        color: "var(--foreground)",
                        border: "1px solid var(--separator-subtle)",
                        boxShadow: "0 8px 24px -8px rgba(26,28,29,0.06)",
                      }
                    : {
                        backgroundColor: "var(--primary)",
                        color: "var(--primary-foreground)",
                        border: "1px solid var(--separator-subtle)",
                        boxShadow: "0 8px 24px -8px rgba(26,28,29,0.12)",
                      };

              return (
                <span
                  key={b.key}
                  className="px-2 py-0.5 text-[11px] rounded-full font-semibold shadow-sm backdrop-blur-sm flex items-center gap-1"
                  style={style}
                >
                  {b.tone === "fresh" ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-8V2m0 8H3v10h10v-8h8z" />
                    </svg>
                  ) : b.tone === "bestseller" ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2 2 6-6" />
                    </svg>
                  ) : (
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

      {/* Product Info */}
      <div className={compact ? "py-1 pr-2 flex-1 min-w-0" : "p-4"}>
        <Link to={`/product/${product.id}`}>
          <h3 className={`font-semibold line-clamp-1 transition-colors cursor-pointer ${compact ? "text-sm mb-0.5" : "text-base mb-1.5"}`} style={{ color: 'var(--foreground)' }} onMouseEnter={(e) => { e.target.style.color = 'var(--primary)'; }} onMouseLeave={(e) => { e.target.style.color = 'var(--foreground)'; }}>
            {product.name}
          </h3>
        </Link>

        {/* Price - Amazon-style: MRP struck through, selling price bold, optional discount % */}
        {displayPrice != null && (
          <div className={compact ? "mb-1.5 flex items-baseline gap-2" : "mb-3 flex flex-wrap items-baseline gap-2"}>
            <span className={compact ? "text-sm font-bold" : "text-lg font-bold"} style={{ color: 'var(--foreground)' }}>
              ₹{Number(displayPrice).toLocaleString('en-IN')}
              {(product.sizes && product.sizes.length > 1) && (
                <span className="text-sm font-normal ml-1 text-design-muted"></span>
              )}
            </span>
            {displayMrp != null && displayMrp > displayPrice && (
              <>
                <span className="text-sm line-through text-design-muted">
                  ₹{Number(displayMrp).toLocaleString('en-IN')}
                </span>
                {discountPct != null && discountPct > 0 && (
                  <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                    {discountPct}% OFF
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Add Button — Primary: yellow-400 bg, gray-900 text, hover orange */}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || isAdding}
          className={`rounded-lg font-semibold transition-all duration-300 active:scale-[0.99] min-h-11 text-sm md:text-sm flex items-center justify-center gap-2 ${
            compact ? "px-3 py-1.5" : "w-full py-2.5"
          } ${outOfStock ? "opacity-60 cursor-not-allowed" : ""}`}
          style={{
            borderRadius: "var(--radius-lg)",
            background: outOfStock ? "var(--muted)" : "var(--btn-primary-bg)",
            color: outOfStock ? "var(--foreground-muted)" : "var(--btn-primary-fg)",
            boxShadow: outOfStock ? "none" : "var(--shadow-soft)",
            border: "none",
          }}
          onMouseEnter={(e) => {
            if (outOfStock || isAdding) return;
            e.currentTarget.style.filter = "brightness(1.08)";
          }}
          onMouseLeave={(e) => {
            if (outOfStock || isAdding) return;
            e.currentTarget.style.filter = "none";
          }}
        >
          {isAdding ? (
            <span className="inline-flex items-center justify-center">
              <span className="inline-block w-4 h-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
            </span>
          ) : justAdded ? (
            <span className="inline-flex items-center justify-center add-success-pop">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 6L9 17l-5-5" />
              </svg>
              <span className="ml-1 hidden sm:inline">Added</span>
            </span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton({ compact = false }) {
  return (
    <div className={`card-soft overflow-hidden group relative ${compact ? "flex gap-3" : ""}`}>
      <div className={`${compact ? "h-20 w-20 rounded-md p-1.5" : "h-64 rounded-lg p-1.5"} flex items-center justify-center`}>
        <div className="w-full h-full animate-pulse" style={{ background: "var(--muted)", borderRadius: "inherit" }} />
      </div>

      <div className={compact ? "py-1 pr-2 flex-1 min-w-0" : "p-4"}>
        <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: "var(--muted)" }} />
        {!compact && <div className="h-4 w-full mt-3 animate-pulse rounded" style={{ background: "var(--muted)" }} />}
        <div className="h-10 mt-5 animate-pulse rounded-lg" style={{ background: "rgba(76,175,80,0.14)" }} />
      </div>
    </div>
  );
}

export default memo(ProductCard);