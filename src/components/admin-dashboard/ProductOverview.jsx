"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight, Filter, Package, Plus, Search, Sparkles, Users } from "lucide-react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";

import { formatCurrency, getProductStock } from "./utils";
import { BulkProductTools } from "./components/BulkProductTools";

const defaultRequest = (url, options) => fetch(url, options);

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
};

export default function ProductOverview() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();
  const { products, collections, stats, loading, refresh } = useDashboardData(true, request);

  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const collectionOptions = useMemo(() => {
    const base = [
      { value: "all", label: "All collections" },
      { value: "none", label: "No collection" },
    ];
    if (!Array.isArray(collections)) return base;
    return [...base, ...collections.map((c) => ({ value: c.id, label: c.name }))];
  }, [collections]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const term = search.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch = term
          ? (product.name || "").toLowerCase().includes(term) ||
            (product.slug || "").toLowerCase().includes(term) ||
            (product.collection?.name || "").toLowerCase().includes(term)
          : true;
        const matchesCollection =
          collectionFilter === "all"
            ? true
            : collectionFilter === "none"
            ? !product.collection
            : product.collectionId === collectionFilter;
        const matchesStock = lowStockOnly
          ? getProductStock(product) <= 12 || (product.shades || []).some((s) => (s.inventory?.quantity ?? 0) <= 12)
          : true;
        return matchesSearch && matchesCollection && matchesStock;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [products, search, collectionFilter, lowStockOnly]);

  const statCards = [
    {
      label: "Total products",
      value: stats.productCount ?? 0,
      helper: `${collections?.length ?? 0} collections`,
      icon: <Package className="h-5 w-5 text-primary" />,
      accent: "from-primary/80 to-secondary/70",
    },
    {
      label: "Total users",
      value: stats.userCount ?? 0,
      helper: "Customers & admins",
      icon: <Users className="h-5 w-5 text-primary" />,
      accent: "from-[#22d3ee] to-[#6366f1]",
    },
    {
      label: "Low stock",
      value: stats.lowStockCount ?? 0,
      helper: "Shades to restock",
      icon: <Sparkles className="h-5 w-5 text-amber-500" />,
      accent: "from-[#f97316] to-[#facc15]",
    },
  ];

  const handleCreate = () => navigate("/dashboard/products/new");

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f7f8fb]">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <header className="border-b border-border/60 bg-white px-4 py-4 shadow-sm md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-2xl font-semibold text-primary">Product preview</p>
                <p className="text-sm text-muted-foreground">
                  Browse, search, and jump into edits for your catalog.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="w-full rounded-full pl-9"
                  />
                </div>
                <Button onClick={handleCreate} className="rounded-full bg-primary px-4 text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Add product
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 space-y-6 px-4 pb-10 pt-6 md:px-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {statCards.map((card) => (
                <Card key={card.label} className="border-none bg-white/90 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
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

            <Card className="border-none bg-white/95 shadow-sm">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Products</CardTitle>
                  <CardDescription>Sorted by newest first</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                    <SelectTrigger className="w-48 rounded-full">
                      <SelectValue placeholder="Collection" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {collectionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={lowStockOnly ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setLowStockOnly((v) => !v)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {lowStockOnly ? "Showing low stock" : "Low stock only"}
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => refresh?.()}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <div className="mx-4 mb-1 h-1 rounded-full bg-gradient-to-r from-primary/80 via-secondary/60 to-primary/40" />

              <CardContent className="space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3"
                    >
                      <div className="h-12 w-12 rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 rounded bg-muted" />
                        <div className="h-3 w-24 rounded bg-muted" />
                      </div>
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                  ))
                ) : filteredProducts.length ? (
                  filteredProducts.map((product) => {
                    const image = product.images?.[0]?.url;
                    const inventory = getProductStock(product);
                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => navigate(`/dashboard/products/${product.id}/edit`)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-white p-3 text-left transition hover:border-primary/50 hover:shadow-sm"
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
                            {product.collection?.name || "No collection"} • {product.finish || "Shade"}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(product.createdAt)}
                            </span>
                            {product.basePrice ? (
                              <span className="font-semibold text-foreground">{formatCurrency(product.basePrice)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary" className="rounded-full">
                            {product.shades?.length ?? 0} shades
                          </Badge>
                          <Badge
                            variant={inventory <= 12 ? "destructive" : "outline"}
                            className="rounded-full"
                          >
                            {inventory} in stock
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                    No products match these filters.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-primary">Bulk actions</p>
                <p className="text-sm text-muted-foreground">
                  Upload JSON or export the catalogue for quick admin updates.
                </p>
              </div>
              <BulkProductTools request={request} refresh={refresh} />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
