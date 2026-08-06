import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import { normalizeOrderStatus, type Order } from "@/types/order";
import type { Product } from "@/types/product";
import type { Review } from "@/types/review";

type DashboardReviewMeta = {
  count: number;
  averageRating: number;
  publishedCount: number;
  pendingCount: number;
};

type DashboardOrderSummary = {
  total: number;
  pending: number;
  inProgress: number;
  delivered: number;
  revenue: number;
  paid?: number;
  fulfilled?: number;
};

type DashboardState = {
  products: Product[];
  shades: any[];
  collections: any[];
  users: any[];
  inventory: any[];
  lowInventory: any[];
  reviews: Review[];
  reviewMeta: DashboardReviewMeta;
  orders: Order[];
  orderSummary: DashboardOrderSummary;
};

export type DashboardResource =
  | "products"
  | "shades"
  | "collections"
  | "users"
  | "inventory"
  | "lowInventory"
  | "reviews"
  | "orders";

type DashboardDataOptions = {
  resources?: readonly DashboardResource[];
  maxAgeMs?: number;
};

type DashboardRequest = (url: string, options?: RequestInit) => Promise<Response>;

type ResourceCacheEntry = {
  value?: unknown;
  updatedAt: number;
  promise?: Promise<unknown>;
};

const ALL_DASHBOARD_RESOURCES: readonly DashboardResource[] = [
  "products",
  "shades",
  "collections",
  "users",
  "inventory",
  "lowInventory",
  "reviews",
  "orders",
];

const DEFAULT_MAX_AGE_MS = 30_000;
const requestCaches = new WeakMap<DashboardRequest, Map<string, ResourceCacheEntry>>();

const createEmptyState = (): DashboardState => ({
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
    inProgress: 0,
    delivered: 0,
    revenue: 0,
  },
});

const defaultRequest: DashboardRequest = (url, options) => fetch(url, options);

function normalizeResources(resources?: readonly DashboardResource[]) {
  return resources?.length
    ? Array.from(new Set(resources)).sort()
    : [...ALL_DASHBOARD_RESOURCES];
}

function getRequestCache(request: DashboardRequest) {
  let cache = requestCaches.get(request);
  if (!cache) {
    cache = new Map();
    requestCaches.set(request, cache);
  }
  return cache;
}

function getResourceCacheKey(resource: DashboardResource, isAdmin: boolean) {
  return resource === "orders" ? `${resource}:${isAdmin ? "admin" : "self"}` : resource;
}

function deriveLowInventory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => Number(item?.quantity) < 12)
    .sort((left, right) => Number(left?.quantity) - Number(right?.quantity));
}

async function readResponse(response: Response, fallback: unknown) {
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`${response.status} ${message}`);
  }
  return response.json().catch(() => fallback);
}

async function fetchResource(
  request: DashboardRequest,
  resource: DashboardResource,
  isAdmin: boolean,
) {
  const paths: Record<Exclude<DashboardResource, "orders">, string> = {
    products: "/products",
    shades: "/shades",
    collections: "/collections",
    users: "/users",
    inventory: "/inventory",
    lowInventory: "/inventory/low?lt=12",
    reviews: "/reviews?status=ALL",
  };
  const path =
    resource === "orders" ? (isAdmin ? "/orders" : "/orders/my") : paths[resource];
  const response = await request(`${API_BASE}${path}`, { cache: "no-store" });

  if (resource === "reviews") {
    return readResponse(response, { items: [], meta: createEmptyState().reviewMeta });
  }
  if (resource === "orders") {
    return readResponse(response, { items: [], summary: createEmptyState().orderSummary });
  }
  return readResponse(response, []);
}

async function ensureResource(
  request: DashboardRequest,
  resource: DashboardResource,
  isAdmin: boolean,
  maxAgeMs: number,
  force = false,
) {
  const cache = getRequestCache(request);
  const cacheKey = getResourceCacheKey(resource, isAdmin);
  const cached = cache.get(cacheKey);
  const isFresh = cached?.value !== undefined && Date.now() - cached.updatedAt < maxAgeMs;

  if (!force && isFresh) return cached.value;
  if (cached?.promise) return cached.promise;

  if (resource === "lowInventory") {
    const inventoryEntry = cache.get("inventory");
    const inventoryIsFresh =
      inventoryEntry?.value !== undefined && Date.now() - inventoryEntry.updatedAt < maxAgeMs;

    if (inventoryEntry?.promise || inventoryIsFresh) {
      const promise = Promise.resolve(inventoryEntry.promise ?? inventoryEntry.value)
        .then((value) => {
          if (!Array.isArray(value)) return cached?.value;
          const lowInventory = deriveLowInventory(value);
          cache.set(cacheKey, { value: lowInventory, updatedAt: Date.now() });
          return lowInventory;
        })
        .finally(() => {
          const current = cache.get(cacheKey);
          if (current?.promise === promise) {
            cache.set(cacheKey, {
              value: current.value,
              updatedAt: current.updatedAt,
            });
          }
        });
      cache.set(cacheKey, {
        value: cached?.value,
        updatedAt: cached?.updatedAt ?? 0,
        promise,
      });
      return promise;
    }
  }

  const promise = fetchResource(request, resource, isAdmin)
    .then((value) => {
      const updatedAt = Date.now();
      cache.set(cacheKey, { value, updatedAt });
      if (resource === "inventory") {
        cache.set("lowInventory", { value: deriveLowInventory(value), updatedAt });
      }
      return value;
    })
    .catch((error) => {
      console.error(`Failed to load dashboard resource: ${resource}`, error);
      return cached?.value;
    })
    .finally(() => {
      const current = cache.get(cacheKey);
      if (current?.promise === promise) {
        cache.set(cacheKey, {
          value: current.value,
          updatedAt: current.updatedAt,
        });
      }
    });

  cache.set(cacheKey, {
    value: cached?.value,
    updatedAt: cached?.updatedAt ?? 0,
    promise,
  });

  return promise;
}

