import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "./ToastContext";
import { useUserAuth } from "./UserAuthContext";
import { API } from "../api";

const CartContext = createContext();
export const CART_SESSION_KEY = "skfruits_cart_session";

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
  const { token: userToken, getAuthHeaders } = useUserAuth();

  const fetchCart = useCallback(async () => {
    const sessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    if (sessionId) headers["X-Cart-Session-Id"] = sessionId;
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.Authorization = auth.Authorization;

    const res = await fetch(`${API}/cart`, { headers, credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      console.error("Cart fetch failed:", data);
      return;
    }
    const newSessionId = res.headers.get("X-Cart-Session-Id") || data.sessionId;
    if (newSessionId) setStoredSessionId(newSessionId);
    setCartItems(Array.isArray(data.items) ? data.items : []);
  }, [getAuthHeaders]);

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
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.Authorization = auth.Authorization;

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
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.Authorization = auth.Authorization;

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
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.Authorization = auth.Authorization;

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
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.Authorization = auth.Authorization;
    if (!sessionId && !auth.Authorization) {
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

  /**
   * Add a personalized fruit basket: all fruit lines + packaging fee (server validates basket + stock).
  * @param {{ fruitBasketId: number, items: Array<{ productId: number, quantity: number, productSizeId?: number|null }> }} payload
   */
  const addFruitBasketBundleToCart = useCallback(
    async (payload) => {
      const sessionId = getStoredSessionId();
      const headers = { "Content-Type": "application/json" };
      if (sessionId) headers["X-Cart-Session-Id"] = sessionId;
      const auth = getAuthHeaders();
      if (auth.Authorization) headers.Authorization = auth.Authorization;

      try {
        const res = await fetch(`${API}/cart/fruit-basket`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          credentials: "include",
        });
        const data = await res.json();
        const newSessionId = res.headers.get("X-Cart-Session-Id") || data.sessionId;
        if (newSessionId) setStoredSessionId(newSessionId);

        if (!res.ok) {
          toast.error(data.error || "Could not add fruit basket to cart");
          return false;
        }
        setCartItems(Array.isArray(data.items) ? data.items : []);
        toast.success("Fruit basket added to cart");
        return true;
      } catch (err) {
        console.error("addFruitBasketBundleToCart:", err);
        toast.error("Could not add fruit basket to cart");
        return false;
      }
    },
    [getAuthHeaders, toast]
  );

  const mergeCart = useCallback(async () => {
    const guestSessionId = getStoredSessionId();
    const headers = { "Content-Type": "application/json" };
    const auth = getAuthHeaders();
    if (!auth.Authorization) return;
    headers.Authorization = auth.Authorization;
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
  }, [getAuthHeaders]);

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
        addFruitBasketBundleToCart,
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
