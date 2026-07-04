"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Clock3, Database, ExternalLink, Play, RefreshCcw, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  buildG12PublicTrendFetchPayload,
  formatG12DateTime,
  formatG12RelativeTime,
  isG12TerminalStatus,
  normalizeG12TrendFetcherRunStatus,
} from "@/lib/g12-trend-fetcher";

type RequestOptions = RequestInit & { silent?: boolean };

type G12RawItemRecord = Record<string, unknown>;

type G12LatestRun = {
  fetch_run_id: string;
  status: string;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
  warnings: string[];
  failure_reasons: string[];
  completed_at: string | null;
  created_at: string | null;
  branch_key: string | null;
  query: string;
  platforms: string[];
  top_comments_limit: number;
  platform_results: Array<{
    platform: string;
    raw_count: number;
    clean_count: number;
    stored_count: number;
    rejected_count: number;
    blocked_count: number;
  }>;
};

type G12InsightRecord = {
  id: string;
  asset_id: string | null;
  trend_id: string | null;
  insight_id: string | null;
  metric_id: string | null;
  fetch_run_id: string | null;
  raw_id: string | null;
  platform: string | null;
  source_type: string | null;
  provider: string | null;
  workflow_group: string | null;
  workflow_id: string | null;
  branch_key: string | null;
  branch_name: string;
  title: string;
  summary: string;
  caption_preview: string | null;
  source_url: string | null;
  source_summary: string | null;
  insight_title: string | null;
  trend_topic: string | null;
  hook_angle: string | null;
  clean_summary: string | null;
  content_recommendation: string | null;
  brand_fit_reason: string | null;
  risk_notes: string | null;
  ai_model: string | null;
  ai_generated: boolean | null;
  trend_strength: number | string | null;
  brand_fit_score: number | string | null;
  risk_score: number | string | null;
  approval_status: string | null;
  approval_id: string | null;
  g4_review_id: string | null;
  g5_approval_id: string | null;
  selected_for_review: boolean | null;
  wf1_handoff_ready: boolean | null;
  compliance_note: string | null;
  actor: string | null;
  created_at: string | null;
  stored_at: string | null;
  updated_at: string | null;
  source_label: string | null;
};

type G12MetricRecord = {
  id: string;
  raw_id: string | null;
  fetch_run_id: string | null;
  platform: string | null;
  branch_key: string | null;
  branch_name: string;
  profile_username: string | null;
  profile_public_link: string | null;
  content_url: string | null;
  caption_preview: string | null;
  source_url: string | null;
  audio_sound: string | null;
  hashtags: string[];
  mentions: string[];
  keyword_matches: string[];
  competitor_matches: string[];
  published_at: string | null;
  views: number | string | null;
  likes: number | string | null;
  comments_count: number | string | null;
  shares: number | string | null;
  saves: number | string | null;
  engagement_rate: number | string | null;
  view_engagement: number | string | null;
  viral_velocity: number | string | null;
  share_intensity: number | string | null;
  trend_strength: number | string | null;
  brand_fit_score: number | string | null;
  risk_score: number | string | null;
  duration_seconds: number | string | null;
  comment_intent_score: number | string | null;
  audio_reuse_score: number | string | null;
  creator_fit_score: number | string | null;
  business_category: string | null;
  subcategory: string | null;
  label: string;
  value: number | string | boolean | null;
  metric_name: string | null;
  metric_label: string | null;
  metric_value: number | string | boolean | null;
  metric_unit: string | null;
  status: string | null;
  created_at: string | null;
  stored_at: string | null;
  updated_at: string | null;
  source_label: string | null;
};

type G12DashboardResponse = {
  status: string;
  message: string;
  source?: string | null;
  run: G12LatestRun | null;
  latestStoredRun?: G12LatestRun | null;
  insights: G12InsightRecord[];
  metrics: G12MetricRecord[];
  rawItems: G12RawItemRecord[];
  rawCounts: Record<string, number>;
  latestStoredInsights?: G12InsightRecord[];
  latestStoredMetrics?: G12MetricRecord[];
  latestStoredRawItems?: G12RawItemRecord[];
  storedInsights?: G12InsightRecord[];
  storedMetrics?: G12MetricRecord[];
  storedRawItems?: G12RawItemRecord[];
};

type G12RunResponse = {
  status: string;
  message: string;
  run: G12LatestRun | null;
  insights: G12InsightRecord[];
  metrics: G12MetricRecord[];
  rawCounts: Record<string, number>;
};

type G12SendResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE" | "ERROR";
  message: string;
  summary?: string | null;
  action_needed?: string | null;
  approval_status?: string | null;
  already_sent?: boolean;
  g4_detail_href?: string | null;
  review_id?: string | null;
  g4_review_id?: string | null;
  approval_id?: string | null;
  asset_id?: string | null;
  approval_state?: string | null;
  safe_rewrite?: string | null;
  caption_suggestions?: string[];
  hook_suggestions?: string[];
  content_draft_id?: string | null;
  insight_id?: string | null;
  fetch_run_id?: string | null;
  request_id?: string | null;
  sent_at?: string | null;
  handled_at?: string | null;
};

type TrendActionState = {
  label: string;
  tone: "send" | "review" | "final";
  disabled: boolean;
  note: string;
};

type TrendRecord = {
  insight: G12InsightRecord;
  metric: G12MetricRecord | null;
  id: string;
  trendTitle: string;
  trendTopic: string | null;
  hookAngle: string | null;
  platformCode: string;
  platformLabel: string;
  sourceAccountName: string;
  profileUsername: string | null;
  profilePublicLink: string | null;
  contentUrl: string | null;
  sourceUrl: string | null;
  sourceUrlMissingText: string;
  captionExcerpt: string;
  savedTimestamp: string | null;
  savedLabel: string;
  savedRelative: string | null;
  audioSound: string | null;
  hashtags: string[];
  keywordMatches: string[];
  competitorMatches: string[];
  savedInsightText: string;
  contentRecommendation: string;
  cleanMetricSummary: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  trendStrength: number | null;
  brandFitScore: number | null;
  riskScore: number | null;
  approvalStatus: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  brandFitReason: string | null;
  riskNotes: string | null;
  sourceSummary: string | null;
  fetchRunId: string | null;
  actionState: TrendActionState;
};

const buildRouteUrl = (path: string) => new URL(path.startsWith("/") ? path : `/${path}`, window.location.origin).toString();

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

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const formatAudioName = (value: string | null | undefined) => {
  const text = firstText(value);
  if (!text) {
    return null;
  }

  const normalized = normalizeWhitespace(text);
  const separatorIndex = normalized.lastIndexOf(" - ");
  if (separatorIndex <= 0) {
    return normalized;
  }

  return normalized.slice(0, separatorIndex).trim();
};

const truncateText = (value: string, limit = 320) => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  const cut = normalized.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const end = lastSpace > limit * 0.6 ? lastSpace : limit;
  return `${cut.slice(0, end).trimEnd()}…`;
};

const countFormatter = new Intl.NumberFormat("en-US");
const scoreFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const formatAbbreviatedCount = (
  value: number,
  divisor: number,
  suffix: "K" | "M" | "B",
  next?: { divisor: number; suffix: "K" | "M" | "B" },
) => {
  const scaled = value / divisor;
  const rounded = Math.round(scaled * 10) / 10;
  if (next && rounded >= 1000) {
    return formatAbbreviatedCount(value, next.divisor, next.suffix);
  }

  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1).replace(/\.0$/, "");
  return `${text}${suffix}`;
};

const formatCount = (value: number | null) => {
  if (value === null) {
    return "—";
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${formatAbbreviatedCount(abs, 1_000_000_000, "B")}`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${formatAbbreviatedCount(abs, 1_000_000, "M", { divisor: 1_000_000_000, suffix: "B" })}`;
  }

  if (abs >= 1_000) {
    return `${sign}${formatAbbreviatedCount(abs, 1_000, "K", { divisor: 1_000_000, suffix: "M" })}`;
  }

  return countFormatter.format(value);
};

const formatScore = (value: number | null) => (value === null ? "—" : scoreFormatter.format(value));

const valueToText = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return null;
};

const parseRecord = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore non-JSON strings
    }
  }

  return null;
};

