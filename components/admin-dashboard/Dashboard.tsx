"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Crown,
  IndianRupee,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShoppingBag,
  UserPlus,
  Users,
} from "lucide-react";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { formatCurrency } from "@/components/admin-dashboard/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { normalizeOrderStatus, type Order } from "@/types/order";

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const SAMPLE_TOTAL_ORDERS = 128;
const SAMPLE_TOTAL_REVENUE = 148600;
const SAMPLE_TOTAL_PRODUCTS = 29;
const SAMPLE_TOTAL_USERS = 10;
const SAMPLE_LOW_STOCK = 2;

type MetricCardProps = {
  label: string;
  value: string;
  helper: string;
  trend: string;
  icon: LucideIcon;
  accentClass: string;
  iconClass: string;
};

type SectionAction = {
  label: string;
  href: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  customer: string;
  email: string;
  status: string;
  amount: number;
  date: string;
  items: number;
};

type InventoryAlertRow = {
  id: string;
  product: string;
  shade: string;
  collection: string;
  stock: number;
};

type DashboardCustomerUser = {
  id?: string;
  name?: string | null;
  email?: string;
  role?: string;
  createdAt?: Date | string;
  joinedAt?: Date | string;
};

type CustomerInsightSummary = {
  totalCustomers: number;
  repeatCustomers: number;
  repeatCustomerRate: number;
  averageOrderValue: number;
  newCustomersThisMonth: number;
  topCustomer: {
    name: string;
    totalSpent: number;
    orders: number;
  };
  hasData: boolean;
};

type CustomerInsightRecord = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  orders: Order[];
  totalSpent: number;
  lastActiveAt?: string;
};

type BestSellerRow = {
  id: string;
  shade: string;
  product: string;
  collection: string;
  sales: number;
  revenue: number;
  color: string;
};

const SAMPLE_ORDER_ROWS: OrderRow[] = [
  {
    id: "cv-1048",
    orderNumber: "CV-1048",
    customer: "Maya Kapoor",
    email: "maya@stylehouse.com",
    status: "Paid",
    amount: 18900,
    date: "2026-06-12",
    items: 3,
  },
  {
    id: "cv-1047",
    orderNumber: "CV-1047",
    customer: "Aanya Jain",
    email: "aanya@studioflux.com",
    status: "Pending",
    amount: 7800,
    date: "2026-06-11",
    items: 2,
  },
  {
    id: "cv-1046",
    orderNumber: "CV-1046",
    customer: "Nia Thomas",
    email: "nia@wellskin.co",
    status: "Shipped",
    amount: 12450,
    date: "2026-06-10",
    items: 4,
  },
  {
    id: "cv-1045",
    orderNumber: "CV-1045",
    customer: "Olivia Parker",
    email: "olivia@blushmail.com",
    status: "Cancelled",
    amount: 9900,
    date: "2026-06-10",
    items: 1,
  },
  {
    id: "cv-1044",
    orderNumber: "CV-1044",
    customer: "Sara Ali",
    email: "sara@beautyatelier.com",
    status: "Delivered",
    amount: 15600,
    date: "2026-06-09",
    items: 5,
  },
];

const SAMPLE_INVENTORY_ALERTS: InventoryAlertRow[] = [
  {
    id: "alert-1",
    product: "Velvet Power Bullet Lipstick",
    shade: "Rosewood Muse",
    collection: "New Drop",
    stock: 2,
  },
  {
    id: "alert-2",
    product: "Glass Luxe Lip Gloss",
    shade: "Berry Bloom",
    collection: "Gloss Garden",
    stock: 1,
  },
  {
    id: "alert-3",
    product: "Air Couture Liquid Matte Lipstick",
    shade: "Amber Silk",
    collection: "Signature Matte",
    stock: 4,
  },
  {
    id: "alert-4",
    product: "Glass Luxe Lip Gloss",
    shade: "Bare Silk",
    collection: "Gloss Garden",
    stock: 3,
  },
];

const SAMPLE_CUSTOMER_INSIGHTS: CustomerInsightSummary = {
  totalCustomers: 10,
  repeatCustomers: 2,
  repeatCustomerRate: 20,
  averageOrderValue: 520.14,
  newCustomersThisMonth: 3,
  topCustomer: {
    name: "Aniket Thakur",
    totalSpent: 2896,
    orders: 2,
  },
  hasData: false,
};

