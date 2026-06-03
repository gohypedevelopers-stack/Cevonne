"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  key: string;
  id?: string;
  slug?: string;
  name?: string;
  price?: number | string | null;
  currency?: string;
  image?: string | null;
  thumb?: string | null;
  color?: string | null;
  shadeName?: string | null;
  quantity?: number | null;
  [key: string]: unknown;
}

export interface ShopContextValue {
  cartItems: CartItem[];
  wishlist: CartItem[];
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (key: string) => void;
  toggleWishlist: (item: CartItem) => "added" | "removed" | "none";
  removeFromWishlist: (key: string) => void;
  drawerOpen: boolean;
  drawerView: string;
  openDrawer: (view?: string) => void;
  closeDrawer: () => void;
  clearCart: () => void;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);
const CART_KEY = "marvella:cart";
const WISHLIST_KEY = "marvella:wishlist";

const readStored = (key: string, fallback: CartItem[] = []) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : fallback;
  } catch (err) {
    console.warn(`Failed to read ${key} from storage`, err);
    return fallback;
  }
};

const persistStored = (key: string, value: CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist ${key} to storage`, err);
  }
};

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readStored(CART_KEY, []));
  const [wishlist, setWishlist] = useState<CartItem[]>(() => readStored(WISHLIST_KEY, []));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState("cart");

  const addToCart = (item: CartItem) => {
    if (!item?.key) return false;
    let added = false;
    setCartItems((prev) => {
      if (prev.some((entry) => entry.key === item.key)) return prev;
      added = true;
      return [...prev, item];
    });
    return added;
  };

  const removeFromCart = (key: string) => {
    if (!key) return;
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => setCartItems([]);

  const toggleWishlist = (item: CartItem) => {
    if (!item?.key) return "none";
    let status: "added" | "removed" | "none" = "none";
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

  const removeFromWishlist = (key: string) => {
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

  useEffect(() => {
    persistStored(CART_KEY, cartItems);
  }, [cartItems]);

  useEffect(() => {
    persistStored(WISHLIST_KEY, wishlist);
  }, [wishlist]);

  const value = useMemo<ShopContextValue>(
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

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
