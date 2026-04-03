import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "./ToastContext";
import { API } from "../api";

const CartContext = createContext();
export const CART_SESSION_KEY = "shoposphere_cart_session";

function getStoredSessionId() {
  try {
    return localStorage.getItem(CART_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function setStoredSessionId(sessionId) {
  try {
    if (sessionId) localStorage.setItem(CART_SESSION_KEY, sessionId);
    else localStorage.removeItem(CART_SESSION_KEY);
  } catch (e) {
    console.warn("Could not persist cart session:", e);
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const toast = useToast();

  const fetchCart = useCallback(async () => {
    const sessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;

    const res = await fetch(`${API}/cart`, { headers, credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      console.error("Cart fetch failed:", data);
      return;
    }
    const newSessionId = res.headers.get("X-Cart-Session-Id") || data.sessionId;
    if (newSessionId) setStoredSessionId(newSessionId);
    setCartItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    fetchCart().finally(() => setIsLoaded(true));
  }, [fetchCart]);

  const addToCart = async (product, selectedSize, quantity = 1) => {
    if (!selectedSize) {
      toast.error("Please select a size");
      return false;
    }

    const sessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;

    const productSizeId = selectedSize && selectedSize.id !== 0 ? selectedSize.id : null;
    const body = JSON.stringify({
      productId: product.id,
      productSizeId,
      quantity,
    });

    try {
      const res = await fetch(`${API}/cart/items`, {
        method: "POST",
        headers,
        body,
        credentials: "include",
      });
      const data = await res.json();
      const newSessionId = res.headers.get("X-Cart-Session-Id") || data.sessionId;
      if (newSessionId) setStoredSessionId(newSessionId);

      if (!res.ok) {
        toast.error(data.error || "Could not add to cart");
        return false;
      }
      await fetchCart();
      toast.success("Added to cart");
      return true;
    } catch (err) {
      console.error("Add to cart error:", err);
      toast.error("Could not add to cart");
      return false;
    }
  };

  const removeFromCart = async (itemId) => {
    const sessionId = getStoredSessionId();
    const headers = {};
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;

    try {
      const res = await fetch(`${API}/cart/items/${itemId}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      if (res.ok) await fetchCart();
    } catch (err) {
      console.error("Remove from cart error:", err);
      toast.error("Could not remove item");
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const sessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;

    try {
      const res = await fetch(`${API}/cart/items/${itemId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ quantity: newQuantity }),
        credentials: "include",
      });
      const data = await res.json();
      const newSessionId = res.headers.get("X-Cart-Session-Id") || data?.sessionId;
      if (newSessionId) setStoredSessionId(newSessionId);
      if (res.ok) {
        await fetchCart();
      } else {
        toast.error(data.error || "Could not update quantity");
      }
    } catch (err) {
      console.error("Update quantity error:", err);
      toast.error("Could not update quantity");
    }
  };

  const clearCart = async () => {
    const sessionId = getStoredSessionId();
    const headers = {};
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;
    if (!sessionId) {
      setCartItems([]);
      return;
    }
    try {
      await fetch(`${API}/cart`, { method: "DELETE", headers, credentials: "include" });
      setCartItems([]);
    } catch (err) {
      console.error("Clear cart error:", err);
      setCartItems([]);
    }
  };

  const getCartTotal = () => cartItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const getCartCount = () => cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const mergeCart = useCallback(async () => {
    const guestSessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    if (guestSessionId) headers["X-Cart-Session-Id"] = guestSessionId;
    try {
      const res = await fetch(`${API}/cart/merge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ guestSessionId: guestSessionId || undefined }),
        credentials: "include",
      });
      const data = await res.json();
      const newSessionId = res.headers.get("X-Cart-Session-Id") || data.sessionId;
      if (newSessionId) setStoredSessionId(newSessionId);
      setCartItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Cart merge error:", err);
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isLoaded,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        refreshCart: fetchCart,
        mergeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
