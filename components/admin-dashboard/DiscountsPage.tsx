"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Archive,
  BadgePercent,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Image as ImageIcon,
  ChevronDown,
  Check,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/api";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import {
  type AdminDiscountRecord,
  type DiscountAction,
  type DiscountAppliesToType,
  type DiscountFormValues,
  type DiscountProofStatus,
  type DiscountProofStatusDetail,
  type DiscountStatus,
  type DiscountSummary,
  type DiscountType,
  discountFormDefaults,
  discountFormSchema,
  formatDiscountDateTime,
  formatDiscountDateTimeInputValue,
  formatDiscountProofMessage,
  formatDiscountUsage,
  formatDiscountValue,
  getDiscountAppliesToLabel,
  getDiscountProofStatusLabel,
  getDiscountProofStatusToneClass,
  getDiscountStatusLabel,
  getDiscountStatusToneClass,
  getDiscountTypeLabel,
  buildDiscountAppliesToLabel,
  isDiscountProofAttentionRequired,
  isAllProductsAppliesToType,
  type DiscountProofSummary,
} from "@/lib/admin/discounts";
import type { Product } from "@/types/product";

type DiscountsApiResponse = {
  items: AdminDiscountRecord[];
  summary: DiscountSummary;
};

type DiscountMutationResponse = {
  item: AdminDiscountRecord;
  message?: string;
};

type AdminRequest = (url: string, options?: RequestInit & { silent?: boolean }) => Promise<Response>;

type DiscountProofResponse = {
  status: "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "PARTIALLY_VERIFIED";
  message: string;
  handledAt: string;
  proofScope?: ProofScopeSelection;
  summary?: DiscountProofSummary | null;
  items?: CollectionProofItemResult[] | null;
  blockedReasons?: CollectionBlockedReason[] | null;
  item?: AdminDiscountRecord | null;
};

type ProofProductOption = {
  product_name: string;
  sku: string;
  variant_name: string;
  stock_available: number | null;
  product_status: string;
  variant_status: string;
};

type CollectionProofItemResult = ProofProductOption & {
  discount_status: DiscountStatus;
  proof_status: DiscountProofStatus;
  g7_result: "PASS" | "BLOCK" | "NEEDS_EVIDENCE";
  reason: string;
  failure_reasons: string[];
};

type CollectionBlockedReason = {
  reason: string;
  count: number;
};

const buildSavedProofRunResult = (discount: AdminDiscountRecord | null): ProofRunResult | null => {
  if (!discount || !discount.g7LastCheckedAt) {
    return null;
  }

  const summary: DiscountProofSummary = {
    verified: Math.max(0, discount.g7VerifiedCount ?? 0),
    needsEvidence: Math.max(0, discount.g7NeedsEvidenceCount ?? 0),
    blocked: Math.max(0, discount.g7BlockedCount ?? 0),
    total:
      Math.max(0, discount.g7VerifiedCount ?? 0) +
      Math.max(0, discount.g7NeedsEvidenceCount ?? 0) +
      Math.max(0, discount.g7BlockedCount ?? 0),
  };
  const items = Array.isArray(discount.g7LastItems) ? discount.g7LastItems : [];
  const blockedReasons = items
    .filter((item) => item.proof_status === "BLOCKED")
    .reduce<Map<string, number>>((counts, item) => {
      counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

  return {
    status: discount.proofStatus,
    message: discount.proofMessage ?? formatDiscountProofMessage(discount.proofStatus),
    checkedAt: discount.proofCheckedAt,
    summary,
    items,
    blockedReasons: [...blockedReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
  };
};

type ProofRunResult = DiscountProofStatusDetail & {
  summary?: DiscountProofSummary | null;
  items?: CollectionProofItemResult[] | null;
  blockedReasons?: CollectionBlockedReason[] | null;
};

type ProofScopeSelection = "ALL_PRODUCTS" | "ONE_PRODUCT";

type FormMode = "create" | "edit";
type StatusFilter = "all" | DiscountStatus;
type DangerAction = Extract<DiscountAction, "EXPIRE" | "ARCHIVE">;

const defaultRequest: AdminRequest = (url, options) => fetch(url, options);
const ADMIN_DISCOUNTS_ROUTE = `${API_BASE}/admin/discounts`;
const STATUS_FILTER_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Archived", value: "ARCHIVED" },
];
const FORM_STATUS_OPTIONS: Array<{ label: string; value: Exclude<DiscountStatus, "ARCHIVED"> }> = [
  { label: "Draft", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
  { label: "Expired", value: "EXPIRED" },
];
const DISCOUNT_TYPE_OPTIONS: Array<{ label: string; value: DiscountType }> = [
  { label: "Percentage", value: "PERCENTAGE" },
  { label: "Fixed amount", value: "FIXED_AMOUNT" },
  { label: "Free shipping", value: "FREE_SHIPPING" },
];
const APPLIES_TO_OPTIONS: Array<{ label: string; value: DiscountAppliesToType }> = [
  { label: "All products", value: "ALL_PRODUCTS" },
  { label: "Specific product", value: "SPECIFIC_PRODUCT" },
  { label: "Specific collection", value: "SPECIFIC_COLLECTION" },
];

const numberFormatter = new Intl.NumberFormat("en-IN");

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.clone().text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const normalizeProofScopeSelection = (value: string | null | undefined): ProofScopeSelection => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ONE_PRODUCT" || normalized === "COLLECTION_PRODUCT" || normalized === "PRODUCT") {
    return "ONE_PRODUCT";
  }

  return "ALL_PRODUCTS";
};

const readResponseMessage = async (response: Response, fallback: string) => {
  const body = await parseJsonResponse<{ message?: string }>(response);
  if (body?.message?.trim()) {
    return body.message.trim();
  }

  return response.statusText || fallback;
};

const formatFilterCount = (count: number) => numberFormatter.format(count);

const toProofStatus = (_discount: AdminDiscountRecord, response: DiscountProofResponse): DiscountProofStatus => {
  if (response.status === "PASS") {
    return "VERIFIED";
  }

  if (response.status === "PARTIALLY_VERIFIED") {
    return "PARTIALLY_VERIFIED";
  }

  if (response.status === "NEEDS_EVIDENCE") {
    return "NEEDS_EVIDENCE";
  }

  return /expired|archived/i.test(response.message) ? "EXPIRED" : "BLOCKED";
};

const mapProofResponseToDetail = (discount: AdminDiscountRecord, response: DiscountProofResponse): DiscountProofStatusDetail => ({
  status: toProofStatus(discount, response),
  message: response.message,
  checkedAt: response.handledAt,
});

const getDiscountSurfaceClass = (status: DiscountStatus) => {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200/80 bg-emerald-50/60";
    case "SCHEDULED":
      return "border-sky-200/80 bg-sky-50/60";
    case "PAUSED":
      return "border-amber-200/80 bg-amber-50/60";
    case "EXPIRED":
      return "border-slate-200/80 bg-slate-100/80";
    case "ARCHIVED":
      return "border-rose-200/80 bg-rose-50/60";
    case "DRAFT":
    default:
      return "border-border/70 bg-muted/20";
  }
};

const getProofSurfaceClass = (status: DiscountProofStatus) => {
  switch (status) {
    case "VERIFIED":
      return "border-emerald-200/80 bg-emerald-50/70";
    case "PARTIALLY_VERIFIED":
      return "border-amber-200/80 bg-amber-50/70";
    case "NEEDS_EVIDENCE":
      return "border-amber-200/80 bg-amber-50/70";
    case "BLOCKED":
      return "border-rose-200/80 bg-rose-50/70";
    case "EXPIRED":
      return "border-slate-200/80 bg-slate-100/80";
    case "NOT_CHECKED":
    default:
      return "border-border/70 bg-muted/20";
  }
};

const isVerifiedProofStatus = (status: DiscountProofStatus) => status === "VERIFIED";

const getProofActionLabel = (status: DiscountProofStatus) => (isVerifiedProofStatus(status) ? "Re-check Proof" : "Check Proof");

const getProofStatusBadgeClass = (status: DiscountProofStatus) =>
  cn("rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide", getDiscountProofStatusToneClass(status));

const getStatusBadgeClass = (status: DiscountStatus) =>
  cn("rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide", getDiscountStatusToneClass(status));

const discountFormToValues = (discount?: AdminDiscountRecord | null): DiscountFormValues => ({
  code: discount?.code ?? discountFormDefaults.code,
  discountType: discount?.discountType ?? discountFormDefaults.discountType,
  discountValue: discount?.discountValue === null || discount?.discountValue === undefined ? "" : String(discount.discountValue),
  appliesToType: discount?.appliesToType ?? discountFormDefaults.appliesToType,
  productId: discount?.productId ?? "",
  sku: discount?.sku ?? "",
  collectionId: discount?.collectionId ?? "",
  startsAt: formatDiscountDateTimeInputValue(discount?.startsAt),
  endsAt: formatDiscountDateTimeInputValue(discount?.endsAt),
  status: discount?.status === "ARCHIVED" ? "DRAFT" : discount?.status ?? discountFormDefaults.status,
  usageLimitTotal: discount?.usageLimitTotal === null || discount?.usageLimitTotal === undefined ? "" : String(discount.usageLimitTotal),
  usageLimitPerCustomer:
    discount?.usageLimitPerCustomer === null || discount?.usageLimitPerCustomer === undefined ? "" : String(discount.usageLimitPerCustomer),
  minimumOrderValue: discount?.minimumOrderValue === null || discount?.minimumOrderValue === undefined ? "" : String(discount.minimumOrderValue),
  notes: discount?.notes ?? "",
});

const buildSelectedProof = (
  discount: AdminDiscountRecord,
  override?: DiscountProofStatusDetail | null,
): DiscountProofStatusDetail => {
  if (override) {
    return override;
  }

  return {
    status: discount.proofStatus,
    message: discount.proofMessage ?? formatDiscountProofMessage(discount.proofStatus),
    checkedAt: discount.proofCheckedAt,
  };
};

type ProductPickerOption = {
  id: string;
  label: string;
  subtitle: string;
  searchValue: string;
  disabled: boolean;
};

const getProductProofSku = (product: Product) => {
  const shades = Array.isArray(product.shades) ? product.shades : [];

  for (const shade of shades) {
    const sku = normalizeProofText(shade?.sku ?? null);
    if (sku) {
      return sku;
    }
  }

  const fallbackSku = normalizeProofText(product.slug);
  return fallbackSku || null;
};

const buildProductPickerOptions = (products: Product[]): ProductPickerOption[] =>
  products.map((product) => {
    const label = normalizeProofText(product.name) || normalizeProofText(product.slug) || product.id;
    const proofSku = getProductProofSku(product);
    const activeSkuCount = Array.isArray(product.shades)
      ? product.shades.reduce((count, shade) => count + (normalizeProofText(shade?.sku ?? null) ? 1 : 0), 0)
      : 0;

    return {
      id: product.id,
      label,
      subtitle:
        activeSkuCount > 0
          ? `${activeSkuCount} active SKU${activeSkuCount === 1 ? "" : "s"}`
          : proofSku
            ? `Fallback SKU: ${proofSku}`
            : "No active SKU",
      searchValue: [product.id, label, product.slug, proofSku, activeSkuCount].filter(Boolean).join(" ").toLowerCase(),
      disabled: !proofSku,
    };
  });

