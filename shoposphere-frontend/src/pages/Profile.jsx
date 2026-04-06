import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api";
import { useUserAuth } from "../context/UserAuthContext";

function ActionTile({ to, title, subtitle, glyph }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "var(--background)",
        borderColor: "var(--border)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.04)",
      }}
    >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--secondary)" }}>
        {glyph}
      </div>
      <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
        {title}
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {subtitle}
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--primary)" }}>
        Open
      </p>
    </Link>
  );
}

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading, logout } = useUserAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ addresses: 0, orders: 0, wishlist: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true, state: { from: "/profile" } });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const ac = new AbortController();

    Promise.all([
      fetch(`${API}/addresses`, { credentials: "include", signal: ac.signal }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API}/orders/my-orders`, { credentials: "include", signal: ac.signal }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API}/wishlist`, { credentials: "include", signal: ac.signal }).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([addresses, orders, wishlist]) => {
        setStats({
          addresses: Array.isArray(addresses) ? addresses.length : 0,
          orders: Array.isArray(orders) ? orders.length : 0,
          wishlist: Array.isArray(wishlist) ? wishlist.length : 0,
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setStats({ addresses: 0, orders: 0, wishlist: 0 });
      })
      .finally(() => setStatsLoading(false));

    return () => ac.abort();
  }, [isAuthenticated]);

  const userInitial = useMemo(() => {
    const text = user?.name || user?.email || "U";
    return String(text).trim().charAt(0).toUpperCase();
  }, [user?.name, user?.email]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section
          className="rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(115deg, color-mix(in oklab, var(--secondary) 90%, white 10%) 0%, var(--background) 70%)",
            boxShadow: "0 16px 42px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className="grid h-14 w-14 place-items-center rounded-full text-xl font-black"
                style={{ background: "var(--foreground)", color: "var(--background)" }}
              >
                {userInitial}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                  My Profile
                </p>
                <h1 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--foreground)" }}>
                  {user?.name || "Shoposphere Member"}
                </h1>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {user?.email || ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              Log out
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionTile
            to="/profile/addresses"
            title="Manage Addresses"
            subtitle="Add, edit and set your default delivery address."
            glyph={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--foreground)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <ActionTile
            to="/profile/orders"
            title="My Orders"
            subtitle="Track order statuses and re-open order details."
            glyph={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--foreground)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1 12h12l1-12M9 11v4m6-4v4" />
              </svg>
            }
          />
          <ActionTile
            to="/profile/wishlist"
            title="Wishlist"
            subtitle="Keep your favourites ready for quick checkout."
            glyph={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--foreground)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }
          />
        </section>
      </div>
    </div>
  );
}