const pickRecordValue = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const value = valueToText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickRecordObject = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const parsed = parseRecord(record[key]);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const normalizeLooseStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          normalized.push(...normalizeLooseStringArray(parsed));
          continue;
        }

        if (parsed && typeof parsed === "object") {
          const label = pickRecordValue(parsed as Record<string, unknown>, ["name", "tag", "value", "label", "text"]);
          if (label) {
            normalized.push(label);
            continue;
          }
        }
      } catch {
        // keep plain strings
      }

      normalized.push(trimmed);
      continue;
    }

    if (typeof entry === "number" || typeof entry === "bigint" || typeof entry === "boolean") {
      normalized.push(String(entry));
      continue;
    }

    if (typeof entry === "object" && entry !== null) {
      const label = pickRecordValue(entry as Record<string, unknown>, ["name", "tag", "value", "label", "text"]);
      if (label) {
        normalized.push(label);
      }
    }
  }

  return Array.from(new Set(normalized)).filter(Boolean);
};

const normalizePlatformCode = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const raw = firstText(value);
    if (!raw) {
      continue;
    }

    const normalized = raw.toUpperCase().replace(/[\s/-]+/g, "_");

    if (normalized.includes("INSTAGRAM")) {
      return "INSTAGRAM";
    }

    if (normalized.includes("TIKTOK")) {
      return "TIKTOK";
    }

    if (normalized.includes("GOOGLE") && normalized.includes("SEARCH")) {
      return "GOOGLE_SEARCH";
    }

    if (normalized === "GOOGLE") {
      return "GOOGLE_SEARCH";
    }

    if (normalized.includes("MANUAL") || normalized.includes("INTERNAL") || normalized.includes("MULTI")) {
      return "MANUAL";
    }
  }

  return "MANUAL";
};

const formatPlatformLabel = (code: string) => {
  switch (code) {
    case "INSTAGRAM":
      return "Instagram";
    case "TIKTOK":
      return "TikTok";
    case "GOOGLE_SEARCH":
      return "Google/Search";
    case "MANUAL":
      return "Manual";
    default:
      return code
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }
};

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="#000000"
      focusable="false"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.656 1.029c1.637-0.025 3.262-0.012 4.886-0.025 0.054 2.031 0.878 3.859 2.189 5.213l-0.002-0.002c1.411 1.271 3.247 2.095 5.271 2.235l0.028 0.002v5.036c-1.912-0.048-3.71-0.489-5.331-1.247l0.082 0.034c-0.784-0.377-1.447-0.764-2.077-1.196l0.052 0.034c-0.012 3.649 0.012 7.298-0.025 10.934-0.103 1.853-0.719 3.543-1.707 4.954l0.020-0.031c-1.652 2.366-4.328 3.919-7.371 4.011l-0.014 0c-0.123 0.006-0.268 0.009-0.414 0.009-1.73 0-3.347-0.482-4.725-1.319l0.040 0.023c-2.508-1.509-4.238-4.091-4.558-7.094l-0.004-0.041c-0.025-0.625-0.037-1.25-0.012-1.862 0.49-4.779 4.494-8.476 9.361-8.476 0.547 0 1.083 0.047 1.604 0.136l-0.056-0.008c0.025 1.849-0.050 3.699-0.050 5.548-0.423-0.153-0.911-0.242-1.42-0.242-1.868 0-3.457 1.194-4.045 2.861l-0.009 0.030c-0.133 0.427-0.21 0.918-0.21 1.426 0 0.206 0.013 0.41 0.037 0.61l-0.002-0.024c0.332 2.046 2.086 3.59 4.201 3.59 0.061 0 0.121-0.001 0.181-0.004l-0.009 0c1.463-0.044 2.733-0.831 3.451-1.994l0.010-0.018c0.267-0.372 0.45-0.822 0.511-1.311l0.001-0.014c0.125-2.237 0.075-4.461 0.087-6.698 0.012-5.036-0.012-10.060 0.025-15.083z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="#000000"
      focusable="false"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path d="M22.3,8.4c-0.8,0-1.4,0.6-1.4,1.4c0,0.8,0.6,1.4,1.4,1.4c0.8,0,1.4-0.6,1.4-1.4C23.7,9,23.1,8.4,22.3,8.4z" />
        <path d="M16,10.2c-3.3,0-5.9,2.7-5.9,5.9s2.7,5.9,5.9,5.9s5.9-2.7,5.9-5.9S19.3,10.2,16,10.2z M16,19.9c-2.1,0-3.8-1.7-3.8-3.8   c0-2.1,1.7-3.8,3.8-3.8c2.1,0,3.8,1.7,3.8,3.8C19.8,18.2,18.1,19.9,16,19.9z" />
        <path d="M20.8,4h-9.5C7.2,4,4,7.2,4,11.2v9.5c0,4,3.2,7.2,7.2,7.2h9.5c4,0,7.2-3.2,7.2-7.2v-9.5C28,7.2,24.8,4,20.8,4z M25.7,20.8   c0,2.7-2.2,5-5,5h-9.5c-2.7,0-5-2.2-5-5v-9.5c0-2.7,2.2-5,5-5h9.5c2.7,0,5,2.2,5,5V20.8z" />
      </g>
    </svg>
  );
}

const getPlatformBadgeTone = (code: string) => {
  switch (code) {
    case "INSTAGRAM":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "TIKTOK":
      return "border-slate-200 bg-white text-slate-900";
    default:
      return "border-border/70 bg-secondary/20 text-muted-foreground";
  }
};

function PlatformBadge({
  code,
  label,
  compact = true,
}: {
  code: string;
  label: string;
  compact?: boolean;
}) {
  const icon =
    code === "INSTAGRAM" ? (
      <InstagramIcon className="size-4 shrink-0" />
    ) : code === "TIKTOK" ? (
      <TikTokIcon className="size-4 shrink-0" />
    ) : null;
  const sizeClasses = icon && compact ? "h-8 min-w-8 px-2.5" : compact ? "px-3 py-1" : "";

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold",
        getPlatformBadgeTone(code),
        sizeClasses,
      )}
    >
      {icon ? (
        <span className={cn("inline-flex items-center", compact ? "justify-center" : "gap-1.5")}>
          {icon}
          {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
        </span>
      ) : (
        <span>{label}</span>
      )}
    </Badge>
  );
}

const getHeaderStatusTone = (status: string) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL_PASS":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "NEEDS REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "RUNNING":
    case "STARTED":
    case "ACCEPTED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "NEEDS ACCESS":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-border/70 bg-secondary/20 text-muted-foreground";
  }
};

const normalizeApprovalStatusValue = (value: string) =>
  normalizeWhitespace(value).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const getApprovalTone = (label: string) => {
  switch (normalizeApprovalStatusValue(label)) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "DRAFT CREATED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "SENT TO CONTENT DRAFT":
    case "IN REVIEW":
    case "REVIEW REQUESTED":
    case "PENDING APPROVAL":
    case "PENDING HUMAN APPROVAL":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "NEEDS G4 G5 BEFORE CONTENT USE":
    case "NEEDS REVIEW":
    case "SEND TO CONTENT DRAFT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-border/70 bg-muted/20 text-muted-foreground";
  }
};

const getApprovalStatusLabel = (label: string) => {
  switch (normalizeApprovalStatusValue(label)) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "DRAFT CREATED":
      return "Draft Created";
    case "SENT TO CONTENT DRAFT":
    case "IN REVIEW":
    case "REVIEW REQUESTED":
    case "PENDING APPROVAL":
    case "PENDING HUMAN APPROVAL":
      return "Sent to Content Draft";
    case "NEEDS G4 G5 BEFORE CONTENT USE":
    case "NEEDS REVIEW":
    case "SEND TO CONTENT DRAFT":
      return "Needs G4/G5 before content use";
    default:
      return normalizeWhitespace(label).replace(/[_-]+/g, " ");
  }
};

const getEffectiveG12ApprovalStatus = (
  insight: Pick<G12InsightRecord, "approval_status" | "approval_id" | "g4_review_id" | "g5_approval_id" | "selected_for_review" | "wf1_handoff_ready">,
) => {
  const approval = normalizeApprovalStatusValue(insight.approval_status ?? "");
  if (
    approval === "APPROVED" &&
    !insight.g5_approval_id &&
    (Boolean(insight.approval_id) || Boolean(insight.g4_review_id) || Boolean(insight.selected_for_review) || Boolean(insight.wf1_handoff_ready))
  ) {
    return "SENT TO CONTENT DRAFT";
  }

  return approval || null;
};

type ApprovalFilterValue = "NEEDS_REVIEW" | "SENT" | "DRAFT" | "APPROVED" | "REJECTED";

const SEND_OUTCOME_VISIBLE_MS = 4000;
const LOAD_ERROR_TOAST_MS = 3500;

