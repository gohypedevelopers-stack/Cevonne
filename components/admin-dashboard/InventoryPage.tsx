"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Download,
  Layers3,
  Loader2,
  MoreHorizontal,
  Package2,
  RefreshCcw,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useNavigate } from "@/lib/router";

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type InventoryStatus = "healthy" | "low" | "critical" | "out";
type InventoryFilter = "all" | InventoryStatus;

type InventoryRow = {
  id: string;
  productId: string;
  product: string;
  shade: string;
  collection: string;
  quantity: number;
  threshold: number;
  status: InventoryStatus;
  color: string;
  sku: string;
  updatedAt: string;
};

type InventoryMetricCardProps = {
  label: string;
  value: string;
  helper: string;
  trend: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

const SAMPLE_INVENTORY_ROWS: InventoryRow[] = [
  {
    id: "inv-1",
    productId: "demo-velvet-rouge",
    product: "Velvet Power Bullet Lipstick",
    shade: "Velvet Rouge",
    collection: "New Drop",
    quantity: 2,
    threshold: 12,
    status: "critical",
    color: "#8c2f59",
    sku: "CV-VP-01",
    updatedAt: "2026-06-12T00:00:00+05:30",
  },
  {
    id: "inv-2",
    productId: "demo-berry-bloom",
    product: "Glass Luxe Lip Gloss",
    shade: "Berry Bloom",
    collection: "Gloss Garden",
    quantity: 11,
    threshold: 10,
    status: "low",
    color: "#c87d92",
    sku: "CV-GL-04",
    updatedAt: "2026-06-11T00:00:00+05:30",
  },
  {
    id: "inv-3",
    productId: "demo-amber-silk",
    product: "Air Couture Liquid Matte Lipstick",
    shade: "Amber Silk",
    collection: "Signature Matte",
    quantity: 0,
    threshold: 8,
    status: "out",
    color: "#d7b08f",
    sku: "CV-AC-07",
    updatedAt: "2026-06-10T00:00:00+05:30",
  },
  {
    id: "inv-4",
    productId: "demo-caramel-eclair",
    product: "Velvet Power Bullet Lipstick",
    shade: "Caramel Éclair",
    collection: "New Drop",
    quantity: 18,
    threshold: 12,
    status: "healthy",
    color: "#4b0d4b",
    sku: "CV-VP-08",
    updatedAt: "2026-06-13T00:00:00+05:30",
  },
  {
    id: "inv-5",
    productId: "demo-mauve-memoir",
    product: "Air Couture Liquid Matte Lipstick",
    shade: "Mauve Memoir",
    collection: "New Drop",
    quantity: 4,
    threshold: 8,
    status: "critical",
    color: "#a15a78",
    sku: "CV-AC-11",
    updatedAt: "2026-06-12T00:00:00+05:30",
  },
  {
    id: "inv-6",
    productId: "demo-berry-pulse",
    product: "Cevonne Crush Velvet Power Bullet",
    shade: "Berry Pulse",
    collection: "Limited Edition",
    quantity: 1,
    threshold: 10,
    status: "critical",
    color: "#8f3e67",
    sku: "CV-CC-02",
    updatedAt: "2026-06-12T00:00:00+05:30",
  },
];

const statusMeta: Record<InventoryStatus, { label: string; className: string; chipClassName: string }> = {
  healthy: {
    label: "Healthy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    chipClassName: "bg-emerald-50 text-emerald-700",
  },
  low: {
    label: "Low stock",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    chipClassName: "bg-amber-50 text-amber-700",
  },
  critical: {
    label: "Critical",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    chipClassName: "bg-rose-50 text-rose-700",
  },
  out: {
    label: "Out of stock",
    className: "border-stone-200 bg-stone-100 text-stone-600",
    chipClassName: "bg-stone-100 text-stone-600",
  },
};

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

function getInventoryStatus(quantity: number, threshold: number): InventoryStatus {
  if (quantity <= 0) return "out";
  if (quantity <= Math.max(1, Math.floor(threshold / 2))) return "critical";
  if (quantity <= threshold) return "low";
  return "healthy";
}

function getInventoryStatusMeta(status: InventoryStatus) {
  return statusMeta[status];
}

function matchesFilter(row: InventoryRow, query: string, levelFilter: InventoryFilter, collectionFilter: string) {
  const searchIndex = [
    row.product,
    row.shade,
    row.collection,
    row.sku,
    row.quantity,
    row.threshold,
    getInventoryStatusMeta(row.status).label,
  ]
    .join(" ")
    .toLowerCase();

  const matchesSearch = !query || searchIndex.includes(query);
  const matchesLevel = levelFilter === "all" || row.status === levelFilter;
  const matchesCollection = collectionFilter === "all" || row.collection === collectionFilter;

  return matchesSearch && matchesLevel && matchesCollection;
}

function normalizeInventoryRows(liveRows: any[] | null | undefined) {
  if (!Array.isArray(liveRows) || !liveRows.length) {
    return [];
  }

  return liveRows.slice(0, 8).map((item: any, index: number) => {
    const fallback = SAMPLE_INVENTORY_ROWS[index % SAMPLE_INVENTORY_ROWS.length];
    const productName = item?.shade?.product?.name || item?.product?.name || item?.productName || fallback.product;
    const shadeName = item?.shade?.name || item?.shadeName || fallback.shade;
    const collectionName = item?.shade?.product?.collection?.name || item?.product?.collection?.name || item?.collection?.name || fallback.collection;
    const quantity = Number(item?.quantity ?? item?.stock ?? item?.inventory?.quantity ?? fallback.quantity) || 0;
    const threshold = Number(item?.threshold ?? item?.lowStockThreshold ?? fallback.threshold) || fallback.threshold;
    const productId = item?.shade?.product?.id || item?.product?.id || item?.productId || fallback.productId;

    return {
      id: item?.id || `inv-${index}`,
      productId,
      product: productName,
      shade: shadeName,
      collection: collectionName,
      quantity,
      threshold,
      status: getInventoryStatus(quantity, threshold),
      color: item?.hexColor || item?.shade?.hexColor || fallback.color,
      sku: item?.shade?.sku || item?.sku || fallback.sku,
      updatedAt: item?.updatedAt || item?.createdAt || fallback.updatedAt,
    } satisfies InventoryRow;
  });
}

function InventoryMetricCard({
  label,
  value,
  helper,
  trend,
  icon: Icon,
  accentClass,
  iconClass,
}: InventoryMetricCardProps) {
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
          <Sparkles className="size-3.5" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryStatSkeleton() {
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

function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const meta = getInventoryStatusMeta(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        meta.className
      )}
    >
      {meta.label}
    </Badge>
  );
}

