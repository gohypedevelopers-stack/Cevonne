import { useEffect, useState } from "react";
import fallbackProducts from "@/data/cevonneProducts";
import { API_BASE, HAS_API_BASE } from "@/lib/api";
import type { Product } from "@/types/product";

const cache = {
  data: (HAS_API_BASE ? null : fallbackProducts || null) as Product[] | null,
  error: null as string | null,
  promise: null as Promise<Product[]> | null,
};

const normalizeItems = (payload: unknown): Product[] => {
  const items = Array.isArray(payload) ? payload : (payload as { data?: unknown })?.data;
  return Array.isArray(items) ? items : [];
};

export function useProductsCatalog() {
  const [products, setProducts] = useState<Product[]>(() => cache.data || []);
  const [loading, setLoading] = useState(Boolean(HAS_API_BASE && !cache.data));
  const [error, setError] = useState<string>(cache.error || "");

  useEffect(() => {
    let cancelled = false;

    // Use bundled products only when no backend is configured.
    if (!HAS_API_BASE && !cache.data && fallbackProducts?.length) {
      cache.data = fallbackProducts;
      setProducts(fallbackProducts);
    }

    if (!HAS_API_BASE || cache.data) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (cache.promise) {
      cache.promise
        .then((items) => {
          if (!cancelled) {
            setProducts(items);
          }
        })
        .catch((err: any) => setError(err?.message || "Failed to load products"))
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    const fetcher = fetch(`${API_BASE}/products`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load products");
        const payload = await res.json();
        const items = normalizeItems(payload);
        cache.data = items;
        cache.error = null;
        return cache.data;
      })
      .catch((err: any) => {
        cache.error = err?.message || "Failed to load products";
        cache.data = null;
        return [];
      })
      .finally(() => {
        cache.promise = null;
      });

    cache.promise = fetcher;

    fetcher
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
        }
      })
      .catch((err: any) => setError(err?.message || "Failed to load products"))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error };
}

export default useProductsCatalog;
