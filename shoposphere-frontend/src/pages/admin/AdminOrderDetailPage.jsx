import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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

const STEPS = ["Processing", "Confirmed", "Out for Delivery", "Delivered"];

function stepIndex(status) {
  const s = String(status || "").toLowerCase().replace(/\s+/g, "_");
  if (s === "cancelled") return -1;
  if (["pending", "processing"].includes(s)) return 0;
  if (s === "confirmed") return 1;
  if (["shipped", "out_for_delivery"].includes(s)) return 2;
  if (s === "delivered") return 3;
  return 0;
}

function StatusBadge({ status }) {
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
    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/admin/orders/${id}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/admin/login", { replace: true });
          return null;
        }
        if (res.status === 404) return null;
        return res.json();
      })
      .then((data) => {
        setOrder(data);
        setAssignDriverId(data?.driverUserId != null ? String(data.driverUserId) : "");
      })
      .catch(() => toast.error("Failed to load order"))
      .finally(() => setLoading(false));
  }, [id, navigate, logout, toast]);

  useEffect(() => {
    fetch(`${API}/admin/drivers`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDrivers(Array.isArray(data) ? data : []))
      .catch(() => setDrivers([]));
  }, []);

  const updateStatus = async (newStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API}/admin/orders/update-status/${order.id}`, {
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
      setOrder((prev) => (prev ? { ...prev, status: data.status, orderStatus: data.orderStatus } : null));
      setConfirmCancel(false);
      toast.success("Order updated");
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === "cancelled") {
      setConfirmCancel(true);
      return;
    }
    updateStatus(newStatus);
  };

  const confirmCancelOrder = () => {
    updateStatus("cancelled");
  };

  const assignDriver = async () => {
    if (!order) return;
    setAssigning(true);
    try {
      const driverUserId = assignDriverId === "" || assignDriverId === "none" ? null : Number(assignDriverId);
      const res = await fetch(`${API}/admin/orders/${order.id}/assign-driver`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ driverUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to assign driver");
        return;
      }
      setOrder((prev) => (prev ? { ...prev, driverUserId: data.driverUserId, driver: data.driver } : null));
      setAssignDriverId(driverUserId != null ? String(driverUserId) : "");
      toast.success(data.driver ? "Driver assigned" : "Driver unassigned");
    } catch {
      toast.error("Failed to assign driver");
    } finally {
      setAssigning(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <p className="font-medium mb-4" style={{ color: "var(--foreground)" }}>Order not found.</p>
          <Link to="/admin/orders" style={{ color: "var(--primary)" }}>Back to Orders</Link>
        </div>
      </div>
    );
  }

  const currentStep = stepIndex(order.status);
  const isCancelled = String(order.status).toLowerCase() === "cancelled";
  const rawStatus =
    order.status === "pending"
      ? "processing"
      : (order.status === "shipped" ? "out_for_delivery" : (order.status || "processing"));

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="sticky top-0 z-40 border-b bg-[var(--background)]/95 backdrop-blur-sm" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-4">
              <Link to="/admin/orders" className="p-2 rounded-lg transition" style={{ color: "var(--foreground)" }} aria-label="Back to orders">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="font-display text-xl font-bold" style={{ color: "var(--foreground)" }}>Order #{order.id}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.orderStatus} />
        </div>

        {!isCancelled && (
          <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--muted)" }}>Order status</h2>
            <div className="flex justify-between relative pt-1">
              <div className="absolute top-5 left-0 right-0 h-0.5" style={{ background: "var(--border)" }} />
              <div
                className="absolute top-5 left-0 h-0.5 transition-all duration-500"
                style={{ width: `${(currentStep / Math.max(STEPS.length - 1, 1)) * 100}%`, background: "var(--primary)" }}
              />
              {STEPS.map((label, idx) => {
                const done = currentStep > idx;
                const active = currentStep === idx;
                return (
                  <div key={label} className="flex flex-col items-center relative z-10">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all"
                      style={{
                        borderColor: done || active ? "var(--primary)" : "var(--border)",
                        background: done ? "var(--primary)" : "var(--background)",
                        color: done ? "var(--primary-foreground)" : active ? "var(--primary)" : "var(--muted)",
                      }}
                    >
                      {(done || active) ? "✓" : idx + 1}
                    </div>
                    <span className="text-xs font-medium mt-2" style={{ color: active || done ? "var(--foreground)" : "var(--muted)" }}>{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Change status:</label>
              <select
                value={rawStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className="px-4 py-2 rounded-lg border font-medium"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {updating && <span className="inline-block h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />}
            </div>
          </section>
        )}

        {isCancelled && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--destructive)", background: "var(--secondary)" }}>
            <p className="font-medium" style={{ color: "var(--destructive)" }}>This order is cancelled.</p>
          </div>
        )}

        <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Assign driver</h2>
          {order.driver ? (
            <p className="text-sm mb-3" style={{ color: "var(--foreground)" }}>
              Current: <strong>{order.driver.name}</strong> {order.driver.phone && ` · ${order.driver.phone}`}
            </p>
          ) : (
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>No driver assigned. Orders can also be auto-assigned when placed.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assignDriverId}
              onChange={(e) => setAssignDriverId(e.target.value)}
              disabled={assigning}
              className="px-4 py-2 rounded-lg border font-medium min-w-[180px]"
              style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            >
              <option value="">Unassign</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} {d.phone ? `(${d.phone})` : ""}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={assignDriver}
              disabled={assigning || assignDriverId === (order.driverUserId != null ? String(order.driverUserId) : "")}
              className="px-4 py-2 rounded-lg font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {assigning ? "Updating…" : "Assign"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Customer</h2>
          <p className="font-medium" style={{ color: "var(--foreground)" }}>{order.customerDetails?.name}</p>
          {order.customerDetails?.phone && <p className="text-sm" style={{ color: "var(--muted)" }}>{order.customerDetails.phone}</p>}
          {order.customerDetails?.email && <p className="text-sm" style={{ color: "var(--muted)" }}>{order.customerDetails.email}</p>}
          {order.customerDetails?.address && <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>{order.customerDetails.address}</p>}
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--muted)" }}>Items</h2>
          <ul className="space-y-4">
            {order.items?.map((item, idx) => (
              <li key={idx} className="flex gap-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--muted)" }}>
                  {item.image ? <img src={item.image} alt={item.productName} className="w-full h-full object-cover" /> : <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color: "var(--foreground)" }}>{item.productName}</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{item.sizeLabel} × {item.quantity}</p>
                </div>
                <p className="font-semibold" style={{ color: "var(--primary)" }}>₹{Number(item.subtotal).toFixed(2)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t flex justify-between font-bold text-lg" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <span>Total</span>
            <span style={{ color: "var(--primary)" }}>₹{Number(order.totalAmount).toFixed(2)}</span>
          </div>
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Payment</h2>
          <p style={{ color: "var(--foreground)" }}>{order.paymentStatus} {order.paymentMethod === "cod" ? "(Cash on Delivery)" : ""}</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{formatDate(order.createdAt)}</p>
        </section>
      </main>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => !updating && setConfirmCancel(false)}>
          <div
            className="rounded-2xl border p-6 w-full max-w-sm shadow-xl"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-semibold text-lg mb-2" style={{ color: "var(--foreground)" }}>Cancel order?</h3>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>This will mark the order as cancelled. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl font-medium border-2"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl font-medium"
                style={{ background: "var(--destructive)", color: "white" }}
              >
                {updating ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