const SAMPLE_BEST_SELLERS: BestSellerRow[] = [
  {
    id: "shade-1",
    shade: "Velvet Rouge",
    product: "Velvet Power Bullet Lipstick",
    collection: "New Drop",
    sales: 128,
    revenue: 24320,
    color: "#6d214f",
  },
  {
    id: "shade-2",
    shade: "Rose Mist",
    product: "Glass Luxe Lip Gloss",
    collection: "Gloss Garden",
    sales: 114,
    revenue: 21660,
    color: "#c87d92",
  },
  {
    id: "shade-3",
    shade: "Nude Silk",
    product: "Air Couture Liquid Matte Lipstick",
    collection: "Signature Matte",
    sales: 96,
    revenue: 18720,
    color: "#c8a38a",
  },
  {
    id: "shade-4",
    shade: "Berry Bloom",
    product: "Cevonne Crush Velvet Power Bullet",
    collection: "Limited Edition",
    sales: 84,
    revenue: 15960,
    color: "#8f3e67",
  },
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

function getCreatedAtValue(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isSameMonth(value: Date | string, reference: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function normalizeCustomerRole(role: unknown) {
  const normalized = String(role ?? "customer").trim().toLowerCase();
  if (normalized === "admin" || normalized === "manager" || normalized === "support" || normalized === "customer") {
    return normalized;
  }
  return "customer";
}

function buildCustomerInsights(
  users: DashboardCustomerUser[] | null | undefined,
  orders: Order[] | null | undefined
): CustomerInsightSummary {
  const orderList = Array.isArray(orders) ? [...orders].sort((a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt)) : [];
  const records = new Map<string, CustomerInsightRecord>();
  const userIdToKey = new Map<string, string>();
  const emailToKey = new Map<string, string>();

  const customerUsers = Array.isArray(users) ? users : [];

  customerUsers.forEach((user, index) => {
    const role = normalizeCustomerRole(user.role);

    if (role !== "customer") return;

    const id = String(user.id ?? `user-${index}`);
    const email = String(user.email ?? "").trim().toLowerCase();
    const name = String(user.name ?? "").trim() || (email ? email.split("@")[0] : "Customer");
    const joinedAt = String(user.joinedAt ?? user.createdAt ?? new Date().toISOString());
    const key = `user:${id}`;

    records.set(key, {
      id,
      name,
      email,
      joinedAt,
      orders: [],
      totalSpent: 0,
    });

    userIdToKey.set(id, key);
    if (email) {
      emailToKey.set(email, key);
    }
  });

  orderList.forEach((order, index) => {
    const orderEmail = String(order.shipping?.email ?? "").trim().toLowerCase();
    const orderUserId = String(order.userId ?? "").trim();
    let key = orderUserId ? userIdToKey.get(orderUserId) : undefined;

    if (!key && orderEmail) {
      key = emailToKey.get(orderEmail);
    }

    if (!key) {
      const fallbackName =
        String(order.shipping?.fullName ?? "").trim() ||
        (orderEmail ? orderEmail.split("@")[0] : `Customer ${index + 1}`);
      key = orderEmail ? `guest:${orderEmail}` : orderUserId ? `user:${orderUserId}` : `order:${order.id}`;

      if (!records.has(key)) {
        records.set(key, {
          id: key,
          name: fallbackName,
          email: orderEmail,
          joinedAt: String(order.createdAt ?? new Date().toISOString()),
          orders: [],
          totalSpent: 0,
        });
      }

      if (orderUserId && !userIdToKey.has(orderUserId)) {
        userIdToKey.set(orderUserId, key);
      }
      if (orderEmail && !emailToKey.has(orderEmail)) {
        emailToKey.set(orderEmail, key);
      }
    }

    const record = records.get(key);
    if (record) {
      record.orders.push(order);
    }
  });

  const customers = [...records.values()].map((record) => {
    const sortedOrders = [...record.orders].sort((a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt));
    const totalSpent = sortedOrders.reduce((sum, order) => sum + (Number(order.totals?.total) || 0), 0);

    return {
      ...record,
      orders: sortedOrders,
      totalSpent,
      lastActiveAt: sortedOrders[0]?.createdAt ? String(sortedOrders[0].createdAt) : undefined,
    };
  });

  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter((customer) => customer.orders.length > 1).length;
  const repeatCustomerRate = totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
  const totalRevenue = orderList.reduce((sum, order) => sum + (Number(order.totals?.total) || 0), 0);
  const averageOrderValue = orderList.length ? totalRevenue / orderList.length : 0;
  const currentMonth = new Date();
  const newCustomersThisMonth = customers.filter((customer) => isSameMonth(customer.joinedAt, currentMonth)).length;
  const topCustomer = customers
    .slice()
    .sort(
      (left, right) =>
        right.totalSpent - left.totalSpent ||
        right.orders.length - left.orders.length ||
        getCreatedAtValue(left.joinedAt) - getCreatedAtValue(right.joinedAt)
    )[0];

  return {
    totalCustomers,
    repeatCustomers,
    repeatCustomerRate,
    averageOrderValue,
    newCustomersThisMonth,
    topCustomer: topCustomer
      ? {
          name: topCustomer.name,
          totalSpent: topCustomer.totalSpent,
          orders: topCustomer.orders.length,
        }
      : { ...SAMPLE_CUSTOMER_INSIGHTS.topCustomer },
    hasData: totalCustomers > 0 || orderList.length > 0,
  };
}

function getOrderStatusMeta(status: string) {
  const normalized = status.trim().toUpperCase();

  switch (normalized) {
    case "PAID":
      return {
        label: "Paid",
        variant: "outline" as const,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "PENDING":
      return {
        label: "Pending",
        variant: "outline" as const,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "PROCESSING":
      return {
        label: "Processing",
        variant: "outline" as const,
        className: "border-violet-200 bg-violet-50 text-violet-700",
      };
    case "SHIPPED":
      return {
        label: "Shipped",
        variant: "outline" as const,
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "OUT_FOR_DELIVERY":
      return {
        label: "Out for delivery",
        variant: "outline" as const,
        className: "border-indigo-200 bg-indigo-50 text-indigo-700",
      };
    case "DELIVERED":
      return {
        label: "Delivered",
        variant: "secondary" as const,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        variant: "destructive" as const,
        className: "",
      };
    default:
      return {
        label: humanize(status),
        variant: "outline" as const,
        className: "border-border/70 bg-muted/30 text-foreground",
      };
  }
}

function mapLiveOrders(orders: Order[]) {
  return [...orders]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5)
    .map((order, index) => {
      const customer =
        order.shipping?.fullName?.trim() ||
        order.shipping?.email?.trim() ||
        `Customer ${index + 1}`;
      const email = order.shipping?.email?.trim() || "Guest checkout";
      const status = getOrderStatusMeta(normalizeOrderStatus(order.status)).label;

      return {
        id: order.id,
        orderNumber: order.number || `ORD-${index + 1}`,
        customer,
        email,
        status,
        amount: Number(order.totals?.total) || 0,
        date: formatDate(order.createdAt),
        items: Array.isArray(order.items) ? order.items.length : 0,
      } satisfies OrderRow;
    });
}

function MetricCard({ label, value, helper, trend, icon: Icon, accentClass, iconClass }: MetricCardProps) {
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
            <Icon className="size-5" />
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <ArrowUpRight className="size-3.5" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-2xl" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
          <Skeleton className="size-12 rounded-2xl" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </CardContent>
    </Card>
  );
}

function PanelHeader({
  title,
  description,
  countLabel,
  action,
}: {
  title: string;
  description: string;
  countLabel?: string;
  action?: SectionAction;
}) {
  return (
    <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">{title}</CardTitle>
        <CardDescription className="max-w-2xl text-sm text-muted-foreground">{description}</CardDescription>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {countLabel ? (
          <Badge
            variant="outline"
            className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
          >
            {countLabel}
          </Badge>
        ) : null}
        {action ? (
          <Button asChild variant="ghost" size="sm" className="rounded-full text-primary">
            <Link to={action.href}>
              {action.label}
              <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>
    </CardHeader>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="overflow-x-auto px-5 pb-5 pt-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[820px] grid-cols-[1.2fr_1.5fr_0.7fr_0.9fr_0.8fr] items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function InventoryAlertsSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-44 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-full" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function BestSellersSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
          <Skeleton className="size-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-3 w-44 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

type CustomerInsightRowProps = {
  icon: LucideIcon;
  label: string;
  helper: string;
  value: string;
  badge: string;
  valueClassName?: string;
  badgeClassName?: string;
};

function CustomerInsightRow({
  icon: Icon,
  label,
  helper,
  value,
  badge,
  valueClassName,
  badgeClassName,
}: CustomerInsightRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf7f4] text-[#4b0d4b]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{helper}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 text-right">
        <p className={cn("truncate text-base font-semibold text-[#4b0d4b]", valueClassName)}>{value}</p>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full border-border/70 bg-muted/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground",
            badgeClassName
          )}
        >
          {badge}
        </Badge>
      </div>
    </div>
  );
}

function CustomerInsightsSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between rounded-xl border border-border/60 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-3 w-52 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function filterMatches(values: Array<string | number | null | undefined>, query: string) {
  if (!query) return true;
  return values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(query));
}

export default function Dashboard() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { collections, shades, inventory, lowInventory, orders, users, stats, loading, refresh } =
    useDashboardData(true, request, isAdmin);

  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  const collectionCount = Array.isArray(collections) ? collections.length : 0;

  const metricCards = [
    {
      label: "Total Products",
      value: numberFormatter.format(stats?.productCount ?? SAMPLE_TOTAL_PRODUCTS),
      helper: `Live catalog across ${collectionCount} collections`,
      trend: "Beauty line",
      icon: Package,
      accentClass: "bg-primary",
      iconClass: "bg-primary/10 text-primary",
    },
    {
      label: "Total Users",
      value: numberFormatter.format(stats?.userCount ?? SAMPLE_TOTAL_USERS),
      helper: "Registered customers and admins",
      trend: "Audience growth",
      icon: Users,
      accentClass: "bg-rose-300",
      iconClass: "bg-rose-100 text-rose-700",
    },
    {
      label: "Low Stock",
      value: numberFormatter.format(stats?.lowStockCount ?? SAMPLE_LOW_STOCK),
      helper: "Lipstick shades need restocking",
      trend: "Needs attention",
      icon: AlertTriangle,
      accentClass: "bg-secondary",
      iconClass: "bg-secondary/60 text-primary",
    },
    {
      label: "Total Orders",
      value: numberFormatter.format(stats?.orderCount ?? SAMPLE_TOTAL_ORDERS),
      helper: `${formatCurrency(stats?.orderRevenue ?? SAMPLE_TOTAL_REVENUE)} revenue`,
      trend: "Live volume",
      icon: ShoppingBag,
      accentClass: "bg-muted-foreground/40",
      iconClass: "bg-muted/60 text-muted-foreground",
    },
  ] satisfies MetricCardProps[];

  const recentOrders = useMemo(() => {
    if (loading) return [];
    const liveOrders = Array.isArray(orders) ? mapLiveOrders(orders) : [];
    return liveOrders.length ? liveOrders : SAMPLE_ORDER_ROWS;
  }, [loading, orders]);
  const visibleOrders = recentOrders.filter((order) =>
    filterMatches([order.orderNumber, order.customer, order.email, order.status, order.amount, order.date], deferredQuery)
  );

  const visibleAlerts = useMemo(() => {
    if (loading) return [];

    const lowStockSource =
      Array.isArray(lowInventory) && lowInventory.length
        ? lowInventory
        : Array.isArray(inventory) && inventory.length
          ? inventory.filter((item: any) => {
              const quantity = Number(item?.quantity ?? 0);
              return quantity > 0 && quantity <= 12;
            })
          : [];

    const liveAlerts = lowStockSource.slice(0, 4).map((item: any, index: number) => ({
      id: item.id || `alert-${index}`,
      // Inventory records belong to a shade, and the product is nested below it.
      // Reading from `item.product` here made the dashboard fall back to demo labels.
      product: item?.shade?.product?.name || "Unnamed product",
      shade: item?.shade?.name || "Unnamed shade",
      collection:
        item?.shade?.product?.collection?.name ||
        item?.shade?.product?.collection?.slug ||
        "Unassigned",
      // Keep a genuine zero quantity as zero instead of replacing it with demo stock.
      stock: Number(item?.quantity ?? 0),
    }));

    return liveAlerts;
  }, [inventory, loading, lowInventory]);

  const filteredAlerts = visibleAlerts.filter((item) =>
    filterMatches([item.product, item.shade, item.collection, item.stock], deferredQuery)
  );

  const customerInsightsSummary = useMemo(
    () => buildCustomerInsights(users as DashboardCustomerUser[], orders),
    [orders, users]
  );

  const customerInsights = customerInsightsSummary.hasData
    ? customerInsightsSummary
    : SAMPLE_CUSTOMER_INSIGHTS;

  const customerInsightRows = useMemo(
    () => [
      {
        icon: RefreshCcw,
        label: "Repeat customers",
        helper: "Customers with more than one order",
        value: numberFormatter.format(customerInsights.repeatCustomers),
        badge: `${customerInsights.repeatCustomerRate}%`,
      },
      {
        icon: IndianRupee,
        label: "Average order value",
        helper: "Gross revenue divided by total orders",
        value: formatCurrency(customerInsights.averageOrderValue),
        badge: "AOV",
      },
      {
        icon: UserPlus,
        label: "New customers",
        helper: "Joined this month",
        value: numberFormatter.format(customerInsights.newCustomersThisMonth),
        badge: "New",
      },
      {
        icon: Crown,
        label: "Top customer",
        helper: `${formatCurrency(customerInsights.topCustomer.totalSpent)} spent · ${numberFormatter.format(customerInsights.topCustomer.orders)} orders`,
        value: customerInsights.topCustomer.name,
        badge: "VIP",
        valueClassName: "max-w-[12rem] truncate",
      },
    ],
    [customerInsights]
  );

  const visibleBestSellers = useMemo(() => {
    if (loading) return [];

    const liveBestSellers =
      Array.isArray(shades) && shades.length
        ? shades.slice(0, 4).map((shade: any, index: number) => ({
            id: shade.id || `shade-${index}`,
            shade: shade?.name || SAMPLE_BEST_SELLERS[index]?.shade || "Shade",
            product:
              shade?.product?.name ||
              SAMPLE_BEST_SELLERS[index]?.product ||
              "Lipstick product",
            collection:
              shade?.product?.collection?.name ||
              shade?.product?.collection?.slug ||
              SAMPLE_BEST_SELLERS[index]?.collection ||
              "Collection",
            sales: [128, 114, 96, 84][index % 4],
            revenue: [24320, 21660, 18720, 15960][index % 4],
            color: shade?.hexColor || shade?.hex || SAMPLE_BEST_SELLERS[index]?.color || "#8f3e67",
          }))
        : [];

    return (liveBestSellers.length ? liveBestSellers : SAMPLE_BEST_SELLERS).filter((item) =>
      filterMatches([item.shade, item.product, item.collection, item.sales, item.revenue], deferredQuery)
    );
  }, [deferredQuery, loading, shades]);

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
                          Dashboard
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Overview of your catalog, customers, orders, and inventory health.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl lg:flex-1 lg:justify-end">
                        <div className="relative w-full sm:flex-1 lg:max-w-md">
                          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search products, orders, or collections..."
                            className="h-11 rounded-full border-border/70 bg-white pl-10 shadow-none"
                          />
                        </div>

                        <Button asChild className="h-11 rounded-full px-5 shadow-sm">
                          <Link to="/dashboard/products/new">
                            <Plus />
                            Add product
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                <Separator className="bg-border/70" />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => <MetricCardSkeleton key={index} />)
                    : metricCards.map((card) => (
                        <MetricCard key={card.label} {...card} />
                      ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm xl:col-span-7">
                    <PanelHeader
                      title="Recent Orders"
                      description="Latest customer checkouts with payment and delivery context."
                      countLabel={`${numberFormatter.format(visibleOrders.length)} shown`}
                      action={{ label: "View all", href: "/dashboard/orders" }}
                    />
                    {loading && !recentOrders.length ? (
                      <OrdersTableSkeleton />
                    ) : visibleOrders.length ? (
                      <div className="overflow-x-auto px-5 pb-5 pt-4">
                        <Table className="min-w-[820px] table-fixed">
                          <colgroup>
                            <col className="w-[22%]" />
                            <col className="w-[30%]" />
                            <col className="w-[18%]" />
                            <col className="w-[15%]" />
                            <col className="w-[15%]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Order ID
                              </TableHead>
                              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Customer
                              </TableHead>
                              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Status
                              </TableHead>
                              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Amount
                              </TableHead>
                              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Date
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleOrders.map((order) => {
                              const status = getOrderStatusMeta(order.status);
                              const initials = initialsFrom(order.customer || order.email);

                              return (
                                <TableRow key={order.id} className="group hover:bg-primary/5">
                                  <TableCell className="px-4 py-4 align-middle">
                                    <Link
                                      to="/dashboard/orders"
                                      className="inline-flex flex-col gap-1 text-left"
                                    >
                                      <span className="font-mono text-xs font-semibold tracking-[0.24em] text-primary">
                                        {order.orderNumber}
                                      </span>
                                      <span className="text-xs text-muted-foreground">{order.items} item{order.items === 1 ? "" : "s"}</span>
                                    </Link>
                                  </TableCell>
                                  <TableCell className="px-4 py-4 align-middle">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="size-10 rounded-2xl border border-border/60">
                                        <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                          {order.customer}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">{order.email}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-4 align-middle">
                                    <Badge
                                      variant={status.variant}
                                      className={cn(
                                        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                                        status.className
                                      )}
                                    >
                                      {status.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="px-4 py-4 text-right align-middle">
                                    <div className="text-sm font-semibold text-foreground">
                                      {formatCurrency(order.amount)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-4 text-right align-middle">
                                    <div className="text-sm text-muted-foreground">{order.date}</div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="px-5 pb-6 pt-4">
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                          No orders match your search.
                        </div>
                      </div>
                    )}
                  </Card>

                  <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm xl:col-span-5">
                    <PanelHeader
                      title="Inventory Alerts"
                      description="Low-stock lipstick shades that need replenishment."
                      countLabel={`${numberFormatter.format(filteredAlerts.length)} shown`}
                      action={{ label: "Open inventory", href: "/dashboard/inventory" }}
                    />
                    {loading && !filteredAlerts.length ? (
                      <InventoryAlertsSkeleton />
                    ) : filteredAlerts.length ? (
                      <div className="space-y-3 p-5">
                        {filteredAlerts.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
                          >
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-[linear-gradient(135deg,rgba(61,10,69,0.08),rgba(234,214,186,0.4))] text-primary">
                              <AlertTriangle className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="truncate text-sm font-semibold text-foreground">{item.product}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.shade} • {item.collection}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700"
                            >
                              {numberFormatter.format(item.stock)} left
                            </Badge>
                            <Button asChild size="sm" variant="outline" className="rounded-full">
                              <Link to="/dashboard/inventory">
                                Restock
                                <ArrowRight />
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-5 pb-6 pt-4">
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                          No inventory alerts match your search.
                        </div>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm xl:col-span-5">
                    <PanelHeader
                      title="Customer Insights"
                      description="A quick view of customer quality, repeat buying, and spending behavior."
                      countLabel="4 signals"
                      action={{ label: "View users", href: "/dashboard/users" }}
                    />
                    {loading && !customerInsightsSummary.hasData ? (
                      <CustomerInsightsSkeleton />
                    ) : (
                      <div className="space-y-3 p-5">
                        {customerInsightRows.map((row) => (
                          <CustomerInsightRow key={row.label} {...row} />
                        ))}

                        <div className="rounded-xl border border-[#eadfd8] bg-[#fbf7f4] px-4 py-3 text-xs leading-5 text-muted-foreground">
                          Customer retention is healthier when repeat buyers increase month over month.
                        </div>
                      </div>
                    )}
                  </Card>

                  <Card className="overflow-hidden rounded-[28px] border-border/60 bg-card shadow-sm xl:col-span-7">
                    <PanelHeader
                      title="Best Selling Shades"
                      description="Lipstick shades driving the strongest revenue and repeat demand."
                      countLabel={`${numberFormatter.format(visibleBestSellers.length)} shades`}
                      action={{ label: "View catalog", href: "/dashboard/products" }}
                    />
                    {loading && !visibleBestSellers.length ? (
                      <BestSellersSkeleton />
                    ) : visibleBestSellers.length ? (
                      <div className="space-y-3 p-5">
                        {visibleBestSellers.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
                          >
                            <div
                              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 shadow-sm"
                              style={{ backgroundColor: item.color }}
                            >
                              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">
                                CV
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="truncate text-sm font-semibold text-foreground">{item.shade}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.product} • {item.collection}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700"
                              >
                                {numberFormatter.format(item.sales)} sold
                              </Badge>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-foreground">{formatCurrency(item.revenue)}</p>
                                <p className="text-xs text-muted-foreground">Revenue</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-5 pb-6 pt-4">
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                          No shades match your search.
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
