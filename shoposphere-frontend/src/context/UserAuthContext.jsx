import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API } from "../api";

const AuthContext = createContext();

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchUser()
      .then((u) => {
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [fetchUser]);

  const login = useCallback(
    async (email, password) => {
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || data.message || "Login failed" };
        }

        const u = data.user;
        setUser(u);
        if (u?.role === "admin" || u?.isAdmin) {
          return { success: true, redirectToAdmin: true };
        }
        const isDriver = u?.role === "driver";
        return { success: true, ...(isDriver && { redirectToDriver: true }) };
      } catch (err) {
        console.error("Login error:", err);
        return { success: false, error: "Network error. Please try again." };
      }
    },
    []
  );

  const signup = useCallback(
    async (name, email, password) => {
      try {
        const res = await fetch(`${API}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || "Signup failed" };
        }

        const u = data.user;
        setUser(u);
        return { success: true };
      } catch (err) {
        console.error("Signup error:", err);
        return { success: false, error: "Network error. Please try again." };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  const loginWithToken = useCallback(async (_authToken, userData) => {
    try {
      if (userData && userData.id) {
        setUser(userData);
        return true;
      }

      const fetchedUser = await fetchUser();
      if (!fetchedUser) {
        return false;
      }

      setUser(fetchedUser);
      return true;
    } catch (error) {
      console.error("Login with token error:", error);
      return false;
    }
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        loginWithToken,
        logout,
        signup,
        refreshUser: () => fetchUser().then(setUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within UserAuthProvider");
  return ctx;
}
