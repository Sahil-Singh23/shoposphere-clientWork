import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate("/admin/dashboard");
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-page-auth flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-xl p-8 md:p-12 max-w-md w-full border" style={{ backgroundColor: "var(--card-white)", borderColor: "var(--border)" }}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.png" alt="shoposphere" className="h-14 w-auto" />
          </div>
          <h1 className="font-display text-xl font-bold text-design-foreground mb-2">
            Admin <span className="text-[var(--hover-accent)]">Login</span>
          </h1>
          <p className="text-design-muted">Access your admin dashboard</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10">
            <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-design-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-design rounded-lg focus:outline-none focus:border-[var(--primary)] transition bg-[var(--input)] text-design-foreground"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-design-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-design rounded-lg focus:outline-none focus:border-[var(--primary)] transition bg-[var(--input)] text-design-foreground"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-brand w-full py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
