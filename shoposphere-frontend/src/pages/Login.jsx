import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { API } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useUserAuth();
  const { mergeCart } = useCart();
  const { mergeWishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const getSafeReturnPath = () => {
    const fromState = location.state?.from;
    const q = new URLSearchParams(location.search).get("returnTo");
    const raw = typeof fromState === "string" ? fromState : q;
    if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      if (result.redirectToAdmin) {
        window.location.href = "/admin/dashboard";
        return;
      }
      if (result.redirectToDriver) {
        navigate("/driver", { replace: true });
        return;
      }
      await mergeCart();
      await mergeWishlist();
      navigate(getSafeReturnPath(), { replace: true });
    } else {
      setError(result.error || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--page-auth-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-8 md:p-10 border"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="shoposphere" className="h-14 w-auto" />
          </div>
          <h1 className="font-display text-xl md:text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Welcome back
          </h1>
          <p style={{ color: "var(--text-muted)" }}>Sign in to your account</p>
        </div>

        {error && (
          <div
            className="mb-6 p-4 rounded-lg border"
            style={{ borderColor: "var(--destructive)", backgroundColor: "var(--secondary)" }}
          >
            <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>
          </div>
        )}

        {/* Google Sign In Button - Above Form */}
        <a 
          href={`${API}/auth/login/federated/google`}
          className="w-full flex items-center justify-center px-4 py-3 border rounded-xl shadow-sm text-sm font-medium transition-all hover:shadow-md mb-6"
          style={{ 
            borderColor: "var(--border)", 
            backgroundColor: "var(--background)",
            color: "var(--foreground)"
          }}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" style={{ borderColor: "var(--border)" }}></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span style={{ background: "var(--background)", color: "var(--text-muted)", padding: "0 8px" }}>Or sign in with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 transition"
              style={{
                background: "var(--input)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 transition pr-10"
                style={{
                  background: "var(--input)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-brand w-full py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold" style={{ color: "var(--primary)" }}>
            Sign up
          </Link>
        </p>
        <p className="mt-3 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Admin? Sign in with your admin email — you&apos;ll be redirected to the dashboard.
        </p>
      </div>
    </div>
  );
}
