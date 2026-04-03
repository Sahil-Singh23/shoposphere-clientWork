import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../api";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  confirmed: "Confirmed",
  // UI: treat internal "shipped" as part of the "Out for Delivery" stage
  shipped: "Out for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function SummaryCardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 min-h-[100px] animate-pulse"
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <div className="h-4 w-24 rounded mb-3" style={{ background: "var(--muted)" }} />
      <div className="h-8 w-20 rounded" style={{ background: "var(--muted)" }} />
    </div>
  );
}

function SummaryCard({ label, value, formatter = (v) => v }) {
  return (
    <div
      className="rounded-xl p-5 transition-shadow hover:shadow-lg"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)",
      }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="text-xl font-display font-bold" style={{ color: "var(--foreground)" }}>
        {formatter(value)}
      </p>
    </div>
  );
}

function formatCurrency(v) {
  return `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminAnalyticsPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [statusDistribution, setStatusDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("day");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filtersInitialized = useRef(false);

  const fetchSummary = async () => {
    const res = await fetch(`${API}/admin/analytics/summary`, { credentials: "include" });
    if (res.status === 401) {
      logout();
      navigate("/admin/login", { replace: true });
      return null;
    }
    if (!res.ok) throw new Error("Failed to load summary");
    return res.json();
  };

  const fetchRevenueTrend = async () => {
    const params = new URLSearchParams({ period });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const res = await fetch(`${API}/admin/analytics/revenue-trend?${params}`, { credentials: "include" });
    if (res.status === 401) return [];
    if (!res.ok) throw new Error("Failed to load revenue trend");
    return res.json();
  };

  const fetchTopProducts = async () => {
    const res = await fetch(`${API}/admin/analytics/top-products?limit=10`, { credentials: "include" });
    if (res.status === 401) return [];
    if (!res.ok) throw new Error("Failed to load top products");
    return res.json();
  };

  const fetchStatusDistribution = async () => {
    const res = await fetch(`${API}/admin/analytics/order-status-distribution`, { credentials: "include" });
    if (res.status === 401) return [];
    if (!res.ok) throw new Error("Failed to load status distribution");
    return res.json();
  };

  useEffect(() => {
    setError(null);
    setLoading(true);
    Promise.all([fetchSummary(), fetchRevenueTrend(), fetchTopProducts(), fetchStatusDistribution()])
      .then(([s, r, t, d]) => {
        if (s) setSummary(s);
        setRevenueTrend(Array.isArray(r) ? r : []);
        setTopProducts(Array.isArray(t) ? t : []);
        setStatusDistribution(Array.isArray(d) ? d : []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load analytics");
        toast.error(err.message || "Failed to load analytics");
      })
      .finally(() => setLoading(false));
  }, [navigate, logout, toast]);

  useEffect(() => {
    if (!filtersInitialized.current) {
      filtersInitialized.current = true;
      return;
    }
    fetchRevenueTrend()
      .then((r) => setRevenueTrend(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [period, dateFrom, dateTo]);

  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const statusChartData = useMemo(
    () =>
      statusDistribution.map((item) => ({
        name: STATUS_LABELS[item.status] || item.status,
        value: item.count,
      })),
    [statusDistribution]
  );

  const revenueTrendDisplay = useMemo(() => {
    return revenueTrend.map((d) => ({
      ...d,
      displayDate: d.date.length === 10 ? d.date : d.date.slice(0, 10),
    }));
  }, [revenueTrend]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {error && (
          <div
            className="rounded-xl border p-4 flex items-center justify-between"
            style={{ borderColor: "var(--destructive)", background: "var(--secondary)" }}
          >
            <p style={{ color: "var(--destructive)" }}>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Overview
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <SummaryCardSkeleton key={i} />
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <SummaryCard label="Total Revenue" value={summary.totalRevenue} formatter={formatCurrency} />
              <SummaryCard label="Total Orders" value={summary.totalOrders} />
              <SummaryCard label="Total Customers" value={summary.totalCustomers} />
              <SummaryCard label="Average Order Value" value={summary.averageOrderValue} formatter={formatCurrency} />
              <SummaryCard label="Pending Orders" value={summary.pendingOrders} />
              <SummaryCard label="Delivered Orders" value={summary.deliveredOrders} />
            </div>
          ) : (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
            >
              <p style={{ color: "var(--muted)" }}>No summary data available.</p>
            </div>
          )}
        </section>

        {/* Filters for revenue trend */}
        <section className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Revenue period:
          </span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </section>

        {/* Revenue trend chart */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Revenue trend
          </h2>
          <div
            className="rounded-xl border p-4 md:p-6 min-h-[280px]"
            style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)" }}
          >
            {loading ? (
              <div className="h-[260px] flex items-center justify-center" style={{ color: "var(--muted)" }}>
                <div className="inline-block h-10 w-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
              </div>
            ) : revenueTrendDisplay.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center" style={{ color: "var(--muted)" }}>
                No revenue data for the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueTrendDisplay} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="displayDate" tick={{ fill: "var(--muted)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--foreground)",
                    }}
                    formatter={(value) => [formatCurrency(value), "Revenue"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order status distribution */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Order status distribution
            </h2>
            <div
              className="rounded-xl border p-4 md:p-6 min-h-[280px]"
              style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)" }}
            >
              {loading ? (
                <div className="h-[260px] flex items-center justify-center" style={{ color: "var(--muted)" }}>
                  <div className="inline-block h-10 w-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
                </div>
              ) : statusChartData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center" style={{ color: "var(--muted)" }}>
                  No order data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusChartData.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--foreground)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Top products */}
          <section>
            <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Top products
            </h2>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)" }}
            >
              {loading ? (
                <div className="p-8 flex items-center justify-center min-h-[280px]" style={{ color: "var(--muted)" }}>
                  <div className="inline-block h-10 w-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
                </div>
              ) : topProducts.length === 0 ? (
                <div className="p-8 text-center min-h-[280px] flex items-center justify-center" style={{ color: "var(--muted)" }}>
                  No product sales data yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--muted)" }}>
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                          Product
                        </th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--foreground)" }}>
                          Units sold
                        </th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--foreground)" }}>
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((row, i) => (
                        <tr key={row.productId} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: "var(--foreground)" }}>
                            {row.totalSold}
                          </td>
                          <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--primary)" }}>
                            {formatCurrency(row.revenueGenerated)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
    </div>
  );
}
