import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { useRecentlyViewed } from "../context/RecentlyViewedContext";
import { useUserAuth } from "../context/UserAuthContext";
import HorizontalProductCarousel from "../components/HorizontalProductCarousel";

export default function Cart() {
  const { recentIds } = useRecentlyViewed();
  const {
    cartItems,
    isLoaded,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
  } = useCart();
  const { isAuthenticated } = useUserAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please sign up or log in to continue checkout.");
      navigate("/signup");
      return;
    }

    navigate("/checkout");
  };

  const handleOpenProduct = (item) => {
    if (!item?.productId) return;
    navigate(`/product/${item.productId}`);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="h-10 w-48 rounded-lg animate-pulse mb-8" style={{ background: "var(--muted)" }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl p-6 flex gap-2 animate-pulse" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                  <div className="w-32 h-32 rounded-lg shrink-0" style={{ background: "var(--muted)" }} />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 rounded w-3/4" style={{ background: "var(--muted)" }} />
                    <div className="h-4 rounded w-1/2" style={{ background: "var(--muted)" }} />
                    <div className="h-8 rounded w-24" style={{ background: "var(--muted)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="rounded-xl p-6 sticky top-8 animate-pulse" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                <div className="h-6 rounded w-32 mb-6" style={{ background: "var(--muted)" }} />
                <div className="h-10 rounded w-full mb-4" style={{ background: "var(--muted)" }} />
                <div className="h-12 rounded w-full" style={{ background: "var(--muted)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl shadow-lg p-12 text-center" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <img src="/logo.png" alt="shoposphere" className="h-12 w-auto mx-auto mb-6 object-contain opacity-50" />
            <h2 className="text-xl font-bold mb-4 font-display" style={{ color: "var(--foreground)" }}>
              Your cart is empty
            </h2>
            <p className="mb-8" style={{ color: "var(--muted)" }}>
              Looks like you haven&apos;t added anything to your cart yet.
            </p>
            <Link
              to="/"
              className="btn-primary-brand inline-block px-8 py-3 rounded-xl font-semibold transition-all shadow-lg"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-8 font-display" style={{ color: "var(--foreground)" }}>Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const RowInner = (
                <div className="flex gap-4">
                  <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "var(--muted)" }}>
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl" aria-hidden>🧺</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
                      {item.productName}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      {item.selectedWeight ? (
                        <>
                          Weight: <span className="font-medium" style={{ color: "var(--foreground)" }}>{item.sizeLabel}</span>
                        </>
                      ) : (
                        <>
                          Size: <span className="font-medium" style={{ color: "var(--foreground)" }}>{item.sizeLabel}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-4 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      ₹{Number(item.subtotal || 0).toFixed(2)}
                    </p>
                    {typeof item.stock === "number" && item.stock <= 5 && item.stock > 0 && (
                      <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>
                        Only {item.stock} left
                      </p>
                    )}
                    {typeof item.stock === "number" && item.stock === 0 && (
                      <p className="text-xs mt-1" style={{ color: "var(--destructive)" }}>
                        Out of stock
                      </p>
                    )}
                  </div>
                </div>
              );

              return (
                <div
                  key={item.id}
                  className="rounded-2xl p-4 sm:p-5 border"
                  style={{ background: "var(--background)" }}
                >
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleOpenProduct(item)}
                      className="flex-1 min-w-0 text-left"
                      title="Open product"
                      type="button"
                    >
                      {RowInner}
                    </button>

                    <div className="flex flex-col items-end justify-between">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-xl leading-none px-1"
                        style={{ color: "var(--foreground)" }}
                        title="Remove item"
                      >
                        ×
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-10 h-10 rounded-2xl border flex items-center justify-center text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--background)" }}
                        >
                          −
                        </button>
                        <span className="text-xl font-medium w-6 text-center" style={{ color: "var(--foreground)" }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={typeof item.stock === "number" && item.quantity >= item.stock}
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: "var(--foreground)", color: "var(--background)" }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-xl shadow-lg p-6 sticky top-8 border" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-bold mb-6 font-display" style={{ color: "var(--foreground)" }}>Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between" style={{ color: "var(--foreground)" }}>
                  <span>Subtotal ({cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0)} items)</span>
                  <span className="font-semibold">₹{getCartTotal().toFixed(2)}</span>
                </div>
                <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Total</span>
                    <span className="text-xl font-bold" style={{ color: "var(--primary)" }}>₹{getCartTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleCheckout}
                  className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 btn-primary-brand"
                >
                  Proceed to Checkout
                </button>
                <Link
                  to="/"
                  className="block w-full text-center py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-md active:scale-95"
                  style={{ background: "var(--muted)", color: "var(--foreground)", borderRadius: "var(--radius-lg)" }}
                >
                  Continue Shopping
                </Link>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear your cart?")) {
                      clearCart();
                    }
                  }}
                  className="w-full py-2 text-sm rounded-lg transition-all duration-300 active:scale-95"
                  style={{ color: "var(--destructive)" }}
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Optional: Recently Viewed */}
        {recentIds.length > 0 && (
          <div className="mt-12">
            <HorizontalProductCarousel
              title="Recently Viewed"
              productIds={recentIds}
              showCounter={false}
              showControls={false}
              sectionClassName="mt-10 max-w-7xl mx-auto px-4"
              titleClassName="text-xl font-bold font-display mb-0"
              cardWrapperClassName="shrink-0 basis-[calc((100%-0.5rem)/2)] lg:basis-[calc((100%-2rem)/5)] overflow-hidden"
              skeletonCount={4}
              loadingSkeletonClassName="shrink-0 basis-[calc((100%-0.5rem)/2)] lg:basis-[calc((100%-2rem)/5)] rounded-xl animate-pulse"
              loadingTrackClassName="flex gap-1 overflow-x-auto scroll-smooth scrollbar-thin pb-2"
              renderTrackClassName="flex gap-2 overflow-x-auto scroll-smooth scrollbar-thin pb-2"
              hideScrollbar={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
