"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Download,
  Eye,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserCog,
  UserPlus,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { formatCurrency } from "@/components/admin-dashboard/utils";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { normalizeOrderStatus, type Order } from "@/types/order";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@/lib/router";

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type UserRole = "admin" | "manager" | "customer" | "support";
type UserStatus = "active" | "invited" | "suspended" | "blocked";
type UserSort = "newest" | "oldest" | "highest_spend" | "most_orders";
type UserRoleFilter = "all" | "customer" | "admin" | "manager";
type UserStatusFilter = "all" | UserStatus;

type DashboardUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
};

type DashboardOrder = Order & {
  customer?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type UserOrderSummary = {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: string;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  role: UserRole;
  status: UserStatus;
  orders: number;
  totalSpent: number;
  joinedAt: string;
  lastActiveAt?: string;
  avatarUrl?: string;
  notes?: string;
  recentOrders: UserOrderSummary[];
};

type UserFormValues = {
  name: string;
  email: string;
  phone: string;
  city: string;
  role: UserRole;
  status: UserStatus;
  note: string;
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

type UserAction = "suspend" | "delete";

type UserActionTarget = {
  action: UserAction;
  ids: string[];
};

type UserRoleDialogState = {
  open: boolean;
  ids: string[];
  role: UserRole;
};

type AddUserDialogState = {
  open: boolean;
  mode: "add" | "invite" | "edit";
  user: UserRecord | null;
};

const ROLE_FILTER_OPTIONS: Array<{ value: UserRoleFilter; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "customer", label: "Customer" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
];

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "customer", label: "Customer" },
  { value: "support", label: "Support" },
];

const STATUS_FILTER_OPTIONS: Array<{ value: UserStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
];

const STATUS_OPTIONS: Array<{ value: UserStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Blocked" },
];

const SORT_OPTIONS: Array<{ value: UserSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest_spend", label: "Highest spend" },
  { value: "most_orders", label: "Most orders" },
];

