"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, RefreshCw } from "lucide-react";
import Link from "next/link";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { getWorkflowDetailHref, humanizeReasonText } from "@/lib/admin/workflows";
import { cn } from "@/lib/utils";

type ComplianceRunRow = {
  id?: string | null;
  created_at?: string | null;
  workflow_group?: string | null;
  action_type?: string | null;
  platform?: string | null;
  status?: string | null;
  fail_reason?: string | null;
  failure_reasons?: unknown;
  policy_ids_checked?: unknown;
  action_packet?: unknown;
};

type G1ApiResponse = {
  status?: string;
  message?: string;
  runs?: ComplianceRunRow[];
  source_table?: string;
};

type G1Status = "PASS" | "BLOCK" | "MANUAL_ONLY" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE" | "ERROR";

type ActionTarget =
  | {
      kind: "link";
      label: string;
      href: string;
      helper: string;
    }
  | {
      kind: "modal";
      label: string;
      helper: string;
    }
  | {
      kind: "text";
      label: string;
      helper: string;
    };

type NormalizedRun = {
  raw: ComplianceRunRow;
  id: string;
  createdAt: string | null;
  createdAtValue: number;
  workflowGroup: string;
  requestedBy: string;
  whatG1Checked: string;
  platform: string;
  status: G1Status;
  statusLabel: string;
  statusTone: string;
  resultTone: string;
  reasonText: string;
  whatItMeans: string;
  whatHappened: string;
  nextStep: string;
  actionTarget: ActionTarget;
  policyIds: string[];
  rawStatus: string | null;
  rawFailReason: string | null;
};

type ReasonNarrative = {
  reasonText: string;
  whatHappened: string;
  nextStep: string;
};

type ReviewRoute = {
  label: string;
  href: string;
  helper: string;
};

const DATA_ROUTE = "/api/admin/g1-compliance-guard/latest";
const RECENT_LIMIT = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const PASS_STATUSES = new Set(["PASS", "ACTIVE", "APPROVED", "READY", "ALLOW", "ALLOWED", "CLEAN", "VERIFIED", "OK", "LIVE", "SUCCESS"]);
const BLOCK_STATUSES = new Set(["BLOCK", "BLOCKED", "FAIL", "FAILED", "REJECTED", "DENIED", "DECLINED"]);
const MANUAL_STATUSES = new Set(["MANUAL_ONLY", "MANUAL", "REVIEW", "NEEDS_REVIEW"]);
const PENDING_STATUSES = new Set(["PENDING_APPROVAL", "PENDING", "QUEUED", "WAITING", "AWAITING_APPROVAL", "APPROVAL_REQUIRED", "SCHEDULED"]);
const EVIDENCE_STATUSES = new Set(["NEEDS_EVIDENCE", "EVIDENCE_REQUIRED", "PROOF_REQUIRED", "MISSING_EVIDENCE"]);
const ERROR_STATUSES = new Set(["ERROR", "SYSTEM_ERROR", "FAILED_SYSTEM"]);

const REVIEW_ROUTES = {
  accountHealth: {
    label: "Open Account Health",
    href: getWorkflowDetailHref("G2"),
    helper: "Open G2 account health and clear the warning.",
  },
  approval: {
    label: "Open Approval",
    href: getWorkflowDetailHref("G5"),
    helper: "Open G5 approval and confirm the request.",
  },
  contentReview: {
    label: "Open Content Review",
    href: getWorkflowDetailHref("G4"),
    helper: "Open G4 content review and attach proof.",
  },
  consent: {
    label: "Open Consent Records",
    href: getWorkflowDetailHref("G3"),
    helper: "Open G3 consent records and add the missing consent.",
  },
  ugc: {
    label: "Open UGC Proof",
    href: getWorkflowDetailHref("G8"),
    helper: "Open G8 UGC proof and upload rights evidence.",
  },
  offer: {
    label: "Open Offer Proof",
    href: getWorkflowDetailHref("G7"),
    helper: "Open G7 offer proof and confirm stock or discount proof.",
  },
} satisfies Record<string, ReviewRoute>;

const STATUS_LABELS: Record<G1Status, string> = {
  PASS: "Approved",
  BLOCK: "Blocked Safely",
  MANUAL_ONLY: "Human Review Needed",
  PENDING_APPROVAL: "Waiting for Approval",
  NEEDS_EVIDENCE: "Evidence Needed",
  ERROR: "System Issue",
};

