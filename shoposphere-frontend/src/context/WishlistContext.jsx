import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useUserAuth } from "./UserAuthContext";
import { useToast } from "./ToastContext";
import { API } from "../api";

const WishlistContext = createContext();
const GUEST_WISHLIST_KEY = "shoposphere_guest_wishlist";

function loadGuestWishlistIds() {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function saveGuestWishlistIds(ids) {
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage write errors
  }
}

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useUserAuth();
  const toast = useToast();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchWishlist = useCallback(async () => {
    if (isAuthenticated) {
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
      return;
    }

    const guestIds = loadGuestWishlistIds();
    if (guestIds.length === 0) {
      setWishlistItems([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/products?ids=${guestIds.join(",")}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setWishlistItems([]);
        return;
      }

      const byId = new Map(data.map((p) => [Number(p.id), p]));
      const hydrated = guestIds
        .map((id) => ({
          id: `guest-${id}`,
          productId: id,
          product: byId.get(id) || null,
        }))
        .filter((item) => item.product);

      setWishlistItems(hydrated);
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
      const id = Number(productId);
      if (!id) return false;

      if (!isAuthenticated) {
        const current = loadGuestWishlistIds();
        if (current.includes(id)) return true;
        const next = [id, ...current].slice(0, 100);
        saveGuestWishlistIds(next);
        await fetchWishlist();
        toast.success("Added to wishlist");
        return true;
      }

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
      const id = Number(productId);
      if (!id) return false;

      if (!isAuthenticated) {
        const current = loadGuestWishlistIds();
        const next = current.filter((x) => x !== id);
        saveGuestWishlistIds(next);
        await fetchWishlist();
        toast.success("Removed from wishlist");
        return true;
      }

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

  const mergeWishlist = useCallback(async () => {
    const guestIds = loadGuestWishlistIds();
    if (guestIds.length === 0) return { merged: 0, failed: 0 };

    const results = await Promise.allSettled(
      guestIds.map(async (id) => {
        const res = await fetch(`${API}/wishlist/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Failed to merge wishlist item ${id}`);
        }
        return id;
      })
    );

    const failedIds = guestIds.filter((_, index) => results[index].status === "rejected");
    saveGuestWishlistIds(failedIds);
    await fetchWishlist();

    return {
      merged: guestIds.length - failedIds.length,
      failed: failedIds.length,
    };
  }, [fetchWishlist]);

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
        mergeWishlist,
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
