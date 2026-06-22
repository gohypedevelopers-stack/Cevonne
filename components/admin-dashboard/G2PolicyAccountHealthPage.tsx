"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
  FieldGroup,
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

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

type G2DisplayStatus = "Working" | "Needs review";
type G2DisplayResult = "PASS" | "BLOCK" | "MANUAL_ONLY";
type G2PrimaryActionKind = "none" | "account-health" | "policy-review";
type G2AccountHealthAction = "MANUAL_ONLY" | "CLEAN" | "WARNING" | "RESTRICTED" | "SUSPENDED";

type G2CheckRow = {
  key: string;
  checkedAt: string;
  checkedAtSort: number;
  areaChecked: string;
  platform: string;
  result: G2DisplayResult;
  actionNeeded: string;
};

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

const G2_MONITORED_ACCOUNT_STATUS_OPTIONS = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "CLEAN", label: "Clean" },
  { value: "WARNING", label: "Warning" },
  { value: "RESTRICTED", label: "Restricted" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
] as const;

const G2_MONITORED_ACCOUNT_REGISTER_STATUS_OPTIONS: ReadonlyArray<(typeof G2_MONITORED_ACCOUNT_STATUS_OPTIONS)[number]> =
  G2_MONITORED_ACCOUNT_STATUS_OPTIONS.filter((option) => option.value !== "CLEAN");

const G2_MONITORED_ACCOUNT_REVIEW_STATUSES = new Set(["UNKNOWN", "WARNING", "RESTRICTED", "SUSPENDED"]);

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

const statusToneClasses: Record<G2DisplayStatus, string> = {
  Working: "border-emerald-200 bg-emerald-100 text-emerald-800",
  "Needs review": "border-amber-200 bg-amber-100 text-amber-800",
};

const statusTextClasses: Record<G2DisplayStatus, string> = {
  Working: "text-emerald-700",
  "Needs review": "text-amber-700",
};

const resultToneClasses: Record<G2DisplayResult, string> = {
  PASS: "border-emerald-200 bg-emerald-100 text-emerald-800",
  BLOCK: "border-rose-200 bg-rose-100 text-rose-800",
  MANUAL_ONLY: "border-amber-200 bg-amber-100 text-amber-800",
};

const displayResultTitles: Record<G2DisplayResult, string> = {
  PASS: "PASS",
  BLOCK: "BLOCK",
  MANUAL_ONLY: "MANUAL_ONLY",
};

const accountHealthReviewStatuses = new Set(["UNKNOWN", "WARNING", "RESTRICTED", "SUSPENDED", "MANUAL_ONLY", "MISSING"]);

const getStatusHeadline = (
  snapshot: G2SummaryResponse | null,
  primaryActionKind: G2PrimaryActionKind,
  registryReviewAccount?: G2MonitoredAccount | null,
): string => {
  if (primaryActionKind === "account-health") {
    if (registryReviewAccount) {
      return "Account health needs review.";
    }

    return "Account health needs review.";
  }

  if (primaryActionKind === "policy-review") {
    return "Policy change needs review.";
  }

  if (snapshot && toNormalizedText(snapshot.g2_status) === "PASS") {
    return "Account health and policy checks are clear.";
  }

  if (snapshot) {
    const status = toNormalizedText(snapshot.g2_status);
    if (status === "BLOCK" || status === "MANUAL_ONLY") {
      return "G2 needs review.";
    }
  }

  return "Account health and policy checks are clear.";
};

const getSummaryActionNeeded = (snapshot: G2SummaryResponse | null, primaryActionKind: G2PrimaryActionKind) => {
  if (primaryActionKind === "account-health") {
    return "Review account health.";
  }

  if (primaryActionKind === "policy-review") {
    return "Review policy change.";
  }

  if (snapshot && toNormalizedText(snapshot.g2_status) === "PASS") {
    return "No action needed.";
  }

  return "Review the latest check.";
};

const getDisplayResult = (status?: string | null): G2DisplayResult => {
  switch (status?.trim().toUpperCase()) {
    case "PASS":
      return "PASS";
    case "BLOCK":
      return "BLOCK";
    default:
      return "MANUAL_ONLY";
  }
};

const toNormalizedText = (value?: string | null) => value?.trim().toUpperCase() ?? "";

const getFirstString = (value: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!value) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const getStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return entries.length ? entries : null;
};

const formatList = (value?: string[] | null, fallback = "Unavailable") => {
  if (!value?.length) {
    return fallback;
  }

  return value.join(", ");
};

const formatDisplayOrFallback = (value?: string | null, fallback = "Unavailable") => {
  if (!value || !value.trim()) {
    return fallback;
  }

  return value.trim();
};

const formatClientLabel = (value?: string | null, fallback = "Unavailable") => {
  if (!value || !value.trim()) {
    return fallback;
  }

  return titleCase(value.trim().replace(/_/g, " "));
};

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
    WHATSAPP: "WhatsApp",
    FACEBOOK: "Facebook",
    TIKTOK: "TikTok",
    YOUTUBE: "YouTube",
    ALL: "All",
  };

  return known[normalized] ?? titleCase(normalized.replace(/_/g, " "));
};

const formatAccountStatus = (value?: string | null) => {
  if (!value || !value.trim()) {
    return "Unknown";
  }

  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case "CLEAN":
    case "OK":
      return "Clean";
    case "MANUAL_ONLY":
      return "Manual only";
    case "WARNING":
      return "Warning";
    case "BLOCKED":
      return "Blocked";
    case "RESTRICTED":
      return "Restricted";
    case "SUSPENDED":
      return "Suspended";
    case "UNKNOWN":
      return "Unknown";
    default:
      return titleCase(normalized.replace(/_/g, " "));
  }
};

const formatRegistryStatus = (value?: string | null) => {
  if (!value || !value.trim()) {
    return "Unknown";
  }

  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case "CLEAN":
      return "Clean";
    case "UNKNOWN":
      return "Unknown";
    case "WARNING":
      return "Warning";
    case "RESTRICTED":
      return "Restricted";
    case "SUSPENDED":
      return "Suspended";
    case "DISABLED":
      return "Disabled";
    default:
      return titleCase(normalized.replace(/_/g, " "));
  }
};

const getRegistryMonitoringTone = (account?: G2MonitoredAccount | null) => {
  const isDisabled = account?.monitoring_enabled === false || toNormalizedText(account?.status) === "DISABLED";

  return isDisabled
    ? "border-slate-200 bg-slate-100 text-slate-800"
    : "border-emerald-200 bg-emerald-100 text-emerald-800";
};

const getRegistryMonitoringLabel = (account?: G2MonitoredAccount | null) => {
  const isDisabled = account?.monitoring_enabled === false || toNormalizedText(account?.status) === "DISABLED";
  return isDisabled ? "Disabled" : "Enabled";
};

