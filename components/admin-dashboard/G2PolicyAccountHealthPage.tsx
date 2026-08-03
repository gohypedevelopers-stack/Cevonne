"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { AppSidebar } from "@/components/admin-dashboard/app-sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

type G2AccountHealth = {
  platform?: string | null;
  account_id?: string | null;
  checked_at?: string | null;
  warning_type?: string | null;
  account_status?: string | null;
  action_required?: string | null;
  restriction_type?: string | null;
  evidence_url?: string | null;
};

type G2PolicyEvent = {
  event_id?: string | null;
  platform?: string | null;
  policy_id?: string | null;
  created_at?: string | null;
  source_url?: string | null;
  policy_family?: string | null;
  event_status?: string | null;
  change_detected?: boolean | null;
  review_required?: boolean | null;
  impacted_workflow_groups?: string[] | null;
  impacted_workflows?: string[] | null;
};

type G2PolicyReview = {
  latest_event?: G2PolicyEvent | null;
  unresolved_policy?: Record<string, unknown> | null;
};

type G2Evidence = {
  platform?: string | null;
  account_id?: string | null;
  checked_by?: string | null;
  created_at?: string | null;
  evidence_id?: string | null;
  source_name?: string | null;
  evidence_url?: string | null;
  evidence_type?: string | null;
  evidence_status?: string | null;
};

type G2RegistryMonitor = {
  run_id?: string | null;
  message?: string | null;
  created_at?: string | null;
  monitor_type?: string | null;
  blocked_count?: number | null;
  changed_count?: number | null;
  checked_count?: number | null;
  monitor_status?: string | null;
};

type G2SummaryResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  g2_status?: string;
  action_needed?: string;
  generated_at?: string;
  requested_by?: string;
  latest_account_health?: G2AccountHealth | null;
  latest_policy_check?: G2PolicyReview | null;
  latest_evidence?: G2Evidence | null;
  latest_registry_monitor?: G2RegistryMonitor | null;
};

type G2MonitoredAccount = {
  account_registry_id?: string | null;
  platform?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  account_type?: string | null;
  business_owner?: string | null;
  status?: "CLEAN" | "UNKNOWN" | "WARNING" | "RESTRICTED" | "SUSPENDED" | "DISABLED" | string | null;
  monitoring_enabled?: boolean | null;
  evidence_required?: boolean | null;
  evidence_url?: string | null;
  last_health_status?: string | null;
  last_checked_at?: string | null;
  source?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type G2MonitoredAccountsResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  accounts?: G2MonitoredAccount[] | null;
  total_count?: number;
  enabled_count?: number;
  clean_count?: number;
  needs_review_count?: number;
  disabled_count?: number;
};

type G2PolicyReviewItem = {
  policy_id?: string | null;
  policy_name?: string | null;
  policy_family?: string | null;
  platform?: string | null;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string | null;
  change_summary?: string | null;
  what_changed?: string | null;
  impacted_workflows?: string[] | null;
  recommended_action?: string | null;
  source_url?: string | null;
  review_status?: "PENDING" | "APPROVED" | "KEPT_UNDER_REVIEW" | "BLOCKED" | string | null;
  created_at?: string | null;
  last_checked_at?: string | null;
  decision_notes?: string | null;
  latest_event?: Record<string, unknown> | null;
};

type G2PolicyReviewsResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  reviews?: G2PolicyReviewItem[] | null;
  total_count?: number;
  pending_count?: number;
};

type G2AccountDetailResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  account?: G2MonitoredAccount | null;
};

type G2DisplayStatus = "Healthy" | "Needs review";
type G2DisplayResult = "Healthy" | "Blocked" | "Needs review";
type G2PrimaryActionKind = "none" | "account-health" | "policy-review";
type G2AccountHealthAction = "MANUAL_ONLY" | "CLEAN" | "WARNING" | "RESTRICTED" | "SUSPENDED";
type G2PolicyDecision = "APPROVE" | "KEEP_REVIEW" | "BLOCK";

type G2CheckRow = {
  key: string;
  checkedAt: string;
  checkedAtSort: number;
  areaChecked: string;
  platform: string;
  result: G2DisplayResult;
  actionNeeded: string;
};

/* ------------------------------------------------------------------
 * Constants & Options
 * ------------------------------------------------------------------ */

const G2_MONITORED_ACCOUNT_PLATFORM_OPTIONS = [
  { value: "META", label: "Meta" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "GOOGLE_SEARCH", label: "Google Search" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "SHOPIFY", label: "Shopify" },
  { value: "WEBSITE", label: "Website" },
  { value: "OTHER", label: "Other" },
] as const;

const G2_MONITORED_ACCOUNT_TYPE_OPTIONS = [
  { value: "PRIMARY_BUSINESS", label: "Primary Business" },
  { value: "AD_ACCOUNT", label: "Ad Account" },
  { value: "MESSAGING", label: "Messaging / API" },
  { value: "CATALOG", label: "Catalog / Commerce" },
  { value: "ANALYTICS", label: "Analytics / Search" },
  { value: "OTHER", label: "Other" },
] as const;