const STATUS_TONES: Record<G1Status, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BLOCK: "border-rose-200 bg-rose-50 text-rose-800",
  MANUAL_ONLY: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_APPROVAL: "border-sky-200 bg-sky-50 text-sky-800",
  NEEDS_EVIDENCE: "border-violet-200 bg-violet-50 text-violet-800",
  ERROR: "border-rose-200 bg-rose-50 text-rose-800",
};

const OVERVIEW_TONES: Record<"Active" | "Needs Attention" | "Issue Found", string> = {
  Active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Needs Attention": "border-amber-200 bg-amber-50 text-amber-800",
  "Issue Found": "border-rose-200 bg-rose-50 text-rose-800",
};

const ACTION_ITEM_STATUSES = new Set<G1Status>(["MANUAL_ONLY", "PENDING_APPROVAL", "NEEDS_EVIDENCE", "ERROR"]);

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonRecord = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const parseStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }

    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
};

const humanizeText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const toFriendlyLabel = (value: string | null | undefined, fallback = "Not available") => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^[A-Z0-9_:\-/ ]+$/.test(trimmed) && /[_-]/.test(trimmed)) {
    return humanizeText(trimmed);
  }

  return trimmed;
};

const toReadablePlatform = (value: string | null | undefined) => {
  const text = toFriendlyLabel(value, "Internal");
  const normalized = text.toUpperCase();

  if (normalized === "IG") {
    return "Instagram";
  }

  if (normalized === "META") {
    return "Meta";
  }

  if (normalized === "GOOGLE") {
    return "Google";
  }

  if (normalized === "WHATSAPP") {
    return "WhatsApp";
  }

  if (normalized === "WEBSITE") {
    return "Website";
  }

  if (normalized === "INTERNAL" || normalized === "INTERNAL SYSTEM") {
    return "Internal";
  }

  return text;
};

const toDateValue = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDateTime = (value: string | null | undefined) => {
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

const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) {
    return "No checks yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  const valueInUnits =
    abs < minute ? Math.max(1, Math.round(abs / 1_000)) :
    abs < hour ? Math.max(1, Math.round(abs / minute)) :
    abs < day ? Math.max(1, Math.round(abs / hour)) :
    Math.max(1, Math.round(abs / day));

  if (abs < minute) {
    return diff >= 0 ? `${valueInUnits} second${valueInUnits === 1 ? "" : "s"} ago` : `in ${valueInUnits} second${valueInUnits === 1 ? "" : "s"}`;
  }

  if (abs < hour) {
    return diff >= 0 ? `${valueInUnits} minute${valueInUnits === 1 ? "" : "s"} ago` : `in ${valueInUnits} minute${valueInUnits === 1 ? "" : "s"}`;
  }

  if (abs < day) {
    return diff >= 0 ? `${valueInUnits} hour${valueInUnits === 1 ? "" : "s"} ago` : `in ${valueInUnits} hour${valueInUnits === 1 ? "" : "s"}`;
  }

  return diff >= 0 ? `${valueInUnits} day${valueInUnits === 1 ? "" : "s"} ago` : `in ${valueInUnits} day${valueInUnits === 1 ? "" : "s"}`;
};

