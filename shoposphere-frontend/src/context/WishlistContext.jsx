import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useUserAuth } from "./UserAuthContext";
import { useToast } from "./ToastContext";
import { API } from "../api";

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useUserAuth();
  const toast = useToast();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/wishlist`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setWishlistItems(data);
      } else {
        setWishlistItems([]);
      }
    } catch (err) {
      console.error("Wishlist fetch error:", err);
      setWishlistItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const wishlistProductIds = wishlistItems.map((item) => item.productId);

  const isInWishlist = useCallback(
    (productId) => {
      if (!productId) return false;
      return wishlistProductIds.includes(Number(productId));
    },
    [wishlistProductIds]
  );

  const addToWishlist = useCallback(
    async (productId) => {
      if (!isAuthenticated) {
        toast.error("Please log in to save items to your wishlist");
        return false;
      }
      const id = Number(productId);
      if (!id) return false;
      setTogglingId(id);
      try {
        const res = await fetch(`${API}/wishlist/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          await fetchWishlist();
          toast.success("Added to wishlist");
          return true;
        }
        toast.error(data.error || "Could not add to wishlist");
        return false;
      } catch (err) {
        console.error("Add to wishlist error:", err);
        toast.error("Could not add to wishlist");
        return false;
      } finally {
        setTogglingId(null);
      }
    },
    [isAuthenticated, fetchWishlist, toast]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      if (!isAuthenticated) return false;
      const id = Number(productId);
      if (!id) return false;
      setTogglingId(id);
      try {
        const res = await fetch(`${API}/wishlist/remove/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          await fetchWishlist();
          toast.success("Removed from wishlist");
          return true;
        }
        const data = await res.json();
        toast.error(data.error || "Could not remove from wishlist");
        return false;
      } catch (err) {
        console.error("Remove from wishlist error:", err);
        toast.error("Could not remove from wishlist");
        return false;
      } finally {
        setTogglingId(null);
      }
    },
    [isAuthenticated, fetchWishlist, toast]
  );

  const toggleWishlist = useCallback(
    async (productId) => {
      if (isInWishlist(productId)) {
        return removeFromWishlist(productId);
      }
      return addToWishlist(productId);
    },
    [isInWishlist, addToWishlist, removeFromWishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistProductIds,
        loading,
        togglingId,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        refreshWishlist: fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return context;
}
