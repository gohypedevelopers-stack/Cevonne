"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronDown,
  Copy,
  Eye,
  Filter,
  FolderPlus,
  Layers3,
  Loader2,
  MoreHorizontal,
  Package,
  PackageSearch,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { BulkProductTools } from "@/components/admin-dashboard/components/BulkProductTools";
import { formatCurrency, getProductStock, slugify } from "@/components/admin-dashboard/utils";
import type { Product, ProductCollection, ProductShade } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { API_BASE } from "@/lib/api";
import { useNavigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type ProductStatus = "in-stock" | "low-stock" | "out-of-stock" | "draft" | "archived";
type SortKey = "newest" | "oldest" | "stock-desc" | "stock-asc" | "name";
type StatusFilter = "all" | ProductStatus;
type CollectionFilter = "all" | "none" | string;

type ProductCollectionOption = Pick<ProductCollection, "id" | "name" | "slug">;

type DecoratedProduct = Product & {
  status: ProductStatus;
  stockCount: number;
  shadeCount: number;
  collectionLabel: string;
  collectionDate: string;
  collectionKey: string;
  searchIndex: string;
};

type ProductStatCardProps = {
  label: string;
  value: string;
  helper: string;
  trend: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

type ProductsToolbarProps = {
  activeFilterCount: number;
  collectionFilter: CollectionFilter;
  collectionOptions: ProductCollectionOption[];
  lowStockOnly: boolean;
  className?: string;
  onCollectionFilterChange: (value: CollectionFilter) => void;
  onLowStockToggle: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  searchQuery: string;
  sortBy: SortKey;
  statusFilter: StatusFilter;
};

type ProductActionHandlers = {
  onDelete: (product: DecoratedProduct) => void;
  onDuplicate: (product: DecoratedProduct) => void;
  onEdit: (product: DecoratedProduct) => void;
  onManageInventory: (product: DecoratedProduct) => void;
  onView: (product: DecoratedProduct) => void;
};

type BulkActionBarProps = {
  collectionOptions: ProductCollectionOption[];
  deleting: boolean;
  exporting: boolean;
  className?: string;
  onAddToCollection: (collectionId: string | null) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onMarkDraft: () => void;
  selectedCount: number;
};

type ProductRowProps = {
  product: DecoratedProduct;
  selected: boolean;
  onToggleSelect: (productId: string, checked: boolean | "indeterminate") => void;
  actions: ProductActionHandlers;
};

type ProductMobileCardProps = ProductRowProps;

type ProductsTableProps = {
  actions: ProductActionHandlers;
  hasProducts: boolean;
  loading: boolean;
  noResults: boolean;
  onClearFilters: () => void;
  onCreateProduct: () => void;
  onToggleSelect: (productId: string, checked: boolean | "indeterminate") => void;
  onToggleSelectAll: (checked: boolean | "indeterminate") => void;
  onRefresh: () => void;
  products: DecoratedProduct[];
  selectedIds: string[];
  someVisibleSelected: boolean;
  allVisibleSelected: boolean;
  errorMessage: string | null;
};

type DemoShadeSeed = {
  name: string;
  quantity: number;
  hexColor: string;
};

type DemoProductSeed = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  createdAt: string;
  productType: string;
  collection?: ProductCollectionOption | null;
  shades?: DemoShadeSeed[];
};

const DEMO_COLLECTION: ProductCollectionOption = {
  id: "collection-new-drop",
  name: "New Drop",
  slug: "new-drop",
};

const DEMO_COLLECTIONS: ProductCollectionOption[] = [DEMO_COLLECTION];

const DEMO_PRODUCTS: Product[] = [
  createDemoProduct({
    id: "demo-caramel-eclair",
    name: "Caramel Éclair — Velvet Power™ Bullet Lipstick",
    slug: "velvet-power-caramel-eclair",
    basePrice: 1448,
    createdAt: "2025-12-09T00:00:00+05:30",
    productType: "Lipstick",
    collection: DEMO_COLLECTION,
  }),
  createDemoProduct({
    id: "demo-berry-bloom",
    name: "Berry Bloom — Glass Luxe™ Lip Gloss",
    slug: "glass-luxe-berry-bloom",
    basePrice: 1448,
    createdAt: "2025-12-09T00:00:00+05:30",
    productType: "Lip Gloss",
    collection: DEMO_COLLECTION,
  }),
  createDemoProduct({
    id: "demo-berry-eclipse",
    name: "Berry Eclipse — Air Couture™ Liquid Matte Lipstick",
    slug: "air-couture-berry-eclipse",
    basePrice: 149,
    createdAt: "2025-12-09T00:00:00+05:30",
    productType: "Liquid Matte Lipstick",
    collection: DEMO_COLLECTION,
  }),
  createDemoProduct({
    id: "demo-amber-silk",
    name: "Amber Silk — Air Couture™ Liquid Matte Lipstick",
    slug: "air-couture-amber-silk",
    basePrice: 149,
    createdAt: "2025-12-09T00:00:00+05:30",
    productType: "Liquid Matte Lipstick",
    collection: DEMO_COLLECTION,
  }),
  createDemoProduct({
    id: "demo-bare-silk",
    name: "Bare Silk — Glass Luxe™ Lip Gloss",
    slug: "glass-luxe-bare-silk",
    basePrice: 149,
    createdAt: "2025-12-09T00:00:00+05:30",
    productType: "Lip Gloss",
    collection: DEMO_COLLECTION,
  }),
  createDemoProduct({
    id: "demo-cevonne-crush",
    name: "Cevonne Crush — Velvet Power™ Bullet Lipstick",
    slug: "cevonne-crush-velvet-power-bullet-lipstick",
    basePrice: 149,
    createdAt: "2025-12-05T00:00:00+05:30",
    productType: "Lipstick",
    collection: null,
  }),
  createDemoProduct({
    id: "demo-velvet-rose",
    name: "Velvet Rose — Velvet Power™ Bullet Lipstick",
    slug: "velvet-power-velvet-rose",
    basePrice: 1448,
    createdAt: "2025-12-11T00:00:00+05:30",
    productType: "Lipstick",
    collection: DEMO_COLLECTION,
    shades: [{ name: "Velvet Rose", quantity: 18, hexColor: "#8d3e63" }],
  }),
  createDemoProduct({
    id: "demo-muted-rose",
    name: "Muted Rose — Air Couture™ Liquid Matte Lipstick",
    slug: "air-couture-muted-rose",
    basePrice: 149,
    createdAt: "2025-12-12T00:00:00+05:30",
    productType: "Liquid Matte Lipstick",
    collection: DEMO_COLLECTION,
    shades: [
      { name: "Muted Rose", quantity: 4, hexColor: "#c98a90" },
      { name: "Petal Veil", quantity: 0, hexColor: "#d7b0b8" },
    ],
  }),
  createDemoProduct({
    id: "demo-beige-glow",
    name: "Beige Glow — Glass Luxe™ Lip Gloss",
    slug: "glass-luxe-beige-glow",
    basePrice: 149,
    createdAt: "2025-12-13T00:00:00+05:30",
    productType: "Lip Gloss",
    collection: DEMO_COLLECTION,
    shades: [{ name: "Beige Glow", quantity: 11, hexColor: "#c6b09e" }],
  }),
];

const DEMO_STATS = {
  totalProducts: 29,
  inStock: 1,
  lowStock: 2,
  collections: 1,
};

const statCardAccent = {
  plum: "bg-primary",
  mint: "bg-emerald-300",
  amber: "bg-amber-300",
  sky: "bg-sky-300",
};

const statusMeta: Record<
  ProductStatus,
  { label: string; className: string; wrapperClass: string }
> = {
  "in-stock": {
    label: "In stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    wrapperClass: "bg-emerald-50 text-emerald-700",
  },
  "low-stock": {
    label: "Low stock",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    wrapperClass: "bg-amber-50 text-amber-700",
  },
  "out-of-stock": {
    label: "Out of stock",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    wrapperClass: "bg-rose-50 text-rose-700",
  },
  draft: {
    label: "Draft",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    wrapperClass: "bg-slate-100 text-slate-600",
  },
  archived: {
    label: "Archived",
    className: "border-stone-200 bg-stone-100 text-stone-600",
    wrapperClass: "bg-stone-100 text-stone-600",
  },
};

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Stock high to low", value: "stock-desc" },
  { label: "Stock low to high", value: "stock-asc" },
  { label: "Name A-Z", value: "name" },
];

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "In stock", value: "in-stock" },
  { label: "Low stock", value: "low-stock" },
  { label: "Out of stock", value: "out-of-stock" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

function initialsFrom(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CV"
  );
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function collectLabels(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return (item as { label?: string; name?: string; title?: string; value?: string }).label
          ?? (item as { label?: string; name?: string; title?: string; value?: string }).name
          ?? (item as { label?: string; name?: string; title?: string; value?: string }).title
          ?? (item as { label?: string; name?: string; title?: string; value?: string }).value
          ?? "";
      }
      return "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function createDemoProduct(seed: DemoProductSeed): Product {
  const shades = (seed.shades ?? []).map((shade, index) => {
    const shadeId = `${seed.id}-shade-${index + 1}`;
    return {
      id: shadeId,
      name: shade.name,
      hexColor: shade.hexColor,
      productId: seed.id,
      inventory: {
        id: `${seed.id}-inventory-${index + 1}`,
        quantity: shade.quantity,
        shadeId,
      },
    } as ProductShade;
  });

  return {
    id: seed.id,
    name: seed.name,
    slug: seed.slug,
    brand: "Cevonne",
    productType: seed.productType,
    basePrice: seed.basePrice,
    collectionId: seed.collection?.id ?? null,
    collection: seed.collection ?? null,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    images: [],
    shades,
  };
}