type ProofTargetOption = {
  sku: string;
  label: string;
  details: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  shadeName: string | null;
  collectionId: string | null;
  collectionName: string | null;
};

const normalizeProofText = (value: string | null | undefined) => value?.trim() ?? "";

const matchesDiscountScope = (discount: AdminDiscountRecord, product: Product) => {
  const discountProductKeys = [discount.productId, discount.productName, discount.productSlug]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const discountCollectionKeys = [discount.collectionId, discount.collectionName, discount.collectionSlug]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (discount.appliesToType === "SPECIFIC_PRODUCT") {
    const productKeys = [product.id, product.name, product.slug].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    return discountProductKeys.some((key) => productKeys.includes(key));
  }

  if (discount.appliesToType === "SPECIFIC_COLLECTION") {
    const collection = product.collection;
    const collectionKeys = [product.collectionId, collection?.id, collection?.name, collection?.slug]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return discountCollectionKeys.some((key) => collectionKeys.includes(key));
  }

  return true;
};

const buildProofTargetOptions = (discount: AdminDiscountRecord, products: Product[]) => {
  const seen = new Set<string>();
  const options: ProofTargetOption[] = [];

  for (const product of products) {
    if (!matchesDiscountScope(discount, product)) {
      continue;
    }

    const collectionName = product.collection?.name ?? discount.collectionName ?? null;
    const shades = Array.isArray(product.shades) ? product.shades : [];

    for (const shade of shades) {
      const sku = normalizeProofText(shade?.sku ?? null);
      if (!sku) {
        continue;
      }

      const normalizedSku = sku.toLowerCase();
      if (seen.has(normalizedSku)) {
        continue;
      }

      seen.add(normalizedSku);
      const shadeName = normalizeProofText(shade?.name ?? null) || "Variant";
      const details = collectionName ? `Collection: ${collectionName}` : "";

      options.push({
        sku,
        label: `${product.name} — ${shadeName} / ${sku}`,
        details,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug ?? null,
        shadeName,
        collectionId: product.collectionId ?? null,
        collectionName,
      });
    }
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
};

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accentClass,
  iconClass,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  accentClass: string;
  iconClass: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm", accentClass)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <span className={cn("flex size-10 items-center justify-center rounded-2xl border", iconClass)}>
            <Icon className="size-4" />
          </span>
        </div>
        <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function EmptyStateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm">
      <CardContent className="space-y-4 p-6 md:p-8">
        <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/15 p-6 text-sm leading-6 text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">{title}</p>
            <p>{description}</p>
          </div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <>
      <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm">
        <CardContent className="space-y-4 p-6 md:p-8">
          <Skeleton className="h-5 w-44 rounded-full" />
          <Skeleton className="h-12 w-3/5 rounded-[20px]" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`discount-metric-skeleton-${index}`} className="h-28 rounded-[24px]" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-10 w-full rounded-full" />
            <Skeleton className="h-64 rounded-[24px]" />
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-28 rounded-[22px]" />
            <Skeleton className="h-20 rounded-[22px]" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function renderFieldError(message?: string | null) {
  if (!message) {
    return null;
  }

  return <FieldError>{message}</FieldError>;
}

function DiscountStatusBadge({ status }: { status: DiscountStatus }) {
  return <Badge variant="outline" className={getStatusBadgeClass(status)}>{getDiscountStatusLabel(status)}</Badge>;
}

function DiscountProofBadge({ status }: { status: DiscountProofStatus }) {
  return <Badge variant="outline" className={getProofStatusBadgeClass(status)}>{getDiscountProofStatusLabel(status)}</Badge>;
}

