import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../api";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

function StatusBadge({ status }) {
  const config = {
    available: { bg: "var(--success)", color: "var(--primary-foreground)" },
    busy: { bg: "var(--accent)", color: "var(--foreground)" },
    offline: { bg: "var(--muted)", color: "var(--foreground)" },
  };
  const c = config[status] || config.offline;
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  return (
    <span
      className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      {label}
    </span>
  );
}

export default function AdminDriversPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [adding, setAdding] = useState(false);

  const fetchDrivers = () => {
    setError(null);
    setLoading(true);
    fetch(`${API}/admin/drivers`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/admin/login", { replace: true });
          return [];
        }
        if (!res.ok) throw new Error("Failed to load drivers");
        return res.json();
      })
      .then((data) => setDrivers(Array.isArray(data) ? data : []))
      .catch((err) => {
        setError(err.message || "Failed to load drivers");
        toast.error(err.message || "Failed to load drivers");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrivers();
  }, [navigate, logout, toast]);

  const handleStatusChange = async (driverId, newStatus) => {
    if (!driverId || !newStatus) return;
    setUpdatingId(driverId);
    try {
      const res = await fetch(`${API}/admin/drivers/update-status/${driverId}`, {
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
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, status: data.status } : d))
      );
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    const { name, phone, password, email } = addForm;
    if (!name?.trim() || !phone?.trim() || !password?.trim()) {
      toast.error("Name, phone and password are required.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${API}/admin/drivers/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          password,
          ...(email?.trim() && { email: email.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add driver");
        return;
      }
      toast.success("Driver added. They can log in with their email and password.");
      setAddForm({ name: "", email: "", phone: "", password: "" });
      setShowAddForm(false);
      fetchDrivers();
    } catch {
      toast.error("Failed to add driver");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-display font-bold" style={{ color: "var(--foreground)" }}>
          Drivers
        </h1>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <span aria-hidden>+</span> Add driver
        </button>
      </div>

      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => !adding && setShowAddForm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-driver-title"
        >
          <div
            className="rounded-2xl border shadow-xl w-full max-w-md p-6"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-driver-title" className="text-xl font-display font-bold mb-4" style={{ color: "var(--foreground)" }}>
              Add driver
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Drivers can log in on the storefront with their email and password.
            </p>
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Name *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Driver name"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Email (optional)</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="driver@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Phone *</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit phone"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>Password * (min 6 characters)</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border"
                  style={{ borderColor: "var(--border)", background: "var(--input)", color: "var(--foreground)" }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {adding ? "Adding…" : "Add driver"}
                </button>
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center justify-between"
          style={{ borderColor: "var(--destructive)", background: "var(--secondary)" }}
        >
          <p style={{ color: "var(--destructive)" }}>{error}</p>
          <button
            type="button"
            onClick={fetchDrivers}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "var(--shadow-soft)" }}
        >
          <div
            className="inline-block h-10 w-10 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: "var(--primary)" }}
          />
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading drivers…
          </p>
        </div>
      ) : drivers.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "var(--shadow-soft)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            No drivers yet.
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Click &quot;Add driver&quot; above to create a driver. They can then log in on the storefront.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-t transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                      {driver.name}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                      {driver.phone}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={driver.status} />
                    </td>
                    <td className="px-4 py-3">
                      {updatingId === driver.id ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: "var(--primary)" }}
                          />
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Updating…
                          </span>
                        </div>
                      ) : (
                        <select
                          value={driver.status}
                          onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                          className="px-3 py-2 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-2"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--background)",
                            color: "var(--foreground)",
                          }}
                          aria-label={`Update status for ${driver.name}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
