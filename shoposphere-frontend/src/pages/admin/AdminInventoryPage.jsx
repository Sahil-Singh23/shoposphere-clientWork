import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../api";

function StockStatusBadge({ status }) {
  const config = {
    "In Stock": { bg: "var(--muted)", color: "var(--foreground)" },
    "Low Stock": { bg: "var(--accent)", color: "var(--foreground)" },
    "Out of Stock": { bg: "var(--destructive)", color: "white" },
  };
  const c = config[status] || config["In Stock"];
  return (
    <span
      className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      {status}
    </span>
  );
}

export default function AdminInventoryPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingRowId, setSavingRowId] = useState(null);

  const fetchInventory = () => {
    setError(null);
    fetch(`${API}/admin/inventory`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/admin/login", { replace: true });
          return [];
        }
        if (!res.ok) throw new Error("Failed to load inventory");
        return res.json();
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => {
        setError(err.message || "Failed to load inventory");
        toast.error(err.message || "Failed to load inventory");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInventory();
  }, [navigate, logout, toast]);

  const startEdit = (row) => {
    setEditingRowId(row.rowId);
    setEditValue(String(row.stock));
  };

  const cancelEdit = () => {
    setEditingRowId(null);
    setEditValue("");
  };

  const saveStock = async (row) => {
    const val = parseInt(editValue, 10);
    if (!Number.isInteger(val) || val < 0) {
      toast.error("Enter a non-negative number");
      return;
    }
    setSavingRowId(row.rowId);
    try {
      const body = {
        stock: val,
        ...(row.sizeId != null && { sizeId: row.sizeId }),
      };
      const res = await fetch(`${API}/admin/products/update-stock/${row.productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update stock");
        return;
      }
      setList((prev) =>
        prev.map((r) =>
          r.rowId === row.rowId
            ? { ...r, stock: data.stock, status: getStatus(data.stock) }
            : r
        )
      );
      setEditingRowId(null);
      setEditValue("");
      toast.success("Stock updated");
    } catch (err) {
      toast.error("Failed to update stock");
    } finally {
      setSavingRowId(null);
    }
  };

  function getStatus(stock) {
    const s = Number(stock ?? 0);
    if (s <= 0) return "Out of Stock";
    if (s <= 5) return "Low Stock";
    return "In Stock";
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {error && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center justify-between"
          style={{ borderColor: "var(--destructive)", background: "var(--secondary)" }}
        >
          <p style={{ color: "var(--destructive)" }}>{error}</p>
          <button
            type="button"
            onClick={fetchInventory}
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
          style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
        >
          <div
            className="inline-block h-10 w-10 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: "var(--primary)" }}
          />
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            Loading inventory…
          </p>
        </div>
      ) : list.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            No products found.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "var(--muted)" }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Product Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Size / Weight
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Current Stock
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Stock Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--foreground)" }}>
                    Update Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.rowId} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                      {row.productName}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                      {row.variantType === "weight" && (
                        <span className="font-medium">{row.variantLabel}</span>
                      )}
                      {row.variantType === "size" && (
                        <span className="font-medium">{row.variantLabel}</span>
                      )}
                      {row.variantType === "single" && (
                        <span style={{ color: "var(--muted)" }}>Single price</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                      {editingRowId === row.rowId ? (
                        <input
                          type="number"
                          min={0}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveStock(row);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="w-24 px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                          autoFocus
                        />
                      ) : (
                        row.stock
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {editingRowId === row.rowId ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveStock(row)}
                            disabled={savingRowId === row.rowId}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                          >
                            {savingRowId === row.rowId ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingRowId === row.rowId}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={editingRowId != null}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
                        >
                          Edit
                        </button>
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
