import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../api";

const STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "confirmed", label: "Confirmed" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status, type = "order" }) {
  const config = {
    Processing: { bg: "var(--muted)", color: "var(--foreground)" },
    Confirmed: { bg: "var(--accent)", color: "var(--foreground)" },
    "Out for Delivery": { bg: "var(--accent)", color: "var(--foreground)" },
    Delivered: { bg: "var(--success)", color: "white" },
    Cancelled: { bg: "var(--destructive)", color: "white" },
    Paid: { bg: "var(--success)", color: "white" },
    Pending: { bg: "var(--muted)", color: "var(--foreground)" },
    COD: { bg: "var(--muted)", color: "var(--foreground)" },
  };
  const c = config[status] || config.Processing;
  return (
    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminOrdersPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetch(`${API}/admin/orders`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/admin/login", { replace: true });
          return [];
        }
        return res.json();
      })
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false));
  }, [navigate, logout, toast]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatus) {
      const s = filterStatus.toLowerCase();
      list = list.filter((o) => String(o.status || o.orderStatus || "").toLowerCase().replace(/\s+/g, "_") === s);
    }
    if (filterPayment) {
      list = list.filter((o) => String(o.paymentStatus || "").toLowerCase() === filterPayment.toLowerCase());
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          String(o.id).includes(q) ||
          (o.customerDetails?.name || "").toLowerCase().includes(q) ||
          (o.customerDetails?.phone || "").includes(q) ||
          (o.customerDetails?.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, filterStatus, filterPayment, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterPayment, search]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    const prev = orders.find((o) => o.id === orderId);
    const prevStatus = prev?.status ?? prev?.orderStatus;
    try {
      const res = await fetch(`${API}/admin/orders/update-status/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderStatus: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update status");
        return;
      }
      setOrders((list) =>
        list.map((o) => (o.id === orderId ? { ...o, status: data.status, orderStatus: data.orderStatus } : o))
      );
      toast.success("Order updated");
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters & search */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by Order ID, customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2.5 rounded-lg border text-sm min-w-[200px] max-w-xs"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="px-4 py-2.5 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          >
            <option value="">All payments</option>
            <option value="Paid">Paid</option>
            <option value="COD">COD</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--secondary)" }}>
            <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "var(--primary)" }} />
            <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", background: "var(--secondary)" }}>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>No orders found.</p>
          </div>
        ) : (
          <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Order ID</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Customer</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Date</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Total</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Payment</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Status</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((order) => (
                    <tr key={order.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--foreground)" }}>
                        <span className="inline-flex items-center gap-2">#{order.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: "var(--foreground)" }}>{order.customerDetails?.name || "—"}</div>
                        {order.customerDetails?.phone && <div className="text-xs" style={{ color: "var(--muted)" }}>{order.customerDetails.phone}</div>}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--primary)" }}>₹{Number(order.totalAmount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.paymentStatus} type="payment" /></td>
                      <td className="px-4 py-3">
                        <select
                          value={
                            order.status === "pending"
                              ? "processing"
                              : (order.status === "shipped" ? "out_for_delivery" : (order.status || "processing"))
                          }
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          className="px-2 py-1.5 rounded-lg border text-xs font-medium"
                          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {updatingId === order.id && (
                          <span className="ml-2 inline-block h-3 w-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="inline-block px-3 py-1.5 rounded-lg font-medium text-sm"
                          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Page {safePage} of {totalPages} · {filtered.length} order(s)
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                Next
              </button>
            </div>
          </div>
          </>
        )}
    </div>
  );
}
