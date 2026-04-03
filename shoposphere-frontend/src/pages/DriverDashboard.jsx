import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import { useToast } from "../context/ToastContext";
import { API } from "../api";
import DeliveryMapCard from "../components/DeliveryMapCard";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DriverDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useUserAuth();
  const [driver, setDriver] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchOrders = useCallback(() => {
    setOrdersLoading(true);
    fetch(`${API}/driver/orders`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) return [];
        if (!res.ok) throw new Error("Failed to load orders");
        return res.json();
      })
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/driver/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/", { replace: true });
          return null;
        }
        if (!res.ok) throw new Error("Failed to load driver");
        return res.json();
      })
      .then((data) => {
        if (data) setDriver(data);
      })
      .catch((err) => setError(err.message || "Something went wrong"))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`${API}/driver/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update status");
        return;
      }
      toast.success(
        newStatus === "out_for_delivery"
          ? "Marked as out for delivery"
          : "Order marked as delivered"
      );
      fetchOrders();
    } catch (err) {
      toast.error("Could not update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div
          className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm mb-4" style={{ color: "var(--destructive)" }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg font-medium"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          Back to store
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header: title + logout */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-xl font-display font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Driver dashboard
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Welcome, {user?.name ?? driver?.email ?? "Driver"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-sm font-medium underline hover:no-underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Back to store
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-sm font-medium border"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
              background: "var(--card)",
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div
        className="rounded-2xl border p-6 mb-8"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <h2
          className="font-semibold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Your profile
        </h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt
              className="font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Name
            </dt>
            <dd style={{ color: "var(--foreground)" }}>
              {user?.name ?? driver?.userId ?? "—"}
            </dd>
          </div>
          <div>
            <dt
              className="font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Email
            </dt>
            <dd style={{ color: "var(--foreground)" }}>
              {driver?.email ?? user?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt
              className="font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Role
            </dt>
            <dd style={{ color: "var(--foreground)" }}>
              {driver?.role ?? "driver"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Orders */}
      <section>
        <h2
          className="text-lg font-display font-bold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Orders assigned to you
        </h2>
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <div
              className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--primary)" }}
            />
          </div>
        ) : orders.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No orders assigned yet. Admin will assign orders from the order
              detail page.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span
                    className="font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Order #{order.id}
                  </span>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    {order.orderStatus}
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  {order.customer}
                  {order.phone && ` · ${order.phone}`}
                </p>
                {order.address && (
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {order.address}
                  </p>
                )}
                {order.estimatedDeliveryDate && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Est. delivery: {formatDate(order.estimatedDeliveryDate)}
                  </p>
                )}
                {order.notes && (
                  <p
                    className="text-xs mt-1 italic"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Note: {order.notes}
                  </p>
                )}
                <div className="mt-3">
                  <DeliveryMapCard
                    address={order.address}
                    addressLatitude={order.addressLatitude}
                    addressLongitude={order.addressLongitude}
                  />
                </div>
                <p
                  className="text-sm mt-2 font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  ₹{Number(order.total).toFixed(2)}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Placed {formatDate(order.createdAt)}
                </p>
                {order.items?.length > 0 && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {order.items.length} item(s):{" "}
                    {order.items
                      .map((i) => `${i.productName} × ${i.quantity}`)
                      .join(", ")}
                  </p>
                )}

                {/* Status actions: shipped -> out_for_delivery; out_for_delivery -> delivered */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "shipped" && (
                    <button
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() =>
                        updateOrderStatus(order.id, "out_for_delivery")
                      }
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {updatingOrderId === order.id
                        ? "Updating…"
                        : "Out for Delivery"}
                    </button>
                  )}
                  {order.status === "out_for_delivery" && (
                    <button
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() =>
                        updateOrderStatus(order.id, "delivered")
                      }
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      style={{
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {updatingOrderId === order.id
                        ? "Updating…"
                        : "Mark delivered"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