const formatClientDateTime = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getRegistryStatusTone = (status?: string | null) => {
  const normalized = status?.trim().toUpperCase() ?? "UNKNOWN";

  if (normalized === "CLEAN") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (normalized === "WARNING" || normalized === "UNKNOWN") {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  if (normalized === "RESTRICTED" || normalized === "SUSPENDED") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-800";
};

const getRegistryActionNeeded = (account?: G2MonitoredAccount | null) => {
  if (!account) {
    return "Review the latest account.";
  }

  const status = account.status?.trim().toUpperCase() ?? "UNKNOWN";

  if (account.monitoring_enabled === false || status === "DISABLED") {
    return "Monitoring is disabled.";
  }

  if (status === "CLEAN") {
    return "No action needed.";
  }

  if (status === "WARNING") {
    return "Review account health and keep this account manual-only until the warning is cleared.";
  }

  if (status === "RESTRICTED") {
    return "Review account health and keep this account paused until the restriction is cleared.";
  }

  if (status === "SUSPENDED") {
    return "Review account health and keep this account paused until the suspension is cleared.";
  }

  return "Review account health and keep this account manual-only until evidence is available.";
};

const getRegistryReviewTarget = (account: G2MonitoredAccount): G2AccountHealth => {
  const status = account.status?.trim().toUpperCase() ?? "UNKNOWN";
  const notes = account.notes?.trim() || null;

  return {
    platform: account.platform ?? null,
    account_id: account.account_id ?? null,
    checked_at: account.last_checked_at ?? account.updated_at ?? account.created_at ?? null,
    warning_type: status === "WARNING" ? notes : null,
    account_status: status === "DISABLED" ? "UNKNOWN" : status,
    action_required: getRegistryActionNeeded(account),
    restriction_type: status === "RESTRICTED" || status === "SUSPENDED" ? notes : null,
    evidence_url: account.evidence_url ?? null,
  };
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

const getStatusActionNeededLabel = (status: G2DisplayResult, actionNeeded?: string | null) => {
  if (actionNeeded && actionNeeded.trim()) {
    return actionNeeded.trim();
  }

  switch (status) {
    case "PASS":
      return "No action needed.";
    case "MANUAL_ONLY":
      return "Review the latest check.";
    case "BLOCK":
      return "Review the latest check.";
    default:
      return "Review required.";
  }
};

const getClientNextStepSupport = (kind: G2PrimaryActionKind) => {
  if (kind === "none") {
    return "No action needed.";
  }

  if (kind === "account-health") {
    return "Open the review panel and update the account status.";
  }

  if (kind === "policy-review") {
    return "Open the review panel and update the policy change.";
  }

  return "Open the review panel to act on the latest check.";
};

const getPrimaryActionKind = (snapshot: G2SummaryResponse | null): G2PrimaryActionKind => {
  if (!snapshot) {
    return "none";
  }

  const accountStatus = toNormalizedText(snapshot.latest_account_health?.account_status);
  if (accountHealthReviewStatuses.has(accountStatus) || accountStatus === "BLOCKED") {
    return "account-health";
  }

  if (hasMeaningfulObject(snapshot.latest_policy_check?.unresolved_policy)) {
    return "policy-review";
  }

  return "none";
};

const getRegistryReviewAccount = (accounts?: G2MonitoredAccount[] | null) => {
  if (!accounts?.length) {
    return null;
  }

  const reviewableAccounts = accounts.filter((account) => {
    if (account.monitoring_enabled === false || toNormalizedText(account.status) === "DISABLED") {
      return false;
    }

    return accountHealthReviewStatuses.has(toNormalizedText(account.status));
  });

  return reviewableAccounts
    .slice()
    .sort((left, right) => {
      const leftTimestamp = getRowTimestamp(left.last_checked_at ?? left.updated_at ?? left.created_at);
      const rightTimestamp = getRowTimestamp(right.last_checked_at ?? right.updated_at ?? right.created_at);
      return (rightTimestamp ?? 0) - (leftTimestamp ?? 0);
    })[0] ?? null;
};

const getAccountHealthResult = (accountHealth?: G2AccountHealth | null): G2DisplayResult | null => {
  if (!hasMeaningfulObject(accountHealth)) {
    return null;
  }

  const normalized = accountHealth.account_status?.trim().toUpperCase();
  if (normalized === "CLEAN" || normalized === "OK") {
    return "PASS";
  }

  if (
    normalized === "UNKNOWN" ||
    normalized === "WARNING" ||
    normalized === "RESTRICTED" ||
    normalized === "SUSPENDED" ||
    normalized === "MANUAL_ONLY" ||
    normalized === "MISSING"
  ) {
    return "MANUAL_ONLY";
  }

  if (normalized === "BLOCKED") {
    return "BLOCK";
  }

  return "MANUAL_ONLY";
};

const getAccountHealthActionNeeded = (accountHealth?: G2AccountHealth | null) => {
  if (!hasMeaningfulObject(accountHealth)) {
    return null;
  }

  const normalized = accountHealth.account_status?.trim().toUpperCase();
  if (normalized === "CLEAN" || normalized === "OK") {
    return "No action needed.";
  }

  if (normalized === "WARNING") {
    return "Review account health and keep affected workflows manual-only until the warning is cleared.";
  }

  if (normalized === "RESTRICTED") {
    return "Review account health and keep affected workflows paused until the restriction is cleared.";
  }

  if (normalized === "SUSPENDED") {
    return "Review account health and keep affected workflows paused until the suspension is cleared.";
  }

  if (normalized === "BLOCKED") {
    return "Review account health and keep affected workflows paused.";
  }

  if (normalized === "UNKNOWN" || normalized === "MANUAL_ONLY" || normalized === "MISSING") {
    return "Review account health and keep affected workflows manual-only until evidence is available.";
  }

  return "Review the latest account-health check.";
};

const getEvidenceResult = (evidence?: G2Evidence | null): G2DisplayResult | null => {
  if (!hasMeaningfulObject(evidence)) {
    return null;
  }

  const normalized = evidence.evidence_status?.trim().toUpperCase();
  if (normalized === "CLEAN" || normalized === "VERIFIED" || normalized === "PASS") {
    return "PASS";
  }

  if (normalized === "WARNING" || normalized === "REVIEW" || normalized === "UNVERIFIED" || normalized === "PARTIAL") {
    return "MANUAL_ONLY";
  }

  if (normalized === "MISSING" || normalized === "BLOCKED" || normalized === "UNKNOWN" || normalized === "FAIL") {
    return "BLOCK";
  }

  return "MANUAL_ONLY";
};

const getEvidenceActionNeeded = (evidence?: G2Evidence | null) => {
  const result = getEvidenceResult(evidence);
  if (!result) {
    return null;
  }

  switch (result) {
    case "PASS":
      return "No action needed.";
    case "BLOCK":
      return "Provide the missing proof before retrying.";
    case "MANUAL_ONLY":
      return "Review the evidence.";
    default:
      return "Review required.";
  }
};

const getPolicyResult = (policyCheck?: G2PolicyReview | null) => {
  if (!policyCheck || !hasMeaningfulObject(policyCheck.latest_event)) {
    return null;
  }

  return hasMeaningfulObject(policyCheck.unresolved_policy) ? "MANUAL_ONLY" : "PASS";
};

const getPolicyAreaChecked = (policyCheck?: G2PolicyReview | null) => {
  if (!policyCheck || !hasMeaningfulObject(policyCheck.latest_event)) {
    return null;
  }

  return hasMeaningfulObject(policyCheck.unresolved_policy) ? "Policy review" : "Historical policy test";
};

const getPolicyActionNeeded = (policyCheck?: G2PolicyReview | null, actionNeeded?: string | null) => {
  if (!policyCheck || !hasMeaningfulObject(policyCheck.latest_event)) {
    return null;
  }

  if (hasMeaningfulObject(policyCheck.unresolved_policy)) {
    return actionNeeded && actionNeeded.trim() ? actionNeeded.trim() : "Human review needed.";
  }

  return "Previously reviewed.";
};

const getPolicyReviewDetails = (policyCheck?: G2PolicyReview | null) => {
  const unresolvedPolicy = hasMeaningfulObject(policyCheck?.unresolved_policy) ? policyCheck?.unresolved_policy : null;
  const latestEvent = hasMeaningfulObject(policyCheck?.latest_event) ? policyCheck?.latest_event : null;
  const detailSource = unresolvedPolicy ?? latestEvent;

  const sourceUrl = getFirstString(detailSource, ["source_url", "sourceUrl", "url"]) ?? getFirstString(latestEvent, ["source_url", "sourceUrl", "url"]);
  const policyId =
    getFirstString(detailSource, ["policy_id", "policyId", "id"]) ??
    getFirstString(latestEvent, ["policy_id", "policyId", "id"]) ??
    "Unavailable";
  const platform = formatPlatform(
    getFirstString(detailSource, ["platform"]) ?? getFirstString(latestEvent, ["platform"]),
    "All",
  );
  const policyFamily = formatClientLabel(
    getFirstString(detailSource, ["policy_family", "policyFamily", "family"]) ??
      getFirstString(latestEvent, ["policy_family", "policyFamily", "family"]),
  );
  const impactedWorkflows = formatList(
    getStringList(detailSource?.impacted_workflows) ??
      getStringList(detailSource?.impacted_workflow_groups) ??
      getStringList(latestEvent?.impacted_workflows) ??
      getStringList(latestEvent?.impacted_workflow_groups),
  );
  const lastChecked = formatClientDateTime(
    getFirstString(detailSource, ["last_checked", "checked_at", "created_at"]) ??
      getFirstString(latestEvent, ["last_checked", "checked_at", "created_at"]),
  );

  return {
    policyId,
    platform,
    policyFamily,
    sourceUrl: sourceUrl ?? "Unavailable",
    impactedWorkflows,
    lastChecked,
  };
};

const getRegistryMonitorResult = (monitor?: G2RegistryMonitor | null) => {
  if (!hasMeaningfulObject(monitor)) {
    return null;
  }

  if ((monitor.blocked_count ?? 0) > 0) {
    return "BLOCK";
  }

  if ((monitor.changed_count ?? 0) > 0) {
    return "MANUAL_ONLY";
  }

  const normalized = monitor.monitor_status?.trim().toUpperCase();
  if (normalized === "BLOCKED" || normalized === "WARNING" || normalized === "REVIEW_REQUIRED") {
    return "MANUAL_ONLY";
  }

  return "PASS";
};

const getRegistryMonitorActionNeeded = (monitor?: G2RegistryMonitor | null) => {
  const result = getRegistryMonitorResult(monitor);
  if (!result) {
    return null;
  }

  switch (result) {
    case "PASS":
      return "No action needed.";
    case "BLOCK":
      return "Review the blocked items.";
    case "MANUAL_ONLY":
      return "Review the latest monitored changes.";
    default:
      return "Review required.";
  }
};

const getRowTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
};

const buildCheckRows = (snapshot: G2SummaryResponse | null): G2CheckRow[] => {
  if (!snapshot) {
    return [];
  }

  const rows: G2CheckRow[] = [];

  if (hasMeaningfulObject(snapshot.latest_account_health)) {
    const accountHealth = snapshot.latest_account_health;
    const checkedAt = accountHealth.checked_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getAccountHealthResult(accountHealth) ?? "MANUAL_ONLY";
      rows.push({
        key: `account-health-${accountHealth.account_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Account health",
        platform: formatPlatform(accountHealth.platform),
        result,
        actionNeeded: getAccountHealthActionNeeded(accountHealth) ?? getStatusActionNeededLabel(result, snapshot.action_needed),
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_evidence)) {
    const evidence = snapshot.latest_evidence;
    const checkedAt = evidence.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getEvidenceResult(evidence) ?? "MANUAL_ONLY";
      rows.push({
        key: `evidence-${evidence.evidence_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Official evidence",
        platform: formatPlatform(evidence.platform),
        result,
        actionNeeded: getEvidenceActionNeeded(evidence) ?? getStatusActionNeededLabel(result, snapshot.action_needed),
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_policy_check?.latest_event)) {
    const policyCheck = snapshot.latest_policy_check;
    const latestEvent = policyCheck?.latest_event ?? null;
    const checkedAt = latestEvent?.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getPolicyResult(policyCheck) ?? "MANUAL_ONLY";
      rows.push({
        key: `policy-${latestEvent?.event_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: getPolicyAreaChecked(policyCheck) ?? "Policy review",
        platform: formatPlatform(latestEvent?.platform, "All"),
        result,
        actionNeeded: getPolicyActionNeeded(policyCheck, snapshot.action_needed) ?? getStatusActionNeededLabel(result, snapshot.action_needed),
      });
    }
  }

  if (hasMeaningfulObject(snapshot.latest_registry_monitor)) {
    const monitor = snapshot.latest_registry_monitor;
    const checkedAt = monitor.created_at ?? snapshot.generated_at ?? "";
    const checkedAtSort = getRowTimestamp(checkedAt);
    if (checkedAtSort !== null) {
      const result = getRegistryMonitorResult(monitor) ?? "MANUAL_ONLY";
      rows.push({
        key: `registry-${monitor.run_id ?? checkedAtSort}`,
        checkedAt,
        checkedAtSort,
        areaChecked: "Registry monitor",
        platform: formatPlatform(
          snapshot.latest_account_health?.platform ?? snapshot.latest_evidence?.platform ?? snapshot.latest_policy_check?.latest_event?.platform ?? null,
          "All",
        ),
        result,
        actionNeeded: getRegistryMonitorActionNeeded(monitor) ?? getStatusActionNeededLabel(result, snapshot.action_needed),
      });
    }
  }

  return rows.sort((left, right) => right.checkedAtSort - left.checkedAtSort).slice(0, 3);
};

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

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm leading-6 text-foreground text-pretty", valueClassName)}>{value}</dd>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardContent className="space-y-5 p-6 md:p-8">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-10 w-3/4 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NextStepSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-2xl" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-11 rounded-full" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Skeleton className="h-6 w-48 rounded-2xl" />
        <Skeleton className="h-4 w-60 rounded-full" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NextStepCard({
  primaryActionKind,
  onReviewAccountHealth,
  onReviewPolicyChange,
}: {
  primaryActionKind: G2PrimaryActionKind;
  onReviewAccountHealth: () => void;
  onReviewPolicyChange: () => void;
}) {
  const actionLabel =
    primaryActionKind === "account-health" ? "Review account health" : primaryActionKind === "policy-review" ? "Review policy change" : null;

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="font-serif text-xl tracking-tight text-primary text-balance">Next step</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-foreground text-pretty">{getClientNextStepSupport(primaryActionKind)}</p>

        {actionLabel ? (
          <Button
            className="w-full rounded-full bg-primary text-primary-foreground shadow-none"
            onClick={primaryActionKind === "account-health" ? onReviewAccountHealth : onReviewPolicyChange}
          >
            {actionLabel}
          </Button>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
            No action needed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
    const normalized = accountHealth?.account_status?.trim().toUpperCase();
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedAction(getDefaultAction());
    setError(null);
    // Re-initialize the form every time the dialog is opened so it reflects the latest row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountHealth]);

  const platform = formatPlatform(accountHealth?.platform, "Unavailable");
  const accountId = formatDisplayOrFallback(accountHealth?.account_id);
  const currentStatus = formatAccountStatus(accountHealth?.account_status);
  const lastChecked = formatClientDateTime(accountHealth?.checked_at);
  const actionNeeded = getAccountHealthActionNeeded(accountHealth) ?? "Review the latest check.";
  const summaryRows = [
    { label: "Platform", value: platform },
    { label: "Account ID", value: accountId, valueClassName: "break-all" },
    { label: "Current status", value: currentStatus, valueClassName: "font-medium" },
    { label: "Last checked", value: lastChecked, valueClassName: "font-medium tabular-nums" },
    { label: "Action needed", value: actionNeeded, valueClassName: "font-medium" },
  ] as Array<{ label: string; value: ReactNode; valueClassName?: string }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(1400px,calc(100vw-32px))] !max-w-[min(1400px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-hidden rounded-[32px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="flex max-h-[calc(100vh-32px)] flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8">
            <div className="space-y-8">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Review account health</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Confirm the latest account status and choose the next safe update.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
              <AlertDescription className="text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="min-w-0 border-border/60 bg-white/95 shadow-sm">
              <CardHeader className="flex flex-col gap-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Current check summary</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  Confirm the latest row before saving an update.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <dl className="overflow-hidden rounded-3xl border border-border/60 bg-muted/15">
                  {summaryRows.map((row, index) => (
                    <div key={row.label} className={cn(index > 0 && "border-t border-border/60")}>
                      <SummaryRow label={row.label} value={row.value} valueClassName={row.valueClassName} />
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/60 bg-white/95 shadow-sm">
              <CardHeader className="flex flex-col gap-2">
                <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Choose what to do next</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 px-6 pb-6 pt-0">
                <FieldSet className="flex flex-col gap-3">
                  <RadioGroup
                    value={selectedAction}
                    onValueChange={(value) => {
                      setSelectedAction(value as G2AccountHealthAction);
                    }}
                    className="grid grid-cols-1 gap-3"
                  >
                    {[
                      {
                        value: "MANUAL_ONLY",
                        title: "Keep manual-only",
                        description: "Keep affected workflows paused until evidence is available.",
                      },
                      {
                        value: "CLEAN",
                        title: "Mark as CLEAN",
                        description: "Use only when the account has been checked and proof is available.",
                      },
                      {
                        value: "WARNING",
                        title: "Mark as WARNING",
                        description: "Use when the account has a warning and needs attention.",
                      },
                      {
                        value: "RESTRICTED",
                        title: "Mark as RESTRICTED",
                        description: "Use when the account is restricted.",
                      },
                      {
                        value: "SUSPENDED",
                        title: "Mark as SUSPENDED",
                        description: "Use when the account is suspended.",
                      },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex min-h-[96px] cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-primary/60 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                          selectedAction === option.value && "border-primary bg-primary/5",
                        )}
                      >
                        <RadioGroupItem value={option.value} className="mt-1" />
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium leading-5 text-foreground">{option.title}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </FieldSet>
              </CardContent>
            </Card>
          </div>

            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-background/95 px-8 py-4 backdrop-blur">
            <DialogFooter className="m-0 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 bg-white shadow-none"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-primary text-primary-foreground shadow-none"
                disabled={submitting}
                onClick={async () => {
                  try {
                    await onSubmit({
                      status: selectedAction,
                      warning_type: accountHealth?.warning_type?.trim() || null,
                      restriction_type: accountHealth?.restriction_type?.trim() || null,
                      evidence_url: accountHealth?.evidence_url?.trim() || null,
                      admin_note: null,
                    });
                    onSaved();
                  } catch (submitError) {
                    setError(submitError instanceof Error ? submitError.message : "Unable to save the account-health update.");
                  }
                }}
              >
                {submitting ? "Saving..." : "Save update"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolicyReviewDialog({
  open,
  onOpenChange,
  policyCheck,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyCheck: G2PolicyReview | null;
}) {
  const details = getPolicyReviewDetails(policyCheck);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-48px)] w-[calc(100vw-48px)] max-w-[920px] overflow-y-auto rounded-[32px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="space-y-6 p-8">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Review policy change</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              This shows the latest policy review details. Historical policy events stay informational until the open review is cleared.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <InfoField label="Policy ID" value={details.policyId} valueClassName="font-medium" />
            <InfoField label="Platform" value={details.platform} valueClassName="font-medium" />
            <InfoField label="Policy family" value={details.policyFamily} valueClassName="font-medium" />
            <InfoField label="Source URL" value={details.sourceUrl} valueClassName="font-medium break-all" />
            <InfoField label="Impacted workflows" value={details.impactedWorkflows} valueClassName="font-medium" className="md:col-span-2" />
            <InfoField label="Last checked" value={details.lastChecked} valueClassName="font-medium tabular-nums" />
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
            Review the policy change above, then clear the open review in the source workflow when the change is resolved.
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              className="rounded-full bg-primary text-primary-foreground shadow-none"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountRegistrySection({
  accounts,
  snapshot,
  loading,
  error,
  onRegisterAccount,
  onReviewHealth,
  onEditAccount,
  onDisableAccount,
}: {
  accounts: G2MonitoredAccount[];
  snapshot: G2MonitoredAccountsResponse | null;
  loading: boolean;
  error: string | null;
  onRegisterAccount: () => void;
  onReviewHealth: (account: G2MonitoredAccount) => void;
  onEditAccount: (account: G2MonitoredAccount) => void;
  onDisableAccount: (account: G2MonitoredAccount) => void;
}) {
  if (loading && !accounts.length && !error) {
    return (
      <Card className="border-border/60 bg-white/95 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Account Registry</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">Loading monitored accounts…</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0 md:px-8">
          <div className="rounded-3xl border border-border/60 bg-muted/15 p-4">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="mt-4 h-10 rounded-2xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCount = snapshot?.total_count ?? accounts.length;
  const cleanCount = snapshot?.clean_count ?? accounts.filter((account) => toNormalizedText(account.status) === "CLEAN").length;
  const needsReviewCount =
    snapshot?.needs_review_count ??
    accounts.filter((account) => {
      const status = toNormalizedText(account.status);
      return account.monitoring_enabled !== false && G2_MONITORED_ACCOUNT_REVIEW_STATUSES.has(status);
    }).length;
  const disabledCount =
    snapshot?.disabled_count ?? accounts.filter((account) => account.monitoring_enabled === false || toNormalizedText(account.status) === "DISABLED").length;

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Account Registry</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            Manage the monitored accounts G2 checks before risky workflows continue.
          </CardDescription>
        </div>

        <Button className="rounded-full bg-primary text-primary-foreground shadow-none" onClick={onRegisterAccount}>
          Register account
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pb-6 pt-0 md:px-8">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoField label="Total monitored" value={totalCount} valueClassName="text-2xl font-semibold tabular-nums" />
          <InfoField label="Clean" value={cleanCount} valueClassName="text-2xl font-semibold tabular-nums text-emerald-700" />
          <InfoField label="Needs review" value={needsReviewCount} valueClassName="text-2xl font-semibold tabular-nums text-amber-700" />
          <InfoField label="Disabled" value={disabledCount} valueClassName="text-2xl font-semibold tabular-nums text-slate-700" />
        </dl>

        {error ? (
          <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
            <AlertDescription className="text-rose-800">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-[1.75rem] border border-border/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Monitoring</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length ? (
                  accounts.map((account) => {
                    const accountStatus = toNormalizedText(account.status);
                    const isDisabled = account.monitoring_enabled === false || accountStatus === "DISABLED";

                    return (
                      <TableRow key={account.account_registry_id ?? `${account.platform}-${account.account_id}`}>
                        <TableCell className="align-top">
                          <div className="min-w-0 space-y-1">
                            <div className="break-words font-medium text-foreground text-pretty">{formatDisplayOrFallback(account.account_name, "Unavailable")}</div>
                            <div className="break-all text-xs leading-5 text-muted-foreground">{formatDisplayOrFallback(account.account_id, "Unavailable")}</div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="font-medium text-foreground" translate="no">
                            {formatPlatform(account.platform, "Unavailable")}
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", getRegistryStatusTone(account.status))}>
                            {formatRegistryStatus(account.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", getRegistryMonitoringTone(account))}>
                            {getRegistryMonitoringLabel(account)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap font-medium tabular-nums text-foreground">
                          {formatClientDateTime(account.last_checked_at ?? account.updated_at ?? account.created_at)}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-border/70 bg-white shadow-none"
                              onClick={() => onReviewHealth(account)}
                              disabled={isDisabled}
                            >
                              Review
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-border/70 bg-white shadow-none"
                              onClick={() => onEditAccount(account)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full border-rose-200 bg-white text-rose-700 shadow-none hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => onDisableAccount(account)}
                              disabled={isDisabled}
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
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No monitored accounts yet. Register the first account to start tracking it in G2.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
    status: string;
  }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const [platform, setPlatform] = useState<string>("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [status, setStatus] = useState("UNKNOWN");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPlatform("");
    setAccountId("");
    setAccountName("");
    setStatus("UNKNOWN");
    setError(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(960px,calc(100vw-64px))] max-h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden rounded-[32px] border-border/60 bg-background p-8 shadow-2xl">
        <div className="space-y-8">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Register account</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">Add an account for G2 to monitor.</DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
              <AlertDescription className="text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-register-platform">Platform</FieldLabel>
                <Select
                  value={platform}
                  onValueChange={(value) => {
                    setPlatform(value);
                    setError(null);
                  }}
                >
                  <SelectTrigger id="g2-register-platform" className="h-11 rounded-2xl border-border/70 bg-white">
                    <SelectValue placeholder="Choose a platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-register-account-id">Account ID</FieldLabel>
                <Input
                  id="g2-register-account-id"
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    setError(null);
                  }}
                  placeholder="924855497254718"
                  autoComplete="off"
                  spellCheck={false}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-register-account-name">Account name</FieldLabel>
                <Input
                  id="g2-register-account-name"
                  value={accountName}
                  onChange={(event) => {
                    setAccountName(event.target.value);
                    setError(null);
                  }}
                  placeholder="G5 Publishing"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldContent>
                <FieldLabel htmlFor="g2-register-status">Current status</FieldLabel>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setError(null);
                  }}
                >
                  <SelectTrigger id="g2-register-status" className="h-11 rounded-2xl border-border/70 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {G2_MONITORED_ACCOUNT_REGISTER_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-8 border-t border-border/60 bg-background/95 px-8 py-4 backdrop-blur">
            <DialogFooter className="m-0 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 bg-white shadow-none"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-primary text-primary-foreground shadow-none"
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
                      status,
                    });
                    onSaved();
                  } catch (submitError) {
                    setError(submitError instanceof Error ? submitError.message : "Unable to register the account.");
                  }
                }}
              >
                {submitting ? "Saving..." : "Register account"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    status: string;
    monitoring_enabled: boolean;
    evidence_url: string | null;
    notes: string | null;
  }) => Promise<void>;
  onSaved: () => void;
  submitting: boolean;
}) {
  const [accountName, setAccountName] = useState("");
  const [status, setStatus] = useState("UNKNOWN");
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !account) {
      return;
    }

    setAccountName(account.account_name?.trim() ?? "");
    setStatus(toNormalizedText(account.status) || "UNKNOWN");
    setMonitoringEnabled(account.monitoring_enabled !== false && toNormalizedText(account.status) !== "DISABLED");
    setError(null);
  }, [account, open]);

  const platform = formatPlatform(account?.platform, "Unavailable");
  const accountId = formatDisplayOrFallback(account?.account_id);
  const currentStatus = formatRegistryStatus(account?.status);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogContent className="!w-[min(900px,calc(100vw-32px))] !max-w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-hidden rounded-[32px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="flex max-h-[calc(100vh-32px)] flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Edit account</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Update the monitored account details and monitoring state.
              </DialogDescription>
            </DialogHeader>

            {account ? (
              <div className="mt-6 grid gap-3 rounded-3xl border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground sm:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Platform</p>
                  <p className="mt-1 font-medium text-foreground">{platform}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account ID</p>
                  <p className="mt-1 break-all font-medium text-foreground">{accountId}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Current status</p>
                  <p className="mt-1 font-medium text-foreground">{currentStatus}</p>
                </div>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive" className="mt-6 border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
                <AlertDescription className="text-rose-800">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <Field className="md:col-span-2">
                <FieldContent>
                  <FieldLabel htmlFor="g2-edit-account-name">Account name</FieldLabel>
                  <Input
                    id="g2-edit-account-name"
                    value={accountName}
                    onChange={(event) => {
                      setAccountName(event.target.value);
                      setError(null);
                    }}
                    placeholder="Account name"
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldContent>
                  <FieldLabel htmlFor="g2-edit-status">Status</FieldLabel>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value);
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="g2-edit-status" className="h-11 rounded-2xl border-border/70 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {G2_MONITORED_ACCOUNT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Pick the current registry status for this account.</FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldContent className="space-y-2">
                  <FieldLabel>Monitoring enabled</FieldLabel>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white px-4 py-3">
                    <Switch
                      checked={monitoringEnabled}
                      onCheckedChange={(checked) => {
                        setMonitoringEnabled(checked);
                        setError(null);
                      }}
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground">{monitoringEnabled ? "Enabled" : "Disabled"}</div>
                      <p className="text-xs leading-5 text-muted-foreground">Disabled accounts stay out of the active G2 review flow.</p>
                    </div>
                  </div>
                </FieldContent>
              </Field>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-background/95 px-8 py-4 backdrop-blur">
            <DialogFooter className="m-0 gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border/70 bg-white shadow-none"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-primary text-primary-foreground shadow-none"
                disabled={submitting || !account}
                onClick={async () => {
                  if (!account) {
                    setError("No account is selected.");
                    return;
                  }

                  setError(null);
                  try {
                    await onSubmit({
                      platform: account.platform ?? "",
                      account_id: account.account_id ?? "",
                      account_name: accountName.trim() || null,
                      status,
                      monitoring_enabled: monitoringEnabled,
                      evidence_url: account.evidence_url ?? null,
                      notes: account.notes ?? null,
                    });
                    onSaved();
                  } catch (submitError) {
                    setError(submitError instanceof Error ? submitError.message : "Unable to update the account.");
                  }
                }}
              >
                {submitting ? "Saving..." : "Save update"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    if (open) {
      setError(null);
    }
  }, [open]);

  const accountName = formatDisplayOrFallback(account?.account_name);
  const platform = formatPlatform(account?.platform, "Unavailable");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <AlertDialogContent className="max-w-[620px] rounded-[28px] border-border/60 bg-background p-0 shadow-2xl">
        <div className="space-y-5 p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="font-serif text-3xl tracking-tight text-primary">Disable monitoring?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-muted-foreground">
              Disable monitoring for this account? This will keep it out of the active G2 review flow.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {account ? (
            <div className="rounded-3xl border border-border/60 bg-muted/15 p-4 text-sm leading-6 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Account:</span> {accountName}
              </div>
              <div>
                <span className="font-medium text-foreground">Platform:</span> {platform}
              </div>
              <div className="break-all">
                <span className="font-medium text-foreground">Account ID:</span> {formatDisplayOrFallback(account.account_id)}
              </div>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
              <AlertDescription className="text-rose-800">{error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel className="rounded-full border-border/70 bg-white shadow-none" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-600 text-white shadow-none hover:bg-rose-700"
              disabled={submitting || !account}
              onClick={async (event) => {
                event.preventDefault();
                if (!account) {
                  setError("No account is selected.");
                  return;
                }

                setError(null);
                try {
                  await onConfirm({
                    platform: account.platform ?? "",
                    account_id: account.account_id ?? "",
                    notes: null,
                  });
                  onSaved();
                } catch (submitError) {
                  setError(submitError instanceof Error ? submitError.message : "Unable to disable monitoring.");
                }
              }}
            >
              {submitting ? "Saving..." : "Disable monitoring"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function G2PolicyAccountHealthPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [snapshot, setSnapshot] = useState<G2SummaryResponse | null>(null);
  const [registrySnapshot, setRegistrySnapshot] = useState<G2MonitoredAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registryLoadError, setRegistryLoadError] = useState<string | null>(null);
  const [accountUpdateNotice, setAccountUpdateNotice] = useState<string | null>(null);
  const [registryUpdateNotice, setRegistryUpdateNotice] = useState<string | null>(null);
  const [accountReviewOpen, setAccountReviewOpen] = useState(false);
  const [policyReviewOpen, setPolicyReviewOpen] = useState(false);
  const [accountUpdatePending, setAccountUpdatePending] = useState(false);
  const [registryMutationPending, setRegistryMutationPending] = useState(false);
  const [registerAccountOpen, setRegisterAccountOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [disableAccountOpen, setDisableAccountOpen] = useState(false);
  const [reviewAccountHealthTarget, setReviewAccountHealthTarget] = useState<G2AccountHealth | null>(null);
  const [selectedRegistryAccount, setSelectedRegistryAccount] = useState<G2MonitoredAccount | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/g2-status-summary"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const body = (await parseJsonResponse<G2SummaryResponse>(response)) ?? null;

      if (!response.ok) {
        throw new Error(body?.message || "G2 status could not be loaded. Ask admin to check the G2 status summary endpoint.");
      }

      setSnapshot(body);
      setLoadError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "G2 status could not be loaded. Ask admin to check the G2 status summary endpoint.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      const response = await request(buildRouteUrl("/api/admin/g2-list-accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });

      const body = (await parseJsonResponse<G2MonitoredAccountsResponse>(response)) ?? null;
      if (!response.ok) {
        throw new Error(body?.message || "G2 monitored accounts could not be loaded.");
      }

      setRegistrySnapshot(body);
      setRegistryLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "G2 monitored accounts could not be loaded.";
      setRegistryLoadError(message);
      toast.error(message);
    } finally {
      setRegistryLoading(false);
    }
  }, [request]);

  const loadDashboard = useCallback(async () => {
    await Promise.allSettled([loadSummary(), loadRegistry()]);
  }, [loadRegistry, loadSummary]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!accountUpdateNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setAccountUpdateNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [accountUpdateNotice]);

  useEffect(() => {
    if (!registryUpdateNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setRegistryUpdateNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [registryUpdateNotice]);

  const latestAccountHealth = snapshot?.latest_account_health ?? null;
  const latestPolicyCheck = snapshot?.latest_policy_check ?? null;
  const registryAccounts = useMemo(() => registrySnapshot?.accounts ?? [], [registrySnapshot]);
  const latestRegistryReviewAccount = useMemo(() => getRegistryReviewAccount(registryAccounts), [registryAccounts]);
  const latestRegistryActiveAccount = useMemo(
    () =>
      registryAccounts.find((account) => {
        return account.monitoring_enabled !== false && toNormalizedText(account.status) !== "DISABLED";
      }) ?? null,
    [registryAccounts],
  );
  const primaryActionKind = latestRegistryReviewAccount ? "account-health" : getPrimaryActionKind(snapshot);

  const hasContent = useMemo(() => {
    if (!snapshot) {
      return registryAccounts.length > 0;
    }

    return (
      hasMeaningfulObject(snapshot.latest_account_health) ||
      hasMeaningfulObject(snapshot.latest_policy_check?.latest_event) ||
      hasMeaningfulObject(snapshot.latest_evidence) ||
      hasMeaningfulObject(snapshot.latest_registry_monitor) ||
      registryAccounts.length > 0
    );
  }, [registryAccounts.length, snapshot]);

  const checkRows = useMemo(() => buildCheckRows(snapshot), [snapshot]);
  const latestCheckRow = checkRows[0] ?? null;
  const snapshotDisplayResult = snapshot ? getDisplayResult(snapshot.g2_status ?? null) : null;
  const displayStatus: G2DisplayStatus =
    primaryActionKind === "none" && (snapshotDisplayResult === null || snapshotDisplayResult === "PASS") ? "Working" : "Needs review";
  const displayResult = latestRegistryReviewAccount
    ? "MANUAL_ONLY"
    : primaryActionKind === "policy-review"
      ? "MANUAL_ONLY"
      : snapshotDisplayResult ?? "PASS";
  const statusMessage = getStatusHeadline(snapshot, primaryActionKind, latestRegistryReviewAccount);
  let lastChecked = formatClientDateTime(latestCheckRow?.checkedAt ?? snapshot?.generated_at);
  if (latestRegistryReviewAccount) {
    lastChecked = formatClientDateTime(
      latestRegistryReviewAccount.last_checked_at ?? latestRegistryReviewAccount.updated_at ?? latestRegistryReviewAccount.created_at,
    );
  } else if (!snapshot && latestRegistryActiveAccount) {
    lastChecked = formatClientDateTime(
      latestRegistryActiveAccount.last_checked_at ?? latestRegistryActiveAccount.updated_at ?? latestRegistryActiveAccount.created_at,
    );
  }
  const lastResultLabel = displayResultTitles[displayResult];
  const actionNeeded = getSummaryActionNeeded(snapshot, primaryActionKind);
  const actionButtonLabel =
    primaryActionKind === "account-health"
      ? "Review account health"
      : primaryActionKind === "policy-review"
        ? "Review policy change"
        : null;
  const showSkeleton = loading && !snapshot && registryLoading;

  const submitAccountHealthUpdate = useCallback(
    async (payload: {
      status: G2AccountHealthAction;
      warning_type: string | null;
      restriction_type: string | null;
      evidence_url: string | null;
      admin_note: string | null;
    }) => {
      const reviewTarget = reviewAccountHealthTarget ?? latestAccountHealth;
      if (!hasMeaningfulObject(reviewTarget)) {
        throw new Error("No account health row is available to update.");
      }

      const platform = reviewTarget.platform?.trim();
      const accountId = reviewTarget.account_id?.trim();
      if (!platform || !accountId) {
        throw new Error("The latest account health row is missing the platform or account ID.");
      }

      setAccountUpdatePending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/g2-account-health-update"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            account_id: accountId,
            status: payload.status,
            warning_type: payload.warning_type,
            restriction_type: payload.restriction_type,
            evidence_url: payload.evidence_url,
            admin_note: payload.admin_note,
            checked_by: "admin",
          }),
          cache: "no-store",
        });

        const body = (await parseJsonResponse<{ status?: string; g2_status?: string; message?: string }>(response)) ?? null;
        if (!response.ok) {
          throw new Error(body?.message || `Request failed (${response.status})`);
        }

        await loadDashboard();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update account health.";
        throw new Error(message);
      } finally {
        setAccountUpdatePending(false);
      }
    },
    [latestAccountHealth, loadDashboard, request, reviewAccountHealthTarget],
  );

  const submitRegistryRegister = useCallback(
    async (payload: {
      platform: string;
      account_id: string;
      account_name: string;
      status: string;
    }) => {
      setRegistryMutationPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/g2-register-account"), {
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

        await loadDashboard();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to register the account.";
        throw new Error(message);
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
      status: string;
      monitoring_enabled: boolean;
      evidence_url: string | null;
      notes: string | null;
    }) => {
      setRegistryMutationPending(true);
      try {
        const response = await request(buildRouteUrl("/api/admin/g2-update-account"), {
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

        await loadDashboard();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update the account.";
        throw new Error(message);
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
        const response = await request(buildRouteUrl("/api/admin/g2-disable-account"), {
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

        await loadDashboard();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to disable monitoring.";
        throw new Error(message);
      } finally {
        setRegistryMutationPending(false);
      }
    },
    [loadDashboard, request],
  );

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-[#faf5f1]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(61,10,69,0.08),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(207,168,124,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.88),_rgba(250,245,241,0.98))]" />
        <AppSidebar />

        <SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 grid grid-cols-[auto,1fr] items-center gap-2 border-b border-border/60 bg-white/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="text-sm font-medium text-primary/80">Menu</span>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <main className="w-full space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
              <header className="overflow-hidden rounded-[2rem] border border-border/60 bg-white/95 shadow-sm">
                <div className="flex flex-col gap-4 px-6 py-6 md:px-8 md:py-8 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground" translate="no">
                      G2 Policy + Account Health
                    </p>
                    <h1 className="font-serif text-3xl tracking-tight text-foreground text-balance md:text-4xl" translate="no">
                      G2 — Policy + Account Health Monitor
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty md:text-base">
                      Watches account health, policy changes, and review status before risky workflows continue.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-border/70 bg-white shadow-none">
                      <Link href="/dashboard/n8n-automations">
                        <ArrowLeft data-icon="inline-start" />
                        Back to N8N Automations
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border/70 bg-white shadow-none"
                      onClick={() => void loadDashboard()}
                      disabled={loading}
                    >
                      <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
                      {loading ? (snapshot ? "Refreshing…" : "Loading…") : "Refresh"}
                    </Button>
                  </div>
                </div>
              </header>

              {loadError ? (
                <Card role="alert" className="border-rose-200 bg-rose-50 shadow-none">
                  <CardContent className="p-4 text-sm leading-6 text-rose-900">{loadError}</CardContent>
                </Card>
              ) : null}

              {accountUpdateNotice ? (
                <Alert variant="default" className="border-emerald-200 bg-emerald-50 text-emerald-950" aria-live="polite">
                  <AlertDescription className="text-emerald-800">{accountUpdateNotice}</AlertDescription>
                </Alert>
              ) : null}

              {registryUpdateNotice ? (
                <Alert variant="default" className="border-emerald-200 bg-emerald-50 text-emerald-950" aria-live="polite">
                  <AlertDescription className="text-emerald-800">{registryUpdateNotice}</AlertDescription>
                </Alert>
              ) : null}

              {registryLoadError ? (
                <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-950" aria-live="polite">
                  <AlertDescription className="text-rose-800">{registryLoadError}</AlertDescription>
                </Alert>
              ) : null}

              {showSkeleton ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    <StatusSkeleton />
                    <TableSkeleton />
                    <TableSkeleton />
                  </div>
                  <div className="space-y-4">
                    <NextStepSkeleton />
                  </div>
                </div>
              ) : hasContent ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardHeader className="space-y-2 pb-0">
                        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.24em]", statusTextClasses[displayStatus])}>
                          {displayStatus}
                        </p>
                        <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Current G2 Status</CardTitle>
                        <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">{statusMessage}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6 p-6 pt-0 md:p-8">
                        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <InfoField
                            label="Status"
                            value={
                              <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", statusToneClasses[displayStatus])}>
                                {displayStatus}
                              </Badge>
                            }
                          />
                          <InfoField label="Last Checked" value={lastChecked} valueClassName="font-medium tabular-nums" />
                          <InfoField
                            label="Action Needed"
                            value={
                              actionButtonLabel ? (
                                <div className="flex flex-col gap-3">
                                  <p className="text-sm leading-6 text-foreground text-pretty">{actionNeeded}</p>
                                  <Button
                                    className="w-full rounded-full bg-primary text-primary-foreground shadow-none"
                                    onClick={() => {
                                      if (primaryActionKind === "account-health") {
                                        setReviewAccountHealthTarget(
                                          latestRegistryReviewAccount ? getRegistryReviewTarget(latestRegistryReviewAccount) : null,
                                        );
                                        setAccountReviewOpen(true);
                                      }
                                      if (primaryActionKind === "policy-review") {
                                        setPolicyReviewOpen(true);
                                      }
                                    }}
                                  >
                                    {actionButtonLabel}
                                  </Button>
                                </div>
                              ) : (
                                actionNeeded
                              )
                            }
                            valueClassName="font-medium"
                          />
                          <InfoField label="Last Result" value={lastResultLabel} valueClassName="font-medium" />
                        </dl>
                      </CardContent>
                    </Card>

                    <AccountRegistrySection
                      accounts={registryAccounts}
                      snapshot={registrySnapshot}
                      loading={registryLoading}
                      error={registryLoadError}
                      onRegisterAccount={() => setRegisterAccountOpen(true)}
                      onReviewHealth={(account) => {
                        setReviewAccountHealthTarget(getRegistryReviewTarget(account));
                        setAccountReviewOpen(true);
                      }}
                      onEditAccount={(account) => {
                        setSelectedRegistryAccount(account);
                        setEditAccountOpen(true);
                      }}
                      onDisableAccount={(account) => {
                        setSelectedRegistryAccount(account);
                        setDisableAccountOpen(true);
                      }}
                    />

                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardHeader className="space-y-2">
                        <CardTitle className="font-serif text-2xl tracking-tight text-primary text-balance">Recent Health + Policy Checks</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">Latest 3 checks only.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Checked At</TableHead>
                              <TableHead>Area Checked</TableHead>
                              <TableHead>Platform</TableHead>
                              <TableHead>Result</TableHead>
                              <TableHead>Action Needed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {checkRows.length ? (
                              checkRows.map((row) => (
                                <TableRow key={row.key}>
                                  <TableCell className="align-top whitespace-nowrap font-medium tabular-nums text-foreground">
                                    {formatCheckedAt(row.checkedAt)}
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <span className="font-medium text-foreground" translate="no">
                                      {row.areaChecked}
                                    </span>
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <span className="text-sm font-medium text-foreground" translate="no">
                                      {row.platform}
                                    </span>
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Badge variant="outline" className={cn("rounded-full border text-[11px] font-semibold tracking-[0.08em]", resultToneClasses[row.result])}>
                                      {displayResultTitles[row.result]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="align-top text-sm leading-6 text-foreground text-pretty">
                                    {row.actionNeeded}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                  G2 is active, but no account or policy check has been recorded yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        <div className="border-t border-border/60 px-4 py-3">
                          <p className="text-xs leading-5 text-muted-foreground">
                            Manual-only means affected workflows pause until review is done.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <aside className="space-y-4">
                    <NextStepCard
                      primaryActionKind={primaryActionKind}
                      onReviewAccountHealth={() => {
                        setReviewAccountHealthTarget(
                          latestRegistryReviewAccount ? getRegistryReviewTarget(latestRegistryReviewAccount) : null,
                        );
                        setAccountReviewOpen(true);
                      }}
                      onReviewPolicyChange={() => setPolicyReviewOpen(true)}
                    />
                  </aside>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
                  <div className="space-y-4">
                    <Card className="border-border/60 bg-white/95 shadow-sm">
                      <CardContent className="p-6">
                        <p className="text-sm font-semibold text-foreground">
                          G2 is active, but no account or policy check has been recorded yet.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
                          Real account health, policy, and evidence checks will appear here once the summary endpoint has data.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <aside className="space-y-4">
                    <NextStepCard
                      primaryActionKind={primaryActionKind}
                      onReviewAccountHealth={() => {
                        setReviewAccountHealthTarget(
                          latestRegistryReviewAccount ? getRegistryReviewTarget(latestRegistryReviewAccount) : null,
                        );
                        setAccountReviewOpen(true);
                      }}
                      onReviewPolicyChange={() => setPolicyReviewOpen(true)}
                    />
                  </aside>
                </div>
              )}

              <AccountHealthReviewDialog
                open={accountReviewOpen}
                onOpenChange={(open) => {
                  setAccountReviewOpen(open);
                  if (!open) {
                    setReviewAccountHealthTarget(null);
                  }
                }}
                accountHealth={reviewAccountHealthTarget ?? latestAccountHealth}
                onSubmit={submitAccountHealthUpdate}
                onSaved={() => {
                  setAccountReviewOpen(false);
                  setReviewAccountHealthTarget(null);
                  setAccountUpdateNotice("Account health update saved.");
                  toast.success("Account health update saved.");
                }}
                submitting={accountUpdatePending}
              />
              <PolicyReviewDialog open={policyReviewOpen} onOpenChange={setPolicyReviewOpen} policyCheck={latestPolicyCheck} />
              <RegisterAccountDialog
                open={registerAccountOpen}
                onOpenChange={(open) => {
                  setRegisterAccountOpen(open);
                }}
                onSubmit={submitRegistryRegister}
                onSaved={() => {
                  setRegisterAccountOpen(false);
                  setRegistryUpdateNotice("Account registered.");
                  toast.success("Account registered.");
                }}
                submitting={registryMutationPending}
              />
              <EditAccountDialog
                open={editAccountOpen}
                onOpenChange={(open) => {
                  setEditAccountOpen(open);
                  if (!open) {
                    setSelectedRegistryAccount(null);
                  }
                }}
                account={selectedRegistryAccount}
                onSubmit={submitRegistryUpdate}
                onSaved={() => {
                  setEditAccountOpen(false);
                  setSelectedRegistryAccount(null);
                  setRegistryUpdateNotice("Account updated.");
                  toast.success("Account updated.");
                }}
                submitting={registryMutationPending}
              />
              <DisableAccountDialog
                open={disableAccountOpen}
                onOpenChange={(open) => {
                  setDisableAccountOpen(open);
                  if (!open) {
                    setSelectedRegistryAccount(null);
                  }
                }}
                account={selectedRegistryAccount}
                onConfirm={submitRegistryDisable}
                onSaved={() => {
                  setDisableAccountOpen(false);
                  setSelectedRegistryAccount(null);
                  setRegistryUpdateNotice("Monitoring disabled.");
                  toast.success("Monitoring disabled.");
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
