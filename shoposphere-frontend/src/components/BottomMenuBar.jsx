import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUserAuth } from "../context/UserAuthContext";

const items = [
  {
    key: "home",
    label: "Home",
    to: "/",
    isActive: (pathname) => pathname === "/" || pathname === "/shop",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M3 11.5L12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M5.5 10.5V20h13V10.5" />
      </svg>
    ),
  },
  {
    key: "search",
    label: "Search",
    to: "/search",
    isActive: (pathname) => pathname === "/search",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    key: "cart",
    label: "Cart",
    to: "/cart",
    isActive: (pathname) => pathname === "/cart" || pathname === "/checkout",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M3.5 5h2.2l1.7 9.2h10.3l1.8-6.2H7.2" />
        <circle cx="10" cy="19" r="1.4" strokeWidth={1.9} />
        <circle cx="17" cy="19" r="1.4" strokeWidth={1.9} />
      </svg>
    ),
  },
  {
    key: "wishlist",
    label: "Wishlist",
    to: "/profile/wishlist",
    isActive: (pathname) => pathname === "/profile/wishlist",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    toAuth: "/profile/orders",
    toGuest: "/login",
    isActive: (pathname) => pathname.startsWith("/profile") || pathname === "/login" || pathname === "/signup",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="8" r="3.2" strokeWidth={1.9} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M5 20c1.8-3.4 4.2-5.2 7-5.2S17.2 16.6 19 20" />
      </svg>
    ),
  },
];

export default function BottomMenuBar() {
  const location = useLocation();
  const { getCartCount } = useCart();
  const { isAuthenticated } = useUserAuth();
  const cartCount = getCartCount();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md"
      style={{
        borderColor: "rgba(0, 0, 0, 0.06)",
        background: "rgba(255, 255, 255, 0.78)",
        boxShadow: "0 -10px 34px rgba(0,0,0,0.14)",
      }}
      aria-label="Bottom menu"
    >
      <div className="grid grid-cols-5 h-[72px] px-2">
        {items.map((item) => {
          const active = item.isActive(location.pathname);
          const to = item.key === "profile" ? (isAuthenticated ? item.toAuth : item.toGuest) : item.to;
          const isCenter = item.key === "cart";

          return (
            <Link
              key={item.key}
              to={to}
              className="relative flex flex-col items-center justify-center gap-1 rounded-xl transition-all"
              style={{ color: active ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.48)" }}
              aria-current={active ? "page" : undefined}
            >
              <div
                className="relative grid place-items-center"
                style={{
                  height: isCenter ? 44 : 36,
                  width: isCenter ? 44 : 36,
                  borderRadius: 999,
                  backgroundColor: isCenter ? "rgba(0,0,0,0.86)" : "transparent",
                  color: isCenter ? "white" : undefined,
                  boxShadow: isCenter ? "0 18px 34px rgba(0,0,0,0.22)" : "none",
                  transform: isCenter ? "translateY(-10px)" : "none",
                }}
              >
                {item.icon}
                {item.key === "cart" && cartCount > 0 && (
                  <span
                    className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                    style={{
                      backgroundColor: "#e11d48",
                      color: "white",
                      boxShadow: "0 12px 20px rgba(0,0,0,0.20)",
                    }}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold leading-none" style={{ transform: isCenter ? "translateY(-6px)" : "none" }}>
                {item.label}
              </span>
              {active && (
                <span
                  className="absolute bottom-1 h-1 w-10 rounded-full"
                  style={{ backgroundColor: "rgba(0,0,0,0.86)" }}
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