const getPacketString = (packet: Record<string, unknown> | null, keys: string[]) => {
  if (!packet) {
    return null;
  }

  for (const key of keys) {
    const value = packet[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
};

const getReasonKey = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized || null;
};

const getReasonNarrative = (status: G1Status, reason: string | null) => {
  const key = getReasonKey(reason) ?? "";

  const exactMatches: Array<{ match: (value: string) => boolean; narrative: ReasonNarrative }> = [
    {
      match: (value) => value.includes("DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER"),
      narrative: {
        reasonText: "Direct Instagram DM from n8n is not allowed. Use the approved DM partner route.",
        whatHappened: "Nothing was sent.",
        nextStep: "Use the approved DM partner route instead.",
      },
    },
    {
      match: (value) => value.includes("GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES"),
      narrative: {
        reasonText: "Google scraping is not allowed. Use approved Google sources only.",
        whatHappened: "Nothing was collected.",
        nextStep: "Use approved Google sources only.",
      },
    },
    {
      match: (value) => value.includes("WF24_PR_ENGINE_AUTOMATION_REMOVED_MANUAL_PR_ONLY"),
      narrative: {
        reasonText: "Automated PR outreach is not allowed. PR must be handled manually.",
        whatHappened: "No automated outreach ran.",
        nextStep: "Handle PR manually.",
      },
    },
    {
      match: (value) => value.includes("WF12_CREATOR_SEEDING_REMOVED_DISCOVERY_LITE_ONLY"),
      narrative: {
        reasonText: "Automated creator seeding is not allowed. Use manual creator review/discovery only.",
        whatHappened: "The automation was paused.",
        nextStep: "Use manual creator review and discovery only.",
      },
    },
    {
      match: (value) => value.includes("HOTJAR_DEFAULT_SESSION_RECORDING_REMOVED_USE_CONSENT_MASKING_RETENTION"),
      narrative: {
        reasonText: "Session recording needs consent, masking, and retention controls before use.",
        whatHappened: "The session recording action was blocked.",
        nextStep: "Add consent, masking, and retention controls before retrying.",
      },
    },
    {
      match: (value) => value.includes("MISSING_REQUIRED_FIELD"),
      narrative: {
        reasonText: "Required information is missing from the request.",
        whatHappened: "G1 stopped the request before it ran.",
        nextStep: "Add the missing information and try again.",
      },
    },
    {
      match: (value) => value.includes("HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED"),
      narrative: {
        reasonText: "Human approval is required before this action can continue.",
        whatHappened: "The request is waiting for a person to confirm it.",
        nextStep: "Open approval and ask a reviewer to confirm the request.",
      },
    },
    {
      match: (value) => value.includes("ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN"),
      narrative: {
        reasonText: "Account health must be checked before this action can continue.",
        whatHappened: "The account was not confirmed clean.",
        nextStep: "Open account health and resolve the issue.",
      },
    },
    {
      match: (value) => value.includes("ACCOUNT_HEALTH_UNKNOWN"),
      narrative: {
        reasonText: "Account health must be checked before this action can continue.",
        whatHappened: "The account health status is still unknown.",
        nextStep: "Open account health and confirm the account is clean.",
      },
    },
    {
      match: (value) => value.includes("UGC_RIGHTS_MISSING"),
      narrative: {
        reasonText: "Creator or UGC permission proof is required.",
        whatHappened: "The request paused safely.",
        nextStep: "Open UGC proof and add rights evidence.",
      },
    },
    {
      match: (value) => value.includes("CLAIM_EVIDENCE_MISSING"),
      narrative: {
        reasonText: "Claim evidence is required before using this content.",
        whatHappened: "The content was paused safely.",
        nextStep: "Open content review and attach proof.",
      },
    },
    {
      match: (value) => value.includes("CONSENT_MISSING"),
      narrative: {
        reasonText: "Consent proof is required before this action can continue.",
        whatHappened: "The request paused safely.",
        nextStep: "Open consent records and add the missing consent.",
      },
    },
    {
      match: (value) => value.includes("OFFER") || value.includes("STOCK") || value.includes("DISCOUNT"),
      narrative: {
        reasonText: "Offer, stock, or discount proof is required before this action can continue.",
        whatHappened: "The offer change was paused safely.",
        nextStep: "Open offer proof and verify the change.",
      },
    },
  ];

  for (const entry of exactMatches) {
    if (entry.match(key)) {
      return entry.narrative;
    }
  }

  if (status === "ERROR") {
    return {
      reasonText: humanizeReasonText(reason) ?? "G1 could not finish the check.",
      whatHappened: "The safety check could not finish.",
      nextStep: "Open the issue and check the workflow setup.",
    };
  }

  if (status === "BLOCK") {
    return {
      reasonText: humanizeReasonText(reason) ?? "G1 blocked this unsafe request.",
      whatHappened: "Nothing ran.",
      nextStep: "Fix the issue and try again.",
    };
  }

  if (status === "PENDING_APPROVAL") {
    return {
      reasonText: humanizeReasonText(reason) ?? "G1 is waiting for approval before this action can continue.",
      whatHappened: "Nothing ran yet.",
      nextStep: "Open approval and confirm the request.",
    };
  }

  if (status === "NEEDS_EVIDENCE") {
    return {
      reasonText: humanizeReasonText(reason) ?? "G1 needs evidence before this action can continue.",
      whatHappened: "The action paused safely.",
      nextStep: "Open content review and add proof.",
    };
  }

  if (status === "MANUAL_ONLY") {
    return {
      reasonText: humanizeReasonText(reason) ?? "A human needs to review this request before it can continue.",
      whatHappened: "The action was paused for review.",
      nextStep: "Open the linked review page and resolve the issue.",
    };
  }

  return {
    reasonText: humanizeReasonText(reason) ?? "G1 allowed this action to continue.",
    whatHappened: "The action passed the safety check.",
    nextStep: "No next step is required right now.",
  };
};

const normalizeStatus = (rawStatus: string | null | undefined, failReason: string | null, failureReasons: string[]) => {
  const status = (rawStatus ?? "").trim().toUpperCase();
  const reasonText = [failReason ?? "", ...failureReasons].join(" ").toUpperCase();

  if (PASS_STATUSES.has(status)) {
    return "PASS" as const;
  }

  if (BLOCK_STATUSES.has(status)) {
    return "BLOCK" as const;
  }

  if (MANUAL_STATUSES.has(status)) {
    return "MANUAL_ONLY" as const;
  }

  if (PENDING_STATUSES.has(status)) {
    return "PENDING_APPROVAL" as const;
  }

  if (EVIDENCE_STATUSES.has(status)) {
    return "NEEDS_EVIDENCE" as const;
  }

  if (ERROR_STATUSES.has(status)) {
    return "ERROR" as const;
  }

  if (reasonText.includes("DIRECT_N8N_IG_DM") || reasonText.includes("GOOGLE_SCRAPING") || reasonText.includes("HOTJAR") || reasonText.includes("WF24") || reasonText.includes("WF12")) {
    return "BLOCK" as const;
  }

  if (reasonText.includes("HUMAN_APPROVAL") || reasonText.includes("APPROVAL")) {
    return "PENDING_APPROVAL" as const;
  }

  if (reasonText.includes("G4_CONTENT") || reasonText.includes("CONTENT_REVIEW") || reasonText.includes("CLAIM_EVIDENCE") || reasonText.includes("EVIDENCE") || reasonText.includes("PROOF")) {
    return "NEEDS_EVIDENCE" as const;
  }

  if (reasonText.includes("CONSENT") || reasonText.includes("UGC_RIGHTS") || reasonText.includes("OFFER") || reasonText.includes("STOCK") || reasonText.includes("DISCOUNT") || reasonText.includes("ACCOUNT_HEALTH")) {
    return "MANUAL_ONLY" as const;
  }

  if (status) {
    return "ERROR" as const;
  }

  return "ERROR" as const;
};

const getStatusLabel = (status: G1Status) => STATUS_LABELS[status];

const getStatusTone = (status: G1Status) => STATUS_TONES[status];

const getMeaning = (status: G1Status) => {
  switch (status) {
    case "PASS":
      return "The action was allowed to continue.";
    case "BLOCK":
      return "The unsafe action did not run.";
    case "MANUAL_ONLY":
      return "A human needs to review this before it can continue.";
    case "PENDING_APPROVAL":
      return "Waiting for approval.";
    case "NEEDS_EVIDENCE":
      return "Evidence is required before it can continue.";
    case "ERROR":
    default:
      return "G1 hit a system issue.";
  }
};

const getOverviewState = (rows: NormalizedRun[]) => {
  const latest = rows[0] ?? null;

  if (!latest) {
    return {
      label: "Active" as const,
      tone: OVERVIEW_TONES.Active,
      helper: "G1 is active and waiting for the first workflow request.",
    };
  }

  if (latest.status === "ERROR") {
    return {
      label: "Issue Found" as const,
      tone: OVERVIEW_TONES["Issue Found"],
      helper: "The latest check hit a system issue.",
    };
  }

  const hasActionItems = rows.some((row) => ACTION_ITEM_STATUSES.has(row.status));
  if (hasActionItems) {
    return {
      label: "Needs Attention" as const,
      tone: OVERVIEW_TONES["Needs Attention"],
      helper: "Some requests need review or evidence.",
    };
  }

  return {
    label: "Active" as const,
    tone: OVERVIEW_TONES.Active,
    helper: "G1 is recording checks normally.",
  };
};

const resolveReviewRoute = (row: NormalizedRun): ReviewRoute | null => {
  const reason = (row.rawFailReason ?? row.reasonText ?? "").toUpperCase();

  if (row.status === "ERROR") {
    return null;
  }

  if (reason.includes("CONSENT")) {
    return REVIEW_ROUTES.consent;
  }

  if (reason.includes("UGC_RIGHTS")) {
    return REVIEW_ROUTES.ugc;
  }

  if (reason.includes("OFFER") || reason.includes("STOCK") || reason.includes("DISCOUNT")) {
    return REVIEW_ROUTES.offer;
  }

  if (reason.includes("HUMAN_APPROVAL") || row.status === "PENDING_APPROVAL") {
    return REVIEW_ROUTES.approval;
  }

  if (reason.includes("G4_CONTENT") || reason.includes("CONTENT_REVIEW") || reason.includes("CLAIM_EVIDENCE") || row.status === "NEEDS_EVIDENCE") {
    return REVIEW_ROUTES.contentReview;
  }

  if (reason.includes("ACCOUNT_HEALTH") || row.status === "MANUAL_ONLY") {
    return REVIEW_ROUTES.accountHealth;
  }

  return REVIEW_ROUTES.contentReview;
};

const getCardActionTarget = (row: NormalizedRun): ActionTarget => {
  if (row.status === "ERROR") {
    return {
      kind: "modal",
      label: "View Issue",
      helper: "Open the issue details.",
    };
  }

  const route = resolveReviewRoute(row);
  if (!route) {
    return {
      kind: "modal",
      label: "View Issue",
      helper: "Open the issue details.",
    };
  }

  return {
    kind: "link",
    label: route.label,
    href: route.href,
    helper: route.helper,
  };
};

const getTableActionTarget = (row: NormalizedRun): ActionTarget => {
  if (row.status === "PASS") {
    return {
      kind: "text",
      label: "No action needed",
      helper: "No action needed right now.",
    };
  }

  if (row.status === "BLOCK") {
    return {
      kind: "modal",
      label: "View reason",
      helper: "Open the blocked reason.",
    };
  }

  if (row.status === "ERROR") {
    return {
      kind: "modal",
      label: "View issue",
      helper: "Open the issue details.",
    };
  }

  const route = resolveReviewRoute(row);
  if (!route) {
    return {
      kind: "modal",
      label: "View issue",
      helper: "Open the issue details.",
    };
  }

  return {
    kind: "link",
    label: "Open review",
    href: route.href,
    helper: route.helper,
  };
};

const normalizeRun = (row: ComplianceRunRow): NormalizedRun | null => {
  const createdAt = typeof row.created_at === "string" && row.created_at.trim() ? row.created_at.trim() : null;
  if (!createdAt) {
    return null;
  }

  const packet = parseJsonRecord(row.action_packet);
  const failureReasons = parseStringArray(row.failure_reasons);
  const policyIds = parseStringArray(row.policy_ids_checked);
  const rawFailReason = typeof row.fail_reason === "string" && row.fail_reason.trim() ? row.fail_reason.trim() : failureReasons[0] ?? null;
  const rawStatus = typeof row.status === "string" && row.status.trim() ? row.status.trim() : null;
  const status = normalizeStatus(rawStatus, rawFailReason, failureReasons);

  const requestedBy = toFriendlyLabel(
    getPacketString(packet, ["requested_by_workflow", "workflow_id", "workflow_group"]) ?? row.workflow_group ?? "Unknown workflow",
  );
  const whatG1Checked = toFriendlyLabel(
    getPacketString(packet, ["action_type"]) ?? row.action_type ?? "Workflow action",
    "Workflow action",
  );
  const platform = toReadablePlatform(getPacketString(packet, ["platform"]) ?? row.platform ?? "Internal");
  const narrative = getReasonNarrative(status, rawFailReason);
  const cardTarget = getCardActionTarget({
    raw: row,
    id: row.id ?? createdAt,
    createdAt,
    createdAtValue: toDateValue(createdAt),
    workflowGroup: row.workflow_group?.trim() || "Unknown",
    requestedBy,
    whatG1Checked,
    platform,
    status,
    statusLabel: getStatusLabel(status),
    statusTone: getStatusTone(status),
    resultTone: getStatusTone(status),
    reasonText: narrative.reasonText,
    whatItMeans: getMeaning(status),
    whatHappened: narrative.whatHappened,
    nextStep: narrative.nextStep,
    actionTarget: {
      kind: "text",
      label: "",
      helper: "",
    },
    policyIds,
    rawStatus,
    rawFailReason,
  });

  const rowView: NormalizedRun = {
    raw: row,
    id: row.id ?? createdAt,
    createdAt,
    createdAtValue: toDateValue(createdAt),
    workflowGroup: row.workflow_group?.trim() || "Unknown",
    requestedBy,
    whatG1Checked,
    platform,
    status,
    statusLabel: getStatusLabel(status),
    statusTone: getStatusTone(status),
    resultTone: getStatusTone(status),
    reasonText: narrative.reasonText,
    whatItMeans: getMeaning(status),
    whatHappened: narrative.whatHappened,
    nextStep: narrative.nextStep,
    actionTarget: cardTarget,
    policyIds,
    rawStatus,
    rawFailReason,
  };

  rowView.actionTarget = getCardActionTarget(rowView);
  return rowView;
};

function StatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  tone?: string;
}) {
  return (
    <Card className={cn("border-border/60 bg-white/95 shadow-sm", tone)}>
      <CardHeader className="space-y-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function FieldCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`status-skeleton-${index}`} className="h-28 rounded-[28px]" />
        ))}
      </div>

      <Skeleton className="h-44 rounded-[28px]" />
      <Skeleton className="h-64 rounded-[28px]" />
      <Skeleton className="h-[28rem] rounded-[28px]" />
    </div>
  );
}

