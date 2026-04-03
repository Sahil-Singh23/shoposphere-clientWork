import { createContext, useContext, useCallback, useState, useEffect } from "react";

const STORAGE_KEY = "shoposphere_recently_viewed";
const MAX_ITEMS = 10;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function saveToStorage(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn("Could not persist recently viewed:", e);
  }
}

const RecentlyViewedContext = createContext();

export function RecentlyViewedProvider({ children }) {
  const [recentIds, setRecentIds] = useState(loadFromStorage);

  const addViewed = useCallback((productId) => {
    const id = Number(productId);
    if (!id || Number.isNaN(id)) return;
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_ITEMS);
      saveToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setRecentIds(loadFromStorage());
  }, []);

  return (
    <RecentlyViewedContext.Provider value={{ recentIds, addViewed }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  const context = useContext(RecentlyViewedContext);
  if (!context) {
    throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider");
  }
  return context;
}
