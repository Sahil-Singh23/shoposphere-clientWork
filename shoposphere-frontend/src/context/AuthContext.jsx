import { createContext, useContext, useState, useEffect } from "react";
import { API } from "../api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async () => {
    try {
      const res = await fetch(`${API}/auth/verify`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else if (res.status === 401) {
        // 401 means invalid/expired token or user is not admin
        // For admin dashboard, this is expected for non-admin users
        // Don't logout here - let UserAuthContext handle customer auth
        setUser(null);
      } else {
        // Other errors might warrant logout
        logout();
      }
    } catch (error) {
      console.error("Token verification error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.user?.isAdmin) {
          setUser(data.user);
          return { success: true };
        }
        return { success: false, message: "This account is not an administrator. Use the storefront login for customers and drivers." };
      }
      return { success: false, message: data.message || data.error || "Login failed" };
    } catch (error) {
      return { success: false, message: "Network error. Please try again." };
    }
  };

  const logout = () => {
    setUser(null);
    fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
