"use client";

import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calendar, Package, PanelLeftClose, PanelLeftOpen, Plus, Search, Users } from "lucide-react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useSidebar } from "@/hooks/use-sidebar";

import { formatCurrency } from "./utils";
import { OrdersPanel } from "./components/OrdersPanel";

const defaultRequest = (url, options) => fetch(url, options);

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function Dashboard() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();

  const CollapseButton = () => {
    const { state, toggleSidebar } = useSidebar();
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden rounded-full md:inline-flex"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        {state === "collapsed" ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>
    );
  };

  const { products, collections, shades, inventory, lowInventory, orders, stats, loading, refresh } =
    useDashboardData(true, request, isAdmin);

  const goToNewProduct = () => navigate("/dashboard/products/new");
  const goToProducts = () => navigate("/dashboard/products");

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  const lowStockItems = useMemo(() => {
    const source = Array.isArray(lowInventory) && lowInventory.length ? lowInventory : inventory || [];
    return source
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        name: item.product?.name ?? item.shade?.name ?? "SKU",
        collection: item.product?.collection?.name,
        quantity: item.quantity ?? 0,
        sku: item.shade?.sku,
      }));
  }, [inventory, lowInventory]);

  const recentProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return [...products]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [products]);

  const statCards = [
    {
      label: "Total products",
      value: stats?.productCount ?? 0,
      helper: `${collections?.length ?? 0} collections`,
      icon: <Package className="h-5 w-5 text-primary" />,
      accent: "from-primary/80 to-secondary/70",
    },
    {
      label: "Total users",
      value: stats?.userCount ?? 0,
      helper: "Customers & admins",
      icon: <Users className="h-5 w-5 text-primary" />,
      accent: "from-[#22d3ee] to-[#6366f1]",
    },
    {
      label: "Low stock",
      value: stats?.lowStockCount ?? 0,
      helper: `${stats?.shadeCount ?? 0} shades tracked`,
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      accent: "from-[#f97316] to-[#facc15]",
    },
  ];

  const StatSkeleton = () => (
    <Card className="border-none bg-white/80 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#f7f8fb]">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <header className="border-b border-border/60 bg-white px-4 py-4 shadow-sm md:px-8">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <CollapseButton />
                  <div>
                    <p className="text-2xl font-semibold text-primary">Dashboard</p>
                    <p className="text-sm text-muted-foreground">
                      Quick view of your catalog, users, and inventory health.
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products or collections..."
                      className="w-full rounded-full pl-9"
                    />
                  </div>
                  <Button onClick={goToNewProduct} className="rounded-full bg-primary px-4 text-primary-foreground">
                    <Plus className="mr-2 h-4 w-4" />
                    Add product
                  </Button>
                </div>
              </div>
            </header>

            <main className="flex-1 space-y-6 px-4 pb-10 pt-6 md:px-8">
              <div className="mx-auto w-full max-w-6xl space-y-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
                    : statCards.map((card) => (
                      <Card key={card.label} className="border-none bg-white/90 shadow-sm">
                        <CardContent className="flex flex-col gap-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                              <p className="text-3xl font-semibold text-foreground">{card.value}</p>
                              <p className="text-xs text-muted-foreground">{card.helper}</p>
                            </div>
                            <div className="rounded-full bg-primary/10 p-3">{card.icon}</div>
                          </div>
                          <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${card.accent}`} />
                        </CardContent>
                      </Card>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
                  {/* Low stock / borrow requests analogue */}
                  <Card className="border-none bg-white/95 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Low inventory</CardTitle>
                        <CardDescription>Shades and SKUs nearing depletion.</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-full" onClick={goToProducts}>
                        View all
                      </Button>
                    </CardHeader>
                    <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
                    <CardContent className="space-y-3">
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
                          >
                            <Skeleton className="h-12 w-12 rounded-xl" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-6 w-14 rounded-full" />
                          </div>
                        ))
                      ) : lowStockItems.length ? (
                        lowStockItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 shadow-sm"
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                              {item.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.collection || "Unassigned"} {item.sku ? `- ${item.sku}` : ""}
                              </p>
                            </div>
                            <Badge variant="secondary" className="rounded-full">
                              {item.quantity} left
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-emerald-700">
                          Inventory looks healthy. No low-stock shades right now.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recently added products */}
                  <Card className="border-none bg-white/95 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Recently added</CardTitle>
                      <Button variant="ghost" size="sm" className="rounded-full" onClick={goToProducts}>
                        View all
                      </Button>
                    </CardHeader>
                    <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />
                    <CardContent className="space-y-3">
                      <button
                        type="button"
                        onClick={goToNewProduct}
                        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/60"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                          <Plus className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-primary">Add new product</p>
                          <p className="text-xs text-muted-foreground">Upload imagery, details, and pricing.</p>
                        </div>
                      </button>

                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3"
                          >
                            <Skeleton className="h-12 w-12 rounded-xl" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-4 w-16" />
                          </div>
                        ))
                      ) : recentProducts.length ? (
                        recentProducts.map((product) => {
                          const image = product.images?.[0]?.url;
                          return (
                            <div
                              key={product.id}
                              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 shadow-sm"
                            >
                              {image ? (
                                <img
                                  src={image}
                                  alt={product.name}
                                  className="h-12 w-12 rounded-xl object-cover ring-1 ring-border/60"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                                  {product.name?.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {product.collection?.name || "No collection"} - {product.finish || "Shade"}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(product.createdAt)}
                                  </span>
                                  {product.basePrice ? (
                                    <span className="font-semibold text-foreground">
                                      {formatCurrency(product.basePrice)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                          No products yet. Add your first product to see it here.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <OrdersPanel orders={orders} loading={loading} refresh={refresh} />
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
