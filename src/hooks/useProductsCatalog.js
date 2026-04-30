import { useEffect, useState } from "react";
import fallbackProducts from "@/data/cevonneProducts";

const API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");

const cache = {
  data: fallbackProducts || null,
  error: null,
  promise: null,
};

const normalizeItems = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.data;
  return Array.isArray(items) ? items : [];
};

export function useProductsCatalog() {
  const [products, setProducts] = useState(() => cache.data || []);
  const [loading, setLoading] = useState(Boolean(API_BASE && !cache.data));
  const [error, setError] = useState(cache.error || "");

  useEffect(() => {
    // Always seed state with fallback locally to prevent empty grids on static deploys.
    if (!cache.data && fallbackProducts?.length) {
      cache.data = fallbackProducts;
      setProducts(fallbackProducts);
    }

    // If we already have products (fallback or fetched), don't refetch when API_BASE is missing.
    if (!API_BASE || cache.data) {
      setLoading(false);
      return;
    }
    if (cache.promise) {
      cache.promise.then(setProducts).catch((err) => setError(err?.message || "Failed to load products"));
      return;
    }

    const fetcher = fetch(`${API_BASE}/products`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load products");
        const payload = await res.json();
        const items = normalizeItems(payload);
        cache.data = items.length ? items : fallbackProducts;
        return cache.data;
      })
      .catch((err) => {
        cache.error = err?.message || "Failed to load products";
        cache.data = fallbackProducts;
        return cache.data;
      });

    cache.promise = fetcher;

    fetcher
      .then((items) => setProducts(items))
      .catch((err) => setError(err?.message || "Failed to load products"))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, error };
}

export default useProductsCatalog;
