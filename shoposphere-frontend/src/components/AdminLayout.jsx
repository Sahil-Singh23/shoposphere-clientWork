import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SIDEBAR_ITEMS = [
  { id: "products", label: "All Fruits", path: "/admin/dashboard", search: "" },
  { id: "categories", label: "Categories", path: "/admin/dashboard", search: "?tab=categories" },
  { id: "banners", label: "Banners", path: "/admin/dashboard", search: "?tab=banners" },
  { id: "reels", label: "Reels", path: "/admin/dashboard", search: "?tab=reels" },
  { id: "orders", label: "Orders", path: "/admin/orders" },
  { id: "drivers", label: "Drivers", path: "/admin/drivers" },
  { id: "analytics", label: "Analytics", path: "/admin/analytics" },
  { id: "inventory", label: "Inventory", path: "/admin/inventory" },
  { id: "reviews", label: "Reviews", path: "/admin/reviews" },
  { id: "messages", label: "Messages", path: "/admin/dashboard", search: "?tab=messages" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;

  const isActive = (item) => {
    if (item.path !== "/admin/dashboard") {
      return pathname === item.path || pathname.startsWith(item.path + "/");
    }
    const currentSearch = search || "";
    const wantSearch = item.search || "";
    if (!wantSearch) return pathname === "/admin/dashboard" && !currentSearch;
    return pathname === "/admin/dashboard" && currentSearch === wantSearch;
  };

  return (
    <div className="min-h-screen flex achroma-admin-shell" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar (desktop) */}
      <aside
        className="hidden lg:flex lg:flex-col w-72 border-r"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              SK
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                shoposphere
              </div>
              <div className="text-xs truncate max-w-[14rem] text-muted">{user?.email}</div>
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const to = item.search ? `${item.path}${item.search}` : item.path;
            const active = isActive(item);
            return (
              <Link
                key={item.id}
                to={to}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-left"
                style={{
                  backgroundColor: active ? "var(--primary)" : "transparent",
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "var(--secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => navigate("/")}
            className="w-full px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            View Shop
          </button>
          <button
            onClick={logout}
            className="w-full px-4 py-2.5 rounded-lg transition font-medium"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--secondary)";
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div
          className="achroma-admin-topbar sticky top-0 z-40 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 h-16 md:h-20">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  SK
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-xl md:text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    Admin <span style={{ color: "var(--primary)" }}>Dashboard</span>
                  </h1>
                  <p className="text-sm mt-0.5 truncate text-muted">Welcome, {user?.email}</p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  View Shop
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-lg transition font-medium bg-[var(--secondary)]"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