function applyCachedResource(
  state: DashboardState,
  resource: DashboardResource,
  value: unknown,
) {
  if (resource === "reviews") {
    const payload = value as { items?: unknown; meta?: unknown } | null;
    state.reviews = Array.isArray(payload?.items) ? (payload.items as Review[]) : [];
    state.reviewMeta =
      typeof payload?.meta === "object" && payload.meta !== null
        ? { ...state.reviewMeta, ...(payload.meta as Partial<DashboardReviewMeta>) }
        : state.reviewMeta;
    return;
  }

  if (resource === "orders") {
    const payload = value as { items?: unknown; summary?: unknown } | unknown[] | null;
    state.orders = Array.isArray(payload)
      ? (payload as Order[])
      : Array.isArray(payload?.items)
        ? (payload.items as Order[])
        : [];
    state.orderSummary =
      !Array.isArray(payload) && typeof payload?.summary === "object" && payload.summary !== null
        ? { ...state.orderSummary, ...(payload.summary as Partial<DashboardOrderSummary>) }
        : state.orderSummary;
    return;
  }

  state[resource] = (Array.isArray(value) ? value : []) as DashboardState[typeof resource];
}

function readCachedState(
  request: DashboardRequest,
  resources: readonly DashboardResource[],
  isAdmin: boolean,
) {
  const state = createEmptyState();
  const cache = requestCaches.get(request);
  if (!cache) return state;

  resources.forEach((resource) => {
    const cached = cache.get(getResourceCacheKey(resource, isAdmin));
    if (cached?.value !== undefined) {
      applyCachedResource(state, resource, cached.value);
    }
  });

  return state;
}

function hasCachedResources(
  request: DashboardRequest,
  resources: readonly DashboardResource[],
  isAdmin: boolean,
) {
  const cache = requestCaches.get(request);
  if (!cache) return false;
  return resources.every(
    (resource) => cache.get(getResourceCacheKey(resource, isAdmin))?.value !== undefined,
  );
}

export async function preloadDashboardData(
  request: DashboardRequest = defaultRequest,
  isAdmin = false,
  options: DashboardDataOptions = {},
) {
  const resources = normalizeResources(options.resources);
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  await Promise.all(
    resources.map((resource) => ensureResource(request, resource, isAdmin, maxAgeMs)),
  );
  return readCachedState(request, resources, isAdmin);
}

export function useDashboardData(
  enabled = true,
  request: DashboardRequest = defaultRequest,
  isAdmin = false,
  options: DashboardDataOptions = {},
) {
  const resourceKey = normalizeResources(options.resources).join(",");
  const resources = useMemo(
    () => resourceKey.split(",") as DashboardResource[],
    [resourceKey],
  );
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const [data, setData] = useState<DashboardState>(() =>
    readCachedState(request, resources, isAdmin),
  );
  const [loading, setLoading] = useState(
    () => enabled && !hasCachedResources(request, resources, isAdmin),
  );
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setData(createEmptyState());
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const hasCache = hasCachedResources(request, resources, isAdmin);
    setData(readCachedState(request, resources, isAdmin));
    setLoading(!hasCache);
    setError(null);

    async function load() {
      try {
        await Promise.all(
          resources.map((resource) =>
            ensureResource(request, resource, isAdmin, maxAgeMs, version > 0),
          ),
        );
        if (!cancelled) {
          setData(readCachedState(request, resources, isAdmin));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, isAdmin, maxAgeMs, request, resourceKey, resources, version]);

  const stats = useMemo(() => {
    const shades = Array.isArray(data.shades) ? data.shades : [];
    const arShadeCount = shades.filter((shade) => shade?.arAssetUrl).length;
    const totalInventory = Array.isArray(data.inventory)
      ? data.inventory.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)
      : 0;
    const reviewSummary = data.reviewMeta;
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const orderRevenue = orders.reduce(
      (acc, order) => acc + (Number(order?.totals?.total) || 0),
      0,
    );
    const pendingOrders = orders.filter(
      (order) => normalizeOrderStatus(order.status) !== "DELIVERED",
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

  const refresh = useCallback(() => setVersion((previous) => previous + 1), []);

  return {
    ...data,
    loading,
    error,
    stats,
    refresh,
  };
}