function G1HowItWorksStrip() {
  const stepClass = "rounded-2xl border border-border/60 bg-white p-4 shadow-sm";

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="font-serif text-2xl tracking-tight text-primary">How G1 Works</CardTitle>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          G1 checks requests automatically. You only step in when the page shows review or evidence needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
          <div className={stepClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
            <p className="mt-2 text-sm font-medium text-foreground">Request comes in</p>
          </div>
          <div className="flex justify-center py-2 text-muted-foreground lg:py-0">
            <ArrowRight className="hidden lg:block" />
            <ChevronDown className="lg:hidden" />
          </div>
          <div className={stepClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
            <p className="mt-2 text-sm font-medium text-foreground">G1 checks safety</p>
          </div>
          <div className="flex justify-center py-2 text-muted-foreground lg:py-0">
            <ArrowRight className="hidden lg:block" />
            <ChevronDown className="lg:hidden" />
          </div>
          <div className={stepClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
            <p className="mt-2 text-sm font-medium text-foreground">G1 allows, blocks, or asks for review</p>
          </div>
        </div>

        <Separator />

        <p className="text-sm leading-6 text-muted-foreground">
          You only need to act when G1 shows Review Needed or Evidence Needed.
        </p>
      </CardContent>
    </Card>
  );
}

function ActionItemCard({
  run,
  onViewIssue,
}: {
  run: NormalizedRun;
  onViewIssue: (run: NormalizedRun) => void;
}) {
  const target = getCardActionTarget(run);
  const badgeTone = getStatusTone(run.status);

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-xl tracking-tight text-foreground text-balance">{run.whatG1Checked}</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              Requested by {run.requestedBy} on {run.platform}
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", badgeTone)}>
            {run.statusLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span>{formatRelativeTime(run.createdAt)}</span>
          <span>•</span>
          <span>{formatDateTime(run.createdAt)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldCard label="Why G1 stopped it" value={run.reasonText} />
        <FieldCard label="What to do next" value={target.helper} />
      </CardContent>
      <CardFooter className="justify-end">
        {target.kind === "link" ? (
          <Button asChild className="h-10 rounded-full px-4">
            <Link href={target.href}>
              {target.label}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-white px-4"
            onClick={() => onViewIssue(run)}
          >
            {target.label}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function RecentChecksMobileRow({
  run,
  onOpenDetails,
}: {
  run: NormalizedRun;
  onOpenDetails: (run: NormalizedRun) => void;
}) {
  const actionTarget = getTableActionTarget(run);

  return (
    <Card className="border-border/60 bg-white/95 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg tracking-tight text-foreground text-balance">{run.whatG1Checked}</CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              {run.requestedBy} · {run.platform}
            </CardDescription>
          </div>
          <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getStatusTone(run.status))}>
            {run.statusLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span>{formatDateTime(run.createdAt)}</span>
          <span>•</span>
          <span>{formatRelativeTime(run.createdAt)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldCard label="What it means" value={run.whatItMeans} />
        {run.status === "BLOCK" || run.status === "ERROR" ? <FieldCard label="Why" value={run.reasonText} /> : null}
      </CardContent>
      <CardFooter className="justify-end">
        {actionTarget.kind === "text" ? (
          <span className="text-sm font-medium text-muted-foreground">{actionTarget.label}</span>
        ) : actionTarget.kind === "modal" ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-white px-4"
            onClick={() => onOpenDetails(run)}
          >
            {actionTarget.label}
          </Button>
        ) : (
          <Button asChild className="h-10 rounded-full px-4">
            <Link href={actionTarget.href}>
              {actionTarget.label}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function DetailsBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm leading-6 text-foreground text-pretty">{value}</div>
    </div>
  );
}

function G1DetailsDialog({
  run,
  open,
  onOpenChange,
}: {
  run: NormalizedRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!run) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,52rem)] overflow-hidden rounded-[28px] border-border/60 bg-white p-0 shadow-2xl sm:max-w-3xl">
        <ScrollArea className="max-h-[90vh]">
          <div className="space-y-6 p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">Safety Check Details</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Plain-English details for this safety check. Technical details stay collapsed.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-2">
              <DetailsBlock label="Result" value={<Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getStatusTone(run.status))}>{run.statusLabel}</Badge>} />
              <DetailsBlock label="What was checked" value={run.whatG1Checked} />
              <DetailsBlock label="Requested by" value={run.requestedBy} />
              <DetailsBlock label="Platform" value={run.platform} />
            </div>

            <DetailsBlock label="Why G1 decided this" value={run.reasonText} />
            <DetailsBlock label="What happened" value={run.whatHappened} />
            <DetailsBlock label="Next safe step" value={run.nextStep} />

            <Collapsible>
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="text-sm font-medium text-foreground">Technical details</span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailsBlock label="Compliance run ID" value={run.id} />
                    <DetailsBlock label="Raw status" value={run.rawStatus ?? "Not available"} />
                    <DetailsBlock label="Raw fail_reason" value={run.rawFailReason ?? "Not available"} />
                    <DetailsBlock
                      label="Policy IDs checked"
                      value={
                        run.policyIds.length ? (
                          <div className="flex flex-wrap gap-2">
                            {run.policyIds.map((policyId) => (
                              <Badge key={policyId} variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-medium text-foreground">
                                {policyId}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "None recorded"
                        )
                      }
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="flex justify-end">
              <Button type="button" variant="outline" className="h-10 rounded-full border-border/70 bg-white px-4" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function G1ComplianceGuardPage() {
  const { authFetch } = useAuth();
  const request = authFetch ?? defaultRequest;

  const [runs, setRuns] = useState<ComplianceRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<NormalizedRun | null>(null);

  const loadData = useCallback(
    async ({ initial = false } = {}) => {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await request(buildRouteUrl(DATA_ROUTE), { cache: "no-store" });
        const body = (await parseJsonResponse<G1ApiResponse>(response)) ?? null;
        if (!response.ok || !body) {
          throw new Error("Could not load G1 checks. Please try again or contact admin.");
        }

        setRuns(Array.isArray(body.runs) ? body.runs : []);
        setLoadError(null);
      } catch {
        setLoadError("Could not load G1 checks. Please try again or contact admin.");
        if (initial) {
          setRuns([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadData({ initial: true });
  }, [loadData]);

  const normalizedRuns = useMemo(() => {
    return runs
      .map((row) => normalizeRun(row))
      .filter((row): row is NormalizedRun => Boolean(row))
      .sort((left, right) => right.createdAtValue - left.createdAtValue);
  }, [runs]);

  const visibleRuns = useMemo(() => normalizedRuns.slice(0, RECENT_LIMIT), [normalizedRuns]);
  const actionItems = useMemo(() => normalizedRuns.filter((row) => ACTION_ITEM_STATUSES.has(row.status)), [normalizedRuns]);
  const latestRun = normalizedRuns[0] ?? null;
  const overview = useMemo(() => getOverviewState(normalizedRuns), [normalizedRuns]);
  const blockedSafelyCount = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return normalizedRuns.filter((row) => row.status === "BLOCK" && row.createdAtValue >= cutoff).length;
  }, [normalizedRuns]);
  const actionsWaitingCount = useMemo(
    () => normalizedRuns.filter((row) => row.status === "MANUAL_ONLY" || row.status === "PENDING_APPROVAL" || row.status === "NEEDS_EVIDENCE").length,
    [normalizedRuns],
  );

  const openDetails = useCallback((run: NormalizedRun) => {
    setSelectedRun(run);
  }, []);

  const closeDetails = useCallback((open: boolean) => {
    if (!open) {
      setSelectedRun(null);
    }
  }, []);

  const headerActions = (
    <Button
      type="button"
      variant="outline"
      className="h-10 min-w-[152px] justify-center rounded-full border-border/70 bg-white px-4 shadow-sm"
      onClick={() => void loadData({ initial: false })}
      disabled={loading || refreshing}
    >
      <RefreshCw data-icon="inline-start" className={cn(loading || refreshing ? "animate-spin" : undefined)} />
      Refresh Checks
    </Button>
  );

  const statusValue = overview.label;

  return (
    <WorkflowDashboardShell
      eyebrow="Compliance gate"
      title="G1 — Compliance Guard"
      description="Automatically checks risky workflow actions before they can run."
      actions={headerActions}
    >
      {loadError && !loading ? (
        <Card role="alert" className="border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-rose-950">
            <AlertTriangle className="mt-0.5 shrink-0 text-rose-600" />
            <div className="space-y-1">
              <p className="font-medium text-rose-950">{loadError}</p>
              <p className="text-sm leading-6 text-rose-900/80">The page is showing the last loaded data, if any.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !normalizedRuns.length ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Status"
              value={<Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", overview.tone)}>{statusValue}</Badge>}
              helper={overview.helper}
              tone={overview.tone}
            />
            <StatCard
              label="Last Check"
              value={latestRun ? formatRelativeTime(latestRun.createdAt) : "No checks yet"}
              helper={latestRun ? `Checked ${latestRun.whatG1Checked}` : "Waiting for the first workflow request."}
            />
            <StatCard label="Actions Waiting" value={actionsWaitingCount} helper="Rows that need review or evidence." />
            <StatCard label="Blocked Safely" value={blockedSafelyCount} helper="These actions did not run." tone="border-rose-200/60" />
          </div>

          <G1HowItWorksStrip />

          <Card className="border-border/60 bg-white/95 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-2xl tracking-tight text-primary">Needs Your Action</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                Only items that need a client or admin response appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionItems.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {actionItems.map((run) => (
                    <ActionItemCard key={run.id} run={run} onViewIssue={openDetails} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  All clear. G1 is checking requests automatically and no action is needed right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-white/95 shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="font-serif text-2xl tracking-tight text-primary">Recent G1 Checks</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    Latest 10 checks, newest first.
                  </CardDescription>
                </div>
                {refreshing ? (
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    Updating
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleRuns.length ? (
                <>
                  <div className="space-y-4 lg:hidden">
                    {visibleRuns.map((run) => (
                      <RecentChecksMobileRow key={run.id} run={run} onOpenDetails={openDetails} />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <Table className="min-w-[1120px] table-fixed">
                      <colgroup>
                        <col className="w-[150px]" />
                        <col className="w-[170px]" />
                        <col className="w-[230px]" />
                        <col className="w-[120px]" />
                        <col className="w-[160px]" />
                        <col className="w-[230px]" />
                        <col className="w-[160px]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Requested By</TableHead>
                          <TableHead>What G1 Checked</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>What It Means</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRuns.map((run) => {
                          const actionTarget = getTableActionTarget(run);

                          return (
                            <TableRow key={run.id} className={cn(run.status === "BLOCK" && "bg-rose-50/30", (run.status === "MANUAL_ONLY" || run.status === "PENDING_APPROVAL" || run.status === "NEEDS_EVIDENCE") && "bg-amber-50/20")}>
                              <TableCell className="align-top whitespace-nowrap font-medium text-foreground">
                                <div className="space-y-1">
                                  <p>{formatDateTime(run.createdAt)}</p>
                                  <p className="text-xs text-muted-foreground">{formatRelativeTime(run.createdAt)}</p>
                                </div>
                              </TableCell>
                              <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                                {run.requestedBy}
                              </TableCell>
                              <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                                {run.whatG1Checked}
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/15 px-3 py-1 text-[11px] font-semibold text-foreground">
                                  {run.platform}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", getStatusTone(run.status))}>
                                  {run.statusLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top whitespace-normal text-sm leading-6 text-foreground">
                                {run.whatItMeans}
                              </TableCell>
                              <TableCell className="align-top">
                                {actionTarget.kind === "text" ? (
                                  <span className="text-sm font-medium text-muted-foreground">{actionTarget.label}</span>
                                ) : actionTarget.kind === "modal" ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-full border-border/70 bg-white px-3 text-[11px] font-medium"
                                    onClick={() => openDetails(run)}
                                  >
                                    {actionTarget.label}
                                  </Button>
                                ) : (
                                  <Button asChild className="h-8 rounded-full px-3 text-[11px] font-medium">
                                    <Link href={actionTarget.href}>
                                      {actionTarget.label}
                                      <ArrowRight data-icon="inline-end" />
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
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  G1 is active, but no workflow action has been checked yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <G1DetailsDialog run={selectedRun} open={Boolean(selectedRun)} onOpenChange={closeDetails} />
    </WorkflowDashboardShell>
  );
}