const ROLE_META: Record<UserRole, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "border-primary/20 bg-primary/5 text-primary",
  },
  manager: {
    label: "Manager",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  customer: {
    label: "Customer",
    className: "border-stone-200 bg-stone-100 text-stone-600",
  },
  support: {
    label: "Support",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  invited: {
    label: "Invited",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  suspended: {
    label: "Suspended",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  blocked: {
    label: "Blocked",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const SAMPLE_USERS: UserRecord[] = [
  {
    id: "usr-cevonne-admin",
    name: "Cevonne Admin",
    email: "admin@cevonne.com",
    phone: "+91 98100 00001",
    city: "Mumbai",
    role: "admin",
    status: "active",
    orders: 0,
    totalSpent: 0,
    joinedAt: "2025-12-05T00:00:00+05:30",
    lastActiveAt: "Today",
    notes: "Brand owner account",
    recentOrders: [],
  },
  {
    id: "usr-meera-joshi",
    name: "Meera Joshi",
    email: "meera@cevonne.com",
    phone: "+91 98100 00002",
    city: "New Delhi",
    role: "admin",
    status: "active",
    orders: 0,
    totalSpent: 0,
    joinedAt: "2025-12-08T00:00:00+05:30",
    lastActiveAt: "Yesterday",
    notes: "Operations admin",
    recentOrders: [],
  },
  {
    id: "usr-aniket-thakur",
    name: "Aniket Thakur",
    email: "aniketthakur@gmail.com",
    phone: "+91 98765 43210",
    city: "New Delhi",
    role: "customer",
    status: "active",
    orders: 2,
    totalSpent: 2896,
    joinedAt: "2026-05-09T00:00:00+05:30",
    lastActiveAt: "2026-05-09T00:00:00+05:30",
    notes: "High engagement customer",
    recentOrders: [
      {
        id: "ord-1048",
        number: "CV-1048",
        total: 1448,
        status: "SHIPPED",
        createdAt: "2026-05-09T00:00:00+05:30",
      },
      {
        id: "ord-1047",
        number: "CV-1047",
        total: 1448,
        status: "DELIVERED",
        createdAt: "2026-05-05T00:00:00+05:30",
      },
    ],
  },
  {
    id: "usr-aniket",
    name: "Aniket",
    email: "anikett331@gmail.com",
    phone: "+91 98765 43211",
    city: "New Delhi",
    role: "customer",
    status: "active",
    orders: 3,
    totalSpent: 447,
    joinedAt: "2025-12-11T00:00:00+05:30",
    lastActiveAt: "2025-12-11T00:00:00+05:30",
    notes: "Repeat checkout customer",
    recentOrders: [
      {
        id: "ord-1046",
        number: "CV-1046",
        total: 149,
        status: "SHIPPED",
        createdAt: "2025-12-11T00:00:00+05:30",
      },
    ],
  },
  {
    id: "usr-demo-customer",
    name: "Demo Customer",
    email: "customer@example.com",
    phone: "+91 98100 00003",
    city: "Jaipur",
    role: "customer",
    status: "invited",
    orders: 0,
    totalSpent: 0,
    joinedAt: "2025-12-12T00:00:00+05:30",
    lastActiveAt: "Never",
    notes: "Invite pending verification",
    recentOrders: [],
  },
  {
    id: "usr-nandini-roy",
    name: "Nandini Roy",
    email: "nandini@brandmail.com",
    phone: "+91 98100 00004",
    city: "Kolkata",
    role: "customer",
    status: "active",
    orders: 1,
    totalSpent: 780,
    joinedAt: "2026-06-02T00:00:00+05:30",
    lastActiveAt: "2026-06-11T00:00:00+05:30",
    notes: "Recently purchased Glass Luxe",
    recentOrders: [
      {
        id: "ord-2050",
        number: "CV-2050",
        total: 780,
        status: "PAID",
        createdAt: "2026-06-11T00:00:00+05:30",
      },
    ],
  },
  {
    id: "usr-sara-ali",
    name: "Sara Ali",
    email: "sara@beautyatelier.com",
    phone: "+91 98100 00005",
    city: "Bengaluru",
    role: "customer",
    status: "active",
    orders: 2,
    totalSpent: 1560,
    joinedAt: "2026-06-07T00:00:00+05:30",
    lastActiveAt: "2026-06-12T00:00:00+05:30",
    notes: "Regular lipstick buyer",
    recentOrders: [
      {
        id: "ord-2051",
        number: "CV-2051",
        total: 780,
        status: "DELIVERED",
        createdAt: "2026-06-12T00:00:00+05:30",
      },
    ],
  },
  {
    id: "usr-aanya-jain",
    name: "Aanya Jain",
    email: "aanya@studioflux.com",
    phone: "+91 98100 00006",
    city: "Pune",
    role: "customer",
    status: "suspended",
    orders: 0,
    totalSpent: 0,
    joinedAt: "2025-11-21T00:00:00+05:30",
    lastActiveAt: "2025-12-10T00:00:00+05:30",
    notes: "Suspended after failed verification",
    recentOrders: [],
  },
  {
    id: "usr-priya-sharma",
    name: "Priya Sharma",
    email: "priya@glossmail.com",
    phone: "+91 98100 00007",
    city: "Chennai",
    role: "customer",
    status: "blocked",
    orders: 0,
    totalSpent: 0,
    joinedAt: "2025-10-18T00:00:00+05:30",
    lastActiveAt: "2025-10-20T00:00:00+05:30",
    notes: "Blocked account review pending",
    recentOrders: [],
  },
  {
    id: "usr-riya-kapoor",
    name: "Riya Kapoor",
    email: "riya@pinklane.co",
    phone: "+91 98100 00008",
    city: "Ahmedabad",
    role: "customer",
    status: "active",
    orders: 1,
    totalSpent: 980,
    joinedAt: "2026-06-11T00:00:00+05:30",
    lastActiveAt: "2026-06-13T00:00:00+05:30",
    notes: "Latest sign-up",
    recentOrders: [
      {
        id: "ord-2052",
        number: "CV-2052",
        total: 980,
        status: "PENDING",
        createdAt: "2026-06-13T00:00:00+05:30",
      },
    ],
  },
];

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

function formatLastActive(value?: string | Date | null) {
  if (!value) return "Never";
  if (typeof value === "string" && ["Never", "Today", "Yesterday"].includes(value)) {
    return value;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
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

function normalizeRole(value: unknown): UserRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "admin" || role === "manager" || role === "customer" || role === "support") {
    return role;
  }
  if (role === "administrator") return "admin";
  return "customer";
}

function getCreatedAtValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? new Date(0).getTime() : date.getTime();
}

function deriveStatus(role: UserRole, orders: number, joinedAt: string): UserStatus {
  if (role === "admin") return "active";
  if (orders > 0) return "active";
  const daysSinceJoined = Math.floor((Date.now() - getCreatedAtValue(joinedAt)) / (1000 * 60 * 60 * 24));
  if (daysSinceJoined <= 14) return "invited";
  if (daysSinceJoined <= 60) return "suspended";
  return "blocked";
}

function matchesUserOrder(order: DashboardOrder, userId: string, email: string) {
  const orderEmail = String(order.customer?.email ?? order.shipping?.email ?? "").trim().toLowerCase();
  return String(order.userId ?? "") === userId || orderEmail === email;
}

function normalizeUsers(liveUsers: DashboardUser[] | null | undefined, liveOrders: DashboardOrder[] | null | undefined) {
  const orders = Array.isArray(liveOrders) ? [...liveOrders] : [];
  const records = Array.isArray(liveUsers)
    ? liveUsers.map((user, index) => {
        const id = String(user.id || `user-${index}`);
        const name = String(user.name || user.email.split("@")[0] || "Unnamed user");
        const email = String(user.email || `user-${index}@cevonne.com`);
        const joinedAt = String(user.createdAt || new Date().toISOString());
        const role = normalizeRole(user.role);
        const matchingOrders = orders
          .filter((order) => matchesUserOrder(order, id, email.toLowerCase()))
          .sort((a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt));
        const totalSpent = matchingOrders.reduce((sum, order) => sum + (Number(order.totals?.total) || 0), 0);
        const latestOrder = matchingOrders[0];
        const recentOrders = matchingOrders.slice(0, 3).map((order) => ({
          id: order.id,
          number: order.number || order.id,
          total: Number(order.totals?.total) || 0,
          status: normalizeOrderStatus(order.status),
          createdAt: String(order.createdAt || joinedAt),
        }));

        return {
          id,
          name,
          email,
          phone: latestOrder?.shipping?.phone || undefined,
          city: latestOrder?.shipping?.city || undefined,
          role,
          status: deriveStatus(role, matchingOrders.length, joinedAt),
          orders: matchingOrders.length,
          totalSpent,
          joinedAt,
          lastActiveAt: latestOrder?.createdAt ? String(latestOrder.createdAt) : "Never",
          avatarUrl: undefined,
          notes: matchingOrders.length
            ? "Connected to live orders"
            : role === "admin"
              ? "Brand admin account"
              : "No order history yet",
          recentOrders,
        } satisfies UserRecord;
      })
    : [];

  if (records.length >= 10) {
    return records;
  }

  const existingEmails = new Set(records.map((record) => record.email.toLowerCase()));
  const fillers = SAMPLE_USERS.filter((user) => !existingEmails.has(user.email.toLowerCase()));
  const needed = Math.max(10 - records.length, 0);

  return [...records, ...fillers.slice(0, needed)];
}

function buildUsersSearchIndex(user: UserRecord) {
  return [
    user.name,
    user.email,
    user.phone,
    user.city,
    user.role,
    user.status,
    user.orders,
    user.totalSpent,
    formatDate(user.joinedAt),
    formatLastActive(user.lastActiveAt),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortUsers(users: UserRecord[], sortBy: UserSort) {
  const list = [...users];

  switch (sortBy) {
    case "oldest":
      return list.sort((a, b) => getCreatedAtValue(a.joinedAt) - getCreatedAtValue(b.joinedAt));
    case "highest_spend":
      return list.sort((a, b) => b.totalSpent - a.totalSpent || getCreatedAtValue(b.joinedAt) - getCreatedAtValue(a.joinedAt));
    case "most_orders":
      return list.sort((a, b) => b.orders - a.orders || b.totalSpent - a.totalSpent);
    case "newest":
    default:
      return list.sort((a, b) => getCreatedAtValue(b.joinedAt) - getCreatedAtValue(a.joinedAt));
  }
}

function filterUsers(users: UserRecord[], query: string, roleFilter: UserRoleFilter, statusFilter: UserStatusFilter, sortBy: UserSort) {
  const search = query.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const matchesSearch = !search || buildUsersSearchIndex(user).includes(search);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return sortUsers(filtered, sortBy);
}

function getUserExportRows(rows: UserRecord[]) {
  return [
    ["Name", "Email", "Phone", "City", "Role", "Status", "Orders", "Total Spent", "Joined", "Last Active", "Notes"],
    ...rows.map((user) => [
      user.name,
      user.email,
      user.phone || "",
      user.city || "",
      ROLE_META[user.role].label,
      STATUS_META[user.status].label,
      `${user.orders}`,
      `${user.totalSpent}`,
      formatDate(user.joinedAt),
      formatLastActive(user.lastActiveAt),
      user.notes || "",
    ]),
  ];
}

function downloadUsersCsv(rows: UserRecord[], filename: string) {
  if (!rows.length) {
    toast.error("No users to export.");
    return;
  }

  const csv = getUserExportRows(rows)
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function UserRoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const meta = ROLE_META[role];

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        meta.className,
        className
      )}
    >
      {meta.label}
    </Badge>
  );
}

function UserStatusBadge({ status, className }: { status: UserStatus; className?: string }) {
  const meta = STATUS_META[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        meta.className,
        className
      )}
    >
      {meta.label}
    </Badge>
  );
}

function getOrderStatusMeta(status: string) {
  switch (normalizeOrderStatus(status)) {
    case "PAID":
      return { label: "Paid", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "PENDING":
      return { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "PROCESSING":
      return { label: "Processing", className: "border-violet-200 bg-violet-50 text-violet-700" };
    case "SHIPPED":
      return { label: "Shipped", className: "border-sky-200 bg-sky-50 text-sky-700" };
    case "OUT_FOR_DELIVERY":
      return { label: "Out for delivery", className: "border-indigo-200 bg-indigo-50 text-indigo-700" };
    case "DELIVERED":
      return { label: "Delivered", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    default:
      return { label: normalizeOrderStatus(status), className: "border-border/70 bg-muted/30 text-foreground" };
  }
}

function OrderStatusBadge({ status }: { status: string }) {
  const meta = getOrderStatusMeta(status);

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

function UserStatCard({ label, value, helper, trend, icon: Icon, accentClass, iconClass }: StatCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md gap-0">
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
          <ArrowUpRight className="size-3.5" />
          {trend}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
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

function ToolbarSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto_auto]">
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="px-6 pb-6 pt-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid min-w-[1080px] grid-cols-[48px_300px_130px_130px_100px_140px_140px_140px_80px] items-center gap-4 rounded-2xl border border-border/60 bg-white p-4 shadow-sm"
          >
            <Skeleton className="size-4 rounded-sm" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="size-9 justify-self-end rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UserActionsMenu({
  user,
  onView,
  onEdit,
  onViewOrders,
  onChangeRole,
  onInvite,
  onResetPassword,
  onSuspend,
  onDelete,
}: {
  user: UserRecord;
  onView: (user: UserRecord) => void;
  onEdit: (user: UserRecord) => void;
  onViewOrders: (user: UserRecord) => void;
  onChangeRole: (user: UserRecord) => void;
  onInvite: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onSuspend: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-full border-border/70 bg-white shadow-none hover:bg-[#fbf7f4]"
          aria-label={`Open actions for ${user.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl border-border/60 bg-white shadow-lg">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          User actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onView(user)}>
          <Eye className="size-4" />
          View user
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(user)}>
          <Pencil className="size-4" />
          Edit user
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onViewOrders(user)}>
          <ShoppingBag className="size-4" />
          View orders
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChangeRole(user)}>
          <UserCog className="size-4" />
          Change role
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInvite(user)}>
          <Mail className="size-4" />
          Send invite
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onResetPassword(user)}>
          <LockKeyhole className="size-4" />
          Reset password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSuspend(user)}>
          <UserX className="size-4" />
          Suspend user
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
          <Trash2 className="size-4" />
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({
  user,
  selected,
  onSelectChange,
  onView,
  onEdit,
  onViewOrders,
  onChangeRole,
  onInvite,
  onResetPassword,
  onSuspend,
  onDelete,
}: {
  user: UserRecord;
  selected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
  onView: (user: UserRecord) => void;
  onEdit: (user: UserRecord) => void;
  onViewOrders: (user: UserRecord) => void;
  onChangeRole: (user: UserRecord) => void;
  onInvite: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onSuspend: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}) {
  const initials = initialsFrom(user.name);

  return (
    <TableRow className="group hover:bg-primary/5">
      <TableCell className="px-4 py-4 align-middle">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectChange(user.id, value === true)}
          aria-label={`Select ${user.name}`}
        />
      </TableCell>
      <TableCell className="px-4 py-4 align-middle">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={() => onView(user)}
        >
          <Avatar className="size-11 rounded-2xl border border-border/60 bg-[#fbf7f4]">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback className="rounded-2xl bg-[#fbf7f4] text-xs font-semibold text-[#4b0d4b]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.city || user.phone || "—"}</p>
          </div>
        </button>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <UserRoleBadge role={user.role} />
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <UserStatusBadge status={user.status} />
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm font-semibold text-foreground">{numberFormatter.format(user.orders)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm font-semibold text-foreground">{formatCurrency(user.totalSpent)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm text-muted-foreground">{formatDate(user.joinedAt)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap">
        <span className="text-sm text-muted-foreground">{formatLastActive(user.lastActiveAt)}</span>
      </TableCell>
      <TableCell className="px-4 py-4 align-middle whitespace-nowrap text-right">
        <UserActionsMenu
          user={user}
          onView={onView}
          onEdit={onEdit}
          onViewOrders={onViewOrders}
          onChangeRole={onChangeRole}
          onInvite={onInvite}
          onResetPassword={onResetPassword}
          onSuspend={onSuspend}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

function UserMobileCard({
  user,
  selected,
  onSelectChange,
  onView,
  onEdit,
  onViewOrders,
  onChangeRole,
  onInvite,
  onResetPassword,
  onSuspend,
  onDelete,
}: {
  user: UserRecord;
  selected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
  onView: (user: UserRecord) => void;
  onEdit: (user: UserRecord) => void;
  onViewOrders: (user: UserRecord) => void;
  onChangeRole: (user: UserRecord) => void;
  onInvite: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onSuspend: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}) {
  const initials = initialsFrom(user.name);

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectChange(user.id, value === true)}
          aria-label={`Select ${user.name}`}
        />
        <Avatar className="size-11 rounded-2xl border border-border/60 bg-[#fbf7f4]">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback className="rounded-2xl bg-[#fbf7f4] text-xs font-semibold text-[#4b0d4b]">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 text-left" onClick={() => onView(user)}>
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.city || user.phone || "—"}</p>
            </button>
            <UserActionsMenu
              user={user}
              onView={onView}
              onEdit={onEdit}
              onViewOrders={onViewOrders}
              onChangeRole={onChangeRole}
              onInvite={onInvite}
              onResetPassword={onResetPassword}
              onSuspend={onSuspend}
              onDelete={onDelete}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UserRoleBadge role={user.role} />
            <UserStatusBadge status={user.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <p className="uppercase tracking-[0.24em]">Orders</p>
              <p className="mt-1 font-medium text-foreground">{numberFormatter.format(user.orders)}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Spent</p>
              <p className="mt-1 font-medium text-foreground">{formatCurrency(user.totalSpent)}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Joined</p>
              <p className="mt-1 font-medium text-foreground">{formatDate(user.joinedAt)}</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.24em]">Active</p>
              <p className="mt-1 font-medium text-foreground">{formatLastActive(user.lastActiveAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <Badge
          variant="outline"
          className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {user.orders} orders
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-full border-border/70 bg-white px-3 shadow-none"
          onClick={() => onViewOrders(user)}
        >
          View orders
        </Button>
      </div>
    </div>
  );
}

function AddUserModal({
  open,
  mode,
  user,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  mode: "add" | "invite" | "edit";
  user: UserRecord | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: UserFormValues) => void;
}) {
  const [form, setForm] = useState<UserFormValues>({
    name: "",
    email: "",
    phone: "",
    city: "",
    role: "customer",
    status: "active",
    note: "",
  });

  useEffect(() => {
    if (!open) return;

    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        city: user.city || "",
        role: user.role,
        status: user.status,
        note: user.notes || "",
      });
      return;
    }

    setForm({
      name: "",
      email: "",
      phone: "",
      city: "",
      role: "customer",
      status: mode === "invite" ? "invited" : "active",
      note: "",
    });
  }, [mode, open, user]);

  const title = mode === "invite" ? "Invite user" : mode === "edit" ? "Edit user" : "Add user";
  const description =
    mode === "invite"
      ? "Prepare an invite for a customer or teammate."
      : mode === "edit"
        ? "Update account details, role, or account status."
        : "Create a customer or admin account for Cevonne.";
  const submitLabel = mode === "invite" ? "Send invite" : mode === "edit" ? "Save changes" : "Save user";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Enter the user's name and email.");
      return;
    }

    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[28px] border-border/60 bg-background p-0 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-6 p-6">
            <DialogHeader className="space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                CEVONNE ADMIN
              </p>
              <DialogTitle className="font-serif text-3xl leading-none tracking-tight text-primary">
                {title}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="user-name">Full name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="user-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Aniket Thakur"
                      className="h-11 rounded-full border-border/70 bg-white shadow-none"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-email">Email address</FieldLabel>
                  <FieldContent>
                    <Input
                      id="user-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="aniketthakur@gmail.com"
                      className="h-11 rounded-full border-border/70 bg-white shadow-none"
                    />
                  </FieldContent>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="user-phone">Phone number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="user-phone"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="+91 98765 43210"
                      className="h-11 rounded-full border-border/70 bg-white shadow-none"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-city">City</FieldLabel>
                  <FieldContent>
                    <Input
                      id="user-city"
                      value={form.city}
                      onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                      placeholder="New Delhi"
                      className="h-11 rounded-full border-border/70 bg-white shadow-none"
                    />
                  </FieldContent>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <FieldContent>
                    <Select
                      value={form.role}
                      onValueChange={(value) => setForm((current) => ({ ...current, role: value as UserRole }))}
                    >
                      <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white shadow-none">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <FieldContent>
                    <Select
                      value={form.status}
                      onValueChange={(value) => setForm((current) => ({ ...current, status: value as UserStatus }))}
                    >
                      <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white shadow-none">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="user-note">Optional note</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="user-note"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="VIP customer, invite pending, or internal note."
                    className="min-h-28 rounded-3xl border-border/70 bg-white shadow-none"
                  />
                  <FieldDescription>Keep short internal notes for the admin team.</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-[#3a083a]">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleChangeDialog({
  open,
  role,
  count,
  onOpenChange,
  onRoleChange,
  onApply,
}: {
  open: boolean;
  role: UserRole;
  count: number;
  onOpenChange: (open: boolean) => void;
  onRoleChange: (role: UserRole) => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[28px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="space-y-6 p-6">
          <DialogHeader className="space-y-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              CEVONNE ADMIN
            </p>
            <DialogTitle className="font-serif text-3xl leading-none tracking-tight text-primary">
              Change role
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Apply a new role to {numberFormatter.format(count)} selected user{count === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <FieldContent>
                <Select value={role} onValueChange={(value) => onRoleChange(value as UserRole)}>
                  <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white shadow-none">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-[#3a083a]" onClick={onApply}>
            Apply role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmUserActionDialog({
  open,
  action,
  count,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  action: UserAction;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const isDelete = action === "delete";
  const title = isDelete
    ? `Delete ${count} user${count === 1 ? "" : "s"}?`
    : `Suspend ${count} user${count === 1 ? "" : "s"}?`;
  const description = isDelete
    ? "This will remove the selected account(s) from the current dashboard view."
    : "This will mark the selected account(s) as suspended in the dashboard.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[28px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="space-y-6 p-6">
          <AlertDialogHeader className="space-y-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              CEVONNE ADMIN
            </p>
            <AlertDialogTitle className="font-serif text-2xl leading-none tracking-tight text-primary">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
          <AlertDialogCancel className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "h-11 rounded-full px-5",
              isDelete
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-amber-600 text-white hover:bg-amber-700"
            )}
            onClick={onConfirm}
          >
            {isDelete ? "Delete" : "Suspend"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UsersToolbar({
  selectedCount,
  searchQuery,
  roleFilter,
  statusFilter,
  sortBy,
  activeFilterCount,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onSortChange,
  onResetFilters,
  onRefresh,
  onExport,
  onBulkExport,
  onClearSelection,
  onBulkChangeRole,
  onBulkSendEmail,
  onBulkSuspend,
  onBulkDelete,
}: {
  selectedCount: number;
  searchQuery: string;
  roleFilter: UserRoleFilter;
  statusFilter: UserStatusFilter;
  sortBy: UserSort;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: UserRoleFilter) => void;
  onStatusFilterChange: (value: UserStatusFilter) => void;
  onSortChange: (value: UserSort) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onBulkExport: () => void;
  onClearSelection: () => void;
  onBulkChangeRole: () => void;
  onBulkSendEmail: () => void;
  onBulkSuspend: () => void;
  onBulkDelete: () => void;
}) {
  if (selectedCount > 0) {
    return (
      <div className="flex h-11 w-full items-center justify-between gap-3 overflow-x-auto">
        <div className="flex h-11 items-center gap-4 shrink-0">
          <Badge
            variant="outline"
            className="flex h-9 items-center rounded-full border-border/70 bg-muted/20 px-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
          >
            {numberFormatter.format(selectedCount)} selected
          </Badge>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-3 text-primary hover:bg-primary/5"
            onClick={onClearSelection}
          >
            Clear selection
          </Button>
        </div>

        <div className="flex h-11 items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-border/70 bg-white px-4 shadow-sm"
            onClick={onBulkExport}
          >
            <Download />
            Export selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-border/70 bg-white px-4 shadow-sm"
            onClick={onBulkChangeRole}
          >
            <UserCog />
            Change role
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-border/70 bg-white px-4 shadow-sm"
            onClick={onBulkSendEmail}
          >
            <Mail />
            Send email
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={onBulkSuspend}
          >
            <UserX />
            Suspend selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-red-200 text-red-600 hover:bg-red-50"
            onClick={onBulkDelete}
          >
            <Trash2 />
            Delete selected
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto_auto]">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, email, phone, or city"
          className="h-11 min-h-11 rounded-full border-border/70 bg-white pl-10 shadow-none focus-visible:ring-primary/20"
        />
      </div>

      <Select value={roleFilter} onValueChange={(value) => onRoleFilterChange(value as UserRoleFilter)}>
        <SelectTrigger className="h-11 min-h-11 w-full rounded-full border-border/70 bg-white px-4 text-sm shadow-none [&>span]:truncate">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          {ROLE_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as UserStatusFilter)}>
        <SelectTrigger className="h-11 min-h-11 w-full rounded-full border-border/70 bg-white px-4 text-sm shadow-none [&>span]:truncate">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(value) => onSortChange(value as UserSort)}>
        <SelectTrigger className="h-11 min-h-11 w-full rounded-full border-border/70 bg-white px-4 text-sm shadow-none [&>span]:truncate">
          <SelectValue placeholder="Newest first" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
        onClick={onResetFilters}
      >
        Reset
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
        onClick={onRefresh}
      >
        <RefreshCcw />
        Refresh
      </Button>
    </div>
  );
}

function UsersTable({
  users,
  selectedIds,
  onSelectChange,
  onToggleAllVisible,
  onView,
  onEdit,
  onViewOrders,
  onChangeRole,
  onInvite,
  onResetPassword,
  onSuspend,
  onDelete,
}: {
  users: UserRecord[];
  selectedIds: string[];
  onSelectChange: (id: string, selected: boolean) => void;
  onToggleAllVisible: (selected: boolean) => void;
  onView: (user: UserRecord) => void;
  onEdit: (user: UserRecord) => void;
  onViewOrders: (user: UserRecord) => void;
  onChangeRole: (user: UserRecord) => void;
  onInvite: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onSuspend: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = users.length > 0 && users.every((user) => selectedSet.has(user.id));
  const someSelected = users.some((user) => selectedSet.has(user.id)) && !allSelected;

  return (
    <>
      <div className="grid gap-3 px-4 pb-4 pt-4 sm:grid-cols-2 lg:hidden xl:px-6 xl:pb-6">
        {users.map((user) => (
          <UserMobileCard
            key={user.id}
            user={user}
            selected={selectedSet.has(user.id)}
            onSelectChange={onSelectChange}
            onView={onView}
            onEdit={onEdit}
            onViewOrders={onViewOrders}
            onChangeRole={onChangeRole}
            onInvite={onInvite}
            onResetPassword={onResetPassword}
            onSuspend={onSuspend}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden w-full overflow-x-auto px-6 pb-6 pt-4 lg:block">
        <Table className="min-w-[1080px] table-fixed">
          <colgroup>
            <col className="w-[48px]" />
            <col className="w-[300px]" />
            <col className="w-[130px]" />
            <col className="w-[130px]" />
            <col className="w-[100px]" />
            <col className="w-[140px]" />
            <col className="w-[140px]" />
            <col className="w-[140px]" />
            <col className="w-[80px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(value) => onToggleAllVisible(value === true)}
                  aria-label="Select all users"
                />
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                User
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Role
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Orders
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Total spent
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Joined
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Last active
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                selected={selectedSet.has(user.id)}
                onSelectChange={onSelectChange}
                onView={onView}
                onEdit={onEdit}
                onViewOrders={onViewOrders}
                onChangeRole={onChangeRole}
                onInvite={onInvite}
                onResetPassword={onResetPassword}
                onSuspend={onSuspend}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function UserDetailsSheet({
  open,
  user,
  onOpenChange,
  onEdit,
  onViewOrders,
}: {
  open: boolean;
  user: UserRecord | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (user: UserRecord) => void;
  onViewOrders: (user: UserRecord) => void;
}) {
  const initials = user ? initialsFrom(user.name) : "CV";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex h-full flex-col">
          <div className="space-y-6 p-6">
            <SheetHeader className="space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                CEVONNE ADMIN
              </p>
              <SheetTitle className="font-serif text-3xl leading-none tracking-tight text-primary">
                {user?.name || "User details"}
              </SheetTitle>
              <SheetDescription className="max-w-xl text-sm text-muted-foreground">
                Review account information, contact details, and recent order activity.
              </SheetDescription>
            </SheetHeader>

            {user ? (
              <>
                <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-14 rounded-2xl border border-border/60 bg-[#fbf7f4]">
                      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                      <AvatarFallback className="rounded-2xl bg-[#fbf7f4] text-sm font-semibold text-[#4b0d4b]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">{user.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                      <p className="truncate text-sm text-muted-foreground">{user.city || user.phone || "—"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <UserRoleBadge role={user.role} />
                    <UserStatusBadge status={user.status} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Orders</p>
                      <p className="font-serif text-3xl leading-none tracking-tight text-primary">
                        {numberFormatter.format(user.orders)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Total spent</p>
                      <p className="font-serif text-3xl leading-none tracking-tight text-primary">
                        {formatCurrency(user.totalSpent)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Joined</p>
                      <p className="font-serif text-3xl leading-none tracking-tight text-primary">{formatDate(user.joinedAt)}</p>
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-2 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Last active</p>
                      <p className="font-serif text-3xl leading-none tracking-tight text-primary">
                        {formatLastActive(user.lastActiveAt)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-3 p-5">
                      <p className="text-sm font-semibold text-foreground">Contact</p>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Email: {user.email}</p>
                        <p>Phone: {user.phone || "—"}</p>
                        <p>City: {user.city || "—"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                    <CardContent className="space-y-3 p-5">
                      <p className="text-sm font-semibold text-foreground">Account note</p>
                      <p className="text-sm leading-6 text-muted-foreground">{user.notes || "No notes available."}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden rounded-2xl border-border/60 bg-white shadow-sm gap-0">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 py-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-semibold tracking-tight text-primary">Recent orders</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        Recent order activity linked to this account.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-full border-border/70 bg-white px-4 shadow-sm"
                      onClick={() => onViewOrders(user)}
                    >
                      <ShoppingBag />
                      View orders
                    </Button>
                  </CardHeader>
                  <Separator className="bg-border/70" />
                  <CardContent className="space-y-3 p-5">
                    {user.recentOrders.length ? (
                      user.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{order.number}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <OrderStatusBadge status={order.status} />
                            <Badge
                              variant="outline"
                              className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                            >
                              {formatCurrency(order.total)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                        No recent orders for this account.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <div className="mt-auto border-t border-border/60 bg-muted/10 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm"
                onClick={() => {
                  if (user) onEdit(user);
                }}
              >
                <Pencil />
                Edit user
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function UsersErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm gap-0">
      <CardContent className="space-y-4 p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
          <UserX className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Unable to load users</p>
          <p className="text-sm text-muted-foreground">Refresh the page or try again in a moment.</p>
        </div>
        <Button type="button" className="h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-[#3a083a]" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function UsersEmptyState({ onAddUser }: { onAddUser: () => void }) {
  return (
    <div className="px-6 pb-6 pt-4">
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-primary shadow-sm">
          <Users className="size-5" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">No users yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add customers or invite team members to start managing Cevonne accounts.
        </p>
        <div className="mt-5">
          <Button type="button" className="h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-[#3a083a]" onClick={onAddUser}>
            <Plus />
            Add user
          </Button>
        </div>
      </div>
    </div>
  );
}

function UsersNoResultsState({ onResetFilters }: { onResetFilters: () => void }) {
  return (
    <div className="px-6 pb-6 pt-4">
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
        <p className="text-lg font-semibold text-foreground">No users found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a different search, role, status, or sort order.
        </p>
        <div className="mt-5">
          <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-5 shadow-sm" onClick={onResetFilters}>
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { authFetch, isAdmin } = useAuth();
  const request = authFetch ?? defaultRequest;
  const { users: liveUsers, orders, loading, error, refresh } = useDashboardData(true, request, isAdmin);
  const navigate = useNavigate();

  const [records, setRecords] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [sortBy, setSortBy] = useState<UserSort>("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailsUser, setDetailsUser] = useState<UserRecord | null>(null);
  const [userDialog, setUserDialog] = useState<AddUserDialogState>({
    open: false,
    mode: "add",
    user: null,
  });
  const [roleDialog, setRoleDialog] = useState<UserRoleDialogState>({
    open: false,
    ids: [],
    role: "customer",
  });
  const [pendingAction, setPendingAction] = useState<UserActionTarget | null>(null);

  const liveRows = useMemo(
    () => normalizeUsers((Array.isArray(liveUsers) ? liveUsers : []) as DashboardUser[], (Array.isArray(orders) ? orders : []) as DashboardOrder[]),
    [liveUsers, orders]
  );

  useEffect(() => {
    setRecords(liveRows);
  }, [liveRows]);

  useEffect(() => {
    const handler = () => refresh?.();
    window.addEventListener("dashboard:data:refresh", handler);
    return () => window.removeEventListener("dashboard:data:refresh", handler);
  }, [refresh]);

  useEffect(() => {
    const validIds = new Set(liveRows.map((user) => user.id));
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [liveRows]);

  useEffect(() => {
    if (!detailsUser) return;

    const refreshed = records.find((user) => user.id === detailsUser.id);
    if (!refreshed) {
      setDetailsUser(null);
      return;
    }

    if (refreshed !== detailsUser) {
      setDetailsUser(refreshed);
    }
  }, [detailsUser, records]);

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  const filteredUsers = useMemo(
    () => filterUsers(records, deferredSearch, roleFilter, statusFilter, sortBy),
    [deferredSearch, records, roleFilter, sortBy, statusFilter]
  );

  const shownCount = filteredUsers.length;
  const totalUsers = records.length;
  const customerCount = records.filter((user) => user.role === "customer").length;
  const adminCount = records.filter((user) => user.role === "admin" || user.role === "manager" || user.role === "support").length;
  const newThisMonth = records.filter((user) => {
    const joined = new Date(user.joinedAt);
    const now = new Date();
    return joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
  }).length;

  const activeFilterCount = [
    searchQuery.trim() ? 1 : 0,
    roleFilter !== "all" ? 1 : 0,
    statusFilter !== "all" ? 1 : 0,
    sortBy !== "newest" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUsers = useMemo(() => records.filter((user) => selectedSet.has(user.id)), [records, selectedSet]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const updateUsers = useCallback((updater: (current: UserRecord[]) => UserRecord[]) => {
    setRecords((current) => updater(current));
  }, []);

  const handleRefresh = useCallback(() => {
    clearSelection();
    refresh?.();
    toast.success("Users refreshed");
  }, [clearSelection, refresh]);

  const handleExport = useCallback(() => {
    downloadUsersCsv(filteredUsers, `cevonne-users-${Date.now()}.csv`);
    toast.success("Users export downloaded");
  }, [filteredUsers]);

  const handleBulkExport = useCallback(() => {
    if (!selectedUsers.length) {
      toast.error("Select users to export.");
      return;
    }

    downloadUsersCsv(selectedUsers, `cevonne-users-selected-${Date.now()}.csv`);
    toast.success("Selected users export downloaded");
  }, [selectedUsers]);

  const handleSelectChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds((current) => {
      if (selected) {
        if (current.includes(id)) return current;
        return [...current, id];
      }
      return current.filter((value) => value !== id);
    });
  }, []);

  const handleToggleVisibleSelection = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds((current) => current.filter((id) => !filteredUsers.some((user) => user.id === id)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      filteredUsers.forEach((user) => next.add(user.id));
      return Array.from(next);
    });
  }, [filteredUsers]);

  const openUserDetails = useCallback((user: UserRecord) => {
    setDetailsUser(user);
  }, []);

  const openAddUser = useCallback((mode: AddUserDialogState["mode"], user: UserRecord | null = null) => {
    setUserDialog({ open: true, mode, user });
  }, []);

  const openRoleDialog = useCallback((ids: string[], role: UserRole) => {
    setRoleDialog({ open: true, ids, role });
  }, []);

  const openSingleRoleDialog = useCallback((user: UserRecord) => {
    openRoleDialog([user.id], user.role);
  }, [openRoleDialog]);

  const openSuspendConfirm = useCallback((ids: string[]) => {
    setPendingAction({ action: "suspend", ids });
  }, []);

  const openDeleteConfirm = useCallback((ids: string[]) => {
    setPendingAction({ action: "delete", ids });
  }, []);

  const handleViewOrders = useCallback((user: UserRecord) => {
    navigate("/dashboard/orders");
    toast.success(`Opened orders for ${user.name}`);
  }, [navigate]);

  const handleInviteUser = useCallback((user: UserRecord) => {
    updateUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              status: "invited",
              lastActiveAt: "Never",
            }
          : item
      )
    );
    toast.success(`Invite prepared for ${user.name}`);
  }, [updateUsers]);

  const handleResetPassword = useCallback((user: UserRecord) => {
    toast.success(`Password reset email prepared for ${user.name}`);
  }, []);

  const handleSingleSuspend = useCallback((user: UserRecord) => {
    setPendingAction({ action: "suspend", ids: [user.id] });
  }, []);

  const handleSingleDelete = useCallback((user: UserRecord) => {
    setPendingAction({ action: "delete", ids: [user.id] });
  }, []);

  const handleApplyRole = useCallback(() => {
    if (!roleDialog.ids.length) return;

    updateUsers((current) =>
      current.map((user) => (roleDialog.ids.includes(user.id) ? { ...user, role: roleDialog.role } : user))
    );
    setSelectedIds((current) => current.filter((id) => !roleDialog.ids.includes(id)));
    toast.success(`Updated ${numberFormatter.format(roleDialog.ids.length)} user role${roleDialog.ids.length === 1 ? "" : "s"}`);
    setRoleDialog({ open: false, ids: [], role: "customer" });
  }, [roleDialog.ids, roleDialog.role, updateUsers]);

  const handleConfirmPendingAction = useCallback(() => {
    if (!pendingAction) return;

    if (pendingAction.action === "suspend") {
      updateUsers((current) =>
        current.map((user) => (pendingAction.ids.includes(user.id) ? { ...user, status: "suspended" } : user))
      );
      toast.success(`Suspended ${numberFormatter.format(pendingAction.ids.length)} user${pendingAction.ids.length === 1 ? "" : "s"}`);
    } else {
      updateUsers((current) => current.filter((user) => !pendingAction.ids.includes(user.id)));
      setSelectedIds((current) => current.filter((id) => !pendingAction.ids.includes(id)));
      toast.success(`Deleted ${numberFormatter.format(pendingAction.ids.length)} user${pendingAction.ids.length === 1 ? "" : "s"}`);
    }

    setPendingAction(null);
  }, [pendingAction, updateUsers]);

  const handleSaveUser = useCallback(
    (values: UserFormValues) => {
      if (userDialog.mode === "edit" && userDialog.user) {
        updateUsers((current) =>
          current.map((item) =>
            item.id === userDialog.user?.id
              ? {
                  ...item,
                  name: values.name.trim(),
                  email: values.email.trim(),
                  phone: values.phone.trim() || undefined,
                  city: values.city.trim() || undefined,
                  role: values.role,
                  status: values.status,
                  notes: values.note.trim() || undefined,
                }
              : item
          )
        );
        toast.success("User updated");
        setUserDialog({ open: false, mode: "add", user: null });
        return;
      }

      const now = new Date().toISOString();
      const newUser: UserRecord = {
        id: `usr-${Date.now().toString(36)}`,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        city: values.city.trim() || undefined,
        role: values.role,
        status: values.status,
        orders: 0,
        totalSpent: 0,
        joinedAt: now,
        lastActiveAt: values.status === "invited" ? "Never" : now,
        notes: values.note.trim() || undefined,
        recentOrders: [],
      };

      updateUsers((current) => [newUser, ...current]);
      toast.success(userDialog.mode === "invite" ? "Invite sent" : "User created");
      setUserDialog({ open: false, mode: "add", user: null });
    },
    [updateUsers, userDialog.mode, userDialog.user]
  );

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    toast.success("Filters cleared");
  }, []);

  const metricCards = [
    {
      label: "Total Users",
      value: numberFormatter.format(totalUsers),
      helper: "Customers and admins",
      trend: "Account base",
      icon: Users,
      accentClass: "bg-primary",
      iconClass: "bg-primary/10 text-primary",
    },
    {
      label: "Customers",
      value: numberFormatter.format(customerCount),
      helper: "Storefront customer accounts",
      trend: "Audience growth",
      icon: UserRound,
      accentClass: "bg-rose-300",
      iconClass: "bg-rose-100 text-rose-700",
    },
    {
      label: "Admins",
      value: numberFormatter.format(adminCount),
      helper: "Team members with admin access",
      trend: "Team control",
      icon: ShieldCheck,
      accentClass: "bg-sky-300",
      iconClass: "bg-sky-100 text-sky-700",
    },
    {
      label: "New This Month",
      value: numberFormatter.format(newThisMonth),
      helper: "Recently joined users",
      trend: "Fresh accounts",
      icon: UserPlus,
      accentClass: "bg-amber-300",
      iconClass: "bg-amber-100 text-amber-700",
    },
  ] satisfies StatCardProps[];

  const toolbarProps = {
    selectedCount: selectedIds.length,
    searchQuery,
    roleFilter,
    statusFilter,
    sortBy,
    activeFilterCount,
    onSearchChange: setSearchQuery,
    onRoleFilterChange: setRoleFilter,
    onStatusFilterChange: setStatusFilter,
    onSortChange: setSortBy,
    onResetFilters: handleResetFilters,
    onRefresh: handleRefresh,
    onExport: handleExport,
    onBulkExport: handleBulkExport,
    onClearSelection: clearSelection,
    onBulkChangeRole: () => openRoleDialog(selectedIds, selectedUsers[0]?.role || "customer"),
    onBulkSendEmail: () => toast.success(`Prepared email draft for ${selectedIds.length} user${selectedIds.length === 1 ? "" : "s"}`),
    onBulkSuspend: () => openSuspendConfirm(selectedIds),
    onBulkDelete: () => openDeleteConfirm(selectedIds),
  };

  const selectedCountForRole = roleDialog.ids.length;

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#f8f3ef] text-foreground">
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
                          Users
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Manage customers, admins, roles, and account activity.
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
                          onClick={() => openAddUser("invite")}
                        >
                          <UserPlus />
                          Invite user
                        </Button>

                        <Button
                          type="button"
                          className="h-11 rounded-full bg-primary px-5 text-primary-foreground shadow-none hover:bg-[#3a083a]"
                          onClick={() => openAddUser("add")}
                        >
                          <Plus />
                          Add user
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
                    : metricCards.map((card) => <UserStatCard key={card.label} {...card} />)}
                </div>

                {error ? (
                  <UsersErrorState onRetry={handleRefresh} />
                ) : (
                  <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm gap-0">
                    <CardHeader className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle className="font-serif text-2xl font-semibold tracking-tight text-primary">
                            All users
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="rounded-full border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                          >
                            {numberFormatter.format(shownCount)} shown
                          </Badge>
                        </div>
                        <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                          Search, filter, and manage customer and admin accounts.
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {numberFormatter.format(activeFilterCount)} active filters
                      </Badge>
                    </CardHeader>

                    <Separator className="bg-border/70" />

                    <CardContent className="p-0">
                      <div className="px-6 py-4">
                        {loading ? <ToolbarSkeleton /> : <UsersToolbar {...toolbarProps} />}
                      </div>

                      <Separator className="bg-border/70" />

                      {loading ? (
                        <UsersTableSkeleton />
                      ) : filteredUsers.length ? (
                        <UsersTable
                          users={filteredUsers}
                          selectedIds={selectedIds}
                          onSelectChange={handleSelectChange}
                          onToggleAllVisible={handleToggleVisibleSelection}
                          onView={openUserDetails}
                          onEdit={(user) => openAddUser("edit", user)}
                          onViewOrders={handleViewOrders}
                          onChangeRole={openSingleRoleDialog}
                          onInvite={handleInviteUser}
                          onResetPassword={handleResetPassword}
                          onSuspend={handleSingleSuspend}
                          onDelete={handleSingleDelete}
                        />
                      ) : records.length ? (
                        <UsersNoResultsState onResetFilters={handleResetFilters} />
                      ) : (
                        <UsersEmptyState onAddUser={() => openAddUser("add")} />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>

      <AddUserModal
        open={userDialog.open}
        mode={userDialog.mode}
        user={userDialog.user}
        onOpenChange={(open) => setUserDialog((current) => ({ ...current, open }))}
        onSave={handleSaveUser}
      />

      <RoleChangeDialog
        open={roleDialog.open}
        role={roleDialog.role}
        count={selectedCountForRole}
        onOpenChange={(open) => setRoleDialog((current) => ({ ...current, open }))}
        onRoleChange={(role) => setRoleDialog((current) => ({ ...current, role }))}
        onApply={handleApplyRole}
      />

      <ConfirmUserActionDialog
        open={Boolean(pendingAction)}
        action={pendingAction?.action || "delete"}
        count={pendingAction?.ids.length || 0}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirm={handleConfirmPendingAction}
      />

      <UserDetailsSheet
        open={Boolean(detailsUser)}
        user={detailsUser}
        onOpenChange={(open) => {
          if (!open) setDetailsUser(null);
        }}
        onEdit={(user) => {
          setDetailsUser(null);
          openAddUser("edit", user);
        }}
        onViewOrders={handleViewOrders}
      />
    </SidebarProvider>
  );
}