const G2_MONITORED_ACCOUNT_STATUS_OPTIONS = [
  { value: "UNKNOWN", label: "Awaiting confirmation" },
  { value: "CLEAN", label: "Healthy" },
  { value: "WARNING", label: "Warning (Needs review)" },
  { value: "RESTRICTED", label: "Restricted" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
] as const;

const G2_MONITORED_ACCOUNT_REGISTER_STATUS_OPTIONS: ReadonlyArray<(typeof G2_MONITORED_ACCOUNT_STATUS_OPTIONS)[number]> =
  G2_MONITORED_ACCOUNT_STATUS_OPTIONS.filter((option) => option.value !== "CLEAN");

const G2_MONITORED_ACCOUNT_REVIEW_STATUSES = new Set(["UNKNOWN", "WARNING", "RESTRICTED", "SUSPENDED", "MANUAL_ONLY", "MISSING"]);

/* ------------------------------------------------------------------
 * Helper Utilities
 * ------------------------------------------------------------------ */

const buildRouteUrl = (path: string) => {
  return new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();
};

const defaultRequest = (url: string, options?: RequestInit) => fetch(url, options);

const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasMeaningfulObject = (value: unknown): value is Record<string, unknown> => {
  return isRecord(value) && Object.keys(value).length > 0;
};

const toNormalizedText = (value?: string | null) => value?.trim().toUpperCase() ?? "";

const titleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatPlatform = (value?: string | null, fallback = "All") => {
  if (!value || !value.trim()) {
    return fallback;
  }
  const normalized = value.trim().toUpperCase();
  const known: Record<string, string> = {
    META: "Meta",
    INSTAGRAM: "Instagram",
    GOOGLE: "Google",
    GOOGLE_ADS: "Google Ads",
    GOOGLE_SEARCH: "Google Search",
    WHATSAPP: "WhatsApp",
    FACEBOOK: "Facebook",
    TIKTOK: "TikTok",
    YOUTUBE: "YouTube",
    LINKEDIN: "LinkedIn",
    SHOPIFY: "Shopify",
    WEBSITE: "Website",
    ALL: "All",
  };
  return known[normalized] ?? titleCase(normalized.replace(/_/g, " "));
};

const formatDisplayOrFallback = (value?: string | null, fallback = "Unavailable") => {
  if (!value || !value.trim()) {
    return fallback;
  }
  return value.trim();
};

const formatClientDateTime = (value?: string | null) => {
  if (!value) {
    return "Not recorded yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded yet";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCheckedAt = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

/* Client-friendly Status Formatting */
const formatRegistryStatus = (value?: string | null) => {
  const normalized = toNormalizedText(value);
  switch (normalized) {
    case "CLEAN":
    case "OK":
    case "PASS":
      return "Healthy";
    case "UNKNOWN":
      return "Awaiting confirmation";
    case "WARNING":
      return "Needs review";
    case "RESTRICTED":
      return "Restricted";
    case "SUSPENDED":
      return "Suspended";
    case "DISABLED":
      return "Monitoring disabled";
    case "BLOCKED":
    case "BLOCK":
      return "Blocked";
    case "MANUAL_ONLY":
      return "Needs review";
    default:
      return normalized ? titleCase(normalized.replace(/_/g, " ")) : "Awaiting confirmation";
  }
};

const getRegistryStatusTone = (status?: string | null) => {
  const normalized = toNormalizedText(status);
  if (normalized === "CLEAN" || normalized === "OK" || normalized === "PASS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (normalized === "WARNING" || normalized === "UNKNOWN" || normalized === "MANUAL_ONLY" || normalized === "MISSING") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (normalized === "RESTRICTED" || normalized === "SUSPENDED" || normalized === "BLOCKED" || normalized === "BLOCK") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-800";
};

const getRegistryMonitoringTone = (account?: G2MonitoredAccount | null) => {
  const isDisabled = account?.monitoring_enabled === false || toNormalizedText(account?.status) === "DISABLED";
  return isDisabled
    ? "border-slate-200 bg-slate-100 text-slate-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
};

const getRiskTone = (risk?: string | null) => {
  const normalized = toNormalizedText(risk);
  switch (normalized) {
    case "CRITICAL":
    case "HIGH":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "LOW":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const resultToneClasses: Record<G2DisplayResult, string> = {
  Healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Blocked: "border-rose-200 bg-rose-50 text-rose-800",
  "Needs review": "border-amber-200 bg-amber-50 text-amber-800",
};

const getRowTimestamp = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const getFirstString = (value: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!value) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

const getStringList = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const entries = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return entries.length ? entries : null;
};

const formatList = (value?: string[] | null, fallback = "None") => {
  if (!value?.length) return fallback;
  return value.join(", ");
};

const formatClientLabel = (value?: string | null, fallback = "Unavailable") => {
  if (!value || !value.trim()) return fallback;
  return titleCase(value.trim().replace(/_/g, " "));
};

const getAccountHealthResult = (accountHealth?: G2AccountHealth | null): G2DisplayResult | null => {
  if (!hasMeaningfulObject(accountHealth)) return null;
  const normalized = toNormalizedText(accountHealth.account_status);
  if (normalized === "CLEAN" || normalized === "OK") return "Healthy";
  if (normalized === "BLOCKED") return "Blocked";
  return "Needs review";
};

const getEvidenceResult = (evidence?: G2Evidence | null): G2DisplayResult | null => {
  if (!hasMeaningfulObject(evidence)) return null;
  const normalized = toNormalizedText(evidence.evidence_status);
  if (normalized === "CLEAN" || normalized === "VERIFIED" || normalized === "PASS") return "Healthy";
  if (normalized === "MISSING" || normalized === "BLOCKED" || normalized === "FAIL") return "Blocked";
  return "Needs review";
};

const getRegistryMonitorResult = (monitor?: G2RegistryMonitor | null): G2DisplayResult | null => {
  if (!hasMeaningfulObject(monitor)) return null;
  if ((monitor.blocked_count ?? 0) > 0) return "Blocked";
  if ((monitor.changed_count ?? 0) > 0) return "Needs review";
  const normalized = toNormalizedText(monitor.monitor_status);
  if (normalized === "BLOCKED") return "Blocked";
  if (normalized === "WARNING" || normalized === "REVIEW_REQUIRED") return "Needs review";
  return "Healthy";
};

const getPolicyResult = (policyCheck?: G2PolicyReview | null): G2DisplayResult | null => {
  if (!policyCheck || !hasMeaningfulObject(policyCheck.latest_event)) return null;
  return hasMeaningfulObject(policyCheck.unresolved_policy) ? "Needs review" : "Healthy";
};

const buildCheckRows = (snapshot: G2SummaryResponse | null): G2CheckRow[] => {
  if (!snapshot) return [];
  const rows: G2CheckRow[] = [];

  if (hasMeaningfulObject(snapshot.latest_account_health)) {
    const health = snapshot.latest_account_health;
    const checkedAt = health.checked_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getAccountHealthResult(health) ?? "Needs review";
      rows.push({
        key: `health-${health.account_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Account health",
        platform: formatPlatform(health.platform),
        result,
        actionNeeded: health.action_required?.trim() || (result === "Healthy" ? "No action needed." : "Review required."),
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_evidence)) {
    const evidence = snapshot.latest_evidence;
    const checkedAt = evidence.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getEvidenceResult(evidence) ?? "Needs review";
      rows.push({
        key: `evidence-${evidence.evidence_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Official evidence",
        platform: formatPlatform(evidence.platform),
        result,
        actionNeeded: result === "Healthy" ? "Proof verified." : "Provide updated evidence.",
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_policy_check?.latest_event)) {
    const policyCheck = snapshot.latest_policy_check;
    const latestEvent = policyCheck?.latest_event ?? null;
    const checkedAt = latestEvent?.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getPolicyResult(policyCheck) ?? "Needs review";
      rows.push({
        key: `policy-${latestEvent?.event_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: hasMeaningfulObject(policyCheck?.unresolved_policy) ? "Policy review" : "Policy test",
        platform: formatPlatform(latestEvent?.platform, "All"),
        result,
        actionNeeded: result === "Healthy" ? "Policy is up to date." : "Administrator review required.",
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_registry_monitor)) {
    const monitor = snapshot.latest_registry_monitor;
    const checkedAt = monitor.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getRegistryMonitorResult(monitor) ?? "Needs review";
      rows.push({
        key: `registry-${monitor.run_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Registry monitor",
        platform: "All",
        result,
        actionNeeded: result === "Healthy" ? "All records verified." : "Review monitored changes.",
      });
    }
  }

  return rows.sort((a, b) => b.checkedAtSort - a.checkedAtSort).slice(0, 3);
};

const getRegistryReviewTarget = (account: G2MonitoredAccount): G2AccountHealth => {
  const status = toNormalizedText(account.status) || "UNKNOWN";
  const notes = account.notes?.trim() || null;
  return {
    platform: account.platform ?? null,
    account_id: account.account_id ?? null,
    checked_at: account.last_checked_at ?? account.updated_at ?? account.created_at ?? null,
    warning_type: status === "WARNING" ? notes : null,
    account_status: status === "DISABLED" ? "UNKNOWN" : status,
    action_required: "Review account health.",
    restriction_type: status === "RESTRICTED" || status === "SUSPENDED" ? notes : null,
    evidence_url: account.evidence_url ?? null,
  };
};

/* ------------------------------------------------------------------
 * Presentational Sub-Components
 * ------------------------------------------------------------------ */

function InfoField({
  label,
  value,
  valueClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/15 p-4", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-2 text-sm leading-6 text-foreground text-pretty", valueClassName)}>{value}</dd>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClasses = {
    emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    amber: "bg-amber-500/10 text-amber-700 border-amber-200",
    rose: "bg-rose-500/10 text-rose-700 border-rose-200",
    slate: "bg-slate-500/10 text-slate-700 border-slate-200",
  };

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
            <div className="text-2xl font-serif font-semibold tracking-tight text-foreground">{value}</div>
            <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl border", toneClasses[tone])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Account Details Drawer (Sheet)
 * ------------------------------------------------------------------ */

function AccountDetailDrawer({
  account,
  open,
  onOpenChange,
  onReviewHealth,
  onEdit,
}: {
  account: G2MonitoredAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewHealth: (account: G2MonitoredAccount) => void;
  onEdit: (account: G2MonitoredAccount) => void;
}) {
  if (!account) return null;

  const platform = formatPlatform(account.platform);
  const statusFormatted = formatRegistryStatus(account.status);
  const statusTone = getRegistryStatusTone(account.status);
  const isWhatsApp = account.platform?.trim().toUpperCase() === "WHATSAPP";
  const isUnknown = toNormalizedText(account.status) === "UNKNOWN";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account Details</p>
          <SheetTitle className="font-serif text-2xl tracking-tight text-primary">
            {formatDisplayOrFallback(account.account_name, "Monitored Account")}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Platform and monitoring metadata recorded in G2.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/15 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current Health</p>
              <Badge variant="outline" className={cn("mt-1 rounded-full border text-xs font-semibold", statusTone)}>
                {statusFormatted}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Monitoring</p>
              <Badge
                variant="outline"
                className={cn("mt-1 rounded-full border text-xs font-semibold", getRegistryMonitoringTone(account))}
              >
                {account.monitoring_enabled === false || toNormalizedText(account.status) === "DISABLED" ? "Disabled" : "Active"}
              </Badge>
            </div>
          </div>

          {isWhatsApp && isUnknown ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <Info className="h-4 w-4 text-amber-800" />
              <AlertDescription className="text-xs text-amber-800 leading-5">
                Meta has not established a quality rating for this WhatsApp phone number yet. Monitoring is active.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3">
            <InfoField label="Platform" value={platform} valueClassName="font-medium" />
            <InfoField label="Account ID" value={formatDisplayOrFallback(account.account_id)} valueClassName="font-mono text-xs break-all" />
            <InfoField label="Account Type" value={formatClientLabel(account.account_type, "Standard")} valueClassName="font-medium" />
            <InfoField label="Last Checked" value={formatClientDateTime(account.last_checked_at ?? account.updated_at ?? account.created_at)} />
            
            {account.evidence_url ? (
              <InfoField
                label="Official Evidence"
                value={
                  <a
                    href={account.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-4 hover:text-primary/80 break-all"
                  >
                    View Official Evidence <ExternalLink className="size-3 shrink-0" />
                  </a>
                }
              />
            ) : null}

            {account.notes ? (
              <InfoField label="Administrator Notes" value={account.notes} valueClassName="text-xs leading-relaxed" />
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border/60">
          <Button
            variant="outline"
            className="flex-1 rounded-full border-border/70 shadow-none text-xs"
            onClick={() => {
              onOpenChange(false);
              onEdit(account);
            }}
          >
            Edit Account
          </Button>
          <Button
            className="flex-1 rounded-full bg-primary text-primary-foreground shadow-none text-xs"
            onClick={() => {
              onOpenChange(false);
              onReviewHealth(account);
            }}
            disabled={account.monitoring_enabled === false || toNormalizedText(account.status) === "DISABLED"}
          >
            Review Health
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------
 * Policy Review Decision Dialog
 * ------------------------------------------------------------------ */

function PolicyReviewDecisionDialog({
  open,
  onOpenChange,
  policyReview,
  onSubmitDecision,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyReview: G2PolicyReviewItem | null;
  onSubmitDecision: (payload: {
    policy_id: string;
    decision: G2PolicyDecision;
    decision_notes: string | null;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [selectedDecision, setSelectedDecision] = useState<G2PolicyDecision>("APPROVE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDecision("APPROVE");
      setNotes("");
      setError(null);
    }
  }, [open, policyReview]);

  if (!policyReview) return null;

  const policyName = formatDisplayOrFallback(policyReview.policy_name ?? policyReview.policy_family, "Policy Review");
  const platform = formatPlatform(policyReview.platform);
  const riskLevel = policyReview.risk_level?.trim().toUpperCase() ?? "MEDIUM";
  const impactedWorkflows = formatList(policyReview.impacted_workflows);
  const sourceUrl = policyReview.source_url?.trim() || null;

  const handleSave = async () => {
    if (selectedDecision === "BLOCK" && !notes.trim()) {
      setError("Please provide a note explaining why this policy change is blocking workflows.");
      return;
    }

    if (selectedDecision === "BLOCK") {
      setConfirmBlockOpen(true);
      return;
    }

    await executeSubmit();
  };

  const executeSubmit = async () => {
    setError(null);
    try {
      await onSubmitDecision({
        policy_id: policyReview.policy_id ?? "unknown",
        decision: selectedDecision,
        decision_notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record policy decision.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-48px)] overflow-y-auto rounded-[32px] border-border/60 bg-background p-6 sm:p-8 shadow-2xl">
          <div className="space-y-6">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full border text-[10px] font-semibold", getRiskTone(riskLevel))}>
                  {riskLevel} Risk
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">{platform}</span>
              </div>
              <DialogTitle className="font-serif text-2xl tracking-tight text-primary">{policyName}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review this policy update and select an action for dependent workflows.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
                <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoField
                label="AI Summary / What Changed"
                value={policyReview.change_summary ?? policyReview.what_changed ?? "Policy update detected."}
                valueClassName="text-xs leading-relaxed"
                className="sm:col-span-2"
              />
              <InfoField label="Impacted Workflows" value={impactedWorkflows} valueClassName="text-xs font-medium" />
              <InfoField
                label="Official Source"
                value={
                  sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4 break-all"
                    >
                      View Source <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    "None provided"
                  )
                }
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your Decision</p>
              <RadioGroup
                value={selectedDecision}
                onValueChange={(val) => setSelectedDecision(val as G2PolicyDecision)}
                className="grid gap-2"
              >
                {[
                  {
                    value: "APPROVE",
                    title: "Approve change",
                    desc: "Mark this policy change verified. All dependent workflows can proceed automatically.",
                    tone: "border-emerald-200 hover:bg-emerald-50/50",
                  },
                  {
                    value: "KEEP_REVIEW",
                    title: "Keep under review",
                    desc: "Keep dependent workflows in manual-only mode until full testing is complete.",
                    tone: "border-amber-200 hover:bg-amber-50/50",
                  },
                  {
                    value: "BLOCK",
                    title: "Block affected workflows",
                    desc: "Stop all dependent automated runs immediately until this policy conflict is resolved.",
                    tone: "border-rose-200 hover:bg-rose-50/50",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors",
                      selectedDecision === option.value ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10",
                      option.tone,
                    )}
                  >
                    <RadioGroupItem value={option.value} className="mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground">{option.title}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <label htmlFor="policy-decision-notes" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Notes {selectedDecision === "BLOCK" ? "(Required for Block)" : "(Optional)"}
              </label>
              <Textarea
                id="policy-decision-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setError(null);
                }}
                placeholder="Add context for this decision..."
                rows={2}
                className="rounded-2xl border-border/70 bg-white text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 shadow-none text-xs"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-primary text-primary-foreground shadow-none text-xs"
                onClick={handleSave}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Decision"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal for BLOCK */}
      <AlertDialog open={confirmBlockOpen} onOpenChange={setConfirmBlockOpen}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border/60 bg-background p-6 shadow-2xl">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="font-serif text-2xl tracking-tight text-rose-700">
              Block Dependent Workflows?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will immediately pause automated execution for all workflows linked to this policy (
              {impactedWorkflows}). Are you sure you want to apply this block?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end mt-4">
            <AlertDialogCancel className="rounded-full border-border/70 text-xs" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-600 text-white shadow-none hover:bg-rose-700 text-xs"
              onClick={async (e) => {
                e.preventDefault();
                setConfirmBlockOpen(false);
                await executeSubmit();
              }}
              disabled={submitting}
            >
              Confirm Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------
 * Policy Reviews Section
 * ------------------------------------------------------------------ */

function PolicyReviewsSection({
  reviews,
  loading,
  onReviewPolicy,
}: {
  reviews: G2PolicyReviewItem[];
  loading: boolean;
  onReviewPolicy: (review: G2PolicyReviewItem) => void;
}) {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">
            Policy & Compliance Reviews
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Platform terms and regulatory policies tracked by G2.
          </CardDescription>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border border-border/70 text-xs font-medium">
          {reviews.length} {reviews.length === 1 ? "policy review" : "policy reviews"}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        {loading && !reviews.length ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : reviews.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy / Family</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>What Changed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((item, idx) => {
                  const policyName = formatDisplayOrFallback(item.policy_name ?? item.policy_family, "Policy");
                  const platform = formatPlatform(item.platform);
                  const risk = item.risk_level?.trim().toUpperCase() ?? "MEDIUM";
                  const status = item.review_status?.trim().toUpperCase() ?? "PENDING";
                  const summary = item.change_summary ?? item.what_changed ?? "Policy update detected.";

                  return (
                    <TableRow key={item.policy_id ?? idx}>
                      <TableCell className="align-top font-medium text-foreground">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">{policyName}</div>
                          {item.source_url ? (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              Source <ExternalLink className="size-2.5" />
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs font-medium text-foreground">{platform}</TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={cn("rounded-full border text-[10px] font-semibold", getRiskTone(risk))}>
                          {risk}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top max-w-xs text-xs text-muted-foreground leading-relaxed">
                        <p className="line-clamp-2">{summary}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full border text-[10px] font-semibold",
                            status === "APPROVED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : status === "BLOCKED"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : "border-amber-200 bg-amber-50 text-amber-800",
                          )}
                        >
                          {status === "APPROVED" ? "Approved" : status === "BLOCKED" ? "Blocked" : "Needs review"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-border/70 text-xs shadow-none"
                          onClick={() => onReviewPolicy(item)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No pending policy reviews. All monitored policies are clear.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Account Registry Section (with Collapsible Disabled Accounts)
 * ------------------------------------------------------------------ */

function AccountRegistrySection({
  accounts,
  loading,
  error,
  onRegisterAccount,
  onViewDetails,
  onReviewHealth,
  onEditAccount,
  onDisableAccount,
}: {
  accounts: G2MonitoredAccount[];
  loading: boolean;
  error: string | null;
  onRegisterAccount: () => void;
  onViewDetails: (account: G2MonitoredAccount) => void;
  onReviewHealth: (account: G2MonitoredAccount) => void;
  onEditAccount: (account: G2MonitoredAccount) => void;
  onDisableAccount: (account: G2MonitoredAccount) => void;
}) {
  const [disabledOpen, setDisabledOpen] = useState(false);

  const activeAccounts = useMemo(
    () => accounts.filter((acc) => acc.monitoring_enabled !== false && toNormalizedText(acc.status) !== "DISABLED"),
    [accounts],
  );

  const disabledAccounts = useMemo(
    () => accounts.filter((acc) => acc.monitoring_enabled === false || toNormalizedText(acc.status) === "DISABLED"),
    [accounts],
  );

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">
            Monitored Accounts
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Accounts tracked for health and permissions before workflows run.
          </CardDescription>
        </div>

        <Button className="rounded-full bg-primary text-primary-foreground shadow-none text-xs" onClick={onRegisterAccount}>
          Register Account
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-6 pt-0 md:px-8">
        {error ? (
          <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
            <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Active Accounts Table */}
        <div className="overflow-hidden rounded-[1.75rem] border border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Current Health</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !accounts.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Loading monitored accounts...
                    </TableCell>
                  </TableRow>
                ) : activeAccounts.length ? (
                  activeAccounts.map((account) => {
                    const isWhatsApp = account.platform?.trim().toUpperCase() === "WHATSAPP";
                    const isUnknown = toNormalizedText(account.status) === "UNKNOWN";

                    return (
                      <TableRow key={account.account_registry_id ?? `${account.platform}-${account.account_id}`}>
                        <TableCell className="align-top">
                          <div className="min-w-0 space-y-1">
                            <div className="font-medium text-foreground text-sm">
                              {formatDisplayOrFallback(account.account_name, "Unnamed Account")}
                            </div>
                            {isWhatsApp && isUnknown ? (
                              <p className="text-[11px] text-amber-700 leading-4">
                                Meta rating not yet established. Monitoring active.
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top font-medium text-xs text-foreground">
                          {formatPlatform(account.platform)}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant="outline"
                            className={cn("rounded-full border text-[11px] font-semibold", getRegistryStatusTone(account.status))}
                          >
                            {formatRegistryStatus(account.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap text-xs font-medium tabular-nums text-foreground">
                          {formatClientDateTime(account.last_checked_at ?? account.updated_at ?? account.created_at)}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-border/70 bg-white text-xs shadow-none"
                              onClick={() => onViewDetails(account)}
                            >
                              <Eye className="size-3 mr-1" /> Details
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-border/70 bg-white text-xs shadow-none"
                              onClick={() => onEditAccount(account)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-rose-200 bg-white text-rose-700 text-xs shadow-none hover:bg-rose-50"
                              onClick={() => onDisableAccount(account)}
                            >
                              Disable
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                      No active monitored accounts. Register your first account to begin health tracking.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Collapsible Section for Disabled Accounts */}
        {disabledAccounts.length > 0 ? (
          <Collapsible open={disabledOpen} onOpenChange={setDisabledOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between rounded-2xl border border-dashed border-border/70 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
                <span className="font-medium">
                  Monitoring disabled ({disabledAccounts.length})
                </span>
                {disabledOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden rounded-2xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disabledAccounts.map((account) => (
                    <TableRow key={account.account_registry_id ?? `${account.platform}-${account.account_id}`}>
                      <TableCell className="align-top font-medium text-xs text-foreground">
                        {formatDisplayOrFallback(account.account_name, "Account")}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {formatPlatform(account.platform)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="rounded-full border border-slate-200 bg-slate-100 text-slate-700 text-[10px]">
                          Disabled
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-border/70 text-xs shadow-none"
                          onClick={() => onEditAccount(account)}
                        >
                          Re-enable
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------
 * Account Health Review Dialog
 * ------------------------------------------------------------------ */

function AccountHealthReviewDialog({
  open,
  onOpenChange,
  accountHealth,
  onSubmit,
  onSaved,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountHealth: G2AccountHealth | null;
  onSubmit: (payload: {
    status: G2AccountHealthAction;
    warning_type: string | null;
    restriction_type: string | null;
    evidence_url: string | null;
    admin_note: string | null;
  }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const getDefaultAction = () => {
    const normalized = toNormalizedText(accountHealth?.account_status);
    switch (normalized) {
      case "CLEAN":
      case "OK":
        return "CLEAN";
      case "WARNING":
        return "WARNING";
      case "RESTRICTED":
        return "RESTRICTED";
      case "SUSPENDED":
        return "SUSPENDED";
      default:
        return "MANUAL_ONLY";
    }
  };

  const [selectedAction, setSelectedAction] = useState<G2AccountHealthAction>(getDefaultAction());
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedAction(getDefaultAction());
      setAdminNote("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountHealth]);

  const platform = formatPlatform(accountHealth?.platform, "Unavailable");
  const accountId = formatDisplayOrFallback(accountHealth?.account_id);
  const currentStatus = formatRegistryStatus(accountHealth?.account_status);
  const lastChecked = formatClientDateTime(accountHealth?.checked_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-32px)] overflow-y-auto rounded-[32px] border-border/60 bg-background p-6 sm:p-8 shadow-2xl">
        <div className="space-y-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Review Account Health</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm the latest account health status and select next action.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
              <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-border/60 bg-muted/15 p-4 text-xs">
            <div>
              <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">Platform:</span>{" "}
              <span className="font-medium text-foreground">{platform}</span>
            </div>
            <div>
              <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">Account ID:</span>{" "}
              <span className="font-mono text-foreground break-all">{accountId}</span>
            </div>
            <div>
              <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">Status:</span>{" "}
              <span className="font-medium text-foreground">{currentStatus}</span>
            </div>
            <div>
              <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">Last Checked:</span>{" "}
              <span className="font-medium text-foreground">{lastChecked}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Update Health Status</p>
            <RadioGroup
              value={selectedAction}
              onValueChange={(value) => setSelectedAction(value as G2AccountHealthAction)}
              className="grid gap-2"
            >
              {[
                {
                  value: "CLEAN",
                  title: "Mark as Healthy",
                  description: "Account verified and clear. Workflows can proceed automatically.",
                },
                {
                  value: "MANUAL_ONLY",
                  title: "Keep Needs Review",
                  description: "Keep affected workflows in manual-only mode until evidence is confirmed.",
                },
                {
                  value: "WARNING",
                  title: "Mark as Warning",
                  description: "Account has a non-fatal warning requiring admin attention.",
                },
                {
                  value: "RESTRICTED",
                  title: "Mark as Restricted",
                  description: "Account has platform restrictions. Pauses risky actions.",
                },
                {
                  value: "SUSPENDED",
                  title: "Mark as Suspended",
                  description: "Account suspended by platform. Blocks all automated actions.",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                    selectedAction === option.value ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10",
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{option.title}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="health-update-notes" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin Notes (Optional)
            </label>
            <Textarea
              id="health-update-notes"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add details about this status update..."
              rows={2}
              className="rounded-2xl border-border/70 bg-white text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border/70 shadow-none text-xs"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-primary text-primary-foreground shadow-none text-xs"
              disabled={submitting}
              onClick={async () => {
                try {
                  await onSubmit({
                    status: selectedAction,
                    warning_type: accountHealth?.warning_type?.trim() || null,
                    restriction_type: accountHealth?.restriction_type?.trim() || null,
                    evidence_url: accountHealth?.evidence_url?.trim() || null,
                    admin_note: adminNote.trim() || null,
                  });
                  onSaved();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to save health update.");
                }
              }}
            >
              {submitting ? "Saving..." : "Save Update"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------
 * Register Account Dialog
 * ------------------------------------------------------------------ */

function RegisterAccountDialog({
  open,
  onOpenChange,
  onSubmit,
  onSaved,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    platform: string;
    account_id: string;
    account_name: string;
    account_type: string;
    status: string;
  }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const [platform, setPlatform] = useState<string>("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("PRIMARY_BUSINESS");
  const [status, setStatus] = useState("UNKNOWN");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPlatform("");
      setAccountId("");
      setAccountName("");
      setAccountType("PRIMARY_BUSINESS");
      setStatus("UNKNOWN");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[calc(100vh-64px)] overflow-y-auto rounded-[32px] border-border/60 bg-background p-6 sm:p-8 shadow-2xl">
        <div className="space-y-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Register Account</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new platform account for G2 health & policy monitoring.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
              <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-reg-platform" className="text-xs">Platform</FieldLabel>
                <Select value={platform} onValueChange={(val) => { setPlatform(val); setError(null); }}>
                  <SelectTrigger id="g2-reg-platform" className="h-10 rounded-2xl border-border/70 bg-white text-xs">
                    <SelectValue placeholder="Choose platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-reg-type" className="text-xs">Account Type</FieldLabel>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger id="g2-reg-type" className="h-10 rounded-2xl border-border/70 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-reg-id" className="text-xs">Account ID</FieldLabel>
                <Input
                  id="g2-reg-id"
                  value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); setError(null); }}
                  placeholder="e.g. 924855497254718"
                  className="h-10 rounded-2xl text-xs"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-reg-name" className="text-xs">Account Name</FieldLabel>
                <Input
                  id="g2-reg-name"
                  value={accountName}
                  onChange={(e) => { setAccountName(e.target.value); setError(null); }}
                  placeholder="e.g. Cevonne Main"
                  className="h-10 rounded-2xl text-xs"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldContent>
                <FieldLabel htmlFor="g2-reg-status" className="text-xs">Initial Status</FieldLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="g2-reg-status" className="h-10 rounded-2xl border-border/70 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_REGISTER_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border/70 shadow-none text-xs"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-primary text-primary-foreground shadow-none text-xs"
              disabled={submitting}
              onClick={async () => {
                const trimmedPlatform = platform.trim();
                const trimmedAccountId = accountId.trim();
                const trimmedAccountName = accountName.trim();

                if (!trimmedPlatform || !trimmedAccountId || !trimmedAccountName) {
                  setError("Platform, account ID, and account name are required.");
                  return;
                }

                setError(null);
                try {
                  await onSubmit({
                    platform: trimmedPlatform,
                    account_id: trimmedAccountId,
                    account_name: trimmedAccountName,
                    account_type: accountType,
                    status,
                  });
                  onSaved();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to register account.");
                }
              }}
            >
              {submitting ? "Saving..." : "Register Account"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------
 * Edit Account Dialog
 * ------------------------------------------------------------------ */

function EditAccountDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  onSaved,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: G2MonitoredAccount | null;
  onSubmit: (payload: {
    platform: string;
    account_id: string;
    account_name: string | null;
    account_type?: string | null;
    status: string;
    monitoring_enabled: boolean;
    evidence_url: string | null;
    notes: string | null;
  }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("PRIMARY_BUSINESS");
  const [status, setStatus] = useState("UNKNOWN");
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && account) {
      setAccountName(account.account_name?.trim() ?? "");
      setAccountType(account.account_type?.trim() || "PRIMARY_BUSINESS");
      setStatus(toNormalizedText(account.status) || "UNKNOWN");
      setMonitoringEnabled(account.monitoring_enabled !== false && toNormalizedText(account.status) !== "DISABLED");
      setNotes(account.notes?.trim() ?? "");
      setError(null);
    }
  }, [account, open]);

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[calc(100vh-32px)] overflow-y-auto rounded-[32px] border-border/60 bg-background p-6 sm:p-8 shadow-2xl">
        <div className="space-y-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl tracking-tight text-primary">Edit Account</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update account details, monitoring state, and administrator notes.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
              <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldContent>
                <FieldLabel htmlFor="g2-edit-name" className="text-xs">Account Name</FieldLabel>
                <Input
                  id="g2-edit-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="h-10 rounded-2xl text-xs"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-edit-type" className="text-xs">Account Type</FieldLabel>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger id="g2-edit-type" className="h-10 rounded-2xl border-border/70 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-edit-status" className="text-xs">Health Status</FieldLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="g2-edit-status" className="h-10 rounded-2xl border-border/70 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldContent>
                <FieldLabel className="text-xs">Monitoring State</FieldLabel>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                  <Switch checked={monitoringEnabled} onCheckedChange={setMonitoringEnabled} />
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-foreground">{monitoringEnabled ? "Enabled" : "Disabled"}</div>
                    <p className="text-[11px] text-muted-foreground leading-4">
                      Disabled accounts stay out of the active G2 review and verification flow.
                    </p>
                  </div>
                </div>
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldContent>
                <FieldLabel htmlFor="g2-edit-notes" className="text-xs">Notes (Optional)</FieldLabel>
                <Textarea
                  id="g2-edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-2xl border-border/70 bg-white text-xs"
                />
              </FieldContent>
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border/70 shadow-none text-xs"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-primary text-primary-foreground shadow-none text-xs"
              disabled={submitting}
              onClick={async () => {
                setError(null);
                try {
                  await onSubmit({
                    platform: account.platform ?? "",
                    account_id: account.account_id ?? "",
                    account_name: accountName.trim() || null,
                    account_type: accountType,
                    status,
                    monitoring_enabled: monitoringEnabled,
                    evidence_url: account.evidence_url ?? null,
                    notes: notes.trim() || null,
                  });
                  onSaved();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to update account.");
                }
              }}
            >
              {submitting ? "Saving..." : "Save Update"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------
 * Disable Account Confirmation Dialog
 * ------------------------------------------------------------------ */

function DisableAccountDialog({
  open,
  onOpenChange,
  account,
  onConfirm,
  onSaved,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: G2MonitoredAccount | null;
  onConfirm: (payload: { platform: string; account_id: string; notes: string | null }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-[28px] border-border/60 bg-background p-6 shadow-2xl">
        <div className="space-y-4">
          <AlertDialogHeader className="space-y-1 text-left">
            <AlertDialogTitle className="font-serif text-2xl tracking-tight text-primary">
              Disable Monitoring?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will pause health checks for{" "}
              <strong className="text-foreground">{formatDisplayOrFallback(account?.account_name, "this account")}</strong>. It
              can be re-enabled at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950">
              <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter className="gap-2 sm:justify-end mt-4">
            <AlertDialogCancel className="rounded-full border-border/70 text-xs" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-600 text-white shadow-none hover:bg-rose-700 text-xs"
              disabled={submitting || !account}
              onClick={async (e) => {
                e.preventDefault();
                if (!account) return;
                setError(null);
                try {
                  await onConfirm({
                    platform: account.platform ?? "",
                    account_id: account.account_id ?? "",
                    notes: null,
                  });
                  onSaved();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to disable monitoring.");
                }
              }}
            >
              {submitting ? "Disabling..." : "Disable Monitoring"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------
 * Main Page Component: G2PolicyAccountHealthPage
 * ------------------------------------------------------------------ */

export default function G2PolicyAccountHealthPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  /* State */
  const [snapshot, setSnapshot] = useState<G2SummaryResponse | null>(null);
  const [registrySnapshot, setRegistrySnapshot] = useState<G2MonitoredAccountsResponse | null>(null);
  const [policyReviewsSnapshot, setPolicyReviewsSnapshot] = useState<G2PolicyReviewsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [policyReviewsLoading, setPolicyReviewsLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [registryLoadError, setRegistryLoadError] = useState<string | null>(null);
  const [policyReviewsLoadError, setPolicyReviewsLoadError] = useState<string | null>(null);

  /* Modal state */
  const [accountReviewOpen, setAccountReviewOpen] = useState(false);
  const [reviewAccountHealthTarget, setReviewAccountHealthTarget] = useState<G2AccountHealth | null>(null);

  const [accountDetailOpen, setAccountDetailOpen] = useState(false);
  const [detailAccountTarget, setDetailAccountTarget] = useState<G2MonitoredAccount | null>(null);

  const [policyDecisionOpen, setPolicyDecisionOpen] = useState(false);
  const [selectedPolicyReview, setSelectedPolicyReview] = useState<G2PolicyReviewItem | null>(null);

  const [registerAccountOpen, setRegisterAccountOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [disableAccountOpen, setDisableAccountOpen] = useState(false);
  const [selectedRegistryAccount, setSelectedRegistryAccount] = useState<G2MonitoredAccount | null>(null);

  const [accountUpdatePending, setAccountUpdatePending] = useState(false);
  const [registryMutationPending, setRegistryMutationPending] = useState(false);
  const [policyDecisionPending, setPolicyDecisionPending] = useState(false);

  /* Fetchers */
  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/n8n/g2/status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_by: "website_admin" }),
        cache: "no-store",
      });
      const body = (await parseJsonResponse<G2SummaryResponse>(response)) ?? null;
      if (!response.ok) {
        throw new Error(body?.message || "G2 status summary could not be loaded.");
      }
      setSnapshot(body);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "G2 status could not be loaded.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/n8n/g2/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoring_enabled_only: false, requested_by: "website_admin" }),
        cache: "no-store",
      });
      const body = (await parseJsonResponse<G2MonitoredAccountsResponse>(response)) ?? null;
      if (!response.ok) {
        throw new Error(body?.message || "Monitored accounts could not be loaded.");
      }
      setRegistrySnapshot(body);
      setRegistryLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Monitored accounts could not be loaded.";
      setRegistryLoadError(message);
    } finally {
      setRegistryLoading(false);
    }
  }, [request]);

  const loadPolicyReviews = useCallback(async () => {
    setPolicyReviewsLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/n8n/g2/policy-reviews"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_only: true, limit: 100, requested_by: "website_admin" }),
        cache: "no-store",
      });
      const body = (await parseJsonResponse<G2PolicyReviewsResponse>(response)) ?? null;
      if (!response.ok) {
        throw new Error(body?.message || "Policy reviews could not be loaded.");
      }
      setPolicyReviewsSnapshot(body);
      setPolicyReviewsLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Policy reviews could not be loaded.";
      setPolicyReviewsLoadError(message);
    } finally {
      setPolicyReviewsLoading(false);
    }
  }, [request]);

  const loadDashboard = useCallback(async () => {
    await Promise.allSettled([loadSummary(), loadRegistry(), loadPolicyReviews()]);
  }, [loadPolicyReviews, loadRegistry, loadSummary]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /* Computed Variables */
  const registryAccounts = useMemo(() => registrySnapshot?.accounts ?? [], [registrySnapshot]);
  const policyReviews = useMemo(() => policyReviewsSnapshot?.reviews ?? [], [policyReviewsSnapshot]);

  const activeAccountsCount = useMemo(
    () => registryAccounts.filter((a) => a.monitoring_enabled !== false && toNormalizedText(a.status) !== "DISABLED").length,
    [registryAccounts],
  );

  const disabledAccountsCount = useMemo(
    () => registryAccounts.filter((a) => a.monitoring_enabled === false || toNormalizedText(a.status) === "DISABLED").length,
    [registryAccounts],
  );

  const needsReviewAccountsCount = useMemo(
    () =>
      registryAccounts.filter(
        (a) => a.monitoring_enabled !== false && G2_MONITORED_ACCOUNT_REVIEW_STATUSES.has(toNormalizedText(a.status)),
      ).length,
    [registryAccounts],
  );

  const pendingPolicyCount = policyReviewsSnapshot?.pending_count ?? policyReviews.length;

  const isManualOnlyState = useMemo(() => {
    const status = toNormalizedText(snapshot?.g2_status);
    const regStatus = toNormalizedText(snapshot?.latest_registry_monitor?.monitor_status);
    return status === "MANUAL_ONLY" || regStatus === "MANUAL_ONLY" || needsReviewAccountsCount > 0 || pendingPolicyCount > 0;
  }, [needsReviewAccountsCount, pendingPolicyCount, snapshot?.g2_status, snapshot?.latest_registry_monitor?.monitor_status]);

  const isBlockedState = useMemo(() => {
    const status = toNormalizedText(snapshot?.g2_status);
    const regStatus = toNormalizedText(snapshot?.latest_registry_monitor?.monitor_status);
    return status === "BLOCK" || status === "BLOCKED" || regStatus === "BLOCK" || regStatus === "BLOCKED";
  }, [snapshot?.g2_status, snapshot?.latest_registry_monitor?.monitor_status]);

  const displayStatus: G2DisplayStatus = isBlockedState || isManualOnlyState ? "Needs review" : "Healthy";

  const checkRows = useMemo(() => buildCheckRows(snapshot), [snapshot]);

  const registry = snapshot?.latest_registry_monitor;

  const registryStatus =
    registry?.monitor_status === "PASS"
      ? "Verified"
      : registry?.monitor_status === "MANUAL_ONLY"
        ? "Needs Review"
        : registry?.monitor_status === "BLOCK" || registry?.monitor_status === "BLOCKED"
          ? "Blocked Records"
          : "Unavailable";

  const registryDescription =
    registry?.monitor_status === "PASS"
      ? "All monitored integrations are clear"
      : registry?.monitor_status === "MANUAL_ONLY"
        ? `${registry.blocked_count ?? 0} of ${
            registry.checked_count ?? 0
          } registry records require review`
        : "Registry review data is unavailable";

  const registryTone: "emerald" | "amber" | "rose" | "slate" =
    registry?.monitor_status === "PASS"
      ? "emerald"
      : registry?.monitor_status === "MANUAL_ONLY"
        ? "amber"
        : registry?.monitor_status === "BLOCK" || registry?.monitor_status === "BLOCKED"
          ? "rose"
          : "slate";

  /* Mutations */
  const submitAccountHealthUpdate = useCallback(
    async (payload: {
      status: G2AccountHealthAction;
      warning_type: string | null;
      restriction_type: string | null;
      evidence_url: string | null;
      admin_note: string | null;
    }) => {
      const reviewTarget = reviewAccountHealthTarget ?? snapshot?.latest_account_health;
      if (!hasMeaningfulObject(reviewTarget)) {
        throw new Error("No account health record available to update.");
      }

      const platform = reviewTarget.platform?.trim();
      const accountId = reviewTarget.account_id?.trim();
      if (!platform || !accountId) {
        throw new Error("Missing platform or account ID.");
      }

      setAccountUpdatePending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/n8n/g2/update-account"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            account_id: accountId,
            status: payload.status,
            warning_type: payload.warning_type,
            restriction_type: payload.restriction_type,
            evidence_url: payload.evidence_url,
            notes: payload.admin_note,
            updated_by: "admin",
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        toast.success("Account health updated successfully.");
        await loadDashboard();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to update account health.";
        throw new Error(msg);
      } finally {
        setAccountUpdatePending(false);
      }
    },
    [loadDashboard, request, reviewAccountHealthTarget, snapshot?.latest_account_health],
  );

  const submitRegistryRegister = useCallback(
    async (payload: {
      platform: string;
      account_id: string;
      account_name: string;
      account_type: string;
      status: string;
    }) => {
      setRegistryMutationPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/n8n/g2/register-account"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            created_by: "admin",
            source: "ADMIN",
            evidence_required: false,
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        toast.success("Account registered successfully.");
        await loadDashboard();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to register account.";
        throw new Error(msg);
      } finally {
        setRegistryMutationPending(false);
      }
    },
    [loadDashboard, request],
  );

  const submitRegistryUpdate = useCallback(
    async (payload: {
      platform: string;
      account_id: string;
      account_name: string | null;
      account_type?: string | null;
      status: string;
      monitoring_enabled: boolean;
      evidence_url: string | null;
      notes: string | null;
    }) => {
      setRegistryMutationPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/n8n/g2/update-account"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            updated_by: "admin",
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        toast.success("Account updated successfully.");
        await loadDashboard();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to update account.";
        throw new Error(msg);
      } finally {
        setRegistryMutationPending(false);
      }
    },
    [loadDashboard, request],
  );

  const submitRegistryDisable = useCallback(
    async (payload: { platform: string; account_id: string; notes: string | null }) => {
      setRegistryMutationPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/n8n/g2/disable-account"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            updated_by: "admin",
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        toast.success("Monitoring disabled for account.");
        await loadDashboard();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to disable monitoring.";
        throw new Error(msg);
      } finally {
        setRegistryMutationPending(false);
      }
    },
    [loadDashboard, request],
  );

  const submitPolicyDecision = useCallback(
    async (payload: {
      policy_id: string;
      decision: G2PolicyDecision;
      decision_notes: string | null;
    }) => {
      setPolicyDecisionPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/n8n/g2/policy-decision"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            decided_by: "admin",
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        toast.success(
          payload.decision === "APPROVE"
            ? "Policy change approved."
            : payload.decision === "BLOCK"
            ? "Dependent workflows blocked."
            : "Policy kept under review.",
        );
        await loadDashboard();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to record policy decision.";
        throw new Error(msg);
      } finally {
        setPolicyDecisionPending(false);
      }
    },
    [loadDashboard, request],
  );

  const showSkeleton = loading && !snapshot && registryLoading;

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(61,10,69,0.08),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(207,168,124,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.88),_rgba(250,245,241,0.98))]" />
        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b border-border/60 bg-white/80 px-3 py-2 backdrop-blur md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <main className="w-full space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
              {/* Header */}
              <header className="overflow-hidden rounded-[2rem] border border-border/60 bg-white/95 shadow-sm">
                <div className="flex flex-col gap-4 px-6 py-6 md:px-8 md:py-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      G2 Policy + Account Health
                    </p>
                    <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
                      Policy & Account Health Monitor
                    </h1>
                    <p className="max-w-2xl text-xs leading-5 text-muted-foreground md:text-sm">
                      Watches account health, policy changes, and official evidence before dependent automations continue.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-white text-xs shadow-none">
                      <Link href="/dashboard/n8n-automations">
                        <ArrowLeft className="size-3.5 mr-1" /> Back to Automations
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border/70 bg-white text-xs shadow-none"
                      onClick={() => void loadDashboard()}
                      disabled={loading || registryLoading || policyReviewsLoading}
                    >
                      <RefreshCw className={cn("size-3.5 mr-1", (loading || registryLoading) && "animate-spin")} />
                      {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                  </div>
                </div>
              </header>

              {/* Error Alert */}
              {loadError ? (
                <Card role="alert" className="border-rose-200 bg-rose-50 shadow-none">
                  <CardContent className="flex items-start justify-between gap-3 p-4 text-xs text-rose-900">
                    <div className="space-y-1">
                      <p className="font-semibold">Unable to load G2 data</p>
                      <p>{loadError}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-rose-300 bg-white text-xs text-rose-800"
                      onClick={() => void loadDashboard()}
                    >
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {/* Explainer Banner for MANUAL_ONLY state */}
              {isManualOnlyState && !loadError ? (
                <Alert className="border-amber-200 bg-amber-50/80 text-amber-950">
                  <AlertTriangle className="size-4 text-amber-800" />
                  <AlertDescription className="text-xs text-amber-900 leading-relaxed">
                    <strong>Needs Review:</strong> G2 is working correctly, but some accounts, policies, or registry records
                    need an administrator&apos;s review before affected automations continue.
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Top 4 Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Overall Status"
                  value={
                    displayStatus === "Healthy" ? (
                      <span className="text-emerald-700">Healthy</span>
                    ) : (
                      <span className="text-amber-700">Needs Review</span>
                    )
                  }
                  subtitle={
                    displayStatus === "Healthy"
                      ? "All monitored checks clear"
                      : `${needsReviewAccountsCount + pendingPolicyCount} item(s) require attention`
                  }
                  icon={displayStatus === "Healthy" ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
                  tone={displayStatus === "Healthy" ? "emerald" : "amber"}
                />

                <SummaryCard
                  title="Monitored Accounts"
                  value={`${activeAccountsCount} Active`}
                  subtitle={`${disabledAccountsCount} monitoring disabled`}
                  icon={<CheckCircle2 className="size-5" />}
                  tone="emerald"
                />

                <SummaryCard
                  title="Policy Reviews"
                  value={pendingPolicyCount > 0 ? `${pendingPolicyCount} Pending` : "All Clear"}
                  subtitle={pendingPolicyCount > 0 ? "Reviews awaiting decision" : "No pending policy changes"}
                  icon={<ShieldAlert className="size-5" />}
                  tone={pendingPolicyCount > 0 ? "amber" : "emerald"}
                />

                <SummaryCard
                  title="Registry Monitor"
                  value={registryStatus}
                  subtitle={registryDescription}
                  icon={registryTone === "emerald" ? <ShieldCheck className="size-5" /> : <Ban className="size-5" />}
                  tone={registryTone}
                />
              </div>

              {showSkeleton ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full rounded-2xl" />
                  <Skeleton className="h-48 w-full rounded-2xl" />
                </div>
              ) : (
                <>
                  {/* Monitored Accounts Section */}
                  <AccountRegistrySection
                    accounts={registryAccounts}
                    loading={registryLoading}
                    error={registryLoadError}
                    onRegisterAccount={() => setRegisterAccountOpen(true)}
                    onViewDetails={(acc) => {
                      setDetailAccountTarget(acc);
                      setAccountDetailOpen(true);
                    }}
                    onReviewHealth={(acc) => {
                      setReviewAccountHealthTarget(getRegistryReviewTarget(acc));
                      setAccountReviewOpen(true);
                    }}
                    onEditAccount={(acc) => {
                      setSelectedRegistryAccount(acc);
                      setEditAccountOpen(true);
                    }}
                    onDisableAccount={(acc) => {
                      setSelectedRegistryAccount(acc);
                      setDisableAccountOpen(true);
                    }}
                  />

                  {/* Policy Reviews Section */}
                  <PolicyReviewsSection
                    reviews={policyReviews}
                    loading={policyReviewsLoading}
                    onReviewPolicy={(rev) => {
                      setSelectedPolicyReview(rev);
                      setPolicyDecisionOpen(true);
                    }}
                  />

                  {/* Latest Checks History */}
                  <Card className="border-border/60 bg-white/95 shadow-sm">
                    <CardHeader className="space-y-1">
                      <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">
                        Recent Health & Policy Checks
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                        Latest check results across account health, policy rules, evidence, and registry records.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Checked At</TableHead>
                            <TableHead>Area Checked</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Action / Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checkRows.length ? (
                            checkRows.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="align-top whitespace-nowrap text-xs font-medium tabular-nums text-foreground">
                                  {formatCheckedAt(row.checkedAt)}
                                </TableCell>
                                <TableCell className="align-top text-xs font-medium text-foreground">
                                  {row.areaChecked}
                                </TableCell>
                                <TableCell className="align-top text-xs font-medium text-foreground">
                                  {row.platform}
                                </TableCell>
                                <TableCell className="align-top">
                                  <Badge
                                    variant="outline"
                                    className={cn("rounded-full border text-[10px] font-semibold", resultToneClasses[row.result])}
                                  >
                                    {row.result}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-top text-xs leading-5 text-foreground text-pretty">
                                  {row.actionNeeded}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                G2 is active. Real check history will appear here as webhooks record events.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t border-border/60 px-4 py-3 bg-muted/10">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Note: &quot;Needs review&quot; (Manual-only) pauses risky actions safely until confirmed by an administrator.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Modals & Drawers */}
              <AccountDetailDrawer
                account={detailAccountTarget}
                open={accountDetailOpen}
                onOpenChange={setAccountDetailOpen}
                onReviewHealth={(acc) => {
                  setReviewAccountHealthTarget(getRegistryReviewTarget(acc));
                  setAccountReviewOpen(true);
                }}
                onEdit={(acc) => {
                  setSelectedRegistryAccount(acc);
                  setEditAccountOpen(true);
                }}
              />

              <PolicyReviewDecisionDialog
                open={policyDecisionOpen}
                onOpenChange={setPolicyDecisionOpen}
                policyReview={selectedPolicyReview}
                onSubmitDecision={submitPolicyDecision}
                submitting={policyDecisionPending}
              />

              <AccountHealthReviewDialog
                open={accountReviewOpen}
                onOpenChange={(open) => {
                  setAccountReviewOpen(open);
                  if (!open) setReviewAccountHealthTarget(null);
                }}
                accountHealth={reviewAccountHealthTarget ?? snapshot?.latest_account_health ?? null}
                onSubmit={submitAccountHealthUpdate}
                onSaved={() => {
                  setAccountReviewOpen(false);
                  setReviewAccountHealthTarget(null);
                }}
                submitting={accountUpdatePending}
              />

              <RegisterAccountDialog
                open={registerAccountOpen}
                onOpenChange={setRegisterAccountOpen}
                onSubmit={submitRegistryRegister}
                onSaved={() => setRegisterAccountOpen(false)}
                submitting={registryMutationPending}
              />

              <EditAccountDialog
                open={editAccountOpen}
                onOpenChange={(open) => {
                  setEditAccountOpen(open);
                  if (!open) setSelectedRegistryAccount(null);
                }}
                account={selectedRegistryAccount}
                onSubmit={submitRegistryUpdate}
                onSaved={() => {
                  setEditAccountOpen(false);
                  setSelectedRegistryAccount(null);
                }}
                submitting={registryMutationPending}
              />

              <DisableAccountDialog
                open={disableAccountOpen}
                onOpenChange={(open) => {
                  setDisableAccountOpen(open);
                  if (!open) setSelectedRegistryAccount(null);
                }}
                account={selectedRegistryAccount}
                onConfirm={submitRegistryDisable}
                onSaved={() => {
                  setDisableAccountOpen(false);
                  setSelectedRegistryAccount(null);
                }}
                submitting={registryMutationPending}
              />
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
