import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { API } from "../../api";
import StarRating from "../../components/StarRating";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminReviewsPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchReviews = () => {
    fetch(`${API}/admin/reviews`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/admin/login", { replace: true });
          return [];
        }
        return res.json();
      })
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load reviews"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, [navigate, logout]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/reviews/delete/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Review deleted");
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(data.error || "Failed to delete review");
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-8 w-48 rounded animate-pulse mb-6" style={{ background: "var(--muted)" }} />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--muted)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--foreground)" }}>
          Reviews
        </h1>
      </div>

        {reviews.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-12 text-center"
            style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
          >
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No reviews yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border p-4 flex flex-wrap items-start justify-between gap-4"
                style={{ borderColor: "var(--border)", background: "var(--background)", boxShadow: "var(--shadow-soft)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      to={`/product/${r.productId}`}
                      className="font-semibold hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      {r.productName || `Product #${r.productId}`}
                    </Link>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      #{r.productId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating value={r.rating} readonly size="sm" />
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {r.userName || "Anonymous"}
                    </span>
                    {r.userEmail ? (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        ({r.userEmail})
                      </span>
                    ) : null}
                  </div>
                  {r.comment ? (
                    <p className="text-sm mt-2" style={{ color: "var(--foreground)" }}>
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                    {formatDate(r.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-opacity"
                  style={{ background: "var(--destructive)", color: "white" }}
                >
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
