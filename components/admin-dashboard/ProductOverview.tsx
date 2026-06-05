"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Boxes,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Filter,
  FolderMinus,
  FolderPlus,
  Layers3,
  Mail,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Tag,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

import { BulkProductTools } from "./components/BulkProductTools";
import { formatCurrency, getProductStock } from "./utils";

const defaultRequest = (url, options) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const humanizeLabel = (value) => {
  if (!value) return "—";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const collectLabels = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.label ?? item.name ?? item.title ?? item.value ?? "";
      }
      return "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const csvCell = (value) => {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
};

type ProductMeta = {
  label: string;
  tone: "default" | "destructive" | "outline" | "secondary";
  className: string;
};

const dashboardSurfaceClass = "w-full overflow-hidden rounded-[28px] border border-border/60 bg-white shadow-none";

const getProductMeta = (product): ProductMeta => {
  const stock = getProductStock(product);

  if (stock <= 0) {
    return {
      label: "Out of stock",
      tone: "destructive",
      className: "border-transparent bg-destructive text-white",
    };
  }

  if (stock <= 12) {
    return {
      label: "Low stock",
      tone: "secondary",
      className: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
    };
  }

  return {
    label: "Active",
    tone: "default",
    className: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  };
};

const getProductChannels = (product) => {
  const channels = [
    ...collectLabels(product?.tags),
    ...collectLabels(product?.badges),
  ];

  if (!channels.length) {
    channels.push(product?.images?.length ? "Online store" : "Catalogue");
  }

  return Array.from(new Set(channels)).slice(0, 3);
};

const getProductImage = (product) => product?.images?.[0]?.url || "";