const getApprovalFilterValue = (label: string): ApprovalFilterValue | null => {
  switch (normalizeApprovalStatusValue(label)) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "DRAFT CREATED":
      return "DRAFT";
    case "SENT TO CONTENT DRAFT":
      return "SENT";
    case "NEEDS G4 G5 BEFORE CONTENT USE":
    case "NEEDS REVIEW":
    case "SEND TO CONTENT DRAFT":
      return "NEEDS_REVIEW";
    default:
      return null;
  }
};

const getSendOutcomeTone = (status: string) => {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "DRAFT CREATED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "SENT TO CONTENT DRAFT":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "NEEDS G4 G5 BEFORE CONTENT USE":
    case "NEEDS REVIEW":
    case "SEND TO CONTENT DRAFT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "MANUAL_ONLY":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "BLOCK":
    case "ERROR":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-border/70 bg-secondary/20 text-muted-foreground";
  }
};

const getSendOutcomeDisplayStatus = (outcome: G12SendResponse) => {
  const approvalStatus = normalizeApprovalStatusValue(outcome.approval_status ?? "");
  if (approvalStatus) {
    return approvalStatus;
  }

  const approvalState = (outcome.approval_state ?? "").trim().toUpperCase();
  if (outcome.status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  return outcome.status;
};

const getSendOutcomeLabel = (outcome: G12SendResponse) => {
  const approvalStatus = normalizeApprovalStatusValue(outcome.approval_status ?? "");
  switch (approvalStatus) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "DRAFT CREATED":
      return "Draft Created";
    case "SENT TO CONTENT DRAFT":
      return "Sent to Content Draft";
    case "NEEDS G4 G5 BEFORE CONTENT USE":
    case "NEEDS REVIEW":
    case "SEND TO CONTENT DRAFT":
      return "Needs G4/G5 before content use";
  }

  const approvalState = (outcome.approval_state ?? "").trim().toUpperCase();
  if (outcome.status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL") {
    return "Pending human approval";
  }

  if (outcome.status === "PASS" && outcome.already_sent) {
    return "Already sent";
  }

  switch (outcome.status) {
    case "PASS":
      return "Content check passed";
    case "PENDING_APPROVAL":
      return "Pending human approval";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "MANUAL_ONLY":
      return "Manual review";
    case "BLOCK":
      return "Blocked safely";
    case "ERROR":
    default:
      return "Needs attention";
  }
};

const getActionState = (insight: G12InsightRecord, riskScore: number | null): TrendActionState => {
  const approval = getEffectiveG12ApprovalStatus(insight) ?? "";
  const isRejected = /(REJECT|BLOCK|DENIED|DECLINED|FAILED|FAIL|NOT APPROVED)/.test(approval);
  const isApproved = Boolean(insight.g5_approval_id) || /(APPROVED|APPROVE|PASSED|COMPLETE|COMPLETED|READY)/.test(approval);
  const isSent =
    Boolean(insight.selected_for_review) ||
    Boolean(insight.wf1_handoff_ready) ||
    approval === "SENT TO CONTENT DRAFT" ||
    approval === "SENT TO DRAFT" ||
    approval === "IN REVIEW" ||
    approval === "REVIEW REQUESTED" ||
    approval === "PENDING APPROVAL" ||
    approval === "PENDING HUMAN APPROVAL";
  const isDraftCreated = approval === "DRAFT CREATED" || (Boolean(insight.g4_review_id) && !isSent);
  const hasFetchRun = Boolean(insight.fetch_run_id);

  if (isRejected) {
    return {
      label: "Rejected",
      tone: "final",
      disabled: true,
      note: "This trend was rejected and should not move forward.",
    };
  }

  if (isApproved) {
    return {
      label: "Approved",
      tone: "final",
      disabled: true,
      note: "This trend already passed human approval.",
    };
  }

  if (isDraftCreated) {
    return {
      label: "Draft Created",
      tone: "final",
      disabled: true,
      note: "A content draft already exists for this trend.",
    };
  }

  if (isSent) {
    return {
      label: "Sent to Content Draft",
      tone: "final",
      disabled: true,
      note: "This trend has already been sent for draft creation.",
    };
  }

  if (riskScore !== null && riskScore >= 70) {
    return {
      label: "Needs Review",
      tone: "review",
      disabled: true,
      note: "High risk needs review before it can be sent.",
    };
  }

  if (!hasFetchRun) {
    return {
      label: "Needs Review",
      tone: "review",
      disabled: true,
      note: "This insight is not ready to send yet.",
    };
  }

  return {
    label: "Send to Content Draft",
    tone: "send",
    disabled: false,
    note: "Requires G4/G5 before content use.",
  };
};

const buildRawItemIndex = (rawItems: G12RawItemRecord[]) => {
  const byRun = new Map<string, G12RawItemRecord[]>();

  for (const rawItem of rawItems) {
    const runId = firstText(
      getRawItemText(rawItem, ["fetch_run_id", "fetchRunId", "run_id", "runId", "source_fetch_run_id"]),
    );

    if (!runId) {
      continue;
    }

    const current = byRun.get(runId) ?? [];
    current.push(rawItem);
    byRun.set(runId, current);
  }

  return byRun;
};

const getRawPayloadRecord = (record: G12RawItemRecord | null | undefined) =>
  pickRecordObject(record, ["raw_payload", "rawPayload", "payload", "data", "details", "metadata"]);

const getRawItemText = (record: G12RawItemRecord | null | undefined, keys: string[]) => {
  const direct = pickRecordValue(record, keys);
  if (direct) {
    return direct;
  }

  const payload = getRawPayloadRecord(record);
  return pickRecordValue(payload, keys);
};

