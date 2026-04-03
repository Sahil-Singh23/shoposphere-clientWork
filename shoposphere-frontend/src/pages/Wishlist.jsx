import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

function parseWeightOptions(product) {
  if (!product?.weightOptions) return [];
  if (Array.isArray(product.weightOptions)) return product.weightOptions;
  try {
    const parsed = JSON.parse(product.weightOptions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAvailableStock(product) {
  if (!product) return 0;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + Math.max(0, Number(v?.stock ?? 0)), 0);
  }

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    return product.sizes.reduce((sum, s) => sum + Math.max(0, Number(s?.stock ?? 0)), 0);
  }

  const weightOptions = parseWeightOptions(product);
  if (weightOptions.length > 0) {
    return weightOptions.reduce((sum, w) => sum + Math.max(0, Number(w?.stock ?? 0)), 0);
  }

  return Math.max(0, Number(product.stock ?? 0));
}

function WishlistCardSkeleton() {
  return (
    <div
      className="rounded-xl border overflow-hidden animate-pulse"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div className="aspect-square w-full" style={{ background: "var(--muted)" }} />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded" style={{ background: "var(--muted)" }} />
        <div className="h-6 w-20 rounded" style={{ background: "var(--muted)" }} />
        <div className="h-10 w-full rounded-lg" style={{ background: "var(--muted)" }} />
        <div className="h-10 w-full rounded-lg" style={{ background: "var(--muted)" }} />
      </div>
    </div>
  );
}

export default function Wishlist() {
  const { isAuthenticated, loading: authLoading } = useUserAuth();
  const { wishlistItems, loading: wishlistLoading, removeFromWishlist, refreshWishlist } = useWishlist();
  const { addToCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (!authLoading) refreshWishlist();
  }, [authLoading, refreshWishlist]);

  const handleRemove = async (productId) => {
    setRemovingId(productId);
    await removeFromWishlist(productId);
    setRemovingId(null);
  };

  const handleAddToCart = (item) => {
    const product = item.product;
    if (!product) return;
    const availableStock = getAvailableStock(product);
    if (availableStock <= 0) {
      toast.error("This product is out of stock");
      return;
    }
    if (product.hasSinglePrice && product.singlePrice) {
      const virtualSize = { id: 0, label: "Standard", price: parseFloat(product.singlePrice) };
      addToCart(product, virtualSize, 1);
      return;
    }
    if (!product.sizes?.length) {
      toast.error("This product has no sizes available");
      return;
    }

    const inStockSizes = product.sizes.filter((s) => Number(s?.stock ?? 0) > 0);
    if (inStockSizes.length === 0) {
      toast.error("This product is out of stock");
      return;
    }

    if (inStockSizes.length === 1) {
      addToCart(product, inStockSizes[0], 1);
    } else {
      navigate(`/product/${product.id}`);
    }
  };

  if (authLoading || (wishlistLoading && wishlistItems.length === 0)) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="h-9 w-40 rounded-lg animate-pulse mb-8" style={{ background: "var(--muted)" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <WishlistCardSkeleton />
            <WishlistCardSkeleton />
            <WishlistCardSkeleton />
            <WishlistCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-bold font-display mb-8" style={{ color: "var(--foreground)" }}>
          Wishlist
        </h1>

        {wishlistItems.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-12 sm:p-16 text-center"
            style={{
              borderColor: "var(--border)",
              background: "var(--secondary)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ background: "var(--muted)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <svg
                className="w-10 h-10 wishlist-heart-outline"
                style={{ color: "var(--destructive)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              Your wishlist is empty
            </p>
            <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "var(--muted)" }}>
              Save your favourite fruits and add them to cart when you&apos;re ready.
            </p>
            <Link
              to="/categories"
              className="inline-block px-8 py-3.5 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "var(--btn-primary-bg)",
                color: "var(--btn-primary-fg)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              Start Exploring Fruits
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((item) => {
              const product = item.product;
              if (!product) return null;
              let images = [];
              if (product.images) {
                if (Array.isArray(product.images)) images = product.images;
                else {
                  try {
                    const parsed = JSON.parse(product.images);
                    images = Array.isArray(parsed) ? parsed : [];
                  } catch {
                    images = [];
                  }
                }
              }
              const getPriceInfo = () => {
                if (product.hasSinglePrice && product.singlePrice != null) {
                  const selling = parseFloat(product.singlePrice);
                  const mrp =
                    product.originalPrice != null && product.originalPrice !== ""
                      ? parseFloat(product.originalPrice)
                      : null;
                  return { selling, mrp };
                }
                if (!product.sizes?.length) return null;
                const minSize = product.sizes.reduce((acc, s) =>
                  parseFloat(s.price) < parseFloat(acc.price) ? s : acc
                );
                return {
                  selling: parseFloat(minSize.price),
                  mrp: minSize.originalPrice != null ? parseFloat(minSize.originalPrice) : null,
                };
              };
              const priceInfo = getPriceInfo();
              const displayPrice = priceInfo ? priceInfo.selling : null;
              const displayMrp =
                priceInfo && priceInfo.mrp != null && priceInfo.mrp > displayPrice ? priceInfo.mrp : null;
              const outOfStock = getAvailableStock(product) <= 0;
              const isRemoving = removingId === product.id;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-lg"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--background)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <Link to={`/product/${product.id}`} className="block">
                    <div
                      className="aspect-square w-full relative overflow-hidden"
                      style={{ background: "var(--muted)" }}
                    >
                      {images.length > 0 ? (
                        <img
                          src={images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <img src="/logo.png" alt="shoposphere" className="h-10 w-auto object-contain opacity-50" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link to={`/product/${product.id}`}>
                      <h3
                        className="font-semibold line-clamp-2 mb-2 hover:opacity-80 transition-opacity"
                        style={{ color: "var(--foreground)" }}
                      >
                        {product.name}
                      </h3>
                    </Link>
                    {displayPrice != null && (
                      <div className="flex flex-wrap items-baseline gap-2 mb-4">
                        <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                          ₹{Number(displayPrice).toLocaleString("en-IN")}
                        </span>
                        {displayMrp != null && displayMrp > displayPrice && (
                          <span className="text-sm line-through" style={{ color: "var(--muted)" }}>
                            ₹{Number(displayMrp).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        disabled={outOfStock}
                        className="w-full py-2.5 rounded-lg font-medium transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed btn-primary-brand"
                        style={{ borderRadius: "var(--radius-lg)" }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        {outOfStock ? "Out of stock" : "Add to Cart"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(product.id)}
                        disabled={isRemoving}
                        className="w-full py-2 rounded-lg font-medium text-sm transition-all duration-300 border disabled:opacity-60"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--foreground)",
                          borderRadius: "var(--radius-lg)",
                        }}
                      >
                        {isRemoving ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
