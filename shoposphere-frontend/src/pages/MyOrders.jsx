import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import { useToast } from "../context/ToastContext";
import { API } from "../api";
import DriverInfo from "../components/DriverInfo";

function OrderCardSkeleton() {
  return (
    <div className="rounded-xl border p-6 animate-pulse" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-24 rounded" style={{ background: "var(--muted)" }} />
          <div className="h-4 w-32 rounded" style={{ background: "var(--muted)" }} />
        </div>
        <div className="h-8 w-20 rounded-lg" style={{ background: "var(--muted)" }} />
      </div>
      <div className="mt-4 flex gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="w-14 h-14 rounded-lg" style={{ background: "var(--muted)" }} />
        ))}
      </div>
      <div className="mt-4 h-10 w-full rounded-lg" style={{ background: "var(--muted)" }} />
    </div>
  );
}

function StatusBadge({ status, type = "order" }) {
  const statusConfig = {
    Processing: { bg: "var(--muted)", color: "var(--foreground)" },
    Confirmed: { bg: "var(--primary)", color: "var(--primary-foreground)" },
    "Out for Delivery": { bg: "var(--accent)", color: "var(--foreground)" },
    Delivered: { bg: "var(--success)", color: "white" },
    Cancelled: { bg: "var(--destructive)", color: "white" },
    Paid: { bg: "var(--success)", color: "white" },
    Pending: { bg: "var(--muted)", color: "var(--foreground)" },
    COD: { bg: "var(--muted)", color: "var(--foreground)" },
  };
  const config = statusConfig[status] || statusConfig.Processing;
  return (
    <span
      className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: config.bg, color: config.color }}
    >
      {status}
    </span>
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function MyOrders() {
  const { isAuthenticated, loading: authLoading } = useUserAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAuthenticated) return;

    fetch(`${API}/orders/my-orders`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login", { replace: true });
          return [];
        }
        return res.json();
      })
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        toast.error("Could not load orders");
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, navigate, toast]);

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="h-9 w-48 rounded-lg animate-pulse mb-8" style={{ background: "var(--muted)" }} />
          <div className="space-y-6">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold font-display mb-8" style={{ color: "var(--foreground)" }}>
          My Orders
        </h1>

        {orders.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-12 text-center"
            style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--muted)" }}
            >
              <svg className="w-8 h-8" style={{ color: "var(--muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2" style={{ color: "var(--foreground)" }}>
              No orders yet
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              When you place an order, it will show up here.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
              style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-fg)", borderRadius: "var(--radius-lg)" }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-6">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <div className="p-6">
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div>
                      <p className="text-sm font-mono font-medium flex flex-wrap items-center gap-2" style={{ color: "var(--muted)" }}>
                        <span>Order #{order.id}</span>
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={order.paymentStatus} type="payment" />
                      <StatusBadge status={order.orderStatus} type="order" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold" style={{ color: "var(--primary)" }}>
                      ₹{Number(order.totalAmount).toFixed(2)}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      · {order.items?.length || 0} item(s)
                    </span>
                  </div>
                  {order.driver && (
                    <DriverInfo driver={order.driver} compact />
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 mt-4">
                    {order.items?.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                        style={{ background: "var(--muted)" }}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </div>
                    ))}
                    {(order.items?.length || 0) > 4 && (
                      <div
                        className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-medium"
                        style={{ background: "var(--muted)", color: "var(--foreground)" }}
                      >
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/orders/${order.id}`}
                    className="mt-4 block w-full py-3 rounded-xl text-center font-semibold transition-all border-2"
                    style={{
                      borderColor: "var(--primary)",
                      color: "var(--primary)",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    View Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
