import { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:5000/api";

const emptyState = {
  products: [],
  shades: [],
  collections: [],
  users: [],
  inventory: [],
  lowInventory: [],
  reviews: [],
  reviewMeta: {
    count: 0,
    averageRating: 0,
    publishedCount: 0,
    pendingCount: 0,
  },
  orders: [],
  orderSummary: {
    total: 0,
    pending: 0,
    paid: 0,
    fulfilled: 0,
    revenue: 0,
  },
};

const defaultRequest = (url, options) => fetch(url, options);

export function useDashboardData(enabled = true, request = defaultRequest, isAdmin = false) {
  const [data, setData] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setData(emptyState);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchArray = async (path, fallback = []) => {
          try {
            const response = await request(`${API_BASE}${path}`);
            if (!response.ok) {
              const message = await response.text().catch(() => response.statusText);
              throw new Error(`${response.status} ${message}`);
            }
            const data = await response.json().catch(() => fallback);
            return Array.isArray(data) ? data : fallback;
          } catch (err) {
            console.error(`Failed to load ${path}`, err);
            return fallback;
          }
        };

        const fetchJson = async (path, fallback = null) => {
          try {
            const response = await request(`${API_BASE}${path}`);
            if (!response.ok) {
              const message = await response.text().catch(() => response.statusText);
              throw new Error(`${response.status} ${message}`);
            }
            return await response.json();
          } catch (err) {
            console.error(`Failed to load ${path}`, err);
            return fallback;
          }
        };

        const [
          products,
          shades,
          collections,
          users,
          inventory,
          lowInventory,
          allReviews,
          ordersPayload,
        ] = await Promise.all([
          fetchArray("/products"),
          fetchArray("/shades"),
          fetchArray("/collections"),
          fetchArray("/users"),
          fetchArray("/inventory"),
          fetchArray("/inventory/low?lt=12"),
          fetchJson("/reviews?status=ALL", { items: [], meta: emptyState.reviewMeta }),
          fetchJson(isAdmin ? "/orders" : "/orders/my", { items: [], summary: emptyState.orderSummary }),
        ]);

        if (!cancelled) {
          const reviewsItems = Array.isArray(allReviews?.items) ? allReviews.items : [];
          const reviewMeta =
            typeof allReviews?.meta === "object"
              ? { ...emptyState.reviewMeta, ...allReviews.meta }
              : { ...emptyState.reviewMeta };
          const fetchedOrders = Array.isArray(ordersPayload?.items) ? ordersPayload.items : [];
          const orderSummary =
            typeof ordersPayload?.summary === "object" && ordersPayload.summary !== null
              ? { ...emptyState.orderSummary, ...ordersPayload.summary }
              : { ...emptyState.orderSummary };
          setData({
            products,
            shades,
            collections,
            users,
            inventory,
            lowInventory,
            reviews: reviewsItems,
            reviewMeta,
            orders: fetchedOrders,
            orderSummary,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Dashboard data failed", err);
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [request, enabled, version, isAdmin]);

  const stats = useMemo(() => {
    const shades = Array.isArray(data.shades) ? data.shades : [];
    const arShadeCount = shades.filter((shade) => shade?.arAssetUrl).length;
    const totalInventory = Array.isArray(data.inventory)
      ? data.inventory.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)
      : 0;
    const reviewSummary = data.reviewMeta ?? emptyState.reviewMeta;
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const orderRevenue = orders.reduce(
      (acc, order) => acc + (Number(order?.totals?.total) || 0),
      0
    );
    const pendingOrders = orders.filter(
      (order) => (order.status || "pending") !== "fulfilled"
    ).length;

    return {
      productCount: Array.isArray(data.products) ? data.products.length : 0,
      shadeCount: shades.length,
      arShadeCount,
      collectionCount: Array.isArray(data.collections) ? data.collections.length : 0,
      userCount: Array.isArray(data.users) ? data.users.length : 0,
      totalInventory,
      lowStockCount: Array.isArray(data.lowInventory) ? data.lowInventory.length : 0,
      reviewCount: reviewSummary.publishedCount ?? 0,
      pendingReviewCount: reviewSummary.pendingCount ?? 0,
      averageRating: reviewSummary.averageRating ?? 0,
      orderCount: orders.length,
      pendingOrders,
      orderRevenue,
    };
  }, [data]);
  const refresh = () => setVersion((prev) => prev + 1);

  return {
    ...data,
    loading,
    error,
    stats,
    refresh,
  };
}
