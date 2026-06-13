"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { formatCurrency } from "@/components/admin-dashboard/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api";
import { normalizeOrderStatus, type Order, type OrderStatus } from "@/types/order";

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type OrderSummary = {
  total: number;
  awaitingPayment: number;
  inProgress: number;
  delivered: number;
  totalCollected: number;
};

type OrdersApiResponse = {
  items?: Order[] | null;
  summary?: Partial<OrderSummary> | null;
};

type PaymentKey = "all" | "razorpay" | "cod" | "card" | "upi";
type DateFilter = "all" | "7d" | "30d" | "90d";
type SortKey = "newest" | "oldest" | "amount-desc" | "amount-asc";
type StatusFilter = "all" | OrderStatus;

type DecoratedOrder = Order & {
  normalizedStatus: OrderStatus;
  paymentKey: PaymentKey;
  paymentLabel: string;
  placedAt: number;
  itemCount: number;
  searchIndex: string;
  locationLabel: string;
  orderBlock: string;
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  trend: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

type FilterFieldProps = {
  label: string;
  children: React.ReactNode;
};

type OrderFiltersProps = {
  activeFilterCount: number;
  dateFilter: DateFilter;
  onClear: () => void;
  onDateFilterChange: (value: DateFilter) => void;
  onPaymentFilterChange: (value: PaymentKey) => void;
  onSortChange: (value: SortKey) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  paymentFilter: PaymentKey;
  sortBy: SortKey;
  statusFilter: StatusFilter;
};

type OrderRowAction = {
  label: string;
  kind: "update" | "view";
  nextStatus?: OrderStatus;
};

const SAMPLE_ORDERS: Order[] = [
  {
    id: "sample-order-1",
    number: "ORD-MOYA18P7",
    status: "PENDING",
    paymentMethod: "razorpay",
    totals: { subtotal: 1448, shippingFee: 0, total: 1448 },
    shipping: {
      fullName: "Aniket Thakur",
      email: "aniketthakur@gmail.com",
      address: "Connaught Place",
      city: "New Delhi",
      postalCode: "110001",
    },
    items: [
      {
        id: "item-1",
        name: "Velvet Power Bullet Lipstick - Velvet Rouge",
        price: 1448,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-12T09:15:00+05:30",
    updatedAt: "2026-06-12T09:15:00+05:30",
  },
  {
    id: "sample-order-2",
    number: "ORD-MOY975HH",
    status: "PENDING",
    paymentMethod: "razorpay",
    totals: { subtotal: 1448, shippingFee: 0, total: 1448 },
    shipping: {
      fullName: "Aniket Thakur",
      email: "aniketthakur@gmail.com",
      address: "Connaught Place",
      city: "New Delhi",
      postalCode: "110001",
    },
    items: [
      {
        id: "item-2",
        name: "Velvet Power Bullet Lipstick - Rosewood Muse",
        price: 1448,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-12T08:05:00+05:30",
    updatedAt: "2026-06-12T08:05:00+05:30",
  },
  {
    id: "sample-order-3",
    number: "ORD-MJ14UHT4",
    status: "PENDING",
    paymentMethod: "cod",
    totals: { subtotal: 149, shippingFee: 0, total: 149 },
    shipping: {
      fullName: "Aniket",
      email: "aniket331@gmail.com",
      address: "Karol Bagh",
      city: "New Delhi",
      postalCode: "110005",
    },
    items: [
      {
        id: "item-3",
        name: "Glass Luxe Lip Gloss - Bare Silk",
        price: 149,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-11T20:12:00+05:30",
    updatedAt: "2026-06-11T20:12:00+05:30",
  },
  {
    id: "sample-order-4",
    number: "ORD-MJ14TWOB",
    status: "PROCESSING",
    paymentMethod: "card",
    totals: { subtotal: 149, shippingFee: 0, total: 149 },
    shipping: {
      fullName: "Aniket",
      email: "aniket331@gmail.com",
      address: "Sector 15",
      city: "New Delhi",
      postalCode: "110085",
    },
    items: [
      {
        id: "item-4",
        name: "Air Couture Liquid Matte Lipstick - Amber Silk",
        price: 149,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-10T11:34:00+05:30",
    updatedAt: "2026-06-10T11:34:00+05:30",
  },
  {
    id: "sample-order-5",
    number: "ORD-MJ14O3G3",
    status: "PROCESSING",
    paymentMethod: "card",
    totals: { subtotal: 149, shippingFee: 0, total: 149 },
    shipping: {
      fullName: "Aniket",
      email: "aniket331@gmail.com",
      address: "Rajouri Garden",
      city: "New Delhi",
      postalCode: "110027",
    },
    items: [
      {
        id: "item-5",
        name: "Air Couture Liquid Matte Lipstick - Berry Bloom",
        price: 149,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-09T15:47:00+05:30",
    updatedAt: "2026-06-09T15:47:00+05:30",
  },
  {
    id: "sample-order-6",
    number: "ORD-MJ11UBLQ",
    status: "PAID",
    paymentMethod: "upi",
    totals: { subtotal: 149, shippingFee: 0, total: 149 },
    shipping: {
      fullName: "Nandini Sharma",
      email: "nandini@ateliermail.com",
      address: "Indiranagar",
      city: "Bengaluru",
      postalCode: "560038",
    },
    items: [
      {
        id: "item-6",
        name: "Cevonne Crush Velvet Power Bullet - Rose Mist",
        price: 149,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-08T13:18:00+05:30",
    updatedAt: "2026-06-08T13:18:00+05:30",
  },
  {
    id: "sample-order-7",
    number: "ORD-MJ11Q8RT",
    status: "SHIPPED",
    paymentMethod: "card",
    totals: { subtotal: 149, shippingFee: 0, total: 149 },
    shipping: {
      fullName: "Sakshi Verma",
      email: "sakshi@brandmail.com",
      address: "C-Scheme",
      city: "Jaipur",
      postalCode: "302001",
    },
    items: [
      {
        id: "item-7",
        name: "Glass Luxe Lip Gloss - Nude Silk",
        price: 149,
        quantity: 1,
      },
    ],
    createdAt: "2026-06-07T17:04:00+05:30",
    updatedAt: "2026-06-07T17:04:00+05:30",
  },
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

const statusToneClasses: Record<OrderStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PAID: "border-rose-200 bg-rose-50 text-rose-700",
  PROCESSING: "border-violet-200 bg-violet-50 text-violet-700",
  SHIPPED: "border-sky-200 bg-sky-50 text-sky-700",
  OUT_FOR_DELIVERY: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statusFillClasses: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PAID: "bg-rose-50 text-rose-700",
  PROCESSING: "bg-violet-50 text-violet-700",
  SHIPPED: "bg-sky-50 text-sky-700",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
};

const paymentLabels: Record<Exclude<PaymentKey, "all">, string> = {
  razorpay: "Razorpay",
  cod: "Cash on delivery",
  card: "Card",
  upi: "UPI",
};

const paymentToneClasses: Record<Exclude<PaymentKey, "all">, string> = {
  razorpay: "border-primary/20 bg-primary/5 text-primary",
  cod: "border-amber-200 bg-amber-50 text-amber-700",
  card: "border-rose-200 bg-rose-50 text-rose-700",
  upi: "border-sky-200 bg-sky-50 text-sky-700",
};

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "Awaiting payment", value: "PENDING" },
  { label: "Paid", value: "PAID" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
];

const paymentFilterOptions: Array<{ label: string; value: PaymentKey }> = [
  { label: "All methods", value: "all" },
  { label: "Razorpay", value: "razorpay" },
  { label: "Cash on delivery", value: "cod" },
  { label: "Card", value: "card" },
  { label: "UPI", value: "upi" },
];

const dateFilterOptions: Array<{ label: string; value: DateFilter }> = [
  { label: "All dates", value: "all" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Amount high to low", value: "amount-desc" },
  { label: "Amount low to high", value: "amount-asc" },
];

const orderActionButtonClassName =
  "h-10 w-36 shrink-0 justify-center whitespace-nowrap rounded-full border-primary/20 bg-white text-primary";
const orderViewButtonClassName =
  "h-10 w-36 shrink-0 justify-center whitespace-nowrap rounded-full border-border/70 bg-white";
const orderActionButtonStyle = { width: 144 };

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

function normalizePaymentMethod(value?: string | null): PaymentKey {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) return "card";
  if (normalized.includes("razorpay")) return "razorpay";
  if (normalized.includes("cash") || normalized === "cod") return "cod";
  if (normalized.includes("upi")) return "upi";
  if (normalized.includes("card")) return "card";
  return "card";
}

function getPaymentLabel(value?: string | null) {
  const key = normalizePaymentMethod(value);
  return paymentLabels[key] ?? humanize(key);
}

function getStatusMeta(status: string) {
  const normalized = normalizeOrderStatus(status);

  return {
    status: normalized,
    label: statusLabels[normalized] ?? humanize(normalized),
    tone: statusToneClasses[normalized] ?? "border-border/70 bg-muted/20 text-muted-foreground",
    fill: statusFillClasses[normalized] ?? "bg-muted/30 text-muted-foreground",
  };
}

function getOrderAction(status: OrderStatus): OrderRowAction {
  switch (status) {
    case "PENDING":
      return { label: "Mark paid", kind: "update", nextStatus: "PAID" };
    case "PAID":
    case "PROCESSING":
      return { label: "Mark shipped", kind: "update", nextStatus: "SHIPPED" };
    default:
      return { label: "View order", kind: "view" };
  }
}

function getDateBucket(timestamp: number) {
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const day = 1000 * 60 * 60 * 24;

  if (diff <= 7 * day) return "7d";
  if (diff <= 30 * day) return "30d";
  if (diff <= 90 * day) return "90d";
  return "all";
}

function matchesSearchIndex(order: DecoratedOrder, query: string) {
  if (!query) return true;
  return order.searchIndex.includes(query);
}

function matchesFilters(order: DecoratedOrder, filters: {
  dateFilter: DateFilter;
  paymentFilter: PaymentKey;
  statusFilter: StatusFilter;
}) {
  if (filters.statusFilter !== "all" && order.normalizedStatus !== filters.statusFilter) {
    return false;
  }

  if (filters.paymentFilter !== "all" && order.paymentKey !== filters.paymentFilter) {
    return false;
  }

  if (filters.dateFilter !== "all" && getDateBucket(order.placedAt) !== filters.dateFilter) {
    return false;
  }

  return true;
}

function sortVisibleOrders(orders: DecoratedOrder[], sortBy: SortKey) {
  const sorted = [...orders];

  switch (sortBy) {
    case "oldest":
      return sorted.sort((a, b) => a.placedAt - b.placedAt);
    case "amount-desc":
      return sorted.sort((a, b) => (b.totals?.total ?? 0) - (a.totals?.total ?? 0));
    case "amount-asc":
      return sorted.sort((a, b) => (a.totals?.total ?? 0) - (b.totals?.total ?? 0));
    default:
      return sorted.sort((a, b) => b.placedAt - a.placedAt);
  }
}

function getActiveFilterCount(searchQuery: string, statusFilter: StatusFilter, paymentFilter: PaymentKey, dateFilter: DateFilter, sortBy: SortKey) {
  return [
    searchQuery.trim().length > 0,
    statusFilter !== "all",
    paymentFilter !== "all",
    dateFilter !== "all",
    sortBy !== "newest",
  ].filter(Boolean).length;
}

function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function StatCard({ label, value, helper, trend, icon: Icon, accentClass, iconClass }: StatCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className={cn("h-1.5 w-full rounded-full", accentClass)} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="font-serif text-4xl leading-none tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{helper}</p>
          </div>
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", iconClass)}>
            <Icon />
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

function StatCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-5">
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

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = getStatusMeta(status);

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", meta.tone)}
    >
      {meta.label}
    </Badge>
  );
}

function PaymentBadge({ paymentKey }: { paymentKey: PaymentKey }) {
  if (paymentKey === "all") {
    return null;
  }

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", paymentToneClasses[paymentKey])}>
      {paymentLabels[paymentKey]}
    </Badge>
  );
}

function OrdersEmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
        <ShoppingBag />
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">No orders yet</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Orders will appear here once customers start checking out. You can refresh the page to sync the latest data.
      </p>
      <Button onClick={onRefresh} variant="outline" className="mt-6 rounded-full">
        <RefreshCw />
        Refresh
      </Button>
    </div>
  );
}

function OrdersNoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
        <Search />
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight text-primary">No matching orders</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Try a different search term or clear the filters to bring back the full orders list.
      </p>
      <Button onClick={onClear} className="mt-6 rounded-full">
        Clear filters
      </Button>
    </div>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="hidden space-y-3 md:block">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[1.25fr_1.7fr_1fr_0.8fr_0.8fr_0.9fr] items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-3 w-24 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full justify-self-end" />
          <Skeleton className="h-9 w-28 rounded-full justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function OrderCardSkeleton() {
  return (
    <Card className="rounded-2xl border-border/60 bg-white shadow-sm md:hidden">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
          </div>
        </div>
        <Separator className="bg-border/60" />
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function OrderFilters({
  activeFilterCount,
  dateFilter,
  onClear,
  onDateFilterChange,
  onPaymentFilterChange,
  onSortChange,
  onStatusFilterChange,
  paymentFilter,
  sortBy,
  statusFilter,
}: OrderFiltersProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Filters</p>
          <p className="text-sm text-muted-foreground">Refine status, payment method, date, and sort order.</p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {activeFilterCount} active
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterField label="Status">
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}>
            <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-4 shadow-none">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Payment">
          <Select value={paymentFilter} onValueChange={(value) => onPaymentFilterChange(value as PaymentKey)}>
            <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-4 shadow-none">
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {paymentFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Date">
          <Select value={dateFilter} onValueChange={(value) => onDateFilterChange(value as DateFilter)}>
            <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-4 shadow-none">
              <SelectValue placeholder="All dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {dateFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Sort by">
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortKey)}>
              <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white px-4 shadow-none">
                <SelectValue placeholder="Newest first" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" className="h-11 shrink-0 rounded-full px-4" onClick={onClear}>
              Reset
            </Button>
          </div>
        </FilterField>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onAdvanceStatus,
  updating,
}: {
  order: DecoratedOrder;
  onAdvanceStatus: (order: DecoratedOrder, nextStatus: OrderStatus) => void;
  updating: boolean;
}) {
  const action = getOrderAction(order.normalizedStatus);

  return (
    <Card
      id={order.id}
      className="rounded-2xl border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 text-[11px] font-semibold tracking-[0.2em] text-primary">
            {order.orderBlock}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{order.number}</p>
              <StatusBadge status={order.normalizedStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground">{order.shipping?.fullName || "Guest customer"}</span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-3.5" />
                {order.locationLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" />
                {formatDate(order.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Banknote className="size-3.5" />
                {order.paymentLabel}
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/60" />

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
              {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            </Badge>
            <PaymentBadge paymentKey={order.paymentKey} />
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            {action.kind === "update" && action.nextStatus ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={orderActionButtonClassName}
                style={orderActionButtonStyle}
                onClick={() => onAdvanceStatus(order, action.nextStatus as OrderStatus)}
                disabled={updating}
              >
                {updating ? <Loader2 className="animate-spin" /> : action.label}
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className={orderViewButtonClassName} style={orderActionButtonStyle}>
                <Link to={`#${order.id}`}>
                  {action.label}
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{order.items.length} line item{order.items.length === 1 ? "" : "s"}</span>
          <span className="font-semibold text-foreground">{formatCurrency(order.totals?.total ?? 0)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrdersTable({
  loading,
  orders,
  onAdvanceStatus,
  updatingId,
  hasData,
  onClearFilters,
  noResults,
  onRefresh,
}: {
  hasData: boolean;
  loading: boolean;
  noResults: boolean;
  onAdvanceStatus: (order: DecoratedOrder, nextStatus: OrderStatus) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  orders: DecoratedOrder[];
  updatingId: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="hidden md:block">
          <OrdersTableSkeleton />
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <OrderCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return <OrdersEmptyState onRefresh={onRefresh} />;
  }

  if (noResults) {
    return <OrdersNoResultsState onClear={onClearFilters} />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-white/90 shadow-sm md:block">
        <Table className="min-w-[1120px]">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[27%]" />
            <col className="w-[17%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Order
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Customer
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Payment
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Amount
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const action = getOrderAction(order.normalizedStatus);
              const initials = initialsFrom(order.shipping?.fullName || order.shipping?.email || "CV");
              const updating = updatingId === order.id;

              return (
                <TableRow key={order.id} id={order.id} className="group hover:bg-primary/5">
                  <TableCell className="px-4 py-4 align-top">
                    <Link to={`#${order.id}`} className="inline-flex flex-col gap-1 text-left">
                      <span className="font-mono text-xs font-semibold tracking-[0.24em] text-primary">
                        {order.number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.orderBlock} • {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 rounded-2xl border border-border/60">
                        <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {order.shipping?.fullName || "Guest customer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{order.locationLabel}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <PaymentBadge paymentKey={order.paymentKey} />
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <StatusBadge status={order.normalizedStatus} />
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right align-top">
                    <div className="text-sm font-semibold text-foreground">{formatCurrency(order.totals?.total ?? 0)}</div>
                    <div className="text-xs text-muted-foreground">{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</div>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right align-top">
                    {action.kind === "update" && action.nextStatus ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={orderActionButtonClassName}
                        style={orderActionButtonStyle}
                        onClick={() => onAdvanceStatus(order, action.nextStatus as OrderStatus)}
                        disabled={updating}
                      >
                        {updating ? <Loader2 className="animate-spin" /> : action.label}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className={orderViewButtonClassName}
                        style={orderActionButtonStyle}
                      >
                        <Link to={`#${order.id}`}>
                          {action.label}
                          <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAdvanceStatus={onAdvanceStatus}
            updating={updatingId === order.id}
          />
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentKey>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(`${API_BASE}/${isAdmin ? "orders" : "orders/my"}`);
      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(message || "Failed to load orders");
      }

      const payload = (await response.json().catch(() => null)) as OrdersApiResponse | Order[] | null;
      const items = Array.isArray((payload as OrdersApiResponse)?.items ?? payload)
        ? (((payload as OrdersApiResponse).items ?? payload) as Order[])
        : [];

      setOrders(items);
    } catch (error) {
      console.error("Failed to load orders", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, request]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadOrders();
    };

    window.addEventListener("dashboard:data:refresh", handleRefresh);
    return () => window.removeEventListener("dashboard:data:refresh", handleRefresh);
  }, [loadOrders]);

  const sourceOrders = useMemo<DecoratedOrder[]>(() => {
    if (loading) return [];

    const baseOrders = orders.length ? orders : SAMPLE_ORDERS;

    return baseOrders.map((order) => {
      const normalizedStatus = getStatusMeta(order.status).status;
      const paymentKey = normalizePaymentMethod(order.paymentMethod);
      const paymentLabel = getPaymentLabel(order.paymentMethod);
      const createdAt = new Date(order.createdAt);
      const placedAt = Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime();
      const itemCount = Array.isArray(order.items) ? order.items.length : 0;
      const locationLabel =
        order.shipping?.city || order.shipping?.address || order.shipping?.postalCode || "Unassigned";
      const searchIndex = [
        order.number,
        order.shipping?.fullName,
        order.shipping?.email,
        order.shipping?.city,
        order.shipping?.address,
        order.shipping?.postalCode,
        paymentLabel,
        normalizedStatus,
        statusLabels[normalizedStatus],
        ...((Array.isArray(order.items) ? order.items : []).map((item) => item.name)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        ...order,
        normalizedStatus,
        paymentKey,
        paymentLabel,
        placedAt,
        itemCount,
        searchIndex,
        locationLabel,
        orderBlock: order.number.slice(-4).toUpperCase(),
      };
    });
  }, [loading, orders]);

  const summary = useMemo<OrderSummary>(() => {
    const totals = sourceOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.totalCollected += Number(order.totals?.total ?? 0) || 0;

        if (order.normalizedStatus === "PENDING") {
          acc.awaitingPayment += 1;
        } else if (order.normalizedStatus !== "DELIVERED") {
          acc.inProgress += 1;
        } else {
          acc.delivered += 1;
        }

        return acc;
      },
      {
        total: 0,
        awaitingPayment: 0,
        inProgress: 0,
        delivered: 0,
        totalCollected: 0,
      }
    );

    return totals;
  }, [sourceOrders]);

  const visibleOrders = useMemo(() => {
    const filtered = sourceOrders.filter((order) => {
      return (
        matchesSearchIndex(order, deferredSearch) &&
        matchesFilters(order, { dateFilter, paymentFilter, statusFilter })
      );
    });

    return sortVisibleOrders(filtered, sortBy);
  }, [deferredSearch, dateFilter, paymentFilter, sortBy, sourceOrders, statusFilter]);

  const activeFilterCount = getActiveFilterCount(searchQuery, statusFilter, paymentFilter, dateFilter, sortBy);
  const hasData = !loading && sourceOrders.length > 0;
  const noResults = hasData && visibleOrders.length === 0;

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFilter("all");
    setSortBy("newest");
  }, []);

  const applyQuickPreset = useCallback((preset: "awaiting" | "inProgress" | "highest") => {
    if (preset === "awaiting") {
      setStatusFilter("PENDING");
      setPaymentFilter("all");
      setDateFilter("all");
      setSortBy("newest");
      return;
    }

    if (preset === "inProgress") {
      setStatusFilter("PROCESSING");
      setPaymentFilter("all");
      setDateFilter("all");
      setSortBy("newest");
      return;
    }

    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFilter("all");
    setSortBy("amount-desc");
  }, []);

  const updateOrderStatus = useCallback(
    async (order: DecoratedOrder, nextStatus: OrderStatus) => {
      setUpdatingId(order.id);
      try {
        const response = await request(`${API_BASE}/orders/${order.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!response.ok) {
          if (response.status === 403) {
            toast.error("Only admins can update order status.");
            return;
          }

          const message = await response.text().catch(() => "");
          throw new Error(message || "Failed to update order");
        }

        setOrders((current) =>
          current.map((item) => (item.id === order.id ? { ...item, status: nextStatus } : item))
        );
        toast.success(`Order ${order.number} marked ${getStatusMeta(nextStatus).label.toLowerCase()}.`);
        window.dispatchEvent(new CustomEvent("dashboard:data:refresh"));
        await loadOrders();
      } catch (error: any) {
        console.error("Order update failed", error);
        toast.error(error?.message || "Unable to update order");
      } finally {
        setUpdatingId(null);
      }
    },
    [loadOrders, request]
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
                          Orders
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Track payments, shipping, and fulfillment.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl lg:flex-1 lg:justify-end">
                        <div className="relative w-full sm:flex-1 lg:max-w-md">
                          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search orders or customers..."
                            className="h-11 rounded-full border-border/70 bg-white pl-10 shadow-none"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full px-5 shadow-sm"
                          onClick={loadOrders}
                        >
                          <RefreshCw />
                          Refresh
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="h-11 rounded-full px-5 shadow-sm">
                              <Filter />
                              Filters
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60 bg-white shadow-lg">
                            <DropdownMenuLabel className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                              Quick filters
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem onSelect={() => applyQuickPreset("awaiting")}>
                                Awaiting payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => applyQuickPreset("inProgress")}>
                                In progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => applyQuickPreset("highest")}>
                                Highest value
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={resetFilters}>Reset filters</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => <StatCardSkeleton key={index} />)
                    : [
                        {
                          label: "Total Orders",
                          value: numberFormatter.format(summary.total),
                          helper: "All live orders",
                          trend: "Order flow",
                          icon: ShoppingBag,
                          accentClass: "bg-primary",
                          iconClass: "bg-primary/10 text-primary",
                        },
                        {
                          label: "Awaiting Payment",
                          value: numberFormatter.format(summary.awaitingPayment),
                          helper: "Needs payment confirmation",
                          trend: "Payment queue",
                          icon: Clock3,
                          accentClass: "bg-amber-300",
                          iconClass: "bg-amber-100 text-amber-700",
                        },
                        {
                          label: "In Progress",
                          value: numberFormatter.format(summary.inProgress),
                          helper: "Paid, processing, shipped",
                          trend: "Fulfillment",
                          icon: Truck,
                          accentClass: "bg-violet-300",
                          iconClass: "bg-violet-100 text-violet-700",
                        },
                        {
                          label: "Delivered",
                          value: numberFormatter.format(summary.delivered),
                          helper: "Completed orders",
                          trend: "Finished",
                          icon: CheckCircle2,
                          accentClass: "bg-emerald-300",
                          iconClass: "bg-emerald-100 text-emerald-700",
                        },
                        {
                          label: "Total Collected",
                          value: formatCurrency(summary.totalCollected),
                          helper: "Gross revenue",
                          trend: "Revenue",
                          icon: Banknote,
                          accentClass: "bg-secondary",
                          iconClass: "bg-secondary/70 text-primary",
                        },
                      ].map((card) => <StatCard key={card.label} {...card} />)}
                </div>

                <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm">
                  <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">
                          Orders & Shipping
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                        >
                          {numberFormatter.format(summary.total)} orders
                        </Badge>
                      </div>
                      <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                        Manage payments, addresses, and fulfillment.
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {numberFormatter.format(activeFilterCount)} active filters
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 p-5">
                    <OrderFilters
                      activeFilterCount={activeFilterCount}
                      dateFilter={dateFilter}
                      onClear={resetFilters}
                      onDateFilterChange={setDateFilter}
                      onPaymentFilterChange={setPaymentFilter}
                      onSortChange={setSortBy}
                      onStatusFilterChange={setStatusFilter}
                      paymentFilter={paymentFilter}
                      sortBy={sortBy}
                      statusFilter={statusFilter}
                    />

                    <Separator className="bg-border/70" />

                    <OrdersTable
                      hasData={sourceOrders.length > 0}
                      loading={loading}
                      noResults={noResults}
                      onAdvanceStatus={updateOrderStatus}
                      onClearFilters={resetFilters}
                      onRefresh={loadOrders}
                      orders={visibleOrders}
                      updatingId={updatingId}
                    />
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