function getProductImage(product: Product) {
  return Array.isArray(product.images) && product.images.length ? product.images[0]?.url ?? "" : "";
}

function getCollectionLabel(product: Product) {
  return product.collection?.name ?? "No collection";
}

function getCollectionKey(product: Product) {
  return product.collectionId ?? product.collection?.id ?? "none";
}

function getProductStatus(product: Product, override?: ProductStatus): ProductStatus {
  if (override) return override;

  const tokens = [
    ...collectLabels(product.tags),
    ...collectLabels(product.badges),
  ]
    .join(" ")
    .toLowerCase();

  if (tokens.includes("archived")) return "archived";
  if (tokens.includes("draft")) return "draft";

  const stock = getProductStock(product);
  if (stock <= 0) return "out-of-stock";
  if (stock <= 12) return "low-stock";
  return "in-stock";
}

function getStatusLabel(status: ProductStatus) {
  return statusMeta[status]?.label ?? humanize(status);
}

function getStatusClassName(status: ProductStatus) {
  return statusMeta[status]?.className ?? "border-border/70 bg-muted/20 text-muted-foreground";
}

function getSearchIndex(product: DecoratedProduct) {
  return [
    product.name,
    product.slug,
    product.brand,
    product.productType,
    product.collectionLabel,
    product.collectionDate,
    product.status,
    getStatusLabel(product.status),
    ...(Array.isArray(product.shades) ? product.shades.map((shade) => shade.name) : []),
    ...(Array.isArray(product.tags) ? collectLabels(product.tags) : []),
    ...(Array.isArray(product.badges) ? collectLabels(product.badges) : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getCollectionCount(products: Product[], collections: ProductCollectionOption[]) {
  if (collections.length > 0) return collections.length;
  const unique = new Set(
    products
      .map((product) => product.collectionId ?? product.collection?.id ?? null)
      .filter((value): value is string => Boolean(value))
  );
  return unique.size;
}

function buildProductCsv(products: DecoratedProduct[]) {
  const headers = [
    "Product",
    "Slug",
    "Status",
    "Inventory",
    "Shades",
    "Collection",
    "Brand",
    "Type",
    "Price",
    "Created",
  ];

  const rows = products.map((product) => [
    product.name,
    product.slug,
    getStatusLabel(product.status),
    `${product.stockCount} units`,
    `${product.shadeCount} shades`,
    product.collectionLabel,
    product.brand ?? "Cevonne",
    humanize(product.productType ?? ""),
    formatCurrency(Number(product.basePrice ?? 0)),
    product.collectionDate,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function ProductStatCard({
  label,
  value,
  helper,
  trend,
  icon: Icon,
  accentClass,
  iconClass,
}: ProductStatCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className={cn("h-1.5 w-full rounded-full", accentClass)} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="font-serif text-4xl leading-none tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{helper}</p>
          </div>
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", iconClass)}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <ArrowRight className="size-3.5" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductStatSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm">
      <CardContent className="space-y-4 p-5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-2xl" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="size-12 rounded-2xl" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </CardContent>
    </Card>
  );
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        getStatusClassName(status)
      )}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

function ProductThumbnail({ product }: { product: DecoratedProduct }) {
  const image = getProductImage(product);
  const initials = initialsFrom(product.name);

  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-[#f8f0ea] shadow-sm">
      <Avatar className="size-12 rounded-2xl">
        <AvatarImage src={image || undefined} alt={product.name} className="rounded-2xl object-cover" />
        <AvatarFallback className="rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function ProductActionsMenu({
  product,
  onDelete,
  onDuplicate,
  onEdit,
  onManageInventory,
  onView,
}: {
  product: DecoratedProduct;
} & ProductActionHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full border-border/70 bg-white shadow-none hover:bg-muted/40"
          aria-label={`Open actions for ${product.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60 bg-white shadow-lg">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Product actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onView(product)}>
          <Eye className="size-4" />
          View product
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(product)}>
          <PencilLine className="size-4" />
          Edit product
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(product)}>
          <Copy className="size-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onManageInventory(product)}>
          <Boxes className="size-4" />
          Manage inventory
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(product)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProductRow({ product, selected, onToggleSelect, actions }: ProductRowProps) {
  return (
    <TableRow
      className={cn("group cursor-pointer transition hover:bg-primary/5", selected && "bg-primary/5")}
      onClick={() => actions.onEdit(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.onEdit(product);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <TableCell className="w-12 px-3 py-4 align-top">
        <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label={`Select ${product.name}`}
            checked={selected}
            onCheckedChange={(checked) => onToggleSelect(product.id, checked)}
          />
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-top">
        <div className="flex min-w-0 items-start gap-3">
          <ProductThumbnail product={product} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-top">
        <ProductStatusBadge status={product.status} />
      </TableCell>
      <TableCell className="px-4 py-4 align-top">
        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <span className="text-base font-semibold text-foreground">{numberFormatter.format(product.stockCount)}</span>
            <span className="text-xs text-muted-foreground">units</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {product.shadeCount} shade{product.shadeCount === 1 ? "" : "s"}
          </p>
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-top">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{product.collectionLabel}</p>
          <p className="text-xs text-muted-foreground">{product.collectionDate}</p>
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 text-right align-top">
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <ProductActionsMenu product={product} {...actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProductMobileCard({ product, selected, onToggleSelect, actions }: ProductMobileCardProps) {
  return (
    <Card
      className="rounded-2xl border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => actions.onEdit(product)}
    >
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div onClick={(event) => event.stopPropagation()}>
            <Checkbox
              aria-label={`Select ${product.name}`}
              checked={selected}
              onCheckedChange={(checked) => onToggleSelect(product.id, checked)}
            />
          </div>
          <ProductThumbnail product={product} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <ProductActionsMenu product={product} {...actions} />
              </div>
            </div>
            <ProductStatusBadge status={product.status} />
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Inventory</p>
            <p className="text-sm font-semibold text-foreground">{numberFormatter.format(product.stockCount)} units</p>
            <p className="text-xs text-muted-foreground">
              {product.shadeCount} shade{product.shadeCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Collection</p>
            <p className="text-sm font-semibold text-foreground">{product.collectionLabel}</p>
            <p className="text-xs text-muted-foreground">{product.collectionDate}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkActionBar({
  collectionOptions,
  deleting,
  exporting,
  className,
  onAddToCollection,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onMarkDraft,
  selectedCount,
}: BulkActionBarProps) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border/60 bg-[#fbf7f3] px-3 shadow-sm",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Badge
          variant="outline"
          className="h-7 shrink-0 rounded-full border-border/70 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {numberFormatter.format(selectedCount)} selected
        </Badge>
        <Button
          type="button"
          variant="ghost"
          className="h-9 shrink-0 rounded-full px-4 text-muted-foreground"
          onClick={onClearSelection}
          disabled={deleting || exporting}
        >
          Clear selection
        </Button>
      </div>

      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none"
          onClick={onExportSelected}
          disabled={deleting || exporting}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : null}
          Export selected
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none"
              disabled={deleting || exporting}
            >
              <FolderPlus className="size-4" />
              Add to collection
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60 bg-white shadow-lg">
            <DropdownMenuLabel className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Move selected
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAddToCollection(null)}>
              No collection
            </DropdownMenuItem>
            {collectionOptions.map((collection) => (
              <DropdownMenuItem key={collection.id} onSelect={() => onAddToCollection(collection.id)}>
                {collection.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none"
          onClick={onMarkDraft}
          disabled={deleting || exporting}
        >
          <Sparkles className="size-4" />
          Mark as draft
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-full border-rose-200 bg-white px-4 text-rose-700 shadow-none hover:bg-rose-50 hover:text-rose-800"
          onClick={onDeleteSelected}
          disabled={deleting || exporting}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete selected
        </Button>
      </div>
    </div>
  );
}

function ProductsToolbar({
  activeFilterCount,
  collectionFilter,
  collectionOptions,
  className,
  lowStockOnly,
  onCollectionFilterChange,
  onLowStockToggle,
  onRefresh,
  onReset,
  onSearchChange,
  onSortChange,
  onStatusFilterChange,
  searchQuery,
  sortBy,
  statusFilter,
}: ProductsToolbarProps) {
  return (
    <div className={cn("flex h-11 w-full items-center gap-3 overflow-x-auto", className)}>
      <div className="relative min-w-[320px] flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, collection, brand, or type"
          className="h-11 min-w-0 rounded-full border-border/70 bg-white pl-10 shadow-none"
        />
      </div>

      <Select value={collectionFilter} onValueChange={(value) => onCollectionFilterChange(value as CollectionFilter)}>
        <SelectTrigger className="!h-11 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none sm:w-[220px]">
          <SelectValue placeholder="All collections" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/60 bg-white shadow-lg">
          <SelectItem value="all">All collections</SelectItem>
          <SelectItem value="none">No collection</SelectItem>
          {collectionOptions.map((collection) => (
            <SelectItem key={collection.id} value={collection.id}>
              {collection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}>
        <SelectTrigger className="!h-11 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none sm:w-[180px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/60 bg-white shadow-lg">
          {statusFilterOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortKey)}>
        <SelectTrigger className="!h-11 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none sm:w-[180px]">
          <SelectValue placeholder="Newest first" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/60 bg-white shadow-lg">
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={lowStockOnly ? "secondary" : "outline"}
        className={cn(
          "h-11 shrink-0 rounded-full px-4 shadow-none",
          lowStockOnly && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        )}
        onClick={onLowStockToggle}
      >
        <Filter className="size-4" />
        Low stock
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 rounded-full border-border/70 bg-white px-4 text-muted-foreground shadow-none hover:bg-muted/40"
        onClick={onReset}
      >
        Reset
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 rounded-full border-border/70 bg-white px-4 shadow-none"
        onClick={onRefresh}
      >
        <RefreshCcw className="size-4" />
        Refresh
      </Button>
    </div>
  );
}

function ProductsLoadingState() {
  return (
    <div className="space-y-3">
      <div className="hidden space-y-3 md:block">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[32px_minmax(0,1.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)] items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm"
          >
            <Skeleton className="size-5 rounded-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-14 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="size-10 justify-self-end rounded-full" />
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border-border/60 bg-white shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="size-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 rounded-full" />
                  <Skeleton className="h-3 w-28 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="size-10 rounded-full" />
              </div>
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProductsEmptyState({ onCreate, onRefresh }: { onCreate: () => void; onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
        <PackageSearch className="size-6" />
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">No products yet</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Your lipstick catalogue is empty. Add a product or refresh to sync the latest inventory from the backend.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onCreate} className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" />
          Add product
        </Button>
        <Button onClick={onRefresh} variant="outline" className="rounded-full">
          <RefreshCcw className="size-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function ProductsNoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
        <Search className="size-6" />
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">No matching products</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Try a different search term or clear the filters to bring back the full lipstick catalogue.
      </p>
      <Button onClick={onClear} className="mt-6 rounded-full">
        Clear filters
      </Button>
    </div>
  );
}

function ProductsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">Unable to load products</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
      <Button onClick={onRetry} variant="outline" className="mt-6 rounded-full">
        Retry
      </Button>
    </div>
  );
}

function ProductsTable({
  actions,
  hasProducts,
  loading,
  noResults,
  onClearFilters,
  onCreateProduct,
  onRefresh,
  onToggleSelect,
  onToggleSelectAll,
  products,
  selectedIds,
  someVisibleSelected,
  allVisibleSelected,
  errorMessage,
}: ProductsTableProps) {
  if (loading) {
    return <ProductsLoadingState />;
  }

  if (errorMessage) {
    return <ProductsErrorState message={errorMessage} onRetry={onRefresh} />;
  }

  if (!hasProducts) {
    return <ProductsEmptyState onCreate={onCreateProduct} onRefresh={onRefresh} />;
  }

  if (noResults) {
    return <ProductsNoResultsState onClear={onClearFilters} />;
  }

  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <Table className="min-w-[1120px] table-fixed">
          <colgroup>
            <col className="w-12" />
            <col className="w-[42%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="px-3 py-4">
                <div className="flex items-center justify-center">
                  <Checkbox
                    aria-label="Select all visible products"
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={onToggleSelectAll}
                  />
                </div>
              </TableHead>
              <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product
              </TableHead>
              <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Inventory
              </TableHead>
              <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Collection
              </TableHead>
              <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                selected={selectedIds.includes(product.id)}
                onToggleSelect={onToggleSelect}
                actions={actions}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <ProductMobileCard
            key={product.id}
            product={product}
            selected={selectedIds.includes(product.id)}
            onToggleSelect={onToggleSelect}
            actions={actions}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();
  const { products, collections, loading, error, refresh } = useDashboardData(true, request, true);

  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ProductStatus>>({});
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkCollectionUpdating, setBulkCollectionUpdating] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  const demoMode = !loading && !error && (!Array.isArray(products) || products.length === 0) && process.env.NODE_ENV !== "production";
  const sourceProducts = useMemo(() => {
    const list = Array.isArray(products) && products.length ? products : [];
    if (demoMode) return DEMO_PRODUCTS;
    return list;
  }, [demoMode, products]);

  const sourceCollections = useMemo(() => {
    const list = Array.isArray(collections) ? collections : [];
    if (demoMode && list.length === 0) return DEMO_COLLECTIONS;
    return list as ProductCollectionOption[];
  }, [collections, demoMode]);

  const collectionOptions = useMemo(() => {
    const seen = new Set<string>();
    return sourceCollections.filter((collection) => {
      if (seen.has(collection.id)) return false;
      seen.add(collection.id);
      return true;
    });
  }, [sourceCollections]);

  const decoratedProducts = useMemo<DecoratedProduct[]>(() => {
    return sourceProducts.map((product) => {
      const status = getProductStatus(product, statusOverrides[product.id]);
      const stockCount = getProductStock(product);
      const shadeCount = Array.isArray(product.shades) ? product.shades.length : 0;
      const collectionLabel = getCollectionLabel(product);
      const collectionDate = formatDate(product.createdAt);
      const collectionKey = getCollectionKey(product);

      const decorated = {
        ...product,
        status,
        stockCount,
        shadeCount,
        collectionLabel,
        collectionDate,
        collectionKey,
      } as DecoratedProduct;

      return {
        ...decorated,
        searchIndex: getSearchIndex(decorated),
      };
    });
  }, [sourceProducts, statusOverrides]);

  useEffect(() => {
    const validIds = new Set(decoratedProducts.map((product) => product.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => validIds.has(id));
      return next.length === current.length ? current : next;
    });
    setStatusOverrides((current) => {
      const nextEntries = Object.entries(current).filter(([id]) => validIds.has(id));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries) as Record<string, ProductStatus>;
    });
  }, [decoratedProducts]);

  const visibleProducts = useMemo(() => {
    const filtered = decoratedProducts.filter((product) => {
      const matchesSearch = deferredSearch
        ? product.searchIndex.includes(deferredSearch)
        : true;

      const matchesCollection =
        collectionFilter === "all"
          ? true
          : collectionFilter === "none"
            ? product.collectionKey === "none"
            : product.collectionKey === collectionFilter;

      const matchesStatus = statusFilter === "all" ? true : product.status === statusFilter;
      const matchesLowStock = lowStockOnly ? product.stockCount <= 12 : true;

      return matchesSearch && matchesCollection && matchesStatus && matchesLowStock;
    });

    return [...filtered].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
        case "stock-desc":
          return right.stockCount - left.stockCount;
        case "stock-asc":
          return left.stockCount - right.stockCount;
        case "name":
          return left.name.localeCompare(right.name);
        default:
          return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
      }
    });
  }, [collectionFilter, deferredSearch, decoratedProducts, lowStockOnly, sortBy, statusFilter]);

  const hasProducts = decoratedProducts.length > 0;
  const noResults = hasProducts && visibleProducts.length === 0;
  const selectedProductSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedProducts = useMemo(
    () => decoratedProducts.filter((product) => selectedProductSet.has(product.id)),
    [decoratedProducts, selectedProductSet]
  );
  const hasSelectedProducts = selectedProducts.length > 0;

  const visibleProductIds = useMemo(() => visibleProducts.map((product) => product.id), [visibleProducts]);
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProductSet.has(id));
  const someVisibleSelected = visibleProductIds.some((id) => selectedProductSet.has(id)) && !allVisibleSelected;
  const selectedCount = selectedIds.length;

  const activeFilterCount = [
    searchQuery.trim().length > 0,
    collectionFilter !== "all",
    statusFilter !== "all",
    lowStockOnly,
    sortBy !== "newest",
  ].filter(Boolean).length;

  const collectionCount = demoMode
    ? DEMO_STATS.collections
    : getCollectionCount(decoratedProducts, collectionOptions);
  const totalProducts = demoMode ? DEMO_STATS.totalProducts : decoratedProducts.length;
  const inStockCount = demoMode
    ? DEMO_STATS.inStock
    : decoratedProducts.filter((product) => product.stockCount > 0).length;
  const lowStockCount = demoMode
    ? DEMO_STATS.lowStock
    : decoratedProducts.filter((product) => product.status === "low-stock").length;

  const stats = [
    {
      label: "Total Products",
      value: numberFormatter.format(totalProducts),
      helper: "Live catalogue items",
      trend: "Product flow",
      icon: Package,
      accentClass: statCardAccent.plum,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      label: "In Stock",
      value: numberFormatter.format(inStockCount),
      helper: "Products ready to sell",
      trend: "Ready to ship",
      icon: Boxes,
      accentClass: statCardAccent.mint,
      iconClass: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Low Stock",
      value: numberFormatter.format(lowStockCount),
      helper: "Needs replenishment",
      trend: "Inventory health",
      icon: AlertTriangle,
      accentClass: statCardAccent.amber,
      iconClass: "bg-amber-100 text-amber-700",
    },
    {
      label: "Collections",
      value: numberFormatter.format(collectionCount),
      helper: "Organised merchandising groups",
      trend: "Merchandising",
      icon: Layers3,
      accentClass: statCardAccent.sky,
      iconClass: "bg-sky-100 text-sky-700",
    },
  ] as const;

  const errorMessage =
    !loading && error
      ? error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unable to load products right now."
      : null;

  const updateProductStatusOverride = useCallback((productIds: string[], status: ProductStatus) => {
    if (!productIds.length) return;
    setStatusOverrides((current) => {
      const next = { ...current };
      productIds.forEach((id) => {
        next[id] = status;
      });
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refresh?.();
    window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
    toast.success("Products refreshed");
  }, [refresh]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setCollectionFilter("all");
    setStatusFilter("all");
    setLowStockOnly(false);
    setSortBy("newest");
    toast.success("Filters cleared");
  }, []);

  const handleCreateProduct = useCallback(() => {
    navigate("/dashboard/products/new");
  }, [navigate]);

  const handleViewProduct = useCallback(
    (product: DecoratedProduct) => {
      navigate(`/dashboard/products/${product.id}/edit`);
    },
    [navigate]
  );

  const handleEditProduct = handleViewProduct;

  const handleManageInventory = useCallback(
    (product: DecoratedProduct) => {
      navigate(`/dashboard/products/${product.id}/edit#inventory`);
    },
    [navigate]
  );

  const handleDuplicateProduct = useCallback(
    async (product: DecoratedProduct) => {
      try {
        const suffix = Math.random().toString(36).slice(2, 6);
        const nextSlug = slugify(`${product.slug}-copy-${suffix}`);
        const payload = {
          name: `${product.name} Copy`,
          slug: nextSlug,
          brand: product.brand ?? "Cevonne",
          productType: product.productType ?? "Lipstick",
          description: product.description ?? undefined,
          finish: product.finish ?? undefined,
          basePrice: Number(product.basePrice ?? 0),
          collectionId: product.collectionId ?? null,
          images: Array.isArray(product.images)
            ? product.images.map((image) => ({ url: image.url, alt: image.alt }))
            : [],
          shades: Array.isArray(product.shades)
            ? product.shades.map((shade) => ({
                name: shade.name,
                hexColor: shade.hexColor,
                sku: shade.sku ?? undefined,
                arAssetUrl: shade.arAssetUrl ?? undefined,
                arPreviewUrl: shade.arPreviewUrl ?? undefined,
                arCode: shade.arCode ?? undefined,
                price: typeof shade.price === "number" ? shade.price : Number(shade.price ?? product.basePrice ?? 0),
                quantity: shade.inventory?.quantity ?? 0,
              }))
            : [],
          tags: product.tags ?? undefined,
          badges: product.badges ?? undefined,
          media: product.media ?? undefined,
          pricing: product.pricing ?? undefined,
          ingredients: product.ingredients ?? undefined,
          size: product.size ?? undefined,
          setContents: product.setContents ?? undefined,
          experience: product.experience ?? undefined,
        };

        const response = await request(`${API_BASE}/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await response.text().catch(() => response.statusText);
          throw new Error(message || "Unable to duplicate product");
        }

        const created = await response.json().catch(() => null);
        toast.success(`${product.name} duplicated`);
        refresh?.();
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));

        if (created?.id) {
          navigate(`/dashboard/products/${created.id}/edit`);
        }
      } catch (duplicateError) {
        console.error("Duplicate product failed", duplicateError);
        toast.error("Unable to duplicate product");
      }
    },
    [navigate, refresh, request]
  );

  const handleDeleteProduct = useCallback(
    async (product: DecoratedProduct) => {
      const confirmed = window.confirm(`Delete ${product.name}? This cannot be undone.`);
      if (!confirmed) return;

      try {
        const response = await request(`${API_BASE}/products/${product.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const message = await response.text().catch(() => response.statusText);
          throw new Error(message || "Unable to delete product");
        }

        toast.success(`${product.name} deleted`);
        setSelectedIds((current) => current.filter((id) => id !== product.id));
        setStatusOverrides((current) => {
          const next = { ...current };
          delete next[product.id];
          return next;
        });
        refresh?.();
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      } catch (deleteError) {
        console.error("Delete product failed", deleteError);
        toast.error("Unable to delete product");
      }
    },
    [refresh, request]
  );

  const handleBulkDelete = useCallback(async () => {
    if (!selectedCount || bulkDeleting) return;

    const confirmed = window.confirm(
      `Delete ${selectedCount} selected product${selectedCount === 1 ? "" : "s"}? This cannot be undone.`
    );

    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map(async (productId) => {
          const response = await request(`${API_BASE}/products/${productId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const message = await response.text().catch(() => response.statusText);
            throw new Error(message || "Unable to delete product");
          }

          return productId;
        })
      );

      const failedIds = results
        .map((result, index) => (result.status === "rejected" ? selectedIds[index] : null))
        .filter((value): value is string => Boolean(value));

      const deletedCount = selectedCount - failedIds.length;

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} product${deletedCount === 1 ? "" : "s"}`);
      }

      if (failedIds.length) {
        setSelectedIds(failedIds);
        toast.error(`${failedIds.length} product${failedIds.length === 1 ? "" : "s"} could not be deleted`);
      } else {
        setSelectedIds([]);
      }

      if (deletedCount > 0) {
        refresh?.();
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      }
    } catch (bulkDeleteError) {
      console.error("Bulk delete failed", bulkDeleteError);
      toast.error("Unable to delete selected products");
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleting, refresh, request, selectedCount, selectedIds]);

  const handleExport = useCallback(
    (scope: "visible" | "selected") => {
      const productsToExport = scope === "selected" ? selectedProducts : visibleProducts;
      if (!productsToExport.length) {
        toast.error("No products available to export.");
        return;
      }

      const csv = buildProductCsv(productsToExport);
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
    },
    [selectedProducts, visibleProducts]
  );

  const handleOpenImportTools = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

  const handleBulkCollectionUpdate = useCallback(
    async (collectionId: string | null) => {
      if (!selectedCount || bulkCollectionUpdating) return;

      setBulkCollectionUpdating(true);
      try {
        const results = await Promise.allSettled(
          selectedProducts.map(async (product) => {
            const response = await request(`${API_BASE}/products/${product.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ collectionId }),
            });

            if (!response.ok) {
              const message = await response.text().catch(() => response.statusText);
              throw new Error(message || "Unable to update collection");
            }

            return product.id;
          })
        );

        const failedIds = results
          .map((result, index) => (result.status === "rejected" ? selectedProducts[index].id : null))
          .filter((value): value is string => Boolean(value));

        if (failedIds.length) {
          toast.error(`${failedIds.length} product${failedIds.length === 1 ? "" : "s"} could not be updated`);
        } else {
          toast.success("Collection updated");
        }

        refresh?.();
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
      } catch (collectionError) {
        console.error("Bulk collection update failed", collectionError);
        toast.error("Unable to update collection");
      } finally {
        setBulkCollectionUpdating(false);
      }
    },
    [bulkCollectionUpdating, refresh, request, selectedCount, selectedProducts]
  );

  const handleMarkDraft = useCallback(() => {
    if (!selectedCount) return;
    updateProductStatusOverride(selectedIds, "draft");
    toast.success(`${selectedCount} product${selectedCount === 1 ? "" : "s"} marked as draft`);
  }, [selectedCount, selectedIds, updateProductStatusOverride]);

  const actions: ProductActionHandlers = useMemo(
    () => ({
      onDelete: handleDeleteProduct,
      onDuplicate: handleDuplicateProduct,
      onEdit: handleEditProduct,
      onManageInventory: handleManageInventory,
      onView: handleViewProduct,
    }),
    [handleDeleteProduct, handleDuplicateProduct, handleEditProduct, handleManageInventory, handleViewProduct]
  );

  const handleToggleSelect = useCallback((productId: string, checked: boolean | "indeterminate") => {
    const shouldSelect = checked === true;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (shouldSelect) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return Array.from(next);
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (checked: boolean | "indeterminate") => {
      const shouldSelect = checked === true;
      setSelectedIds((current) => {
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
    },
    [visibleProductIds]
  );

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1] text-foreground">
        <div className="pointer-events-none absolute -left-24 top-8 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-secondary/35 blur-3xl" />

        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <main className="flex-1 px-4 pb-8 pt-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
                <header className="sticky top-0 z-10 rounded-[28px] border border-border/60 bg-background/90 px-4 py-4 shadow-sm backdrop-blur-xl lg:px-6 lg:py-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 md:hidden">
                      <SidebarTrigger className="size-9 rounded-full border border-border/60 bg-white shadow-sm" />
                      <span className="text-sm font-medium text-muted-foreground">Menu</span>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-2xl space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                          Cevonne Admin
                        </p>
                        <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">
                          Products
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Manage your lipstick catalog, collections, and inventory.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-3xl lg:flex-1 lg:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                          onClick={() => handleExport("visible")}
                        >
                          Export
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                          onClick={handleOpenImportTools}
                        >
                          Import
                        </Button>

                        <Button
                          type="button"
                          className="h-11 rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/90"
                          onClick={handleCreateProduct}
                        >
                          Add product
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => <ProductStatSkeleton key={index} />)
                    : stats.map((stat) => (
                        <ProductStatCard key={stat.label} {...stat} />
                      ))}
                </div>

                <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm gap-0 py-0">
                  <CardHeader className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">
                          All products
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                        >
                          {numberFormatter.format(visibleProducts.length)} shown
                        </Badge>
                      </div>
                      <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                        Search, filter, and open any product record in a few clicks.
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {numberFormatter.format(activeFilterCount)} active filters
                      </Badge>
                    </div>
                  </CardHeader>

                  <Separator className="bg-border/70" />

                  <CardContent className="p-0">
                    <div className="px-6 py-4">
                      <div className="flex h-11 items-center">
                        {hasSelectedProducts ? (
                          <BulkActionBar
                            className="h-11"
                            collectionOptions={collectionOptions}
                            deleting={bulkDeleting}
                            exporting={bulkExporting}
                            onAddToCollection={handleBulkCollectionUpdate}
                            onClearSelection={() => setSelectedIds([])}
                            onDeleteSelected={handleBulkDelete}
                            onExportSelected={() => {
                              setBulkExporting(true);
                              try {
                                handleExport("selected");
                              } finally {
                                setBulkExporting(false);
                              }
                            }}
                            onMarkDraft={handleMarkDraft}
                            selectedCount={selectedCount}
                          />
                        ) : (
                          <ProductsToolbar
                            className="h-11"
                            activeFilterCount={activeFilterCount}
                            collectionFilter={collectionFilter}
                            collectionOptions={collectionOptions}
                            lowStockOnly={lowStockOnly}
                            onCollectionFilterChange={setCollectionFilter}
                            onLowStockToggle={() => setLowStockOnly((value) => !value)}
                            onRefresh={handleRefresh}
                            onReset={handleResetFilters}
                            onSearchChange={setSearchQuery}
                            onSortChange={setSortBy}
                            onStatusFilterChange={setStatusFilter}
                            searchQuery={searchQuery}
                            sortBy={sortBy}
                            statusFilter={statusFilter}
                          />
                        )}
                      </div>
                    </div>

                    <Separator className="bg-border/70" />

                    <div className="px-6 pb-6 pt-4">
                      <ProductsTable
                        actions={actions}
                        hasProducts={hasProducts}
                        loading={loading}
                        noResults={noResults}
                        onClearFilters={handleResetFilters}
                        onCreateProduct={handleCreateProduct}
                        onRefresh={handleRefresh}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        products={visibleProducts}
                        selectedIds={selectedIds}
                        someVisibleSelected={someVisibleSelected}
                        allVisibleSelected={allVisibleSelected}
                        errorMessage={errorMessage}
                      />
                    </div>
                  </CardContent>
                </Card>
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