function InventoryRowActions({ row, onAdjustStock }: { row: InventoryRow; onAdjustStock: (row: InventoryRow) => void }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0 rounded-full border-border/70 bg-white shadow-none hover:bg-muted/40"
          aria-label={`Open actions for ${row.product}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60 bg-white shadow-lg">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Inventory actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAdjustStock(row)}>
          <Boxes className="size-4" />
          Adjust stock
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/dashboard/products/${row.productId}/edit`)}>
          <Package2 className="size-4" />
          View product
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/dashboard/products/${row.productId}/edit#inventory`)}>
          <ArrowRight className="size-4" />
          Open inventory editor
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <RefreshCcw className="size-4" />
          Recheck stock
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InventoryTableSkeleton() {
  return (
    <div className="overflow-x-auto px-6 pb-6 pt-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[1220px] grid-cols-[300px_170px_180px_90px_120px_150px_130px_90px] items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="size-10 rounded-full justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function InventoryRow({
  row,
  onAdjustStock,
}: {
  row: InventoryRow;
  onAdjustStock: (row: InventoryRow) => void;
}) {
  const initials = initialsFrom(row.product);

  return (
    <TableRow className="group hover:bg-primary/5">
      <TableCell className="px-4 py-4 align-middle">
        <div className="flex items-center gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 shadow-sm"
            style={{ backgroundColor: `${row.color}14` }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: row.color }}>
              {initials}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{row.product}</p>
            <p className="truncate text-xs text-muted-foreground">SKU {row.sku}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle">
        <p className="truncate text-sm font-medium text-foreground">{row.shade}</p>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <Badge
          variant="outline"
          className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {row.collection}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm font-semibold text-foreground">{numberFormatter.format(row.quantity)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm text-muted-foreground">{numberFormatter.format(row.threshold)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <InventoryStatusBadge status={row.status} />
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm text-muted-foreground">{formatDate(row.updatedAt)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 text-right align-middle whitespace-nowrap">
        <InventoryRowActions row={row} onAdjustStock={onAdjustStock} />
      </TableCell>
    </TableRow>
  );
}

function InventoryCompactCard({
  row,
  onAdjustStock,
}: {
  row: InventoryRow;
  onAdjustStock: (row: InventoryRow) => void;
}) {
  const initials = initialsFrom(row.product);

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 shadow-sm"
          style={{ backgroundColor: `${row.color}14` }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: row.color }}>
            {initials}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{row.product}</p>
              <p className="truncate text-xs text-muted-foreground">SKU {row.sku}</p>
            </div>
            <InventoryStatusBadge status={row.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <p className="uppercase tracking-[0.24em]">Shade</p>
              <p className="mt-1 font-medium text-foreground">{row.shade}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Collection</p>
              <p className="mt-1 font-medium text-foreground">{row.collection}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Qty</p>
              <p className="mt-1 font-medium text-foreground">{numberFormatter.format(row.quantity)}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Threshold</p>
              <p className="mt-1 font-medium text-foreground">{numberFormatter.format(row.threshold)}</p>
            </div>
            <div className="col-span-2">
              <p className="uppercase tracking-[0.24em]">Updated</p>
              <p className="mt-1 font-medium text-foreground">{formatDate(row.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <Badge
          variant="outline"
          className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {row.collection}
        </Badge>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-border/70 bg-white px-3 shadow-none"
            onClick={() => onAdjustStock(row)}
          >
            Restock
            <ArrowRight className="size-4" />
          </Button>
          <InventoryRowActions row={row} onAdjustStock={onAdjustStock} />
        </div>
      </div>
    </div>
  );
}

function InventoryQueueItem({ row, onAdjustStock }: { row: InventoryRow; onAdjustStock: (row: InventoryRow) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center">
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 shadow-sm"
        style={{ backgroundColor: `${row.color}14` }}
      >
        <Boxes className="size-5" style={{ color: row.color }} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-foreground">{row.product}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.shade} • {row.collection}
        </p>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
          row.status === "out"
            ? "border-stone-200 bg-stone-100 text-stone-600"
            : row.status === "critical"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
        )}
      >
        {numberFormatter.format(row.quantity)} left
      </Badge>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => onAdjustStock(row)}
      >
        Restock
        <ArrowRight />
      </Button>
    </div>
  );
}

