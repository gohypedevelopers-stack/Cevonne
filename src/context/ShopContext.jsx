import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ShopContext = createContext(null);
const CART_KEY = "marvella:cart";
const WISHLIST_KEY = "marvella:wishlist";

const readStored = (key, fallback = []) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    console.warn(`Failed to read ${key} from storage`, err);
    return fallback;
  }
};

const persistStored = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist ${key} to storage`, err);
  }
};

function ShopProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => readStored(CART_KEY, []));
  const [wishlist, setWishlist] = useState(() => readStored(WISHLIST_KEY, []));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState("cart");

  const addToCart = (item) => {
    if (!item?.key) return false;
    let added = false;
    setCartItems((prev) => {
      if (prev.some((entry) => entry.key === item.key)) return prev;
      added = true;
      return [...prev, item];
    });
    return added;
  };

  const removeFromCart = (key) => {
    if (!key) return;
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => setCartItems([]);

  const toggleWishlist = (item) => {
    if (!item?.key) return "none";
    let status = "none";
    setWishlist((prev) => {
      if (prev.some((entry) => entry.key === item.key)) {
        status = "removed";
        return prev.filter((entry) => entry.key !== item.key);
      }
      status = "added";
      return [...prev, item];
    });
    return status;
  };

  const removeFromWishlist = (key) => {
    if (!key) return;
    setWishlist((prev) => prev.filter((item) => item.key !== key));
  };

  const openDrawer = (view = "cart") => {
    setDrawerView(view === "wishlist" ? "wishlist" : "cart");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  // Persist cart/wishlist to localStorage so they stay across refreshes.
  useEffect(() => {
    persistStored(CART_KEY, cartItems);
  }, [cartItems]);

  useEffect(() => {
    persistStored(WISHLIST_KEY, wishlist);
  }, [wishlist]);

  const value = useMemo(
    () => ({
      cartItems,
      wishlist,
      addToCart,
      removeFromCart,
      toggleWishlist,
      removeFromWishlist,
      drawerOpen,
      drawerView,
      openDrawer,
      closeDrawer,
      clearCart,
    }),
    [cartItems, wishlist, drawerOpen, drawerView]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}

export { ShopProvider, useShop };