const resolveRawItemForTrend = (
  insight: G12InsightRecord,
  metric: G12MetricRecord | null,
  rawItemsByRun: Map<string, G12RawItemRecord[]>,
  index: number,
) => {
  const runId = firstText(insight.fetch_run_id, metric?.fetch_run_id);
  const runItems = runId ? rawItemsByRun.get(runId) ?? [] : [];
  if (!runItems.length) {
    return null;
  }

  const platformCode = normalizePlatformCode(insight.platform, metric?.platform, insight.source_type, insight.provider);
  const rawIdCandidates = [firstText(insight.raw_id), firstText(metric?.raw_id)].filter(Boolean) as string[];
  const metricIdCandidates = [firstText(insight.metric_id), firstText(metric?.id)].filter(Boolean) as string[];
  const sourceUrlCandidates = [firstText(insight.source_url), firstText(metric?.source_url), firstText(metric?.content_url), firstText(metric?.profile_public_link)].filter(Boolean) as string[];

  const exactMatches = runItems.filter((rawItem) => {
    const rawItemCandidates = [
      getRawItemText(rawItem, ["raw_item_id", "rawItemId", "source_item_id", "sourceItemId", "id"]),
      getRawItemText(rawItem, ["raw_id", "rawId"]),
    ].filter(Boolean) as string[];
    const rawMetricCandidates = [
      getRawItemText(rawItem, ["metric_id", "metricId", "trend_metric_id", "trendMetricId"]),
      getRawItemText(rawItem, ["source_metric_id", "sourceMetricId"]),
    ].filter(Boolean) as string[];
    const rawUrlCandidates = [
      getRawItemText(rawItem, ["source_url", "sourceUrl"]),
      getRawItemText(rawItem, ["url", "postUrl", "webVideoUrl", "permalink", "content_url", "contentUrl"]),
    ].filter(Boolean) as string[];

    return (
      rawIdCandidates.some((candidate) => rawItemCandidates.includes(candidate)) ||
      metricIdCandidates.some((candidate) => rawMetricCandidates.includes(candidate)) ||
      sourceUrlCandidates.some((candidate) => rawUrlCandidates.includes(candidate))
    );
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (exactMatches.length > 1) {
    return (
      exactMatches.find((rawItem) => {
        const rawPlatform = normalizePlatformCode(
          getRawItemText(rawItem, ["platform", "source_platform", "platform_name", "sourcePlatform"]),
          getRawItemText(rawItem, ["platform_name", "platformName"]),
        );
        return platformCode && rawPlatform && rawPlatform === platformCode;
      }) ?? exactMatches[0]
    );
  }

  const platformMatches = runItems.filter((rawItem) => {
    const rawPlatform = normalizePlatformCode(
      getRawItemText(rawItem, ["platform", "source_platform", "platform_name", "sourcePlatform"]),
      getRawItemText(rawItem, ["platform_name", "platformName"]),
    );

    return Boolean(platformCode && rawPlatform && rawPlatform === platformCode);
  });

  if (platformMatches.length > 0) {
    return platformMatches[Math.min(index, platformMatches.length - 1)] ?? platformMatches[0];
  }

  return runItems.length === 1 ? runItems[0] : null;
};

const buildCaptionExcerpt = (insight: G12InsightRecord, metric: G12MetricRecord | null, rawItem: G12RawItemRecord | null) =>
  firstText(
    getRawItemText(rawItem, ["caption_excerpt", "captionExcerpt"]),
    insight.caption_preview,
    metric?.caption_preview,
    getRawItemText(rawItem, ["caption", "text", "description"]),
    getRawItemText(rawItem, ["caption_preview", "captionPreview"]),
  ) ?? "";

const buildSavedTimestamp = (insight: G12InsightRecord, metric: G12MetricRecord | null) =>
  firstText(insight.created_at, insight.stored_at, metric?.created_at, metric?.stored_at);

const buildSourceUrl = (insight: G12InsightRecord, metric: G12MetricRecord | null, rawItem: G12RawItemRecord | null) =>
  firstText(
    insight.source_url,
    metric?.source_url,
    getRawItemText(rawItem, ["source_url", "sourceUrl"]),
    getRawItemText(rawItem, ["url", "postUrl", "webVideoUrl", "permalink"]),
  );

const buildHashtags = (metric: G12MetricRecord | null, rawItem: G12RawItemRecord | null) => {
  const metricTags = normalizeLooseStringArray(metric?.hashtags);
  const rawTags = normalizeLooseStringArray((rawItem as Record<string, unknown> | null | undefined)?.hashtags);
  const payload = getRawPayloadRecord(rawItem);
  const payloadTags = normalizeLooseStringArray(payload ? (payload.hashtags ?? payload.hash_tags ?? payload.hashtag_list ?? payload.hashtagList) : []);

  return Array.from(new Set([...metricTags, ...rawTags, ...payloadTags]));
};

const buildCleanMetricSummary = (metric: G12MetricRecord | null) => {
  if (!metric) {
    return "";
  }

  const parts: string[] = [];
  const views = toNumber(metric.views);
  const likes = toNumber(metric.likes);
  const shares = toNumber(metric.shares);
  const comments = toNumber(metric.comments_count);
  const saves = toNumber(metric.saves);
  const engagementRate = toNumber(metric.engagement_rate);
  const trendStrength = toNumber(metric.trend_strength);
  const brandFitScore = toNumber(metric.brand_fit_score);
  const riskScore = toNumber(metric.risk_score);

  if (views !== null) parts.push(`${formatCount(views)} views`);
  if (likes !== null) parts.push(`${formatCount(likes)} likes`);
  if (shares !== null) parts.push(`${formatCount(shares)} shares`);
  if (comments !== null) parts.push(`${formatCount(comments)} comments`);
  if (saves !== null) parts.push(`${formatCount(saves)} saves`);
  if (engagementRate !== null) parts.push(`engagement ${formatScore(engagementRate)}`);
  if (trendStrength !== null) parts.push(`trend strength ${formatScore(trendStrength)}`);
  if (brandFitScore !== null) parts.push(`brand fit ${formatScore(brandFitScore)}`);
  if (riskScore !== null) parts.push(`risk ${formatScore(riskScore)}`);

  return parts.join(" · ");
};

const buildTrendRecords = (insights: G12InsightRecord[], metrics: G12MetricRecord[], rawItems: G12RawItemRecord[]) => {
  const metricsById = new Map<string, G12MetricRecord>();
  const metricsByRunId = new Map<string, G12MetricRecord[]>();
  const rawItemsByRun = buildRawItemIndex(rawItems);

  for (const metric of metrics) {
    metricsById.set(metric.id, metric);

    const runId = firstText(metric.fetch_run_id);
    if (!runId) {
      continue;
    }

    const current = metricsByRunId.get(runId) ?? [];
    current.push(metric);
    metricsByRunId.set(runId, current);
  }

  return insights
    .map((insight, index) => {
      const runId = firstText(insight.fetch_run_id);
      const runMetrics = runId ? metricsByRunId.get(runId) ?? [] : [];
      const metric = insight.metric_id ? metricsById.get(insight.metric_id) ?? null : runMetrics[index] ?? runMetrics[0] ?? null;
      const rawItem = resolveRawItemForTrend(insight, metric, rawItemsByRun, index);

      const platformCode = normalizePlatformCode(
        insight.platform,
        metric?.platform,
        insight.source_type,
        insight.provider,
        insight.source_label,
        getRawItemText(rawItem, ["platform", "source_platform", "platform_name", "sourcePlatform"]),
      );

      const trendTitle = firstText(insight.insight_title, insight.trend_topic, insight.hook_angle, insight.title) ?? "Saved trend";
      const profileUsername = firstText(metric?.profile_username);
      const profilePublicLink = firstText(metric?.profile_public_link);
      const contentUrl = firstText(metric?.content_url);
      const sourceAccountName =
        firstText(
          metric?.profile_username,
          getRawItemText(rawItem, ["source_account_name", "sourceAccountName", "account_name", "accountName"]),
          getRawItemText(rawItem, ["profile_username", "profileUsername", "username", "handle"]),
          insight.source_label,
          insight.provider,
          insight.actor,
        ) ?? "Unknown source";
      const savedTimestamp = buildSavedTimestamp(insight, metric);
      const savedLabel = savedTimestamp ? formatG12DateTime(savedTimestamp) : "Not available";
      const savedRelative = savedTimestamp ? formatG12RelativeTime(savedTimestamp) : null;
      const hashtags = buildHashtags(metric, rawItem);
      const views = toNumber(metric?.views);
      const likes = toNumber(metric?.likes);
      const comments = toNumber(metric?.comments_count);
      const shares = toNumber(metric?.shares);
      const saves = toNumber(metric?.saves);
      const engagementRate = toNumber(metric?.engagement_rate);
      const trendStrength = toNumber(insight.trend_strength ?? metric?.trend_strength);
      const brandFitScore = toNumber(insight.brand_fit_score ?? metric?.brand_fit_score);
      const riskScore = toNumber(insight.risk_score ?? metric?.risk_score);
      const actionState = getActionState(insight, riskScore);
      const captionExcerpt = buildCaptionExcerpt(insight, metric, rawItem);
      const sourceUrl = buildSourceUrl(insight, metric, rawItem);

      return {
        insight,
        metric,
        id: insight.id,
        trendTitle,
        trendTopic: firstText(insight.trend_topic),
        hookAngle: firstText(insight.hook_angle),
        platformCode,
        platformLabel: formatPlatformLabel(platformCode),
        sourceAccountName,
        profileUsername,
        profilePublicLink,
        contentUrl,
        sourceUrl,
        sourceUrlMissingText: "Source link not available from fetched data.",
        captionExcerpt,
        savedTimestamp,
        savedLabel,
        savedRelative,
        audioSound: firstText(metric?.audio_sound),
        hashtags,
        keywordMatches: metric?.keyword_matches ?? [],
        competitorMatches: metric?.competitor_matches ?? [],
        savedInsightText:
          firstText(insight.summary, insight.source_summary, insight.clean_summary, insight.content_recommendation, insight.hook_angle) ??
          "No saved insight text was stored for this trend.",
        contentRecommendation: firstText(insight.content_recommendation) ?? "No content recommendation was stored.",
        cleanMetricSummary: buildCleanMetricSummary(metric),
        views,
        likes,
        comments,
        shares,
        saves,
        engagementRate,
        trendStrength,
        brandFitScore,
        riskScore,
        approvalStatus: getEffectiveG12ApprovalStatus(insight),
        aiGenerated: Boolean(insight.ai_generated),
        aiModel: firstText(insight.ai_model),
        brandFitReason: firstText(insight.brand_fit_reason),
        riskNotes: firstText(insight.risk_notes),
        sourceSummary: firstText(insight.source_summary),
        fetchRunId: firstText(insight.fetch_run_id, metric?.fetch_run_id),
        actionState,
      } satisfies TrendRecord;
    })
    .sort((a, b) => {
      const aTime = a.savedTimestamp ? new Date(a.savedTimestamp).getTime() : 0;
      const bTime = b.savedTimestamp ? new Date(b.savedTimestamp).getTime() : 0;
      return bTime - aTime || b.trendTitle.localeCompare(a.trendTitle);
    });
};

const compareByNewest = (a: TrendRecord, b: TrendRecord) => {
  const aTime = a.savedTimestamp ? new Date(a.savedTimestamp).getTime() : 0;
  const bTime = b.savedTimestamp ? new Date(b.savedTimestamp).getTime() : 0;
  return bTime - aTime || a.trendTitle.localeCompare(b.trendTitle);
};

const compareByViews = (a: TrendRecord, b: TrendRecord) => (b.views ?? -1) - (a.views ?? -1) || compareByNewest(a, b);
const compareByTrendStrength = (a: TrendRecord, b: TrendRecord) => (b.trendStrength ?? -1) - (a.trendStrength ?? -1) || compareByNewest(a, b);
const compareByLatestRunCard = (a: TrendRecord, b: TrendRecord) => {
  const aTime = a.savedTimestamp ? new Date(a.savedTimestamp).getTime() : 0;
  const bTime = b.savedTimestamp ? new Date(b.savedTimestamp).getTime() : 0;
  return bTime - aTime || (b.views ?? -1) - (a.views ?? -1) || (b.likes ?? -1) - (a.likes ?? -1) || a.trendTitle.localeCompare(b.trendTitle);
};

const patchG12InsightForSendOutcome = (insight: G12InsightRecord, outcome: G12SendResponse) => {
  if (insight.id !== outcome.insight_id) {
    return insight;
  }

  const approvalStatus = outcome.approval_status ?? insight.approval_status;
  const normalizedApprovalStatus = approvalStatus ? normalizeApprovalStatusValue(approvalStatus) : "";
  const isSentToDraft = normalizedApprovalStatus === "SENT TO CONTENT DRAFT" || normalizedApprovalStatus === "APPROVED";

  return {
    ...insight,
    approval_status: approvalStatus,
    approval_id: outcome.approval_id ?? outcome.g4_review_id ?? outcome.review_id ?? insight.approval_id,
    g4_review_id: outcome.g4_review_id ?? outcome.approval_id ?? outcome.review_id ?? insight.g4_review_id,
    selected_for_review: isSentToDraft ? true : insight.selected_for_review,
    wf1_handoff_ready: isSentToDraft ? true : insight.wf1_handoff_ready,
    updated_at: outcome.handled_at ?? outcome.sent_at ?? insight.updated_at,
  };
};

const patchG12DashboardForSendOutcome = (dashboard: G12DashboardResponse | null, outcome: G12SendResponse) => {
  if (!dashboard || !outcome.insight_id) {
    return dashboard;
  }

  const patchArray = (records?: G12InsightRecord[]) =>
    records?.map((record) => patchG12InsightForSendOutcome(record, outcome)) ?? [];

  return {
    ...dashboard,
    insights: patchArray(dashboard.insights),
    latestStoredInsights: patchArray(dashboard.latestStoredInsights),
    storedInsights: patchArray(dashboard.storedInsights),
  };
};

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="font-serif text-3xl tracking-tight text-primary">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  onRun,
  running,
}: {
  title: string;
  description: string;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <Card className="rounded-[28px] border-dashed border-border/70 bg-white/70 shadow-none">
      <CardContent className="space-y-4 p-6 md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
          <p className="text-sm leading-6 text-foreground">{description}</p>
        </div>
        <Button type="button" className="rounded-full px-5" onClick={onRun} disabled={running}>
          <Play className="mr-2 size-4" />
          {running ? "Running…" : "Run Workflow"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TrendCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-40 rounded-full" />
            <Skeleton className="h-8 w-3/5 rounded-2xl" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-2 break-words text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

function TrendMetricChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">{value}</div>
    </div>
  );
}

function TrendAiInsightPanel({ record, className }: { record: TrendRecord; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-sky-200 bg-sky-50 p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-sky-700" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">AI Insight</p>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-6 text-sky-950">
        <p>
          <span className="font-semibold">Content recommendation:</span>{" "}
          <span className="text-sky-800">{record.contentRecommendation ?? "—"}</span>
        </p>
        <p>
          <span className="font-semibold">Brand fit reason:</span> <span className="text-sky-800">{record.brandFitReason ?? "—"}</span>
        </p>
        <p>
          <span className="font-semibold">Risk notes:</span> <span className="text-sky-800">{record.riskNotes ?? "—"}</span>
        </p>
      </div>
    </div>
  );
}

function TrendSourcePostPanel({ record, className }: { record: TrendRecord; className?: string }) {
  const captionText = normalizeWhitespace(record.captionExcerpt);
  const sourceMetrics: Array<[string, ReactNode]> = [
    ["Views", formatCount(record.views)],
    ["Likes", formatCount(record.likes)],
    ["Shares", formatCount(record.shares)],
    ["Trend strength", formatScore(record.trendStrength)],
    ["Brand fit", formatScore(record.brandFitScore)],
  ];

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-white p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Database className="size-4 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Original Post Data</p>
      </div>
      {captionText ? (
        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Caption</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{captionText}</p>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <TrendMetricChip label="Handle" value={record.profileUsername ?? "—"} />
        <TrendMetricChip label="Audio" value={formatAudioName(record.audioSound) ?? "—"} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {sourceMetrics.map(([label, value]) => (
          <TrendMetricChip key={`${record.id}-${label}`} label={label} value={value} />
        ))}
        <div className="flex min-w-0 items-stretch">
          {record.sourceUrl ? (
            <Button asChild variant="outline" className="h-full w-full rounded-xl border-border/70 bg-white px-4 text-xs font-semibold shadow-none">
              <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-3.5" />
                Open Original Post
              </a>
            </Button>
          ) : record.sourceUrlMissingText ? (
            <div className="flex h-full min-h-[56px] items-center rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
              <p className="text-xs leading-5 text-muted-foreground">{record.sourceUrlMissingText}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrendSummaryCard({
  record,
  onSend,
  sending,
}: {
  record: TrendRecord;
  onSend: (record: TrendRecord) => void;
  sending: boolean;
}) {
  const captionText = normalizeWhitespace(record.captionExcerpt);
  const buttonLabel = sending ? "Sending…" : record.actionState.label;
  const metricChips: Array<[string, ReactNode]> = [
    ["Views", formatCount(record.views)],
    ["Likes", formatCount(record.likes)],
    ["Comments", formatCount(record.comments)],
    ["Shares", formatCount(record.shares)],
  ];
  const scoreChips: Array<[string, ReactNode]> = [
    ["Trend strength", formatScore(record.trendStrength)],
    ["Brand fit", formatScore(record.brandFitScore)],
    ["Risk", formatScore(record.riskScore)],
  ];

  return (
    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
      <CardHeader className="border-b border-border/60 bg-muted/15 px-4 py-3 md:px-5 md:py-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge code={record.platformCode} label={record.platformLabel} />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-[1.9rem] tracking-tight text-primary text-balance leading-[1.05]">{record.trendTitle}</h3>
              {record.hookAngle ? <p className="text-sm leading-5 text-foreground text-pretty">{record.hookAngle}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:self-start lg:pt-1">
            <Badge
              variant="outline"
              className="whitespace-nowrap rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold leading-none text-muted-foreground"
            >
              {record.savedLabel}
            </Badge>
            {record.savedRelative ? <p className="whitespace-nowrap text-[11px] font-medium leading-none text-muted-foreground">{record.savedRelative}</p> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {captionText || record.sourceUrl ? (
              <div className="rounded-2xl border border-border/60 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Caption</p>
                {captionText ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{captionText}</p> : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Metrics</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {metricChips.map(([label, value]) => (
                  <TrendMetricChip key={`${record.id}-${label}`} label={label} value={value} />
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {scoreChips.map(([label, value]) => (
                  <TrendMetricChip key={`${record.id}-${label}`} label={label} value={value} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Original Post Data</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <TrendMetricChip label="Handle" value={record.profileUsername ?? "—"} />
                <TrendMetricChip label="Audio" value={formatAudioName(record.audioSound) ?? "—"} />
              </div>
              <div className="mt-3 flex w-full flex-col gap-2">
                {record.sourceUrl ? (
                  <Button asChild variant="outline" className="h-9 w-full rounded-full border-border/70 bg-white px-4 text-xs font-semibold shadow-none">
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 size-3.5" />
                      Open Original Post
                    </a>
                  </Button>
                ) : record.sourceUrlMissingText ? (
                  <p className="text-xs leading-5 text-muted-foreground">{record.sourceUrlMissingText}</p>
                ) : null}
              </div>
            </div>

          </div>

          <TrendAiInsightPanel record={record} />
        </div>

      </CardContent>

      <CardFooter className="flex flex-col items-start gap-2 border-t border-border/60 bg-muted/10 px-4 py-3 md:px-5 md:py-3">
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            className={cn(
              "h-9 rounded-full px-4",
              record.actionState.label === "Needs Review" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "",
            )}
            variant={record.actionState.label === "Send to Content Draft" ? "default" : "outline"}
            onClick={() => onSend(record)}
            disabled={record.actionState.disabled || sending}
          >
            <ArrowRight className="mr-2 size-4" />
            {buttonLabel}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">{record.actionState.note}</p>
        </div>
      </CardFooter>
    </Card>
  );
}

function TrendTableRow({
  record,
  onSend,
  sending,
  isSourcePostOpen,
  isAiInsightOpen,
  onToggleSourcePost,
  onToggleAiInsight,
}: {
  record: TrendRecord;
  onSend: (record: TrendRecord) => void;
  sending: boolean;
  isSourcePostOpen: boolean;
  isAiInsightOpen: boolean;
  onToggleSourcePost: (record: TrendRecord) => void;
  onToggleAiInsight: (record: TrendRecord) => void;
}) {
  const approvalStatusSource = record.approvalStatus ?? record.actionState.label;
  const approvalStatusLabel = getApprovalStatusLabel(approvalStatusSource);
  const approvalToneLabel = approvalStatusSource;

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="w-[130px] whitespace-nowrap text-sm text-muted-foreground">{record.savedLabel}</TableCell>
        <TableCell className="w-[96px]">
          <PlatformBadge code={record.platformCode} label={record.platformLabel} />
        </TableCell>
        <TableCell className="w-[180px] whitespace-normal">
            <Button
              type="button"
              variant="outline"
              className={cn(
              "h-9 w-full justify-start rounded-full border-border/70 bg-white px-3 text-left text-xs font-semibold text-foreground shadow-none hover:bg-muted/50",
              isSourcePostOpen && "bg-muted/50",
              )}
            onClick={() => onToggleSourcePost(record)}
          >
            <Database className="mr-2 size-3.5" />
            {isSourcePostOpen ? "Hide Original Post Data" : "Original Post Data"}
          </Button>
        </TableCell>
        <TableCell className="w-[180px] whitespace-normal">
            <Button
              type="button"
              variant="outline"
              className={cn(
              "h-9 w-full justify-start rounded-full border-sky-200 bg-sky-50 px-3 text-left text-xs font-semibold text-sky-700 shadow-none hover:bg-sky-100",
              isAiInsightOpen && "bg-sky-100",
              )}
            onClick={() => onToggleAiInsight(record)}
          >
            <Sparkles className="mr-2 size-3.5" />
            {isAiInsightOpen ? "Hide AI Insight" : "AI Insight"}
          </Button>
        </TableCell>
        <TableCell className="w-[250px] whitespace-normal">
          <Badge
            variant="outline"
            className={cn(
              "flex w-full min-w-0 max-w-full justify-start rounded-full border px-2.5 py-1 text-left text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] whitespace-normal break-words",
              getApprovalTone(approvalToneLabel),
            )}
          >
            {approvalStatusLabel}
          </Badge>
        </TableCell>
        <TableCell className="w-[200px] whitespace-normal">
          <div className="flex min-w-0 flex-col gap-2.5">
            <Button
              type="button"
              className={cn(
                "h-auto min-h-8 w-full justify-start rounded-full px-3 py-2 text-left text-[11px] leading-4 whitespace-normal",
                record.actionState.label === "Needs Review" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "",
              )}
              variant={record.actionState.label === "Send to Content Draft" ? "default" : "outline"}
              onClick={() => onSend(record)}
              disabled={record.actionState.disabled || sending}
            >
              {sending ? "Sending…" : record.actionState.label}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isSourcePostOpen ? (
        <TableRow className="align-top bg-white">
          <TableCell colSpan={6} className="p-4 md:p-5">
            <TrendSourcePostPanel record={record} className="shadow-sm" />
          </TableCell>
        </TableRow>
      ) : null}
      {isAiInsightOpen ? (
        <TableRow className="align-top bg-sky-50/40">
          <TableCell colSpan={6} className="p-4 md:p-5">
            <TrendAiInsightPanel record={record} className="shadow-sm" />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export default function G12PublicTrendFetcherPageReworked() {
  const { authFetch } = useAuth();

  const [dashboard, setDashboard] = useState<G12DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [awaitingFetchRunId, setAwaitingFetchRunId] = useState<string | null>(null);
  const [sendingTrendId, setSendingTrendId] = useState<string | null>(null);
  const [sendOutcome, setSendOutcome] = useState<G12SendResponse | null>(null);
  const [expandedSourcePostRowId, setExpandedSourcePostRowId] = useState<string | null>(null);
  const [expandedAiInsightRowId, setExpandedAiInsightRowId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "INSTAGRAM" | "TIKTOK">("ALL");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | ApprovalFilterValue>("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "views" | "trend_strength">("newest");
  const [searchTerm, setSearchTerm] = useState("");

  const hasLoadedRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const sendOutcomeTimeoutRef = useRef<number | null>(null);
  const sendingTrendIdRef = useRef<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const request = useCallback(
    (url: string, options: RequestOptions = {}) => {
      const { silent, ...fetchOptions } = options;
      if (authFetch) {
        return authFetch(url, { ...fetchOptions, silent });
      }

      return fetch(url, fetchOptions);
    },
    [authFetch],
  );

  const loadDashboard = useCallback(async (options: { silentError?: boolean } = {}) => {
    const { silentError = false } = options;
    const isInitialLoad = !hasLoadedRef.current;
    hasLoadedRef.current = true;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await request(buildRouteUrl("/api/admin/g12-trend-fetcher/latest"), {
        cache: "no-store",
        silent: true,
      });
      const body = await parseJsonResponse<G12DashboardResponse>(response);

      if (body) {
        setDashboard(body);
        if (body.status === "ERROR") {
          if (!silentError) {
            toast.error(body.message || "Unable to load the latest trends.", { duration: LOAD_ERROR_TOAST_MS });
          }
        }
      } else if (!response.ok) {
        if (!silentError) {
          toast.error("Unable to load the latest trends.", { duration: LOAD_ERROR_TOAST_MS });
        }
      } else {
        if (!silentError) {
          toast.error("The latest trends response was empty.", { duration: LOAD_ERROR_TOAST_MS });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load the latest trends.";
      if (!silentError) {
        toast.error(message, { duration: LOAD_ERROR_TOAST_MS });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!awaitingFetchRunId) {
      return;
    }

    let active = true;
    let timeoutId: number | null = null;

    const poll = async () => {
      if (!active) {
        return;
      }

      try {
        const response = await request(buildRouteUrl(`/api/admin/g12-trend-fetcher/runs/${encodeURIComponent(awaitingFetchRunId)}`), {
          cache: "no-store",
          silent: true,
        });
        const body = await parseJsonResponse<G12RunResponse>(response);
        const status = normalizeG12TrendFetcherRunStatus(body?.run?.status ?? body?.status ?? (response.ok ? "ACCEPTED" : "ERROR"));
        const runComplete = Boolean(body?.run?.completed_at) || isG12TerminalStatus(status);

        if (runComplete) {
          setAwaitingFetchRunId(null);
          await loadDashboard({ silentError: true });
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "The workflow refresh could not finish.";
        setAwaitingFetchRunId(null);
        toast.error(message, { duration: LOAD_ERROR_TOAST_MS });
        return;
      }

      if (!active) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void poll();
      }, 4000);
      pollTimeoutRef.current = timeoutId;
    };

    timeoutId = window.setTimeout(() => {
      void poll();
    }, 3000);
    pollTimeoutRef.current = timeoutId;

    return () => {
      active = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [awaitingFetchRunId, loadDashboard, request]);

  useEffect(() => {
    return () => {
      if (sendOutcomeTimeoutRef.current !== null) {
        window.clearTimeout(sendOutcomeTimeoutRef.current);
        sendOutcomeTimeoutRef.current = null;
      }
    };
  }, []);

  const latestRunRecords = useMemo(
    () => buildTrendRecords(dashboard?.insights ?? [], dashboard?.metrics ?? [], dashboard?.rawItems ?? []),
    [dashboard],
  );
  const allStoredRecords = useMemo(() => {
    const storedInsights = dashboard?.storedInsights?.length ? dashboard.storedInsights : dashboard?.insights ?? [];
    const storedMetrics = dashboard?.storedMetrics?.length ? dashboard.storedMetrics : dashboard?.metrics ?? [];
    const storedRawItems = dashboard?.storedRawItems?.length ? dashboard.storedRawItems : dashboard?.rawItems ?? [];

    return buildTrendRecords(storedInsights, storedMetrics, storedRawItems);
  }, [dashboard]);

  const latestRun = dashboard?.run ?? null;
  const latestStoredRun = dashboard?.latestStoredRun ?? null;
  const latestStoredRecords = useMemo(() => {
    const explicitRecords = buildTrendRecords(
      dashboard?.latestStoredInsights ?? [],
      dashboard?.latestStoredMetrics ?? [],
      dashboard?.latestStoredRawItems ?? [],
    );
    if (explicitRecords.length) {
      return explicitRecords;
    }

    if (latestStoredRun?.fetch_run_id) {
      const matchingRecords = allStoredRecords.filter((record) => record.fetchRunId === latestStoredRun.fetch_run_id);
      if (matchingRecords.length) {
        return matchingRecords;
      }
    }

    return latestRunRecords;
  }, [allStoredRecords, dashboard, latestRunRecords, latestStoredRun?.fetch_run_id]);
  const latestRunTime = latestRun?.completed_at ?? latestRun?.created_at ?? null;
  const latestRunStatus = useMemo(() => {
    if (submittingRun || awaitingFetchRunId) {
      return "RUNNING";
    }

    if (loading && !dashboard) {
      return "STARTED";
    }

    if (!latestRun) {
      return "NEEDS ACCESS";
    }

    const status = normalizeG12TrendFetcherRunStatus(latestRun.status);
    if (status === "PARTIAL_PASS") {
      return "PARTIAL_PASS";
    }

    if (status === "BLOCK" || status === "ERROR") {
      return "BLOCK";
    }

    if (status === "RUNNING" || status === "STARTED" || status === "ACCEPTED") {
      return "RUNNING";
    }

    return "PASS";
  }, [awaitingFetchRunId, dashboard, latestRun, loading, submittingRun]);
  const latestRunBadgeStatus = latestRunStatus === "BLOCK" ? "NEEDS REVIEW" : latestRunStatus;

  const latestRunLabel = latestRunTime ? `${formatG12DateTime(latestRunTime)} · ${formatG12RelativeTime(latestRunTime)}` : "No run yet";

  const latestCards = useMemo(() => {
    const sorted = [...latestStoredRecords].sort(compareByLatestRunCard);
    const limit = Math.max(0, latestStoredRun?.stored_count ?? sorted.length);
    return sorted.slice(0, limit);
  }, [latestStoredRecords, latestStoredRun?.stored_count]);
  const latestCardsGridClassName = latestCards.length > 1 ? "grid gap-5 lg:grid-cols-2" : "grid gap-5";

  const approvalFilterCounts = useMemo(() => {
    const counts = new Map<ApprovalFilterValue, number>();

    for (const record of allStoredRecords) {
      const approval = getApprovalFilterValue(record.approvalStatus ?? record.actionState.label);
      if (!approval) {
        continue;
      }

      counts.set(approval, (counts.get(approval) ?? 0) + 1);
    }

    return counts;
  }, [allStoredRecords]);

  const approvalFilterOptions = useMemo(
    () =>
      [
        { value: "NEEDS_REVIEW" as const, label: "Needs G4/G5 before content use" },
        { value: "SENT" as const, label: "Sent to Content Draft" },
        { value: "DRAFT" as const, label: "Draft Created" },
        { value: "APPROVED" as const, label: "Approved" },
        { value: "REJECTED" as const, label: "Rejected" },
      ]
        .map((option) => ({
          ...option,
          count: approvalFilterCounts.get(option.value) ?? 0,
        }))
        .filter((option) => option.count > 0),
    [approvalFilterCounts],
  );

  useEffect(() => {
    if (approvalFilter === "ALL") {
      return;
    }

    if (!approvalFilterOptions.some((option) => option.value === approvalFilter)) {
      setApprovalFilter("ALL");
    }
  }, [approvalFilter, approvalFilterOptions]);

  const filteredStoredRecords = useMemo(() => {
    const search = normalizeWhitespace(deferredSearchTerm).toLowerCase();

    return allStoredRecords.filter((record) => {
      if (platformFilter !== "ALL" && record.platformCode !== platformFilter) {
        return false;
      }

      if (approvalFilter !== "ALL") {
        const approval = getApprovalFilterValue(record.approvalStatus ?? record.actionState.label);

        if (approval !== approvalFilter) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      const haystack = [
        record.trendTitle,
        record.trendTopic,
        record.hookAngle,
        record.sourceAccountName,
        record.savedInsightText,
        record.contentRecommendation,
        record.cleanMetricSummary,
        record.platformLabel,
        record.approvalStatus,
        record.sourceSummary,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [allStoredRecords, approvalFilter, deferredSearchTerm, platformFilter]);

  const visibleStoredRows = useMemo(() => {
    const list = [...filteredStoredRecords];
    if (sortBy === "views") {
      return list.sort(compareByViews);
    }
    if (sortBy === "trend_strength") {
      return list.sort(compareByTrendStrength);
    }
    return list.sort(compareByNewest);
  }, [filteredStoredRecords, sortBy]);

  useEffect(() => {
    if (expandedSourcePostRowId && !visibleStoredRows.some((record) => record.id === expandedSourcePostRowId)) {
      setExpandedSourcePostRowId(null);
    }
    if (expandedAiInsightRowId && !visibleStoredRows.some((record) => record.id === expandedAiInsightRowId)) {
      setExpandedAiInsightRowId(null);
    }
  }, [expandedAiInsightRowId, expandedSourcePostRowId, visibleStoredRows]);

  const isBusy = loading || refreshing || submittingRun || Boolean(awaitingFetchRunId);
  const latestRunStoredLabel = latestStoredRun ? `Latest stored run: ${formatCount(latestStoredRun.stored_count)}` : "Latest stored run: 0";
  const totalStoredCount = allStoredRecords.length;
  const historicalRunCount = new Set(allStoredRecords.map((record) => record.fetchRunId).filter(Boolean)).size;
  const totalStoredLabel = `Total stored insights: ${formatCount(totalStoredCount)}`;
  const historicalRunLabel = `Total G12 Runs: ${formatCount(historicalRunCount)}`;
  const headerStatusTone = getHeaderStatusTone(latestRunBadgeStatus);

  const handleRunWorkflow = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setSubmittingRun(true);
    try {
      const payload = buildG12PublicTrendFetchPayload({ platformSelection: "both" });

      const response = await request(buildRouteUrl("/api/admin/g12-trend-fetcher/run"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        silent: true,
      });

      const body = await parseJsonResponse<G12RunResponse>(response);
      const status = normalizeG12TrendFetcherRunStatus(body?.status ?? (response.ok ? "ACCEPTED" : "ERROR"));
      const fetchRunId = body?.run?.fetch_run_id ?? null;

      if (!response.ok) {
        throw new Error(body?.message ?? "The workflow could not start.");
      }

      if (status === "ACCEPTED" && fetchRunId) {
        toast.info(body?.message ?? "Trend fetch started. Data will be saved automatically when the workflow completes.");
        setAwaitingFetchRunId(fetchRunId);
        return;
      }

      if (status === "BLOCK") {
        toast.error(body?.message ?? "The workflow was blocked.");
      } else if (status === "PASS" || status === "PARTIAL_PASS") {
        toast.success(body?.message ?? "Workflow run completed.");
      } else {
        toast.info(body?.message ?? "Workflow run accepted.");
      }

      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the workflow.";
      toast.error(message);
    } finally {
      setSubmittingRun(false);
    }
  }, [isBusy, loadDashboard, request]);

  const handleSendToContentDraft = useCallback(
    async (record: TrendRecord) => {
      if (sendingTrendIdRef.current) {
        return;
      }

      sendingTrendIdRef.current = record.id;
      setSendingTrendId(record.id);
      setSendOutcome(null);
      if (sendOutcomeTimeoutRef.current !== null) {
        window.clearTimeout(sendOutcomeTimeoutRef.current);
        sendOutcomeTimeoutRef.current = null;
      }

      try {
        const payload = {
          insight_id: record.insight.id,
          trend_id: record.insight.trend_id ?? undefined,
          raw_id: record.insight.raw_id ?? undefined,
          metric_id: record.insight.metric_id ?? undefined,
          asset_id: record.insight.asset_id ?? undefined,
          approval_id: record.insight.approval_id ?? undefined,
          g4_review_id: record.insight.g4_review_id ?? undefined,
          fetch_run_id: record.fetchRunId ?? undefined,
        };

        const response = await request(buildRouteUrl("/api/admin/automations/g12/send-to-content-draft"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<G12SendResponse>(response);
        if (!body) {
          throw new Error("Unable to send the selected trend.");
        }

        const approvalStatus = normalizeApprovalStatusValue(body.approval_status ?? "");
        const approvalState = (body.approval_state ?? "").trim().toUpperCase();
        const isApproved = approvalStatus === "APPROVED" || approvalState === "APPROVED" || body.status === "PASS";

        setDashboard((current) => patchG12DashboardForSendOutcome(current, body));
        if (body.status === "ERROR") {
          setSendOutcome(null);
          toast.error(body.message || "Unable to send the selected trend.", { duration: LOAD_ERROR_TOAST_MS });
        } else if (isApproved) {
          setSendOutcome(body);
          sendOutcomeTimeoutRef.current = window.setTimeout(() => {
            setSendOutcome(null);
            sendOutcomeTimeoutRef.current = null;
          }, SEND_OUTCOME_VISIBLE_MS);
          toast.success(
            body.message || (body.already_sent ? "Draft already exists and is approved." : "Draft created and approved successfully."),
            { duration: LOAD_ERROR_TOAST_MS },
          );
        } else if (body.status === "NEEDS_EVIDENCE" || body.status === "BLOCK") {
          setSendOutcome(null);
          toast.warning(body.message || (body.status === "NEEDS_EVIDENCE" ? "More evidence is required." : "Blocked safely."), {
            duration: LOAD_ERROR_TOAST_MS,
          });
        } else if (body.status === "MANUAL_ONLY" || body.status === "PENDING_APPROVAL") {
          setSendOutcome(body);
          sendOutcomeTimeoutRef.current = window.setTimeout(() => {
            setSendOutcome(null);
            sendOutcomeTimeoutRef.current = null;
          }, SEND_OUTCOME_VISIBLE_MS);
          toast.info(body.message || "The draft now needs review.", { duration: LOAD_ERROR_TOAST_MS });
        } else {
          setSendOutcome(body);
          sendOutcomeTimeoutRef.current = window.setTimeout(() => {
            setSendOutcome(null);
            sendOutcomeTimeoutRef.current = null;
          }, SEND_OUTCOME_VISIBLE_MS);
          toast.info(body.message || "The selected trend was updated.", { duration: LOAD_ERROR_TOAST_MS });
        }

        if (body.status !== "ERROR") {
          window.setTimeout(() => {
            void loadDashboard({ silentError: true });
          }, 800);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send the selected trend.";
        setSendOutcome(null);
        toast.error(message, { duration: LOAD_ERROR_TOAST_MS });
      } finally {
        sendingTrendIdRef.current = null;
        setSendingTrendId(null);
      }
    },
    [loadDashboard, request],
  );

  const statusBadge = (
    <Badge
      variant="outline"
      className={cn("h-10 rounded-full border px-5 py-0 text-sm font-semibold uppercase tracking-[0.12em]", headerStatusTone)}
    >
      {latestRunBadgeStatus}
    </Badge>
  );

  const headerActions = (
    <Button type="button" className="h-10 rounded-full px-5" onClick={handleRunWorkflow} disabled={isBusy}>
      <RefreshCcw className={cn("mr-2 size-4", isBusy && "animate-spin")} />
      {loading && !dashboard ? "Loading…" : submittingRun ? "Running…" : awaitingFetchRunId ? "Updating…" : "Run Workflow"}
    </Button>
  );

  return (
    <WorkflowDashboardShell
      title="G12 — Public Trend Fetcher"
      description="Latest workflow results and insights."
      descriptionClassName="whitespace-nowrap"
      badges={
        <>
          {statusBadge}
          <Badge
            variant="outline"
            className="h-10 rounded-full border-border/70 bg-secondary/20 px-5 py-0 text-sm font-semibold text-muted-foreground"
          >
            <Clock3 className="mr-2 size-4" />
            {latestRunLabel}
          </Badge>
        </>
      }
      actions={headerActions}
    >
      <div className="space-y-6">
      {sendOutcome ? (
        <Card role="status" className={cn("rounded-[24px] border shadow-sm", getSendOutcomeTone(getSendOutcomeDisplayStatus(sendOutcome)))}>
          <CardContent className="space-y-5 p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                      getSendOutcomeTone(getSendOutcomeDisplayStatus(sendOutcome)),
                    )}
                  >
                    {getSendOutcomeLabel(sendOutcome)}
                  </Badge>
                  {sendOutcome.already_sent ? (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      Already sent
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold leading-6 text-foreground">{sendOutcome.message}</p>
                  {sendOutcome.summary ? <p className="text-sm leading-6 text-muted-foreground">{sendOutcome.summary}</p> : null}
                </div>
              </div>
            </div>

            {sendOutcome.status !== "ERROR" ? (
              <div className="space-y-4">
                <DetailLine
                  label="Safe rewrite"
                  value={
                    <p className={cn("whitespace-pre-wrap text-sm leading-6 text-foreground", sendOutcome.safe_rewrite ? "text-pretty" : "text-muted-foreground")}>
                      {sendOutcome.safe_rewrite ?? "No safe rewrite was returned."}
                    </p>
                  }
                />

                {sendOutcome.g4_detail_href ? (
                  <div className="flex justify-start">
                    <Button asChild type="button" className="h-10 rounded-full px-4">
                      <Link href={sendOutcome.g4_detail_href}>{sendOutcome.action_needed ?? "View G4 Review"}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardHeader className="space-y-3">
          <SectionHeader
            title="Latest Stored Trends"
            description="Saved insights from the latest G12 run."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {latestRunStoredLabel}
                </Badge>
              </div>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !dashboard ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <TrendCardSkeleton key={`g12-card-skeleton-${index}`} />
              ))}
            </div>
          ) : latestCards.length ? (
            <div className={latestCardsGridClassName}>
              {latestCards.map((record) => (
                <TrendSummaryCard
                  key={record.id}
                  record={record}
                  onSend={(selected) => void handleSendToContentDraft(selected)}
                  sending={sendingTrendId === record.id}
                />
              ))}
            </div>
          ) : latestStoredRun ? (
            <EmptyState
              title="No saved trend insights from the latest stored run"
              description="The latest stored Supabase run did not return qualified insights."
              onRun={() => void handleRunWorkflow()}
              running={isBusy}
            />
          ) : (
            <EmptyState
              title="No trends saved yet"
              description="No trends saved yet. Run the workflow to fetch the latest public trend signals."
              onRun={() => void handleRunWorkflow()}
              running={isBusy}
            />
          )}
        </CardContent>
      </Card>

      <Card id="all-stored-results" className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardHeader className="space-y-4">
          <SectionHeader
            title="All Stored Results"
            description="Clean G12 trend insights from every workflow run."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {totalStoredLabel}
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {historicalRunLabel}
                </Badge>
              </div>
            }
          />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.5fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search all stored results" className="!h-12 rounded-2xl pl-10" />
            </div>

            <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as typeof platformFilter)}>
              <SelectTrigger className="!h-12 w-full rounded-2xl">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All platforms</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
              </SelectContent>
            </Select>

            <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as typeof approvalFilter)}>
              <SelectTrigger className="!h-12 w-full rounded-2xl">
                <SelectValue placeholder="Approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {approvalFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="!h-12 w-full rounded-2xl px-3">
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sorting</span>
                  <SelectValue placeholder="Newest" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="trend_strength">Trend strength</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {approvalFilterOptions.length === 1 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Only one approval status exists in the stored data right now, so the other status buckets are hidden.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {visibleStoredRows.length ? (
            <div className="mt-6 overflow-hidden rounded-[24px] border border-border/60 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[1050px] table-fixed">
                  <colgroup>
                    <col className="w-[130px]" />
                    <col className="w-[96px]" />
                    <col className="w-[180px]" />
                    <col className="w-[180px]" />
                    <col className="w-[250px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">Date saved</TableHead>
                      <TableHead className="px-3">Platform</TableHead>
                      <TableHead className="px-3 text-left">Original Post Data</TableHead>
                      <TableHead className="px-3 text-left">AI Insight</TableHead>
                      <TableHead className="px-3">Approval status</TableHead>
                      <TableHead className="px-3">Action Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStoredRows.map((record) => (
                      <TrendTableRow
                        key={record.id}
                        record={record}
                        onSend={(selected) => void handleSendToContentDraft(selected)}
                        sending={sendingTrendId === record.id}
                        isSourcePostOpen={expandedSourcePostRowId === record.id}
                        isAiInsightOpen={expandedAiInsightRowId === record.id}
                        onToggleSourcePost={(selected) =>
                          setExpandedSourcePostRowId((current) => (current === selected.id ? null : selected.id))
                        }
                        onToggleAiInsight={(selected) =>
                          setExpandedAiInsightRowId((current) => (current === selected.id ? null : selected.id))
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
              No stored insights match the current filters.
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="bg-border/70" />
      </div>
    </WorkflowDashboardShell>
  );
}
