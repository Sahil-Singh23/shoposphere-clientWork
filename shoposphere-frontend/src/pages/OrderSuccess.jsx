import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { useUserAuth } from "../context/UserAuthContext";
import { API } from "../api";
import DriverInfo from "../components/DriverInfo";

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { isAuthenticated } = useUserAuth();
  const orderId = searchParams.get("orderId") || "";
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (orderId) clearCart();
  }, [orderId, clearCart]);

  useEffect(() => {
    if (!orderId || !isAuthenticated) return;
    fetch(`${API}/orders/${orderId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOrder(data))
      .catch(() => setOrder(null));
  }, [orderId, isAuthenticated]);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div
        className="max-w-md w-full rounded-2xl shadow-lg p-8 sm:p-10 text-center border"
        style={{ background: "var(--background)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
      >
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl sm:text-xl font-bold font-display mb-2" style={{ color: "var(--foreground)" }}>
          Order confirmed
        </h1>
        <p className="mb-4" style={{ color: "var(--text-muted)" }}>
          Thank you for your order. We&apos;ll get it to you soon.
        </p>
        {orderId && (
          <p className="text-sm mb-4 font-mono px-3 py-2 rounded-lg" style={{ background: "var(--muted)", color: "var(--foreground)" }}>
            Order ID: {orderId}
          </p>
        )}
        {/* Delivery ETA */}
        {order?.estimatedDeliveryMinutes != null && (
          <div className="rounded-xl p-4 mb-4 text-left" style={{ background: "linear-gradient(135deg, #16a34a 0%, #059669 100%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-white">
                  Arriving in ~{order.estimatedDeliveryMinutes} mins
                </p>
                {order.driverAvailable === false && (
                  <p className="text-xs text-white/80 mt-0.5">
                    We&apos;re assigning a delivery partner — may take slightly longer
                  </p>
                )}
                {order.driverAvailable === true && order.driver && (
                  <p className="text-xs text-white/80 mt-0.5">
                    Your delivery partner is on the way!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {order?.driver && (
          <div className="mb-6 text-left">
            <DriverInfo driver={order.driver} />
          </div>
        )}
        <Link
          to="/"
          className="btn-primary-brand inline-block w-full sm:w-auto px-8 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
          style={{ borderRadius: "var(--radius-lg)" }}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