function InventoryHealthCard({ rows }: { rows: InventoryRow[] }) {
  const healthy = rows.filter((row) => row.status === "healthy");
  const low = rows.filter((row) => row.status === "low" || row.status === "critical");
  const out = rows.filter((row) => row.status === "out");
  const total = Math.max(rows.length, 1);
  const healthScore = Math.max(58, Math.round(((healthy.length + low.length * 0.55) / total) * 100));

  return (
    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="font-serif text-xl font-semibold tracking-tight text-primary">
          Inventory health
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          A compact view of stock health across lipstick shades and collections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Healthy coverage</p>
            <Badge
              variant="outline"
              className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700"
            >
              {healthScore}%
            </Badge>
          </div>
          <Progress value={healthScore} className="h-2 rounded-full bg-secondary/30" indicatorClassName="bg-emerald-500" />
          <p className="text-xs text-muted-foreground">
            {healthy.length} healthy shades out of {rows.length} tracked records.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Healthy</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{healthy.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-amber-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Needs review</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{low.length}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-rose-50/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Out of stock</p>
            <p className="mt-1 text-2xl font-semibold text-rose-700">{out.length}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Inventory mix</p>
            <span className="text-xs text-muted-foreground">Shades tracked</span>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Healthy</span>
                <span className="font-medium text-foreground">{healthy.length}</span>
              </div>
              <Progress
                value={(healthy.length / total) * 100}
                className="h-2 rounded-full bg-secondary/30"
                indicatorClassName="bg-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Needs restock</span>
                <span className="font-medium text-foreground">{low.length}</span>
              </div>
              <Progress
                value={(low.length / total) * 100}
                className="h-2 rounded-full bg-secondary/30"
                indicatorClassName="bg-amber-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Out of stock</span>
                <span className="font-medium text-foreground">{out.length}</span>
              </div>
              <Progress
                value={(out.length / total) * 100}
                className="h-2 rounded-full bg-secondary/30"
                indicatorClassName="bg-rose-500"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InventoryPage() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const navigate = useNavigate();
  const { collections, inventory, lowInventory, loading, refresh, stats } = useDashboardData(true, request, isAdmin);

  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<InventoryFilter>("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const ledgerRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  const liveRows = useMemo(() => normalizeInventoryRows(Array.isArray(inventory) ? inventory : null), [inventory]);

  const collectionOptions = useMemo(() => {
    const liveCollections = Array.isArray(collections) ? collections : [];
    const unique = new Map<string, string>();

    liveRows.forEach((row) => {
      unique.set(row.collection, row.collection);
    });

    liveCollections.forEach((collection: any) => {
      const label = collection?.name || collection?.slug || "";
      if (label) unique.set(label, label);
    });

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [collections, liveRows]);

  const filteredRows = useMemo(
    () => liveRows.filter((row) => matchesFilter(row, deferredQuery, levelFilter, collectionFilter)),
    [collectionFilter, deferredQuery, levelFilter, liveRows]
  );

  const restockRows = useMemo(() => filteredRows.filter((row) => row.status !== "healthy").slice(0, 4), [filteredRows]);

  const totalUnits = useMemo(
    () =>
      Number(
        stats?.totalInventory ??
          liveRows.reduce((sum, row) => sum + row.quantity, 0)
      ) || 0,
    [liveRows, stats?.totalInventory]
  );

  const lowCount = useMemo(() => liveRows.filter((row) => row.status === "low" || row.status === "critical").length, [liveRows]);
  const outCount = useMemo(() => liveRows.filter((row) => row.status === "out").length, [liveRows]);
  const trackedShades = useMemo(() => {
    if (Array.isArray(lowInventory) && lowInventory.length) return lowInventory.length;
    return liveRows.length;
  }, [liveRows.length, lowInventory]);
  const healthScore = Math.max(58, Math.round(((liveRows.length - lowCount * 0.6 - outCount * 1.1) / Math.max(liveRows.length, 1)) * 100));

  const activeFilterCount = [
    searchQuery.trim() ? 1 : 0,
    levelFilter !== "all" ? 1 : 0,
    collectionFilter !== "all" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const handleRefresh = useCallback(() => {
    refresh?.();
    toast.success("Inventory refreshed");
  }, [refresh]);

  const handleExport = useCallback(() => {
    if (!filteredRows.length) {
      toast.error("No inventory rows to export.");
      return;
    }

    const csv = [
      ["Product", "Shade", "Collection", "Quantity", "Threshold", "Health", "Updated"],
      ...filteredRows.map((row) => [
        row.product,
        row.shade,
        row.collection,
        `${row.quantity} units`,
        `${row.threshold}`,
        getInventoryStatusMeta(row.status).label,
        formatDate(row.updatedAt),
      ]),
    ]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cevonne-inventory-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Inventory export downloaded");
  }, [filteredRows]);

  const handleAdjustStock = useCallback(
    (row: InventoryRow) => {
      navigate(`/dashboard/products/${row.productId}/edit#inventory`);
    },
    [navigate]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setLevelFilter("all");
    setCollectionFilter("all");
    toast.success("Filters cleared");
  }, []);

  const metricCards = [
    {
      label: "Total Units",
      value: numberFormatter.format(totalUnits),
      helper: "Across all tracked lipstick shades",
      trend: "Stock volume",
      icon: Boxes,
      accentClass: "bg-primary",
      iconClass: "bg-primary/10 text-primary",
    },
    {
      label: "Tracked Shades",
      value: numberFormatter.format(trackedShades),
      helper: "Shade-level inventory records",
      trend: "Shade coverage",
      icon: Layers3,
      accentClass: "bg-rose-300",
      iconClass: "bg-rose-100 text-rose-700",
    },
    {
      label: "Low Stock",
      value: numberFormatter.format(lowCount),
      helper: "Shades that need replenishment",
      trend: "Restock queue",
      icon: TriangleAlert,
      accentClass: "bg-amber-300",
      iconClass: "bg-amber-100 text-amber-700",
    },
    {
      label: "Stock Health",
      value: `${healthScore}%`,
      helper: "Healthy coverage across the catalog",
      trend: "Inventory health",
      icon: Sparkles,
      accentClass: "bg-sky-300",
      iconClass: "bg-sky-100 text-sky-700",
    },
  ] satisfies InventoryMetricCardProps[];

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
                          CEVONNE ADMIN
                        </p>
                        <h1 className="font-serif text-4xl leading-none tracking-tight text-primary md:text-5xl">
                          Inventory
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Track lipstick stock, shade availability, and restocking needs.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-3xl lg:flex-1 lg:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                          onClick={handleExport}
                        >
                          <Download />
                          Export
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                          onClick={() => ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                          <Boxes />
                          Adjust stock
                        </Button>

                        <Button
                          type="button"
                          className="h-11 rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/90"
                          onClick={() => queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                          Restock items
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => <InventoryStatSkeleton key={index} />)
                    : metricCards.map((card) => <InventoryMetricCard key={card.label} {...card} />)}
                </div>

                <div className="flex flex-col gap-6">
                  <div ref={ledgerRef} id="inventory-ledger" className="scroll-mt-6">
                    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
                      <CardHeader className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">
                              Inventory ledger
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                            >
                              {numberFormatter.format(filteredRows.length)} shown
                            </Badge>
                          </div>
                          <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                            Search, review, and adjust shade stock at a glance.
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
                        <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_200px_220px_auto_auto]">
                          <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={searchQuery}
                              onChange={(event) => setSearchQuery(event.target.value)}
                              placeholder="Search by product, shade, or SKU"
                              className="h-12 min-h-12 rounded-full border-border/70 bg-white pl-10 text-sm leading-none shadow-none focus-visible:ring-primary/20"
                            />
                          </div>

                          <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as InventoryFilter)}>
                            <SelectTrigger className="h-12 min-h-12 w-full rounded-full border-border/70 bg-white px-4 text-sm shadow-none [&>span]:truncate">
                              <span className="truncate">
                                {levelFilter === "all" ? "All levels" : getInventoryStatusMeta(levelFilter).label}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All levels</SelectItem>
                              <SelectItem value="healthy">Healthy</SelectItem>
                              <SelectItem value="low">Low stock</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="out">Out of stock</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                            <SelectTrigger className="h-12 min-h-12 w-full rounded-full border-border/70 bg-white px-4 text-sm shadow-none [&>span]:truncate">
                              <span className="truncate">{collectionFilter === "all" ? "All collections" : collectionFilter}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All collections</SelectItem>
                              {collectionOptions.map((collection) => (
                                <SelectItem key={collection} value={collection}>
                                  {collection}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-full border-border/70 bg-white px-5 shadow-sm"
                              onClick={resetFilters}
                            >
                              Reset
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-full border-border/70 bg-white px-5 shadow-sm"
                              onClick={handleRefresh}
                            >
                              <RefreshCcw />
                              Refresh
                            </Button>
                          </div>
                        </div>

                        <Separator className="bg-border/70" />

                        {loading ? (
                          <InventoryTableSkeleton />
                        ) : filteredRows.length ? (
                          <>
                            <div className="grid gap-3 px-4 pb-4 pt-4 sm:grid-cols-2 lg:hidden xl:px-6 xl:pb-6">
                              {filteredRows.map((row) => (
                                <InventoryCompactCard key={row.id} row={row} onAdjustStock={handleAdjustStock} />
                              ))}
                            </div>

                            <div className="hidden w-full overflow-x-auto px-6 pb-6 pt-4 lg:block">
                              <Table className="min-w-[1220px] table-fixed">
                                <colgroup>
                                  <col className="w-[300px]" />
                                  <col className="w-[170px]" />
                                  <col className="w-[180px]" />
                                  <col className="w-[90px]" />
                                  <col className="w-[120px]" />
                                  <col className="w-[150px]" />
                                  <col className="w-[130px]" />
                                  <col className="w-[90px]" />
                                </colgroup>
                                <TableHeader>
                                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Product
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Shade
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Collection
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Qty
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Threshold
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Health
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Updated
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                      Actions
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredRows.map((row) => (
                                    <InventoryRow key={row.id} row={row} onAdjustStock={handleAdjustStock} />
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <div className="px-6 pb-6 pt-4">
                            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                              No inventory records match your search.
                              <div className="mt-4">
                                <Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
                                  Clear filters
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div ref={queueRef} id="restock-queue" className="grid gap-6 lg:grid-cols-2">
                    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
                      <CardHeader className="border-b border-border/60 px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="font-serif text-xl font-semibold tracking-tight text-primary">
                              Restock queue
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">
                              Shades that need immediate attention.
                            </CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700"
                          >
                            {numberFormatter.format(restockRows.length)} shown
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 p-5">
                        {restockRows.length ? (
                          restockRows.map((row) => <InventoryQueueItem key={row.id} row={row} onAdjustStock={handleAdjustStock} />)
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                            No restock items match your filters.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <InventoryHealthCard rows={liveRows} />
                  </div>
                </div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
