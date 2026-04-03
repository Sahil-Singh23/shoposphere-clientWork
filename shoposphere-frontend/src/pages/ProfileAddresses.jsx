import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import { useToast } from "../context/ToastContext";
import { API } from "../api";
import AddressForm from "../components/AddressForm";

export default function ProfileAddresses() {
  const { isAuthenticated, loading: authLoading } = useUserAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAddresses = async () => {
    try {
      const res = await fetch(`${API}/addresses`, { credentials: "include" });
      if (res.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const data = await res.json();
      setAddresses(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Could not load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (isAuthenticated) fetchAddresses();
  }, [authLoading, isAuthenticated, navigate]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (addr) => {
    setEditing(addr);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`${API}/addresses/update/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Could not update address");
          return;
        }
        toast.success("Address updated");
      } else {
        const res = await fetch(`${API}/addresses/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Could not add address");
          return;
        }
        toast.success("Address added");
      }
      setModalOpen(false);
      setEditing(null);
      fetchAddresses();
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this address?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/addresses/delete/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not delete");
        return;
      }
      toast.success("Address removed");
      fetchAddresses();
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  };

  const setDefault = async (id) => {
    try {
      const res = await fetch(`${API}/addresses/set-default/${id}`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not set default");
        return;
      }
      toast.success("Default address updated");
      fetchAddresses();
    } catch (e) {
      toast.error("Something went wrong");
    }
  };

  if (authLoading || (!isAuthenticated && !addresses.length)) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--foreground)" }}>
            Saved Addresses
          </h1>
          <Link
            to="/"
            className="text-sm font-medium"
            style={{ color: "var(--muted)" }}
          >
            ← Back to shop
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl p-6 animate-pulse border"
                style={{ background: "var(--muted)", borderColor: "var(--border)" }}
              >
                <div className="h-5 rounded w-1/3 mb-2" style={{ background: "var(--border)" }} />
                <div className="h-4 rounded w-full mb-1" style={{ background: "var(--border)" }} />
                <div className="h-4 rounded w-2/3" style={{ background: "var(--border)" }} />
              </div>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center border"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <p className="mb-4" style={{ color: "var(--muted)" }}>No saved addresses yet.</p>
            <button
              type="button"
              onClick={openAdd}
              className="btn-primary-brand px-6 py-3 rounded-xl font-semibold"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              Add your first address
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-xl p-6 border shadow-sm transition"
                style={{
                  background: "var(--background)",
                  borderColor: addr.isDefault ? "var(--primary)" : "var(--border)",
                  borderWidth: addr.isDefault ? 2 : 1,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {addr.isDefault && (
                      <span
                        className="inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2"
                        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        Default
                      </span>
                    )}
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{addr.fullName}</p>
                    <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{addr.phone}</p>
                    <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>
                      {addr.addressLine}, {addr.city}, {addr.state} – {addr.pincode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefault(addr.id)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(addr)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      disabled={deletingId === addr.id}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ color: "var(--destructive)" }}
                    >
                      {deletingId === addr.id ? "Removing…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={openAdd}
              className="w-full py-4 rounded-xl border-2 border-dashed font-medium transition"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              + Add New Address
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold font-display mb-4" style={{ color: "var(--foreground)" }}>
              {editing ? "Edit address" : "Add new address"}
            </h2>
            <AddressForm
              initialValues={editing}
              onSubmit={handleSave}
              onCancel={() => !saving && setModalOpen(false)}
              loading={saving}
              submitLabel={editing ? "Update" : "Add address"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