function DiscountRowActions({
  discount,
  busyAction,
  onEdit,
  onCheckProof,
  onStatusAction,
  onDangerAction,
}: {
  discount: AdminDiscountRecord;
  busyAction: { id: string; kind: string } | null;
  onEdit: (discount: AdminDiscountRecord) => void;
  onCheckProof: (discount: AdminDiscountRecord) => void;
  onStatusAction: (discount: AdminDiscountRecord, action: DiscountAction) => void;
  onDangerAction: (discount: AdminDiscountRecord, action: DangerAction) => void;
}) {
  const isBusy = busyAction?.id === discount.discountId;
  const isArchived = discount.status === "ARCHIVED";
  const canActivate = !["ACTIVE", "ARCHIVED", "EXPIRED"].includes(discount.status);
  const canPause = ["ACTIVE", "SCHEDULED"].includes(discount.status);
  const canExpire = !["ARCHIVED", "EXPIRED"].includes(discount.status);
  const canArchive = discount.status !== "ARCHIVED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-full border border-border/50 bg-white text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={`Open actions for ${discount.code}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-[20px] border-border/70 bg-white shadow-xl">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Actions
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={isBusy || isArchived}
          onSelect={() => {
            if (!isArchived) {
              onEdit(discount);
            }
          }}
        >
          <PencilLine className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy}
          onSelect={() => {
            onCheckProof(discount);
          }}
        >
          <ShieldCheck className="mr-2 size-4" />
          {getProofActionLabel(discount.proofStatus)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isBusy || !canPause}
          onSelect={() => {
            if (canPause) {
              onStatusAction(discount, "PAUSE");
            }
          }}
        >
          <Pause className="mr-2 size-4" />
          Pause
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy || !canActivate}
          onSelect={() => {
            if (canActivate) {
              onStatusAction(discount, "ACTIVATE");
            }
          }}
        >
          <Play className="mr-2 size-4" />
          Activate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy || !canExpire}
          onSelect={() => {
            if (canExpire) {
              onDangerAction(discount, "EXPIRE");
            }
          }}
        >
          <Clock3 className="mr-2 size-4" />
          Expire
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isBusy || !canArchive}
          className="text-rose-600 focus:text-rose-600"
          onSelect={() => {
            if (canArchive) {
              onDangerAction(discount, "ARCHIVE");
            }
          }}
        >
          <Archive className="mr-2 size-4" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DiscountTableRow({
  discount,
  selected,
  busyAction,
  onSelect,
  onEdit,
  onCheckProof,
  onStatusAction,
  onDangerAction,
}: {
  discount: AdminDiscountRecord;
  selected: boolean;
  busyAction: { id: string; kind: string } | null;
  onSelect: (discount: AdminDiscountRecord) => void;
  onEdit: (discount: AdminDiscountRecord) => void;
  onCheckProof: (discount: AdminDiscountRecord) => void;
  onStatusAction: (discount: AdminDiscountRecord, action: DiscountAction) => void;
  onDangerAction: (discount: AdminDiscountRecord, action: DangerAction) => void;
}) {
  return (
    <TableRow
      role="button"
      tabIndex={0}
      onClick={() => onSelect(discount)}
      onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(discount);
        }
      }}
      className={cn(
        "cursor-pointer border-border/60 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        selected && "bg-amber-50/40",
      )}
    >
      <TableCell className="min-w-[180px] px-5 py-4">
        <div className="space-y-1">
          <p className="font-semibold tracking-wide text-foreground" translate="no">
            {discount.code}
          </p>
        </div>
      </TableCell>
      <TableCell className="px-5 py-4">
        <Badge variant="outline" className="rounded-full border-border/70 bg-muted/20 px-3 py-1 text-[11px] font-semibold">
          {getDiscountTypeLabel(discount.discountType)}
        </Badge>
      </TableCell>
      <TableCell className="px-5 py-4 text-sm text-foreground">{formatDiscountValue(discount.discountValue, discount.discountType)}</TableCell>
      <TableCell className="max-w-[250px] px-5 py-4 text-sm text-muted-foreground">
        <span className="line-clamp-2">{buildDiscountAppliesToLabel(discount)}</span>
      </TableCell>
      <TableCell className="px-5 py-4 text-sm text-muted-foreground">{formatDiscountDateTime(discount.startsAt)}</TableCell>
      <TableCell className="px-5 py-4 text-sm text-muted-foreground">{formatDiscountDateTime(discount.endsAt)}</TableCell>
      <TableCell className="px-5 py-4">
        <DiscountStatusBadge status={discount.status} />
      </TableCell>
      <TableCell className="px-5 py-4 text-sm text-muted-foreground">{formatDiscountUsage(discount.usedCount, discount.usageLimitTotal)}</TableCell>
      <TableCell className="px-5 py-4">
        <DiscountProofBadge status={discount.proofStatus} />
      </TableCell>
      <TableCell className="px-5 py-4">
        <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-full border border-border/60 bg-white px-3 text-xs font-medium shadow-none"
            onClick={() => onEdit(discount)}
            disabled={discount.status === "ARCHIVED"}
          >
            <PencilLine className="mr-2 size-3.5" />
            Edit
          </Button>
          <DiscountRowActions
            discount={discount}
            busyAction={busyAction}
            onEdit={onEdit}
            onCheckProof={onCheckProof}
            onStatusAction={onStatusAction}
            onDangerAction={onDangerAction}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileDiscountCard({
  discount,
  selected,
  busyAction,
  onSelect,
  onEdit,
  onCheckProof,
  onStatusAction,
  onDangerAction,
}: {
  discount: AdminDiscountRecord;
  selected: boolean;
  busyAction: { id: string; kind: string } | null;
  onSelect: (discount: AdminDiscountRecord) => void;
  onEdit: (discount: AdminDiscountRecord) => void;
  onCheckProof: (discount: AdminDiscountRecord) => void;
  onStatusAction: (discount: AdminDiscountRecord, action: DiscountAction) => void;
  onDangerAction: (discount: AdminDiscountRecord, action: DangerAction) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(discount)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(discount);
        }
      }}
      className={cn(
        "w-full rounded-[24px] border border-border/70 bg-white/90 p-4 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        selected && "border-amber-300 bg-amber-50/50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold tracking-wide text-foreground" translate="no">
            {discount.code}
          </p>
          <p className="text-xs text-muted-foreground">{buildDiscountAppliesToLabel(discount)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DiscountStatusBadge status={discount.status} />
          <DiscountProofBadge status={discount.proofStatus} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Type</p>
          <p className="mt-1 text-foreground">{getDiscountTypeLabel(discount.discountType)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Value</p>
          <p className="mt-1 text-foreground">{formatDiscountValue(discount.discountValue, discount.discountType)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</p>
          <p className="mt-1 text-foreground">{formatDiscountDateTime(discount.startsAt)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">End</p>
          <p className="mt-1 text-foreground">{formatDiscountDateTime(discount.endsAt)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{formatDiscountUsage(discount.usedCount, discount.usageLimitTotal)}</span>
        <span>{discount.proofCheckedAt ? `Updated ${formatDiscountDateTime(discount.proofCheckedAt)}` : "Needs proof"}</span>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-full border-border/70 bg-white px-3 text-xs font-medium"
          onClick={() => onEdit(discount)}
          disabled={discount.status === "ARCHIVED"}
        >
          <PencilLine className="mr-2 size-3.5" />
          Edit
        </Button>
        <DiscountRowActions
          discount={discount}
          busyAction={busyAction}
          onEdit={onEdit}
          onCheckProof={onCheckProof}
          onStatusAction={onStatusAction}
          onDangerAction={onDangerAction}
        />
      </div>
    </div>
  );
}

function DiscountDetailsCard({
  discount,
  busyAction,
  onEdit,
  onCheckProof,
  onStatusAction,
  onDangerAction,
}: {
  discount: AdminDiscountRecord | null;
  busyAction: { id: string; kind: string } | null;
  onEdit: (discount: AdminDiscountRecord) => void;
  onCheckProof: (discount: AdminDiscountRecord) => void;
  onStatusAction: (discount: AdminDiscountRecord, action: DiscountAction) => void;
  onDangerAction: (discount: AdminDiscountRecord, action: DangerAction) => void;
}) {
  if (!discount) {
    return (
      <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm xl:sticky xl:top-6">
        <CardContent className="space-y-4 p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Selected discount</p>
          <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
            Select a discount to review its schedule, target, and proof status.
          </div>
        </CardContent>
      </Card>
    );
  }

  const proof = buildSelectedProof(discount, null);
  const proofTone = getProofSurfaceClass(proof.status);
  const proofHelper =
    proof.status === "VERIFIED"
      ? discount.appliesToType === "SPECIFIC_COLLECTION"
        ? "This collection discount is verified for every product in the collection."
        : null
      : proof.status === "PARTIALLY_VERIFIED"
        ? discount.appliesToType === "SPECIFIC_COLLECTION"
          ? "Some products in this collection still need proof before the discount can be used everywhere."
          : "Some products are still unverified. Check the remaining targets before using this discount broadly."
        : null;
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(discount.code);
      toast.success("Discount code copied.");
    } catch {
      toast.error("Could not copy the discount code.");
    }
  };

  return (
    <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm xl:sticky xl:top-6">
      <CardHeader className="space-y-4 border-b border-border/60 bg-muted/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Selected discount</p>
            <div className="space-y-1">
              <CardTitle className="font-serif text-3xl tracking-tight text-primary" translate="no">
                {discount.code}
              </CardTitle>
              <CardDescription className="max-w-md text-sm leading-6 text-muted-foreground">
                {buildDiscountAppliesToLabel(discount)}
              </CardDescription>
            </div>
          </div>
          <span className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-white shadow-sm">
            <BadgePercent className="size-5 text-primary" />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DiscountStatusBadge status={discount.status} />
          <DiscountProofBadge status={proof.status} />
          <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold">
            {getDiscountTypeLabel(discount.discountType)}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full border border-border/60 bg-white px-3 text-[11px] font-semibold text-muted-foreground shadow-none"
            onClick={handleCopyCode}
          >
            <Copy className="mr-2 size-3.5" />
            Copy code
          </Button>
        </div>

        <div className={cn("rounded-[22px] border p-4 text-sm leading-6", proofTone)}>
          <div className="flex items-start gap-3">
            {proof.status === "VERIFIED" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : proof.status === "NEEDS_EVIDENCE" || proof.status === "PARTIALLY_VERIFIED" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-foreground">{proof.message ?? formatDiscountProofMessage(proof.status)}</p>
              {proofHelper ? <p className="text-xs leading-5 text-muted-foreground">{proofHelper}</p> : null}
              <p className="text-xs text-muted-foreground">
                {proof.checkedAt ? `Checked ${formatDiscountDateTime(proof.checkedAt)}` : "Needs proof"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-6 md:p-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={cn("rounded-[22px] border p-4", getDiscountSurfaceClass(discount.status))}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Value</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatDiscountValue(discount.discountValue, discount.discountType)}</p>
          </div>
          <div className={cn("rounded-[22px] border p-4", getDiscountSurfaceClass(discount.status))}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Usage</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatDiscountUsage(discount.usedCount, discount.usageLimitTotal)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-border/60 bg-muted/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start date</p>
            <p className="mt-2 text-sm font-medium text-foreground">{formatDiscountDateTime(discount.startsAt)}</p>
          </div>
          <div className="rounded-[22px] border border-border/60 bg-muted/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">End date</p>
            <p className="mt-2 text-sm font-medium text-foreground">{formatDiscountDateTime(discount.endsAt)}</p>
          </div>
          <div className="rounded-[22px] border border-border/60 bg-muted/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Applies to</p>
            <p className="mt-2 text-sm font-medium text-foreground">{getDiscountAppliesToLabel(discount.appliesToType)}</p>
          </div>
          <div className="rounded-[22px] border border-border/60 bg-muted/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Minimum order</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {discount.minimumOrderValue === null || discount.minimumOrderValue === undefined
                ? "None"
                : formatDiscountValue(discount.minimumOrderValue, "FIXED_AMOUNT")}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-[22px] border border-border/60 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Created</p>
              <p className="mt-2 text-sm text-foreground">{formatDiscountDateTime(discount.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Updated</p>
              <p className="mt-2 text-sm text-foreground">{formatDiscountDateTime(discount.updatedAt)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Created by</p>
              <p className="mt-2 text-sm text-foreground">{discount.createdBy ?? "Admin"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Updated by</p>
              <p className="mt-2 text-sm text-foreground">{discount.updatedBy ?? "Admin"}</p>
            </div>
          </div>
          <Separator className="bg-border/70" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
            <p className="text-sm leading-6 text-foreground text-pretty">
              {discount.notes || "No notes attached to this discount."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 rounded-full px-4"
            onClick={() => onEdit(discount)}
            disabled={discount.status === "ARCHIVED"}
          >
            <PencilLine className="mr-2 size-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-white px-4"
            onClick={() => onCheckProof(discount)}
            disabled={busyAction?.id === discount.discountId && busyAction.kind === "CHECK_PROOF"}
          >
            {busyAction?.id === discount.discountId && busyAction.kind === "CHECK_PROOF" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 size-4" />
            )}
            {getProofActionLabel(discount.proofStatus)}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {discount.status !== "ARCHIVED" && (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-border/70 bg-white px-4"
              onClick={() => onStatusAction(discount, discount.status === "ACTIVE" ? "PAUSE" : "ACTIVATE")}
              disabled={busyAction?.id === discount.discountId}
            >
              {busyAction?.id === discount.discountId ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : discount.status === "ACTIVE" ? (
                <Pause className="mr-2 size-4" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              {discount.status === "ACTIVE" ? "Pause" : "Activate"}
            </Button>
          )}
          {discount.status !== "ARCHIVED" && discount.status !== "EXPIRED" && (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-border/70 bg-white px-4"
              onClick={() => onDangerAction(discount, "EXPIRE")}
              disabled={busyAction?.id === discount.discountId}
            >
              <Clock3 className="mr-2 size-4" />
              Expire
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DiscountFormDialog({
  open,
  mode,
  discount,
  onOpenChange,
  onSubmit,
  submitting,
  products = [],
  collections = [],
}: {
  open: boolean;
  mode: FormMode;
  discount: AdminDiscountRecord | null;
  products?: Product[];
  collections?: any[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DiscountFormValues) => Promise<void> | void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountFormSchema) as any,
    defaultValues: discountFormDefaults,
    mode: "onChange",
  });

  const discountType = watch("discountType");
  const appliesToType = watch("appliesToType");
  const productIdValue = watch("productId");
  const codeRegistration = register("code");
  const productPickerOptions = useMemo(() => buildProductPickerOptions(products), [products]);
  const selectedProductOption = useMemo(
    () => productPickerOptions.find((option) => option.id === productIdValue) ?? null,
    [productIdValue, productPickerOptions],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(discountFormToValues(discount));
  }, [discount, open, reset]);

  useEffect(() => {
    if (!open || discountType !== "FREE_SHIPPING") {
      return;
    }

    setValue("discountValue", "", { shouldDirty: true, shouldValidate: true });
  }, [discountType, open, setValue]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (appliesToType === "ALL_PRODUCTS") {
      setValue("productId", "", { shouldDirty: true, shouldValidate: true });
      setValue("sku", "", { shouldDirty: true, shouldValidate: true });
      setValue("collectionId", "", { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (appliesToType === "SPECIFIC_PRODUCT") {
      setValue("sku", "", { shouldDirty: true, shouldValidate: true });
      setValue("collectionId", "", { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (appliesToType === "SPECIFIC_SKU") {
      setValue("productId", "", { shouldDirty: true, shouldValidate: true });
      setValue("collectionId", "", { shouldDirty: true, shouldValidate: true });
      return;
    }

    setValue("productId", "", { shouldDirty: true, shouldValidate: true });
    setValue("sku", "", { shouldDirty: true, shouldValidate: true });
  }, [appliesToType, open, setValue]);

  useEffect(() => {
    if (!open || mode !== "edit" || appliesToType !== "SPECIFIC_PRODUCT" || productIdValue) {
      return;
    }

    const fallbackName = normalizeProofText(discount?.productName ?? null).toLowerCase();
    const fallbackSlug = normalizeProofText(discount?.productSlug ?? null).toLowerCase();
    if (!fallbackName && !fallbackSlug) {
      return;
    }

    const fallbackProduct = productPickerOptions.find((option) => {
      const searchValue = option.searchValue;
      return (fallbackName && searchValue.includes(fallbackName)) || (fallbackSlug && searchValue.includes(fallbackSlug));
    });

    if (fallbackProduct) {
      setValue("productId", fallbackProduct.id, { shouldDirty: false, shouldValidate: true });
    }
  }, [
    appliesToType,
    discount?.productName,
    discount?.productSlug,
    mode,
    open,
    productIdValue,
    productPickerOptions,
    setValue,
  ]);

  const title = mode === "create" ? "Create discount" : "Edit discount";
  const description =
    mode === "create"
      ? "Set up a new code with timing, usage limits, and a target scope."
      : "Changing discount value, target, dates, or status will require a new proof check.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[min(96vw,1000px)] sm:max-w-[1000px] overflow-hidden rounded-[32px] border-border/70 bg-white p-0 shadow-2xl">
        <form
          onSubmit={handleSubmit(async (values) => onSubmit(values as DiscountFormValues))}
          className="flex max-h-[94vh] flex-col overflow-hidden"
        >
          <div className="border-b border-border/60 bg-muted/20 px-6 py-6 md:px-8 md:py-8">
            <DialogHeader className="space-y-2 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Commerce operations</p>
              <DialogTitle className="font-serif text-3xl leading-none tracking-tight text-primary">{title}</DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto px-6 py-8 md:px-8">
            <div className="space-y-8">
              <FieldGroup className="gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="discount-code">Discount code</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-code"
                        placeholder="SUMMER20"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...codeRegistration}
                        onBlur={(event) => {
                          codeRegistration.onBlur(event);
                          const value = event.target.value.trim().toUpperCase();
                          setValue("code", value, { shouldDirty: true, shouldValidate: true });
                        }}
                      />
                      <FieldDescription>Use a short, memorable code. It will be stored in uppercase.</FieldDescription>
                      {renderFieldError(errors.code?.message)}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <FieldContent>
                      <Controller
                        control={control}
                        name="status"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => field.onChange(value as DiscountFormValues["status"])}
                          >
                            <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white shadow-none">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                              <SelectContent>
                              {FORM_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <FieldDescription>Archived is handled separately through the row actions.</FieldDescription>
                      {renderFieldError(errors.status?.message)}
                    </FieldContent>
                  </Field>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Discount type</FieldLabel>
                  <FieldDescription>Choose how the value should be interpreted.</FieldDescription>
                  <Controller
                    control={control}
                    name="discountType"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) {
                            field.onChange(value as DiscountType);
                          }
                        }}
                        className="grid w-full gap-2 sm:grid-cols-3"
                      >
                        {DISCOUNT_TYPE_OPTIONS.map((option) => (
                          <ToggleGroupItem
                            key={option.value}
                            value={option.value}
                            className="h-11 rounded-full border-border/70 bg-white px-4 text-sm font-medium shadow-none data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
                          >
                            {option.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                  {renderFieldError(errors.discountType?.message)}
                </div>

                {discountType !== "FREE_SHIPPING" ? (
                  <Field>
                    <FieldLabel htmlFor="discount-value">
                      {discountType === "PERCENTAGE" ? "Discount percent" : "Discount value"}
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-value"
                        type="number"
                        min="0"
                        step={discountType === "PERCENTAGE" ? "0.01" : "0.01"}
                        placeholder={discountType === "PERCENTAGE" ? "20" : "499"}
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("discountValue")}
                      />
                      <FieldDescription>
                        {discountType === "PERCENTAGE"
                          ? "Enter a number like 20 for a 20 percent discount."
                          : "Enter a currency amount in INR."}
                      </FieldDescription>
                      {renderFieldError(errors.discountValue?.message)}
                    </FieldContent>
                  </Field>
                ) : (
                  <Alert variant="default" className="rounded-[22px] border-emerald-200 bg-emerald-50/70 text-emerald-950">
                    <CheckCircle2 className="size-4" />
                    <AlertTitle className="text-sm font-semibold">Free shipping discount</AlertTitle>
                    <AlertDescription className="text-sm leading-6">
                      Leave the value blank. The discount is applied as free shipping instead of a number.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <FieldLabel>Applies to</FieldLabel>
                  <FieldDescription>Pick a target scope, then fill in the matching field below.</FieldDescription>
                  <Controller
                    control={control}
                    name="appliesToType"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        size="sm"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) {
                            field.onChange(value as DiscountAppliesToType);
                          }
                        }}
                        className="grid w-full gap-2 sm:grid-cols-3"
                      >
                        {APPLIES_TO_OPTIONS.map((option) => (
                          <ToggleGroupItem
                            key={option.value}
                            value={option.value}
                            className="h-11 rounded-full border border-border/70 bg-white px-4 text-sm font-medium shadow-none hover:bg-muted data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary"
                          >
                            {option.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                  {renderFieldError(errors.appliesToType?.message)}
                </div>

                <div className="mt-4">
                  {appliesToType === "SPECIFIC_PRODUCT" ? (
                    <Field>
                      <FieldLabel>Product</FieldLabel>
                      <FieldContent>
                        <Controller
                          control={control}
                          name="productId"
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="h-10 w-full justify-between rounded-none border border-primary-200 bg-white font-normal hover:bg-primary-50/50"
                                >
                                  {selectedProductOption ? (
                                    <span className="flex min-w-0 flex-col items-start text-left">
                                      <span className="truncate font-medium text-foreground">{selectedProductOption.label}</span>
                                      <span className="truncate text-xs text-muted-foreground">{selectedProductOption.subtitle}</span>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {field.value
                                        ? discount?.productName || discount?.productSlug || field.value
                                        : "Select product"}
                                    </span>
                                  )}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                collisionPadding={16}
                                sideOffset={8}
                                className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
                              >
                                <Command>
                                  <CommandInput placeholder="Search products..." />
                                  <CommandList className="max-h-[320px] overflow-y-auto">
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup>
                                      {productPickerOptions.map((option) => {
                                        return (
                                          <CommandItem
                                            key={option.id}
                                            value={option.searchValue}
                                            disabled={option.disabled}
                                            onSelect={() => {
                                              if (!option.disabled) {
                                                field.onChange(option.id);
                                              }
                                            }}
                                            className="flex items-start gap-3"
                                          >
                                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                              <span className="truncate text-sm font-medium text-foreground">{option.label}</span>
                                              <span className="truncate text-xs text-muted-foreground">{option.subtitle}</span>
                                            </div>
                                            {option.disabled ? (
                                              <Badge variant="secondary" className="rounded-full border-border/70 bg-muted/60 text-muted-foreground">
                                                No active SKU
                                              </Badge>
                                            ) : null}
                                            <Check
                                              className={cn(
                                                "ml-auto h-4 w-4",
                                                field.value === option.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                        <FieldDescription>Choose the catalog product for this discount. Products without an active SKU are disabled.</FieldDescription>
                        {renderFieldError(errors.productId?.message)}
                      </FieldContent>
                    </Field>
                  ) : null}

                  {appliesToType === "SPECIFIC_COLLECTION" ? (
                    <Field>
                      <FieldLabel>Collection</FieldLabel>
                      <FieldContent>
                        <Controller
                          control={control}
                          name="collectionId"
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="h-10 w-full justify-between rounded-none border border-primary-200 bg-white font-normal hover:bg-primary-50/50"
                                >
                                  {field.value
                                    ? collections.find((collection: any) => collection.id === field.value)?.title || collections.find((collection: any) => collection.id === field.value)?.name || collections.find((collection: any) => collection.id === field.value)?.id
                                    : <span className="text-muted-foreground">Select collection</span>}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="p-0" 
                                style={{ width: "var(--radix-popover-trigger-width)" }}
                                align="start"
                              >
                                <Command className="">
                                  <CommandInput className="" placeholder="Search collections..." />
                                  <CommandList>
                                    <CommandEmpty>No collection found.</CommandEmpty>
                                    <CommandGroup>
                                      {collections.map((collection: any) => {
                                        const thumbnail = collection?.image?.url ? encodeURI(collection.image.url) : (collection?.bannerImage?.url ? encodeURI(collection.bannerImage.url) : "");
                                        return (
                                          <CommandItem
                                            key={collection.id}
                                            value={collection.title || collection.name || collection.id}
                                            onSelect={() => {
                                              field.onChange(collection.id);
                                            }}
                                            className="flex items-center gap-3 cursor-pointer"
                                          >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/50">
                                              {thumbnail ? (
                                                <img src={thumbnail} alt={collection.title || collection.name || ""} className="h-full w-full object-cover" />
                                              ) : (
                                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                              )}
                                            </div>
                                            <span className="truncate flex-1">{collection.title || collection.name || collection.id}</span>
                                            <Check
                                              className={cn(
                                                "ml-auto h-4 w-4",
                                                field.value === collection.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                          </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                        <FieldDescription>Choose the catalog collection for this discount.</FieldDescription>
                        {renderFieldError(errors.collectionId?.message)}
                      </FieldContent>
                    </Field>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="discount-starts-at">Start date and time</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-starts-at"
                        type="datetime-local"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("startsAt")}
                      />
                      <FieldDescription>Leave blank for an immediate draft.</FieldDescription>
                      {renderFieldError(errors.startsAt?.message)}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="discount-ends-at">End date and time</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-ends-at"
                        type="datetime-local"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("endsAt")}
                      />
                      <FieldDescription>Add an end date for urgency or scheduled campaigns.</FieldDescription>
                      {renderFieldError(errors.endsAt?.message)}
                    </FieldContent>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="discount-usage-total">Usage limit total</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-usage-total"
                        type="number"
                        min="0"
                        step="1"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("usageLimitTotal")}
                      />
                      <FieldDescription>Leave blank for unlimited usage.</FieldDescription>
                      {renderFieldError(errors.usageLimitTotal?.message)}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="discount-usage-per-customer">Usage per customer</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-usage-per-customer"
                        type="number"
                        min="0"
                        step="1"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("usageLimitPerCustomer")}
                      />
                      <FieldDescription>Optional guardrail for repeat redemptions.</FieldDescription>
                      {renderFieldError(errors.usageLimitPerCustomer?.message)}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="discount-minimum-order">Minimum order value</FieldLabel>
                    <FieldContent>
                      <Input
                        id="discount-minimum-order"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="h-11 rounded-full border-border/70 bg-white shadow-none"
                        {...register("minimumOrderValue")}
                      />
                      <FieldDescription>Optional minimum cart value before the code can be used.</FieldDescription>
                      {renderFieldError(errors.minimumOrderValue?.message)}
                    </FieldContent>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="discount-notes">Notes</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="discount-notes"
                      rows={5}
                      placeholder="Campaign notes, urgency language, stock context, or proof notes."
                      className="min-h-[140px] rounded-[24px] border-border/70 bg-white shadow-none"
                      {...register("notes")}
                    />
                    <FieldDescription>
                      Avoid urgency wording like &quot;ends soon&quot; unless the end date is set. The proof check will flag it.
                    </FieldDescription>
                    {renderFieldError(errors.notes?.message)}
                  </FieldContent>
                </Field>
              </FieldGroup>
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/10 px-6 py-4 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border/70 bg-white px-5"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11 rounded-full px-6" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {submitting ? "Saving..." : mode === "create" ? "Create discount" : "Save changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckProofDialog({
  discount,
  products = [],
  request,
  onOpenChange,
  onRunProof,
}: {
  discount: AdminDiscountRecord | null;
  products?: Product[];
  request: AdminRequest;
  onOpenChange: (open: boolean) => void;
  onRunProof: (
    discount: AdminDiscountRecord,
    payload: {
      sku?: string;
      urgencyClaim?: string;
      secondStockSource?: string;
      secondStockQuantity?: string;
      secondStockEvidenceUrl?: string;
      secondStockCheckedAt?: string;
      proofScope?: ProofScopeSelection;
    },
  ) => Promise<ProofRunResult | null> | void;
}) {
  const [selectedSku, setSelectedSku] = useState("");
  const [proofScope, setProofScope] = useState<ProofScopeSelection>("ALL_PRODUCTS");
  const [proofProducts, setProofProducts] = useState<ProofProductOption[]>([]);
  const [proofProductsLoading, setProofProductsLoading] = useState(false);
  const [proofProductsError, setProofProductsError] = useState<string | null>(null);
  const [proofRunResult, setProofRunResult] = useState<ProofRunResult | null>(null);
  const [urgencyClaim, setUrgencyClaim] = useState("none");
  const [secondStockSource, setSecondStockSource] = useState("");
  const [secondStockQuantity, setSecondStockQuantity] = useState("");
  const [secondStockEvidenceUrl, setSecondStockEvidenceUrl] = useState("");
  const [secondStockCheckedAt, setSecondStockCheckedAt] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [isRunningProof, setIsRunningProof] = useState(false);

  useEffect(() => {
    if (!discount) {
      return;
    }

    setSelectedSku(isAllProductsAppliesToType(discount.appliesToType) || discount.appliesToType === "SPECIFIC_COLLECTION" ? "" : discount.sku ?? discount.g7LastItems?.[0]?.sku ?? "");
    setProofScope(
      isAllProductsAppliesToType(discount.appliesToType) || discount.appliesToType === "SPECIFIC_COLLECTION"
        ? "ALL_PRODUCTS"
        : normalizeProofScopeSelection(discount.g7ProofScope),
    );
    setProofProducts([]);
    setProofProductsError(null);
    setProofProductsLoading(false);
    setProofRunResult(buildSavedProofRunResult(discount));
    setUrgencyClaim("none");
    setSecondStockSource("");
    setSecondStockQuantity("");
    setSecondStockEvidenceUrl("");
    setSecondStockCheckedAt("");
    setTargetError(null);
    setTargetOpen(false);
    setIsRunningProof(false);
  }, [discount]);

  useEffect(() => {
    const usesProofProductList = Boolean(
      discount &&
        (discount.appliesToType === "SPECIFIC_COLLECTION" ||
          discount.appliesToType === "SPECIFIC_PRODUCT" ||
          isAllProductsAppliesToType(discount.appliesToType)),
    );

    if (!usesProofProductList || !discount) {
      setProofProducts([]);
      setProofProductsError(null);
      setProofProductsLoading(false);
      return;
    }

    let cancelled = false;

    const loadProofProducts = async () => {
      setProofProductsLoading(true);
      setProofProductsError(null);

      try {
        const response = await request(buildRouteUrl(`${ADMIN_DISCOUNTS_ROUTE}/${discount.discountId}/proof-products`), {
          cache: "no-store",
          silent: true,
        });
        const body = await parseJsonResponse<ProofProductOption[]>(response);

        if (!response.ok || !Array.isArray(body)) {
          throw new Error("Unable to load proof products.");
        }

        if (!cancelled) {
          setProofProducts(body);
          setProofProductsError(
            body.length
              ? null
              : discount.appliesToType === "SPECIFIC_PRODUCT"
                ? "This product has no active variant/SKU. Add a variant before checking proof."
              : isAllProductsAppliesToType(discount.appliesToType)
                ? "No active products are available in the catalog."
                : "No products are linked to this collection yet. Add products to this collection before checking proof.",
          );
        }
      } catch {
        if (!cancelled) {
          setProofProducts([]);
          setProofProductsError(
            discount.appliesToType === "SPECIFIC_PRODUCT"
              ? "Unable to load product variants right now."
              : isAllProductsAppliesToType(discount.appliesToType)
                ? "Unable to load active products right now."
                : "No products are linked to this collection yet. Add products to this collection before checking proof.",
          );
        }
      } finally {
        if (!cancelled) {
          setProofProductsLoading(false);
        }
      }
    };

    void loadProofProducts();

    return () => {
      cancelled = true;
    };
  }, [discount, request]);

  useEffect(() => {
    setProofRunResult(null);
    setTargetError(null);
  }, [proofScope, selectedSku]);

  const proofTargets = (() => {
    if (!discount) {
      return [];
    }

    if (discount.appliesToType === "SPECIFIC_PRODUCT") {
      return proofProducts.map((option) => ({
        sku: option.sku,
        label: option.variant_name.trim()
          ? `${option.product_name} — ${option.variant_name} / ${option.sku}`
          : `${option.product_name} / ${option.sku}`,
        details:
          option.stock_available === null
            ? "Stock unknown"
            : `Stock ${numberFormatter.format(option.stock_available)}`,
      }));
    }

    if (
      discount.appliesToType === "SPECIFIC_SKU" ||
      discount.appliesToType === "SPECIFIC_COLLECTION" ||
      isAllProductsAppliesToType(discount.appliesToType)
    ) {
      return [];
    }

    return buildProofTargetOptions(discount, products).map((option) => ({
      sku: option.sku,
      label: option.label,
      details: option.details,
    }));
  })();

  function formatCollectionProofLabel(option: ProofProductOption) {
    return option.variant_name.trim()
      ? `${option.product_name} — ${option.variant_name} / ${option.sku}`
      : `${option.product_name} / ${option.sku}`;
  }

  const handleRun = async () => {
    if (isBlockedByExpiry) {
      return;
    }

    if (usesMultiProductProof) {
      if (proofScope === "ONE_PRODUCT" && !targetValue) {
        setTargetError(
          isAllProductsDiscount
            ? "Select a product from this discount before checking proof."
            : "Select a product from this collection before checking proof.",
        );
        return;
      }

      if (proofScope === "ALL_PRODUCTS" && !hasProofProducts) {
        setTargetError(
          isAllProductsDiscount
            ? proofProductsError ?? "No active products are available in the catalog."
            : "No products are linked to this collection yet. Add products to this collection before checking proof.",
        );
        return;
      }

      setTargetError(null);
      setProofRunResult(null);
      setIsRunningProof(true);
      try {
        const result = await Promise.resolve(
          onRunProof(currentDiscount, {
            sku: proofScope === "ONE_PRODUCT" ? targetValue : "",
            proofScope,
            urgencyClaim: urgencyClaim === "none" ? "" : urgencyClaim,
            secondStockSource: needsStockProof ? secondStockSource : undefined,
            secondStockQuantity: needsStockProof ? secondStockQuantity : undefined,
            secondStockEvidenceUrl: needsStockProof ? secondStockEvidenceUrl : undefined,
            secondStockCheckedAt: needsStockProof ? secondStockCheckedAt : undefined,
          }),
        );

        if (result) {
          setProofRunResult(result);
        }
      } finally {
        setIsRunningProof(false);
      }
      return;
    }

    if (requiresTargetSelection && !targetValue) {
      setTargetError("Select a product or SKU before running proof check.");
      return;
    }

    if (requiresTargetSelection && !proofTargets.length && currentDiscount.appliesToType !== "SPECIFIC_SKU") {
      setTargetError(
        currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
          ? "This product has no active variant/SKU. Add a variant before checking proof."
          : "No product or SKU options are available for this discount.",
      );
      return;
    }

    setTargetError(null);
    setProofRunResult(null);
    setIsRunningProof(true);
    try {
      const result = await Promise.resolve(
        onRunProof(currentDiscount, {
          sku: targetValue,
          urgencyClaim: urgencyClaim === "none" ? "" : urgencyClaim,
          secondStockSource: needsStockProof ? secondStockSource : undefined,
          secondStockQuantity: needsStockProof ? secondStockQuantity : undefined,
          secondStockEvidenceUrl: needsStockProof ? secondStockEvidenceUrl : undefined,
          secondStockCheckedAt: needsStockProof ? secondStockCheckedAt : undefined,
        }),
      );

      if (result) {
        setProofRunResult(result);
      }
    } finally {
      setIsRunningProof(false);
    }
  };

  function formatProofStatusLabel(value: string) {
    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  const collectionProofSummaryItems = proofRunResult?.summary
    ? [
        {
          label: "Verified",
          value: proofRunResult.summary.verified,
          cardClasses: "border-emerald-200/70 bg-emerald-50/60",
          valueClass: "text-emerald-700",
        },
        {
          label: "Needs evidence",
          value: proofRunResult.summary.needsEvidence,
          cardClasses: "border-amber-200/70 bg-amber-50/60",
          valueClass: "text-amber-700",
        },
        {
          label: "Blocked",
          value: proofRunResult.summary.blocked,
          cardClasses: "border-rose-200/70 bg-rose-50/60",
          valueClass: "text-rose-700",
        },
      ]
    : [];

  const collectionProofItemsBySku = new Map((proofRunResult?.items ?? []).map((item) => [item.sku.toLowerCase(), item]));

  const collectionBlockedReasonGroups = proofRunResult?.blockedReasons?.length
    ? proofRunResult.blockedReasons
    : (() => {
        const counts = new Map<string, number>();

        for (const item of proofRunResult?.items ?? []) {
          if (item.proof_status !== "BLOCKED") {
            continue;
          }

          counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
        }

        return [...counts.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
      })();

  const formatBlockedReasonCopy = (item: CollectionBlockedReason) => {
    const total = proofRunResult?.summary?.total ?? item.count;
    const appliesToAllProducts = isAllProductsDiscount;
    const scopeLabel = appliesToAllProducts ? "this discount" : "this collection";

    if (item.count === total) {
      if (/product is out of stock/i.test(item.reason)) {
        return appliesToAllProducts
          ? "All active products in this discount are currently out of stock."
          : "All products in this collection are currently out of stock.";
      }

      if (/discount is not linked to this product\/sku/i.test(item.reason)) {
        return "Discount is not linked to these products in Neon.";
      }

      if (/discount is paused/i.test(item.reason)) {
        return "This discount is paused.";
      }

      if (/discount has expired/i.test(item.reason)) {
        return "This discount has expired.";
      }

      if (/discount is not active yet/i.test(item.reason)) {
        return "This discount is not active yet.";
      }
    }

    return `${numberFormatter.format(item.count)} products blocked for ${scopeLabel} because ${item.reason.replace(/\.$/, "")}`;
  };

  if (!discount) return null;

  const currentDiscount = discount;
  const isCollectionDiscount = currentDiscount.appliesToType === "SPECIFIC_COLLECTION";
  const isAllProductsDiscount = isAllProductsAppliesToType(currentDiscount.appliesToType);
  const usesMultiProductProof = isCollectionDiscount || isAllProductsDiscount;
  const hasProofProducts = proofProducts.length > 0;
  const collectionName = currentDiscount.collectionName ?? "";
  const collectionLabel = currentDiscount.collectionName ?? "this collection";
  const proofScopeLabel = isAllProductsDiscount ? "this discount" : collectionLabel;
  const proofRequiresActivation = isAllProductsDiscount && currentDiscount.status !== "ACTIVE";
  const targetValue = usesMultiProductProof
    ? proofScope === "ONE_PRODUCT"
      ? selectedSku.trim()
      : ""
    : selectedSku.trim() || (currentDiscount.appliesToType === "SPECIFIC_SKU" ? currentDiscount.sku?.trim() ?? "" : "");
  const selectedMultiProductTarget = usesMultiProductProof
    ? proofScope === "ONE_PRODUCT"
      ? proofProducts.find((option) => option.sku.toLowerCase() === targetValue.toLowerCase()) ?? null
      : null
    : null;
  const selectedTarget = !usesMultiProductProof
    ? proofTargets.find((option) => option.sku.toLowerCase() === targetValue.toLowerCase()) ?? null
    : selectedMultiProductTarget
      ? {
          sku: selectedMultiProductTarget.sku,
          label: formatCollectionProofLabel(selectedMultiProductTarget),
          details: `Stock ${selectedMultiProductTarget.stock_available === null ? "unknown" : numberFormatter.format(selectedMultiProductTarget.stock_available)}`,
        }
      : null;
  const requiresTargetSelection = usesMultiProductProof ? proofScope === "ONE_PRODUCT" : currentDiscount.appliesToType !== "SPECIFIC_SKU";
  const needsStockProof = urgencyClaim === "Low stock" || urgencyClaim === "Only X left";
  const isTimeBased = urgencyClaim === "Limited time" || urgencyClaim === "Ends soon" || urgencyClaim === "Today only";
  const hasNoEndDate = !currentDiscount.endsAt;
  const isBlockedByExpiry = isTimeBased && hasNoEndDate;
  const targetPlaceholder = usesMultiProductProof
    ? proofScope === "ONE_PRODUCT"
      ? "Select a product / SKU"
      : isAllProductsDiscount
        ? "Check all active products"
        : "All products in collection"
    : currentDiscount.appliesToType === "ALL_PRODUCTS"
      ? "Choose product / SKU"
      : "Select product variant / SKU";
  const targetLabel = usesMultiProductProof
    ? isAllProductsDiscount
      ? "Product or SKU"
      : `Product from ${collectionLabel}`
    : currentDiscount.appliesToType === "ALL_PRODUCTS"
      ? "Product or SKU"
      : "Product variant / SKU";
  const targetDescription = usesMultiProductProof
    ? proofScope === "ONE_PRODUCT"
      ? isAllProductsDiscount
        ? "Choose one active product for this discount's proof check."
        : `Choose one active product from ${proofScopeLabel} for the proof check.`
      : isAllProductsDiscount
        ? "G7 will check every active product/SKU tied to this discount."
        : "G7 will check every active product/SKU in this collection."
    : currentDiscount.appliesToType === "ALL_PRODUCTS"
      ? "Choose the exact product/SKU where this discount will be used."
      : "Choose a product variant/SKU for the proof check.";
  const subtitle = isCollectionDiscount
    ? `This discount applies to all products in ${currentDiscount.collectionName ? `the ${collectionName} collection` : "this collection"}. G7 will check whether it is safe to use.`
    : isAllProductsDiscount
      ? "This discount applies to all active products. Choose whether to check every product or one product only."
      : currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
        ? `This discount applies to ${currentDiscount.productName ?? "the selected product"}. Choose the variant or SKU where you want to use it.`
        : "G7 will check the exact SKU tied to this discount.";
  const dialogTitle = isCollectionDiscount
    ? "Check Collection Discount Proof"
    : isAllProductsDiscount
      ? "Check All Products Discount Proof"
      : "Check Discount Proof";

  return (
    <Dialog open={!!discount} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-6xl sm:max-w-6xl overflow-hidden sm:rounded-[32px] border-black/5 bg-white p-0 shadow-2xl flex flex-col">
        <DialogHeader className="px-8 pt-8 md:px-12 md:pt-10 pb-6 border-b border-black/5 shrink-0">
          <DialogTitle className="text-2xl font-medium tracking-[-0.03em] text-foreground">{dialogTitle}</DialogTitle>
          <DialogDescription className="mt-2 text-base leading-relaxed tracking-[-0.01em] text-muted-foreground">{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 space-y-12">
          {targetError ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-800">
              <AlertTriangle className="size-4 text-rose-600" />
              <AlertTitle>Action required</AlertTitle>
              <AlertDescription>{targetError}</AlertDescription>
            </Alert>
          ) : null}

          {usesMultiProductProof ? (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div className="space-y-10">
                <Field>
                  <FieldLabel htmlFor="proof-scope" className="text-sm font-medium text-foreground">Proof scope</FieldLabel>
                  <FieldContent>
                    <Select value={proofScope} onValueChange={(value) => setProofScope(value as ProofScopeSelection)}>
                      <SelectTrigger id="proof-scope" className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5">
                        <SelectValue placeholder={isAllProductsDiscount ? "Check all active products" : "Check all products in collection"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/70 bg-white/95 backdrop-blur-md">
                        <SelectGroup>
                          <SelectItem value="ALL_PRODUCTS">{isAllProductsDiscount ? "Check all active products" : "Check all products in collection"}</SelectItem>
                          <SelectItem value="ONE_PRODUCT">Check one product only</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>{targetDescription}</FieldDescription>
                  </FieldContent>
                </Field>

                {proofRequiresActivation && hasProofProducts ? (
                  <Alert className="border-amber-200 bg-amber-50 text-amber-950 rounded-2xl">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <AlertTitle>Activate this discount before checking proof.</AlertTitle>
                    <AlertDescription>
                      The active catalog is loaded below, but proof stays disabled until this discount is active.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {proofScope === "ONE_PRODUCT" ? (
                  <Field>
                    <FieldLabel htmlFor="proof-collection-product">
                      {currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
                        ? "Product variant / SKU"
                        : isAllProductsDiscount
                          ? "Product or SKU"
                          : "Product from collection"}
                    </FieldLabel>
                    <FieldContent>
                      <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="h-12 w-full justify-between rounded-2xl border-black/10 bg-white font-normal shadow-sm hover:bg-muted/30 focus:ring-1 focus:ring-black/5"
                          >
                            {selectedTarget ? (
                              <span className="flex min-w-0 flex-col items-start text-left">
                                <span className="truncate font-medium text-foreground">{selectedTarget.label}</span>
                                {selectedTarget.details ? (
                                  <span className="truncate text-xs text-muted-foreground">{selectedTarget.details}</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{targetPlaceholder}</span>
                            )}
                            <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search product or SKU..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {proofProducts.map((option) => {
                                  const optionLabel = formatCollectionProofLabel(option);
                                  const isSelected = option.sku.toLowerCase() === targetValue.toLowerCase();

                                  return (
                                    <CommandItem
                                      key={option.sku}
                                      value={`${optionLabel} ${option.stock_available === null ? "unknown" : option.stock_available}`}
                                      onSelect={() => {
                                        setSelectedSku(option.sku);
                                        setTargetError(null);
                                        setTargetOpen(false);
                                      }}
                                      className="flex items-start gap-3"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{optionLabel}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          Stock {option.stock_available === null ? "unknown" : numberFormatter.format(option.stock_available)}
                                        </p>
                                      </div>
                                      <Check className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </FieldContent>
                  </Field>
                ) : null}

                <div className="space-y-6 pt-4 border-t border-black/5">
                  <div className="flex items-end justify-between">
                    <div>
                      <h3 className="text-lg font-medium tracking-tight text-foreground">{isAllProductsDiscount ? "Products found" : "Products in collection"}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {proofProductsLoading
                          ? "Loading products..."
                          : hasProofProducts
                            ? isAllProductsDiscount
                              ? `${numberFormatter.format(proofProducts.length)} active products will be checked.`
                              : `${numberFormatter.format(proofProducts.length)} active products found`
                            : isAllProductsDiscount
                              ? "No active products are available in the catalog."
                              : "No products linked yet"}
                      </p>
                    </div>
                    {!proofProductsLoading && hasProofProducts ? (
                      <Button asChild variant="ghost" className="text-sm font-medium hover:bg-muted/30 rounded-full h-9 px-4 text-muted-foreground">
                        <Link href={isAllProductsDiscount ? "/dashboard/products" : "/dashboard/products/collections"}>
                          {isAllProductsDiscount ? "Manage products" : "Manage products"}
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  {proofProductsLoading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mr-2" /> Loading...
                    </div>
                  ) : null}

                  {proofProductsError && !proofProductsLoading ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-950 rounded-2xl">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <AlertTitle>
                        {isAllProductsDiscount
                          ? proofProductsError === "No active products are available in the catalog."
                            ? "No active products available"
                            : "Unable to load active products"
                          : "Collection needs products"}
                      </AlertTitle>
                      <AlertDescription>{proofProductsError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {!proofProductsLoading && hasProofProducts ? (
                    <div className="border-y border-black/5 divide-y divide-black/5 max-h-[35vh] overflow-y-auto pr-2">
                      {proofProducts.map((option) => {
                        const proofItem = collectionProofItemsBySku.get(option.sku.toLowerCase()) ?? null;
                        const isVerified = proofItem?.proof_status === "VERIFIED";
                        const isBlocked = proofItem?.proof_status === "BLOCKED";
                        const isNeedsEvidence = proofItem?.proof_status === "NEEDS_EVIDENCE";
                        
                        return (
                          <div key={option.sku} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0 space-y-1 pr-4">
                              <p className="text-sm font-medium text-foreground truncate">
                                {option.product_name} {option.variant_name ? <span className="text-muted-foreground">— {option.variant_name}</span> : ""}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="font-mono">{option.sku}</span>
                                <span>•</span>
                                <span className={cn(
                                  option.stock_available === null ? "text-slate-500" :
                                  option.stock_available > 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {option.stock_available === null ? "Stock unknown" : `${numberFormatter.format(option.stock_available)} in stock`}
                                </span>
                              </div>
                              {proofItem ? (
                                <p className={cn("text-xs mt-2", 
                                  isVerified ? "text-emerald-600" : 
                                  isBlocked ? "text-rose-600" : 
                                  isNeedsEvidence ? "text-amber-600" : "text-muted-foreground"
                                )}>
                                  {proofItem.reason}
                                </p>
                              ) : null}
                            </div>
                            
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                              <DiscountStatusBadge status={proofItem?.discount_status ?? discount.status} />
                              {proofItem ? (
                                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-medium", getProofStatusBadgeClass(proofItem.proof_status))}>
                                  {getDiscountProofStatusLabel(proofItem.proof_status)}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-transparent rounded-full px-3 font-medium">Needs proof</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-8 rounded-3xl border-0 bg-[#F9F9F9] p-8 md:p-10 shadow-none">
                {isRunningProof ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Loader2 className="size-6 animate-spin text-foreground" />
                      <p className="text-base font-medium text-foreground">Checking proof now...</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {isAllProductsDiscount
                          ? "G7 is reviewing the active products linked to this discount."
                          : `G7 is reviewing the selected products in ${collectionLabel}.`}
                      </p>
                    </div>
                  </div>
                ) : proofRunResult?.summary ? (
                  <>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Proof Result</h4>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-medium", getProofStatusBadgeClass(proofRunResult.status))}>
                        {getDiscountProofStatusLabel(proofRunResult.status)}
                      </Badge>
                      <p className="mt-4 text-sm leading-relaxed text-foreground">{proofRunResult.message}</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</h4>
                      <div className="space-y-3">
                        {collectionProofSummaryItems.map(item => (
                          <div key={item.label} className="flex justify-between items-center py-2 border-b border-black/5 last:border-0">
                            <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                            <span className={cn("text-sm font-semibold", item.valueClass)}>{numberFormatter.format(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {collectionBlockedReasonGroups.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Blocked Reasons</h4>
                        <div className="space-y-3">
                          {collectionBlockedReasonGroups.map(item => (
                            <div key={item.reason} className="bg-white rounded-xl p-3 shadow-sm border border-black/5">
                              <div className="flex justify-between items-start gap-3">
                                <p className="text-xs leading-relaxed text-foreground">{formatBlockedReasonCopy(item)}</p>
                                <Badge variant="secondary" className="bg-muted text-foreground shrink-0 rounded-full">{item.count}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Overview</h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {isAllProductsDiscount
                        ? "G7 will check every active product/SKU tied to this discount when you run proof."
                        : `G7 will check every active product/SKU in ${collectionLabel} when you run proof.`}
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-black/5 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{isAllProductsDiscount ? "Products found" : "Products"}</span>
                        <span className="text-sm font-medium">{numberFormatter.format(proofProducts.length)}</span>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-black/5 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Scope</span>
                        <span className="text-sm font-medium">
                          {proofScope === "ALL_PRODUCTS" ? (isAllProductsDiscount ? "All active products" : "All products") : "Selected product"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Field>
              <FieldLabel htmlFor="proof-sku">{targetLabel}</FieldLabel>
              <FieldContent>
                {discount.appliesToType === "SPECIFIC_SKU" ? (
                  <>
                    <Input
                      id="proof-sku"
                      value={targetValue}
                      readOnly
                      className="h-12 w-full rounded-2xl border-black/10 bg-[#F4F4F4] shadow-sm"
                    />
                    <FieldDescription>G7 will use this exact SKU when checking proof.</FieldDescription>
                  </>
                ) : (
                  <>
                    <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="h-11 w-full justify-between rounded-full border-border/70 bg-white font-normal shadow-none hover:bg-muted/50"
                        >
                          {selectedTarget ? (
                            <span className="flex min-w-0 flex-col items-start text-left">
                              <span className="truncate font-medium text-foreground">{selectedTarget.label}</span>
                              {selectedTarget.details ? (
                                <span className="truncate text-xs text-muted-foreground">{selectedTarget.details}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{targetPlaceholder}</span>
                          )}
                          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                            <CommandInput placeholder={currentDiscount.appliesToType === "SPECIFIC_PRODUCT" ? "Search variant or SKU..." : "Search product or SKU..."} />
                            <CommandList>
                              <CommandEmpty>
                                {currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
                                  ? "No active variants or SKUs found."
                                  : "No product or SKU found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {proofTargets.map((option) => {
                                  const isSelected = option.sku.toLowerCase() === targetValue.toLowerCase();

                                return (
                                  <CommandItem
                                    key={option.sku}
                                    value={`${option.label} ${option.details} ${option.sku}`}
                                    onSelect={() => {
                                      setSelectedSku(option.sku);
                                      setTargetError(null);
                                      setTargetOpen(false);
                                    }}
                                    className="flex items-start gap-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-foreground">{option.label}</p>
                                      {option.details ? <p className="truncate text-xs text-muted-foreground">{option.details}</p> : null}
                                    </div>
                                    <Check className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FieldDescription>{targetDescription}</FieldDescription>
                    {!proofProductsLoading && (proofProductsError || proofTargets.length === 0) ? (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                        <AlertTriangle className="size-4 text-amber-600" />
                        <AlertTitle>
                          {currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
                            ? proofProductsError
                              ? "Unable to load variants"
                              : "No active variants available"
                            : "Missing product data"}
                        </AlertTitle>
                        <AlertDescription>
                          {currentDiscount.appliesToType === "SPECIFIC_PRODUCT"
                            ? proofProductsError ?? "This product has no active variant/SKU. Add a variant before checking proof."
                            : "No product or SKU options are available for this discount."}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                )}
              </FieldContent>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="proof-urgency">Will you use urgency wording?</FieldLabel>
            <FieldContent>
              <Select value={urgencyClaim} onValueChange={setUrgencyClaim}>
                <SelectTrigger id="proof-urgency" className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5">
                  <SelectValue placeholder="No urgency wording" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/70 bg-white/95 backdrop-blur-md">
                  <SelectItem value="none">No urgency wording</SelectItem>
                  <SelectItem value="Limited time">Limited time</SelectItem>
                  <SelectItem value="Ends soon">Ends soon</SelectItem>
                  <SelectItem value="Today only">Today only</SelectItem>
                  <SelectItem value="Low stock">Low stock</SelectItem>
                  <SelectItem value="Only X left">Only X left</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          {isBlockedByExpiry ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-800">
              <AlertTriangle className="size-4 text-rose-600" />
              <AlertTitle>Action required</AlertTitle>
              <AlertDescription>This discount needs an end date before using urgency wording.</AlertDescription>
            </Alert>
          ) : null}

          {needsStockProof ? (
            <div className="space-y-4 rounded-[22px] border border-border/60 bg-muted/10 p-5">
              <h4 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Stock Proof Required</h4>
              <p className="text-sm text-muted-foreground">Add second stock proof before using low-stock wording.</p>

              <Field>
                <FieldLabel htmlFor="proof-stock-source">Second stock source</FieldLabel>
                <FieldContent>
                  <Input
                    id="proof-stock-source"
                    placeholder="e.g. Warehouse system, supplier email"
                    value={secondStockSource}
                    onChange={(e) => setSecondStockSource(e.target.value)}
                    className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="proof-stock-qty">Second stock quantity</FieldLabel>
                <FieldContent>
                  <Input
                    id="proof-stock-qty"
                    type="number"
                    placeholder="e.g. 5"
                    value={secondStockQuantity}
                    onChange={(e) => setSecondStockQuantity(e.target.value)}
                    className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="proof-stock-evidence">Evidence URL or note</FieldLabel>
                <FieldContent>
                  <Input
                    id="proof-stock-evidence"
                    placeholder="Link to evidence or quick note"
                    value={secondStockEvidenceUrl}
                    onChange={(e) => setSecondStockEvidenceUrl(e.target.value)}
                    className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="proof-stock-checked">Checked at</FieldLabel>
                <FieldContent>
                  <Input
                    id="proof-stock-checked"
                    type="datetime-local"
                    value={secondStockCheckedAt}
                    onChange={(e) => setSecondStockCheckedAt(e.target.value)}
                    className="h-12 w-full rounded-2xl border-black/10 bg-white shadow-sm focus:ring-1 focus:ring-black/5"
                  />
                </FieldContent>
              </Field>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 p-6 md:px-12 md:py-6 border-t border-black/5 bg-white sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-full px-6 font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full px-8 font-medium shadow-sm bg-foreground text-background hover:bg-foreground/90"
            onClick={() => void handleRun()}
            disabled={
              isRunningProof ||
              proofRequiresActivation ||
              isBlockedByExpiry ||
              (usesMultiProductProof &&
                (proofProductsLoading ||
                  proofProducts.length === 0 ||
                  (proofScope === "ONE_PRODUCT" && !targetValue))) ||
              (!isCollectionDiscount && requiresTargetSelection && !proofTargets.length && currentDiscount.appliesToType !== "SPECIFIC_SKU")
            }
          >
            {isRunningProof ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {isRunningProof ? "Checking proof now..." : getProofActionLabel(currentDiscount.proofStatus)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DiscountsPage() {
  const { authFetch } = useAuth();
  const request: AdminRequest = authFetch ?? defaultRequest;
  const { products, collections } = useDashboardData(true, request, true);

  const [discounts, setDiscounts] = useState<AdminDiscountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<FormMode>("create");
  const [editorDiscount, setEditorDiscount] = useState<AdminDiscountRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyAction, setBusyAction] = useState<{ id: string; kind: string } | null>(null);
  const [confirmDanger, setConfirmDanger] = useState<{ discount: AdminDiscountRecord; action: DangerAction } | null>(null);
  const [checkProofDiscount, setCheckProofDiscount] = useState<AdminDiscountRecord | null>(null);
  const hasLoadedRef = useRef(false);

  const searchValue = useDeferredValue(search.trim().toLowerCase());

  const loadDiscounts = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}): Promise<AdminDiscountRecord[] | null> => {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!silent) {
        setError(null);
      }

      try {
        const response = await request(buildRouteUrl(ADMIN_DISCOUNTS_ROUTE), {
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<DiscountsApiResponse>(response);
        if (!response.ok || !body) {
          throw new Error("Discounts could not be loaded.");
        }

        setDiscounts(body.items ?? []);
        hasLoadedRef.current = true;
        setError(null);
        return body.items ?? [];
      } catch {
        setError("Discounts could not be loaded. Check the admin API connection.");
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadDiscounts({ silent: true });
  }, [loadDiscounts]);

  const displayDiscounts = discounts;

  const summary = useMemo<DiscountSummary>(() => {
    const now = Date.now();
    return {
      total: displayDiscounts.length,
      draft: displayDiscounts.filter((discount) => discount.status === "DRAFT").length,
      scheduled: displayDiscounts.filter((discount) => discount.status === "SCHEDULED").length,
      active: displayDiscounts.filter((discount) => discount.status === "ACTIVE").length,
      paused: displayDiscounts.filter((discount) => discount.status === "PAUSED").length,
      expired: displayDiscounts.filter(
        (discount) =>
          discount.status === "EXPIRED" || (discount.endsAt ? new Date(discount.endsAt).getTime() < now : false),
      ).length,
      archived: displayDiscounts.filter((discount) => discount.status === "ARCHIVED").length,
      needsProof: displayDiscounts.filter(
        (discount) =>
          discount.status !== "ARCHIVED" &&
          discount.status !== "EXPIRED" &&
          isDiscountProofAttentionRequired(discount.proofStatus),
      ).length,
    };
  }, [displayDiscounts]);

  const filteredDiscounts = useMemo(() => {
    return displayDiscounts.filter((discount) => {
      const searchIndex = [
        discount.code,
        discount.discountId,
        discount.discountType,
        getDiscountTypeLabel(discount.discountType),
        discount.productId,
        discount.productName,
        discount.productSlug,
        discount.sku,
        discount.collectionId,
        discount.collectionName,
        discount.collectionSlug,
        discount.notes,
        discount.status,
        getDiscountStatusLabel(discount.status),
        discount.proofStatus,
        getDiscountProofStatusLabel(discount.proofStatus),
        buildDiscountAppliesToLabel(discount),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");

      const matchesSearch = !searchValue || searchIndex.includes(searchValue);
      const matchesStatus = statusFilter === "all" || discount.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [displayDiscounts, searchValue, statusFilter]);

  useEffect(() => {
    if (!discounts.length) {
      setSelectedDiscountId(null);
      return;
    }

    const selectedExists = discounts.some((discount) => discount.discountId === selectedDiscountId);
    if (!selectedDiscountId || !selectedExists) {
      setSelectedDiscountId(discounts[0].discountId);
    }
  }, [discounts, selectedDiscountId]);

  const selectedDiscount = useMemo(
    () => displayDiscounts.find((discount) => discount.discountId === selectedDiscountId) ?? null,
    [displayDiscounts, selectedDiscountId],
  );

  const activeFilterCount = Number(Boolean(searchValue)) + Number(statusFilter !== "all");
  const hasResults = filteredDiscounts.length > 0;

  const syncDiscountRecord = useCallback((record: AdminDiscountRecord) => {
    setDiscounts((current) => {
      const next = current.filter((item) => item.discountId !== record.discountId);
      return [record, ...next].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    });
    setSelectedDiscountId(record.discountId);
  }, []);

  const handleOpenCreate = () => {
    setEditorMode("create");
    setEditorDiscount(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (discount: AdminDiscountRecord) => {
    if (discount.status === "ARCHIVED") {
      toast.info("Archived discounts are read-only.");
      return;
    }

    setEditorMode("edit");
    setEditorDiscount(discount);
    setEditorOpen(true);
    setSelectedDiscountId(discount.discountId);
  };

  const handleSubmitDiscount = async (values: DiscountFormValues) => {
    setSubmitting(true);

    try {
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
      };

      const response = await request(
        buildRouteUrl(editorMode === "edit" && editorDiscount ? `${ADMIN_DISCOUNTS_ROUTE}/${editorDiscount.discountId}` : ADMIN_DISCOUNTS_ROUTE),
        {
          method: editorMode === "edit" && editorDiscount ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
          silent: true,
        },
      );

      const body = await parseJsonResponse<DiscountMutationResponse>(response);
      if (!response.ok || !body?.item) {
        throw new Error(await readResponseMessage(response, "Discount could not be saved."));
      }

      const refreshedDiscounts = await loadDiscounts({ silent: true });
      const savedRecord =
        refreshedDiscounts?.find((record) => record.discountId === body.item.discountId) ??
        body.item;

      syncDiscountRecord(savedRecord);
      setEditorOpen(false);
      setEditorDiscount(null);
      toast.success(body.message ?? (editorMode === "edit" ? "Discount updated." : "Discount created."));
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Discount could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const applyActionResult = (record: AdminDiscountRecord, message?: string) => {
    syncDiscountRecord(record);
    toast.success(message ?? `${record.code} updated.`);
  };

  const handleStatusAction = async (discount: AdminDiscountRecord, action: DiscountAction) => {
    setBusyAction({ id: discount.discountId, kind: action });

    try {
      const response = await request(buildRouteUrl(`${ADMIN_DISCOUNTS_ROUTE}/${discount.discountId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<DiscountMutationResponse>(response);
      if (!response.ok || !body?.item) {
        throw new Error(await readResponseMessage(response, "Discount action failed."));
      }

      applyActionResult(body.item, body.message);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Discount action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDangerAction = (discount: AdminDiscountRecord, action: DangerAction) => {
    setConfirmDanger({ discount, action });
  };

  const confirmDangerAction = async () => {
    if (!confirmDanger) {
      return;
    }

    const { discount, action } = confirmDanger;
    setBusyAction({ id: discount.discountId, kind: action });
    setConfirmDanger(null);

    try {
      const response = await request(buildRouteUrl(`${ADMIN_DISCOUNTS_ROUTE}/${discount.discountId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<DiscountMutationResponse>(response);
      if (!response.ok || !body?.item) {
        throw new Error(await readResponseMessage(response, "Discount action failed."));
      }

      applyActionResult(body.item, body.message);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Discount action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCheckProof = (discount: AdminDiscountRecord) => {
    setCheckProofDiscount(discount);
  };

  const handleRunProofCheck = async (
    discount: AdminDiscountRecord,
    payload: {
      sku?: string;
      urgencyClaim?: string;
      secondStockSource?: string;
      secondStockQuantity?: string;
      secondStockEvidenceUrl?: string;
      secondStockCheckedAt?: string;
      proofScope?: ProofScopeSelection;
    },
  ): Promise<ProofRunResult | null> => {
    setBusyAction({ id: discount.discountId, kind: "CHECK_PROOF" });

    try {
      const response = await request(buildRouteUrl(`${ADMIN_DISCOUNTS_ROUTE}/${discount.discountId}/check-proof`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<DiscountProofResponse>(response);
      if (!response.ok || !body) {
        throw new Error(await readResponseMessage(response, "Proof check failed."));
      }

      const proof = mapProofResponseToDetail(discount, body);
      const proofResult: ProofRunResult = {
        ...proof,
        summary: body.summary ?? null,
        items: body.items ?? null,
        blockedReasons: body.blockedReasons ?? null,
      };
      if (body.item) {
        syncDiscountRecord(body.item);
      }
      setSelectedDiscountId(discount.discountId);

      if (proof.status === "VERIFIED") {
        toast.success(body.message);
      } else if (proof.status === "PARTIALLY_VERIFIED" || proof.status === "NEEDS_EVIDENCE") {
        toast.warning(body.message);
      } else {
        toast.error(body.message);
      }
      return proofResult;
    } catch (checkError) {
      toast.error(checkError instanceof Error ? checkError.message : "Proof check failed.");
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  const handleRefresh = () => {
    void loadDiscounts({ silent: false });
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const discountSummaryCards = [
    {
      label: "Active discounts",
      value: formatFilterCount(summary.active),
      helper: "Ready to use in campaigns and offers.",
      icon: CheckCircle2,
      accentClass: "bg-emerald-50/50",
      iconClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Scheduled discounts",
      value: formatFilterCount(summary.scheduled),
      helper: "Queued for a future launch date.",
      icon: Clock3,
      accentClass: "bg-sky-50/50",
      iconClass: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      label: "Expired discounts",
      value: formatFilterCount(summary.expired),
      helper: "Past their end date or marked expired.",
      icon: Archive,
      accentClass: "bg-slate-50/70",
      iconClass: "border-slate-200 bg-slate-100 text-slate-700",
    },
    {
      label: "Needs proof",
      value: formatFilterCount(summary.needsProof),
      helper: "Needs proof or missing evidence.",
      icon: ShieldCheck,
      accentClass: "bg-amber-50/70",
      iconClass: "border-amber-200 bg-amber-50 text-amber-700",
    },
  ];

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
                          Discounts &amp; Coupons
                        </h1>
                        <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                          Create and manage discount codes used in offers, content, and campaigns.
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl lg:flex-1 lg:justify-end">
                        <Button type="button" className="h-11 rounded-full px-5 shadow-sm" onClick={handleOpenCreate}>
                          <Plus className="mr-2 size-4" />
                          Create discount
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>
            {error && !loading ? (
              <Card role="alert" className="rounded-[28px] border-rose-200 bg-rose-50 shadow-sm">
                <CardContent className="space-y-4 p-6 md:p-8">
                  <div className="flex items-start gap-3 rounded-[22px] border border-rose-200 bg-white/80 p-4 text-rose-950">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">{error}</p>
                      <p className="text-sm leading-6 text-rose-900/80">Try again once the admin API is available.</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-11 rounded-full px-5"
                    onClick={handleRefresh}
                    disabled={loading || refreshing}
                  >
                    <RefreshCcw className={cn("mr-2 size-4", refreshing && "animate-spin")} />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {loading && !discounts.length ? (
              <LoadingState />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {discountSummaryCards.map((card) => (
                    <MetricCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      helper={card.helper}
                      icon={card.icon}
                      accentClass={card.accentClass}
                      iconClass={card.iconClass}
                    />
                  ))}
                </div>

                <div className="grid gap-6">
                  <div className="space-y-6">
                    <Card className="rounded-[28px] border-border/70 bg-white/90 shadow-sm">
                      <CardContent className="space-y-4 p-5 md:p-6">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Library</p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Showing {formatFilterCount(filteredDiscounts.length)} of {formatFilterCount(displayDiscounts.length)} discounts
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search codes, products, SKUs, notes"
                                className="h-11 w-full rounded-full border-border/70 bg-white pl-10 shadow-none sm:w-[320px]"
                              />
                            </div>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                              <SelectTrigger className="h-11 w-full rounded-full border-border/70 bg-white shadow-none sm:w-[180px]">
                                <SelectValue placeholder="Filter status" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_FILTER_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {activeFilterCount > 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-11 rounded-full px-4 text-sm font-medium"
                                onClick={resetFilters}
                              >
                                Clear
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/90 shadow-sm">
                      <CardContent className="p-0">
                        {hasResults ? (
                          <>
                            <div className="hidden md:block">
                              <div className="overflow-x-auto">
                                <Table className="min-w-[1240px]">
                                  <TableHeader className="bg-muted/20">
                                    <TableRow className="border-border/60">
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Code</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Type</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Value</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Applies to</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start date</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">End date</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Used</TableHead>
                                      <TableHead className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Proof</TableHead>
                                      <TableHead className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Action</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {filteredDiscounts.map((discount) => (
                                      <DiscountTableRow
                                        key={discount.discountId}
                                        discount={discount}
                                        selected={discount.discountId === selectedDiscountId}
                                        busyAction={busyAction}
                                        onSelect={(item) => setSelectedDiscountId(item.discountId)}
                                        onEdit={handleOpenEdit}
                                        onCheckProof={handleCheckProof}
                                        onStatusAction={handleStatusAction}
                                        onDangerAction={handleDangerAction}
                                      />
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            <div className="space-y-3 p-4 md:hidden">
                              {filteredDiscounts.map((discount) => (
                                <MobileDiscountCard
                                  key={discount.discountId}
                                  discount={discount}
                                  selected={discount.discountId === selectedDiscountId}
                                  busyAction={busyAction}
                                  onSelect={(item) => setSelectedDiscountId(item.discountId)}
                                  onEdit={handleOpenEdit}
                                  onCheckProof={handleCheckProof}
                                  onStatusAction={handleStatusAction}
                                  onDangerAction={handleDangerAction}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <EmptyStateCard
                            title="No discounts matched your filters"
                            description="Try a broader search or clear the status filter to see more codes."
                            action={
                              <Button type="button" variant="outline" className="h-11 rounded-full border-border/70 bg-white px-5" onClick={resetFilters}>
                                Reset filters
                              </Button>
                            }
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
              </div>
            </main>
          </div>
        </SidebarInset>

        <DiscountFormDialog
          open={editorOpen}
          mode={editorMode}
          discount={editorDiscount}
          products={products}
          collections={collections}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) {
              setEditorDiscount(null);
            }
          }}
          onSubmit={handleSubmitDiscount}
          submitting={submitting}
        />

        <AlertDialog open={Boolean(confirmDanger)} onOpenChange={(open) => !open && setConfirmDanger(null)}>
          <AlertDialogContent className="rounded-[28px] border-border/70 bg-white p-0 shadow-2xl">
            <div className="p-6">
              <AlertDialogHeader className="space-y-2 text-left">
                <AlertDialogTitle className="font-serif text-3xl tracking-tight text-primary">
                  {confirmDanger?.action === "EXPIRE" ? "Expire this discount?" : "Archive this discount?"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
                  {confirmDanger?.discount.code ? (
                    <>
                      <span translate="no">{confirmDanger.discount.code}</span> will be{" "}
                      {confirmDanger.action === "EXPIRE" ? "marked expired and kept read-only" : "archived and removed from the active list"}.
                    </>
                  ) : null}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
              <AlertDialogCancel className="h-11 rounded-full border-border/70 bg-white px-5 shadow-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={cn(
                  "h-11 rounded-full px-5",
                  confirmDanger?.action === "ARCHIVE" ? "bg-rose-600 text-white hover:bg-rose-700" : "",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmDangerAction();
                }}
              >
                {busyAction?.id === confirmDanger?.discount.discountId ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {confirmDanger?.action === "EXPIRE" ? "Expire discount" : "Archive discount"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CheckProofDialog
          discount={checkProofDiscount}
          products={products}
          request={request}
          onOpenChange={(open) => {
            if (!open) setCheckProofDiscount(null);
          }}
          onRunProof={handleRunProofCheck}
        />
      </div>
    </SidebarProvider>
  );
}