export default function ProductOverview() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();
  const { products, collections, stats, loading, refresh } = useDashboardData(true, request);

  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  useEffect(() => {
    const validIds = new Set(Array.isArray(products) ? products.map((product) => product.id) : []);
    setSelectedProductIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [products]);

  useEffect(() => {
    if (selectedProductIds.length === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [selectedProductIds.length, showSelectedOnly]);

  const collectionOptions = useMemo(() => {
    const base = [
      { value: "all", label: "All collections" },
      { value: "none", label: "No collection" },
    ];

    if (!Array.isArray(collections)) return base;

    return [...base, ...collections.map((collection) => ({ value: collection.id, label: collection.name }))];
  }, [collections]);

  const visibleProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];

    const term = search.trim().toLowerCase();

    return [...products]
      .filter((product) => {
        const matchesSearch = term
          ? [
              product?.name,
              product?.slug,
              product?.brand,
              product?.productType,
              product?.collection?.name,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(term))
          : true;

        const matchesCollection =
          collectionFilter === "all"
            ? true
            : collectionFilter === "none"
              ? !product?.collection
              : product?.collectionId === collectionFilter;

        const matchesStock = lowStockOnly ? getProductStock(product) <= 12 : true;

        return matchesSearch && matchesCollection && matchesStock;
      })
      .sort((a, b) => {
        const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return left - right;
      });
  }, [products, search, collectionFilter, lowStockOnly]);

  const inventoryProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((product) => getProductStock(product) > 0);
  }, [products]);

  const visibleProductIds = useMemo(() => visibleProducts.map((product) => product.id), [visibleProducts]);
  const selectedProductIdSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);
  const selectedCount = selectedProductIds.length;
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProductIdSet.has(id));
  const someVisibleSelected = visibleProductIds.some((id) => selectedProductIdSet.has(id)) && !allVisibleSelected;
  const displayedProducts = useMemo(() => {
    if (!showSelectedOnly) return visibleProducts;
    if (!Array.isArray(products)) return [];
    return products.filter((product) => selectedProductIdSet.has(product.id));
  }, [products, selectedProductIdSet, showSelectedOnly, visibleProducts]);

  const statCards = [
    {
      label: "Total products",
      value: numberFormatter.format(stats?.productCount ?? 0),
      helper: "Live catalogue items",
      icon: <Package className="h-5 w-5 text-primary" />,
      gradient: "from-primary/70 via-primary/20 to-secondary/20",
    },
    {
      label: "In stock",
      value: numberFormatter.format(inventoryProducts.length),
      helper: "Products ready to sell",
      icon: <Boxes className="h-5 w-5 text-emerald-600" />,
      gradient: "from-emerald-500/60 via-emerald-200/20 to-transparent",
    },
    {
      label: "Low stock",
      value: numberFormatter.format(stats?.lowStockCount ?? 0),
      helper: "Needs replenishment",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      gradient: "from-amber-500/70 via-amber-200/20 to-transparent",
    },
    {
      label: "Collections",
      value: numberFormatter.format(stats?.collectionCount ?? 0),
      helper: "Organised merchandising groups",
      icon: <Layers3 className="h-5 w-5 text-sky-600" />,
      gradient: "from-sky-500/70 via-sky-200/20 to-transparent",
    },
  ];

  const handleCreate = () => navigate("/dashboard/products/new");

  const handleRefresh = () => {
    refresh?.();
    toast.success("Product catalogue refreshed");
  };

  const handleResetFilters = () => {
    setSearch("");
    setCollectionFilter("all");
    setLowStockOnly(false);
    toast.success("Filters cleared");
  };

  const handlePlaceholderBulkAction = (label: string) => {
    if (!selectedCount) return;
    toast.info(`${label} is not wired yet for product bulk actions.`);
  };

  const handleToggleProductSelection = (productId: string, checked: boolean | "indeterminate") => {
    const shouldSelect = checked === true;
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (shouldSelect) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return Array.from(next);
    });
  };

  const handleToggleVisibleSelection = (checked: boolean | "indeterminate") => {
    const shouldSelect = checked === true;
    setSelectedProductIds((current) => {
      const next = new Set(current);
      visibleProductIds.forEach((productId) => {
        if (shouldSelect) {
          next.add(productId);
        } else {
          next.delete(productId);
        }
      });
      return Array.from(next);
    });
  };

  const handleClearSelection = () => {
    setSelectedProductIds([]);
    setShowSelectedOnly(false);
  };

  const handleDeleteSelected = async () => {
    if (!selectedCount || bulkDeleting) return;

    const confirmDelete = window.confirm(
      `Delete ${selectedCount} selected product${selectedCount === 1 ? "" : "s"}? This cannot be undone.`
    );

    if (!confirmDelete) return;

    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedProductIds.map(async (productId) => {
          const response = await request(`${API_BASE}/products/${productId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const message = await response.text().catch(() => "Failed to delete product");
            throw new Error(message || "Failed to delete product");
          }

          return productId;
        })
      );

      const failedIds = results
        .map((result, index) => (result.status === "rejected" ? selectedProductIds[index] : null))
        .filter((value): value is string => Boolean(value));

      const deletedCount = selectedCount - failedIds.length;

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} product${deletedCount === 1 ? "" : "s"}`);
      }

      if (failedIds.length) {
        setSelectedProductIds(failedIds);
        toast.error(`${failedIds.length} product${failedIds.length === 1 ? "" : "s"} could not be deleted`);
      } else {
        setSelectedProductIds([]);
      }

      if (deletedCount > 0) {
        refresh?.();
      }
    } catch (error) {
      console.error("Bulk delete failed", error);
      toast.error("Unable to delete selected products");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = () => {
    if (!visibleProducts.length) {
      toast.error("No products available to export.");
      return;
    }

    const headers = [
      "Product",
      "Slug",
      "Status",
      "Inventory",
      "Collection",
      "Channels",
      "Product type",
      "Vendor",
      "Base price",
      "Created",
    ];

    const rows = visibleProducts.map((product) => {
      const meta = getProductMeta(product);
      const stock = getProductStock(product);
      const channels = getProductChannels(product).join(" | ");

      return [
        product?.name ?? "",
        product?.slug ?? "",
        meta.label,
        stock,
        product?.collection?.name ?? "—",
        channels,
        humanizeLabel(product?.productType),
        product?.brand ?? "—",
        product?.basePrice != null ? formatCurrency(Number(product.basePrice)) : "—",
        formatDate(product?.createdAt),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cevonne-products-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#f5f7fb]">
        <AppSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 space-y-4 px-3 pb-6 pt-2 md:px-4 lg:px-5">
              <div className="flex min-h-10 w-full flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <h1 className="text-[15px] font-semibold leading-none tracking-tight text-foreground">
                    Products
                  </h1>
                </div>

                <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    className="h-9 rounded-full border-border/70 bg-white px-4 text-sm font-medium text-foreground shadow-none hover:bg-muted/40"
                  >
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setImportDialogOpen(true)}
                    className="h-9 rounded-full border-border/70 bg-white px-4 text-sm font-medium text-foreground shadow-none hover:bg-muted/40"
                  >
                    Import
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-9 rounded-full border-border/70 bg-white px-4 text-sm font-medium text-foreground shadow-none hover:bg-muted/40"
                      >
                        More actions
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60">
                      <DropdownMenuItem onClick={handleRefresh}>
                        <RefreshCcw className="h-4 w-4" />
                        Refresh data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleResetFilters}>
                        <Filter className="h-4 w-4" />
                        Reset filters
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                        <Upload className="h-4 w-4" />
                        Open bulk tools
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreate}>
                        <Plus className="h-4 w-4" />
                        Add new product
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={handleCreate}
                    className="h-9 rounded-full bg-[#111111] px-4 text-sm font-medium text-white shadow-none hover:bg-black"
                  >
                    Add product
                  </Button>
                </div>
              </div>

              <div className="w-full">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <Card key={index} className="overflow-hidden rounded-3xl border-border/60 bg-white shadow-none p-0">
                          <CardContent className="space-y-3 p-4">
                            <div className="h-1.5 w-full rounded-full bg-muted/60" />
                            <div className="h-4 w-24 rounded bg-muted/60" />
                            <div className="h-9 w-20 rounded bg-muted/60" />
                            <div className="h-3 w-28 rounded bg-muted/60" />
                          </CardContent>
                        </Card>
                      ))
                    : statCards.map((card) => (
                        <Card key={card.label} className="overflow-hidden rounded-3xl border-border/60 bg-white shadow-none p-0">
                          <CardContent className="space-y-4 p-4">
                            <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${card.gradient}`} />
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                                <p className="text-3xl font-semibold tracking-tight text-foreground">{card.value}</p>
                                <p className="text-xs text-muted-foreground">{card.helper}</p>
                              </div>
                              <div className="rounded-2xl bg-primary/10 p-3">{card.icon}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                </div>
              </div>

              <div className={dashboardSurfaceClass}>
                <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">All products</p>
                    <p className="text-sm text-muted-foreground">
                      Search, filter, and open any product record in a few clicks.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-xs uppercase tracking-wide">
                      {displayedProducts.length} shown
                    </Badge>
                    {lowStockOnly ? (
                      <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-wide">
                        Low stock filter on
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 border-b border-border/60 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_220px_160px_120px] lg:items-center">
                    <div className="relative w-full">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by name, collection, brand, or type"
                        className="h-11 rounded-full border-border/70 bg-muted/20 pl-10"
                      />
                    </div>

                    <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                      <SelectTrigger className="h-11 rounded-full border-border/70 bg-muted/20">
                        <SelectValue placeholder="Collection" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/60">
                        {collectionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant={lowStockOnly ? "default" : "outline"}
                      onClick={() => setLowStockOnly((value) => !value)}
                      className={cn(
                        "h-11 rounded-full px-4",
                        lowStockOnly && "bg-amber-500 text-white hover:bg-amber-500/90"
                      )}
                    >
                      <Filter className="h-4 w-4" />
                      Low stock
                    </Button>

                    <Button type="button" variant="ghost" className="h-11 rounded-full px-4" onClick={handleResetFilters}>
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-full" onClick={handleRefresh}>
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[920px] table-fixed">
                    <colgroup>
                      <col className="w-[5%]" />
                      <col className="w-[47%]" />
                      <col className="w-[17%]" />
                      <col className="w-[13%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <TableHeader>
                      {selectedCount > 0 ? (
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableHead className="h-12 p-0" colSpan={5}>
                            <div className="grid h-full grid-cols-[5%_47%_17%_13%_18%] items-center bg-muted/20 px-5">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  aria-label="Select all visible products"
                                  title="Select all visible products"
                                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                  onCheckedChange={handleToggleVisibleSelection}
                                  disabled={bulkDeleting || visibleProductIds.length === 0}
                                />
                              </div>

                              <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full border-border/70 bg-white px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted/40"
                                  onClick={() => handlePlaceholderBulkAction("Bulk edit")}
                                  disabled={bulkDeleting}
                                >
                                  Bulk edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full border-border/70 bg-white px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted/40"
                                  onClick={() => handlePlaceholderBulkAction("Set as draft")}
                                  disabled={bulkDeleting}
                                >
                                  Set as draft
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground"
                                  onClick={handleClearSelection}
                                  disabled={bulkDeleting}
                                >
                                  Clear selection
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-8 w-8 rounded-full border-border/70 bg-white p-0 text-foreground shadow-none hover:bg-muted/40"
                                      disabled={bulkDeleting}
                                      aria-label="More bulk actions"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-80 rounded-2xl border-border/60">
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Archive products")}>
                                      <Archive className="h-4 w-4" />
                                      Archive products
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Unlist products")}>
                                      <EyeOff className="h-4 w-4" />
                                      Unlist products
                                    </DropdownMenuItem>
                                    <DropdownMenuItem variant="destructive" onSelect={() => void handleDeleteSelected()}>
                                      <Trash2 className="h-4 w-4" />
                                      Delete products
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Include in sales channels")}>
                                      Include in sales channels
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Exclude from sales channels")}>
                                      Exclude from sales channels
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Include in catalogs")}>
                                      Include in catalogs
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Exclude from catalogs")}>
                                      Exclude from catalogs
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Add tags")}>
                                      <Tags className="h-4 w-4" />
                                      Add tags
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Remove tags")}>
                                      <Tag className="h-4 w-4" />
                                      Remove tags
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Add to collection(s)")}>
                                      <FolderPlus className="h-4 w-4" />
                                      Add to collection(s)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Remove from collection(s)")}>
                                      <FolderMinus className="h-4 w-4" />
                                      Remove from collection(s)
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Apps
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => handlePlaceholderBulkAction("Create email campaign")}>
                                      <Mail className="h-4 w-4" />
                                      Create email campaign
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div aria-hidden="true" className="col-span-2" />

                              <div className="justify-self-end">
                                <div className="flex items-center gap-1 shrink-0">
                                  <Switch
                                    id="show-selected-only"
                                    checked={showSelectedOnly}
                                    onCheckedChange={setShowSelectedOnly}
                                    disabled={selectedCount === 0 || bulkDeleting}
                                    className="h-4 w-7 shrink-0"
                                  />
                                  <label
                                    htmlFor="show-selected-only"
                                    className={cn(
                                      "cursor-pointer whitespace-nowrap text-sm font-medium leading-none text-foreground",
                                      (selectedCount === 0 || bulkDeleting) && "cursor-not-allowed text-muted-foreground"
                                    )}
                                  >
                                    Show all selected
                                  </label>
                                </div>
                              </div>
                            </div>
                          </TableHead>
                        </TableRow>
                      ) : (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead className="w-12 px-3 py-4">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                aria-label="Select all visible products"
                                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                onCheckedChange={handleToggleVisibleSelection}
                              />
                            </div>
                          </TableHead>
                          <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Product
                          </TableHead>
                          <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Status
                          </TableHead>
                          <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Inventory
                          </TableHead>
                          <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Collection
                          </TableHead>
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell colSpan={5} className="px-5 py-4">
                              <div className="grid grid-cols-[24px_minmax(0,1.8fr)_repeat(3,minmax(0,1fr))] gap-4">
                                <div className="h-10 rounded-2xl bg-muted/60" />
                                <div className="h-10 rounded-2xl bg-muted/60" />
                                <div className="h-10 rounded-2xl bg-muted/60" />
                                <div className="h-10 rounded-2xl bg-muted/60" />
                                <div className="h-10 rounded-2xl bg-muted/60" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : displayedProducts.length ? (
                        displayedProducts.map((product) => {
                          const image = getProductImage(product);
                          const stock = getProductStock(product);
                          const variantCount = product?._count?.shades ?? product?.shades?.length ?? 0;
                          const meta = getProductMeta(product);

                          return (
                            <TableRow
                              key={product.id}
                              className={cn(
                                "group cursor-pointer transition hover:bg-primary/5",
                                selectedProductIdSet.has(product.id) && "bg-primary/5"
                              )}
                              onClick={() => navigate(`/dashboard/products/${product.id}/edit`)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  navigate(`/dashboard/products/${product.id}/edit`);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                            >
                              <TableCell className="w-12 px-3 py-4">
                                <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
                                  <Checkbox
                                    aria-label={`Select ${product.name}`}
                                    checked={selectedProductIdSet.has(product.id)}
                                    onCheckedChange={(checked) => handleToggleProductSelection(product.id, checked)}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  {image ? (
                                    <img
                                      src={image}
                                      alt={product.name}
                                      className="h-12 w-12 rounded-2xl object-cover ring-1 ring-border/70"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-border/70">
                                      {product?.name?.slice(0, 2)?.toUpperCase() || "PR"}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                                </div>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <Badge
                                  variant={meta.tone}
                                  className={cn(
                                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                                    meta.className
                                  )}
                                >
                                  {meta.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-end gap-2">
                                    <span className="text-base font-semibold text-foreground">{numberFormatter.format(stock)}</span>
                                    <span className="text-xs text-muted-foreground">units</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{variantCount} shade{variantCount === 1 ? "" : "s"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-foreground">
                                    {product?.collection?.name ?? "No collection"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(product?.createdAt)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="px-5 py-16 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                              <div className="rounded-full bg-primary/10 p-4 text-primary">
                                <BadgeCheck className="h-6 w-6" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-semibold text-foreground">No products match your filters.</p>
                                <p className="text-sm text-muted-foreground">
                                  Clear the search or filter settings to show the full product list.
                                </p>
                              </div>
                              <Button type="button" className="rounded-full" onClick={handleResetFilters}>
                                Clear filters
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto rounded-[28px] border-border/60 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-primary">Bulk product tools</DialogTitle>
            <DialogDescription>
              Upload JSON files, paste product payloads, or export catalogue data without leaving the product page.
            </DialogDescription>
          </DialogHeader>
          <BulkProductTools request={request} refresh={refresh} />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}










