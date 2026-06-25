"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Clock3, Eye, Play, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  formatG12Count,
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
  already_sent?: boolean;
  g4_detail_href?: string | null;
  review_id?: string | null;
  g4_review_id?: string | null;
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
  publishedTimestamp: string | null;
  publishedLabel: string;
  publishedRelative: string | null;
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

type DetailState = {
  record: TrendRecord | null;
  open: boolean;
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

const countFormatter = new Intl.NumberFormat("en-IN");
const scoreFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const formatCount = (value: number | null) => (value === null ? "—" : countFormatter.format(value));
const formatScore = (value: number | null) => (value === null ? "—" : scoreFormatter.format(value));
const formatCompact = (value: number | null) => (value === null ? null : compactFormatter.format(value));

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

const getHeaderStatusTone = (status: string) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIAL_PASS":
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

const getApprovalTone = (label: string) => {
  switch (label) {
    case "Approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Draft Created":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Sent to Content Draft":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "Needs Review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-border/70 bg-muted/20 text-muted-foreground";
  }
};

const getSendOutcomeTone = (status: string) => {
  switch (status) {
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
  const approvalState = (outcome.approval_state ?? "").trim().toUpperCase();
  if (outcome.status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  return outcome.status;
};

const getSendOutcomeLabel = (outcome: G12SendResponse) => {
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
  const approval = (insight.approval_status ?? "").trim().toUpperCase();
  const isRejected = /(REJECT|BLOCK|DENIED|DECLINED|FAILED|FAIL)/.test(approval);
  const isApproved = Boolean(insight.g5_approval_id) || /(APPROVED|APPROVE|PASSED|COMPLETE|COMPLETED|READY)/.test(approval);
  const isDraftCreated = Boolean(insight.g4_review_id) || /(DRAFT)/.test(approval);
  const isSent = Boolean(insight.selected_for_review) || Boolean(insight.wf1_handoff_ready) || /(SENT|IN_REVIEW|REVIEW_REQUESTED)/.test(approval);
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
    note: "Clean payload only. It does not publish content.",
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
  ) ?? "Caption preview not available from the fetched public data.";

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

  if (views !== null) parts.push(`${formatCompact(views)} views`);
  if (likes !== null) parts.push(`${formatCompact(likes)} likes`);
  if (shares !== null) parts.push(`${formatCompact(shares)} shares`);
  if (comments !== null) parts.push(`${formatCompact(comments)} comments`);
  if (saves !== null) parts.push(`${formatCompact(saves)} saves`);
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
      const publishedTimestamp = firstText(
        metric?.published_at,
        metric?.created_at,
        insight.created_at,
        insight.stored_at,
        metric?.stored_at,
        getRawItemText(rawItem, ["published_at", "publishedAt", "detected_at", "detectedAt", "created_at", "createdAt"]),
      );
      const publishedLabel = publishedTimestamp ? formatG12DateTime(publishedTimestamp) : "Not available";
      const publishedRelative = publishedTimestamp ? formatG12RelativeTime(publishedTimestamp) : null;
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
        publishedTimestamp,
        publishedLabel,
        publishedRelative,
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
        approvalStatus: firstText(insight.approval_status),
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
      const aTime = a.publishedTimestamp ? new Date(a.publishedTimestamp).getTime() : 0;
      const bTime = b.publishedTimestamp ? new Date(b.publishedTimestamp).getTime() : 0;
      return bTime - aTime || b.trendTitle.localeCompare(a.trendTitle);
    });
};

const compareByNewest = (a: TrendRecord, b: TrendRecord) => {
  const aTime = a.publishedTimestamp ? new Date(a.publishedTimestamp).getTime() : 0;
  const bTime = b.publishedTimestamp ? new Date(b.publishedTimestamp).getTime() : 0;
  return bTime - aTime || a.trendTitle.localeCompare(b.trendTitle);
};

const compareByViews = (a: TrendRecord, b: TrendRecord) => (b.views ?? -1) - (a.views ?? -1) || compareByNewest(a, b);
const compareByTrendStrength = (a: TrendRecord, b: TrendRecord) => (b.trendStrength ?? -1) - (a.trendStrength ?? -1) || compareByNewest(a, b);
const compareByLatestRunCard = (a: TrendRecord, b: TrendRecord) => {
  const aTime = a.insight.created_at ? new Date(a.insight.created_at).getTime() : a.publishedTimestamp ? new Date(a.publishedTimestamp).getTime() : 0;
  const bTime = b.insight.created_at ? new Date(b.insight.created_at).getTime() : b.publishedTimestamp ? new Date(b.publishedTimestamp).getTime() : 0;
  return bTime - aTime || (b.views ?? -1) - (a.views ?? -1) || (b.likes ?? -1) - (a.likes ?? -1) || a.trendTitle.localeCompare(b.trendTitle);
};

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p>
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

function SuggestionList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  if (!items.length) {
    return <p className="text-sm leading-6 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm leading-6 text-foreground text-pretty">
          {item}
        </li>
      ))}
    </ul>
  );
}

function TrendMetricChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function TrendSummaryCard({
  record,
  onViewDetails,
  onSend,
  sending,
}: {
  record: TrendRecord;
  onViewDetails: (record: TrendRecord) => void;
  onSend: (record: TrendRecord) => void;
  sending: boolean;
}) {
  const approvalLabel =
  record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review"
      ? "NEEDS_G4_G5_BEFORE_CONTENT_USE"
      : record.actionState.label;
  const approvalTone = getApprovalTone(record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review" ? "Needs Review" : record.actionState.label);
  const isFinal = record.actionState.tone === "final";
  const captionText = normalizeWhitespace(record.captionExcerpt);
  const buttonLabel = sending ? "Sending…" : record.actionState.label;
  const sourceTags = record.hashtags.slice(0, 8);
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
      <CardHeader className="border-b border-border/60 bg-muted/15 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {record.platformLabel}
              </Badge>
              {record.trendTopic ? (
                <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {record.trendTopic}
                </Badge>
              ) : null}
              {record.aiGenerated ? (
                <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                  AI summarized
                </Badge>
              ) : null}
              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", approvalTone)}>
                {approvalLabel}
              </Badge>
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-2xl tracking-tight text-primary text-balance">{record.trendTitle}</h3>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground text-pretty">{record.savedInsightText}</p>
              {record.hookAngle ? <p className="text-sm leading-6 text-foreground text-pretty">{record.hookAngle}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              {record.publishedLabel}
            </Badge>
            {record.publishedRelative ? <p className="text-xs text-muted-foreground">{record.publishedRelative}</p> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">Source Caption Preview</p>
                  <p className="mt-1 text-xs leading-5 text-amber-950/80">Reference only. Raw scraped content is quarantined.</p>
                </div>
                <Badge variant="outline" className="rounded-full border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700">
                  Quarantined
                </Badge>
              </div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                <p className={cn("line-clamp-4 text-sm leading-6 text-pretty", captionText ? "text-foreground" : "text-muted-foreground")}>
                  {captionText || "Caption preview not available from the fetched public data."}
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-950">
                Do not copy this caption. Raw scraped content is quarantined.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Source Metadata</p>
                {record.sourceUrl ? (
                  <Button asChild variant="outline" className="h-9 rounded-full border-border/70 bg-white px-4 text-xs font-semibold">
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                      Open original post
                      <ArrowUpRight className="ml-2 size-4" />
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">{record.sourceUrlMissingText}</p>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-secondary/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</p>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">{record.sourceAccountName}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Handle</p>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">{record.profileUsername ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Audio</p>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">{record.audioSound ?? "—"}</p>
                </div>
              </div>

              {sourceTags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourceTags.map((tag) => (
                    <Badge key={`${record.id}-${tag}`} variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      {tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`}
                    </Badge>
                  ))}
                  {record.hashtags.length > 8 ? (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      +{record.hashtags.length - 8} more
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Metrics</p>
                {record.cleanMetricSummary ? <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Saved in Supabase</span> : null}
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
              {record.cleanMetricSummary ? <p className="mt-3 rounded-xl border border-border/60 bg-secondary/10 p-3 text-xs leading-5 text-muted-foreground">{record.cleanMetricSummary}</p> : null}
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">AI Insight</p>
                {record.aiGenerated ? (
                  <Badge variant="outline" className="rounded-full border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-sky-700">
                    AI summarized
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-sky-950">
                <p>
                  <span className="font-semibold">AI model:</span> <span className="text-sky-800">{record.aiModel ?? "—"}</span>
                </p>
                <p>
                  <span className="font-semibold">Content recommendation:</span>{" "}
                  <span className="text-sky-800">{record.contentRecommendation}</span>
                </p>
                <p>
                  <span className="font-semibold">Brand fit reason:</span>{" "}
                  <span className="text-sky-800">{record.brandFitReason ?? "—"}</span>
                </p>
                <p>
                  <span className="font-semibold">Risk notes:</span> <span className="text-sky-800">{record.riskNotes ?? "—"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="space-y-1">
          <p className={cn("text-sm leading-6", isFinal ? "text-muted-foreground" : "text-foreground")}>Saved in Supabase. Raw content quarantined. Requires G4/G5 before content use.</p>
          <p className="text-xs leading-5 text-muted-foreground">{record.actionState.note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" className="h-10 rounded-full px-4 text-sm" onClick={() => onViewDetails(record)}>
            <Eye className="mr-2 size-4" />
            View Details
          </Button>
          <Button
            type="button"
            className={cn(
              "h-10 rounded-full px-5",
              record.actionState.label === "Needs Review" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "",
            )}
            variant={record.actionState.label === "Send to Content Draft" ? "default" : "outline"}
            onClick={() => onSend(record)}
            disabled={record.actionState.disabled || sending}
          >
            <ArrowRight className="mr-2 size-4" />
            {buttonLabel}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function TrendTableRow({
  record,
  onViewDetails,
  onSend,
  sending,
}: {
  record: TrendRecord;
  onViewDetails: (record: TrendRecord) => void;
  onSend: (record: TrendRecord) => void;
  sending: boolean;
}) {
  return (
    <TableRow className="align-top">
      <TableCell className="w-[130px] whitespace-nowrap text-sm text-muted-foreground">{record.publishedLabel}</TableCell>
      <TableCell className="w-[96px]">
        <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {record.platformLabel}
        </Badge>
      </TableCell>
      <TableCell className="w-[170px]">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-1 break-words font-medium text-foreground">{record.trendTopic ?? record.trendTitle}</p>
          <p className="line-clamp-1 break-words text-xs leading-5 text-muted-foreground">{record.sourceAccountName}</p>
        </div>
      </TableCell>
      <TableCell className="w-[230px] whitespace-normal text-sm leading-6 text-foreground">
        <p className="break-words">{record.trendTitle}</p>
      </TableCell>
      <TableCell className="w-[78px] whitespace-nowrap text-sm text-foreground">{formatCount(record.views)}</TableCell>
      <TableCell className="w-[78px] whitespace-nowrap text-sm text-foreground">{formatCount(record.likes)}</TableCell>
      <TableCell className="w-[78px] whitespace-nowrap text-sm text-foreground">{formatCount(record.shares)}</TableCell>
      <TableCell className="w-[96px] whitespace-nowrap text-sm text-foreground">{formatScore(record.trendStrength)}</TableCell>
      <TableCell className="w-[88px] whitespace-nowrap text-sm text-foreground">{formatScore(record.brandFitScore)}</TableCell>
      <TableCell className="w-[72px]">
        <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", record.aiGenerated ? "border-sky-200 bg-sky-50 text-sky-700" : "border-border/70 bg-secondary/20 text-muted-foreground")}>
          {record.aiGenerated ? "AI" : "Manual"}
        </Badge>
      </TableCell>
      <TableCell className="w-[250px] whitespace-normal">
        <Badge
          variant="outline"
          className={cn(
            "flex w-full min-w-0 max-w-full justify-center rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] whitespace-normal break-all",
            getApprovalTone(record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review" ? "Needs Review" : record.actionState.label),
          )}
        >
          {record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review"
            ? "NEEDS_G4_G5_BEFORE_CONTENT_USE"
            : record.actionState.label}
        </Badge>
      </TableCell>
      <TableCell className="w-[200px] whitespace-normal">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-8 w-full justify-start rounded-full px-3 py-2 text-left text-[11px] leading-4 whitespace-normal"
            onClick={() => onViewDetails(record)}
          >
            <Eye className="mr-1 size-3.5" />
            View Details
          </Button>
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
            <ArrowRight className="mr-1 size-3.5" />
            {sending ? "Sending…" : record.actionState.label}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function G12PublicTrendFetcherPageReworked() {
  const { authFetch } = useAuth();

  const [dashboard, setDashboard] = useState<G12DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [awaitingFetchRunId, setAwaitingFetchRunId] = useState<string | null>(null);
  const [sendingTrendId, setSendingTrendId] = useState<string | null>(null);
  const [sendOutcome, setSendOutcome] = useState<G12SendResponse | null>(null);
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "INSTAGRAM" | "TIKTOK">("ALL");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | "NEEDS_REVIEW" | "SENT" | "DRAFT" | "APPROVED" | "REJECTED">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "views" | "trend_strength">("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [detailState, setDetailState] = useState<DetailState>({ record: null, open: false });

  const hasLoadedRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
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

  const loadDashboard = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    hasLoadedRef.current = true;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setLoadError(null);

    try {
      const response = await request(buildRouteUrl("/api/admin/g12-trend-fetcher/latest"), {
        cache: "no-store",
        silent: true,
      });
      const body = await parseJsonResponse<G12DashboardResponse>(response);

      if (body) {
        setDashboard(body);
        if (body.status === "ERROR") {
          setLoadError(body.message);
        }
      } else if (!response.ok) {
        setLoadError("Unable to load the latest trends.");
      } else {
        setLoadError("The latest trends response was empty.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load the latest trends.";
      setLoadError(message);
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
          await loadDashboard();
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "The workflow refresh could not finish.";
        setAwaitingFetchRunId(null);
        toast.error(message);
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
  const latestStoredRunTime = latestStoredRun?.completed_at ?? latestStoredRun?.created_at ?? null;
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

  const latestRunLabel = latestRunTime ? `${formatG12DateTime(latestRunTime)} · ${formatG12RelativeTime(latestRunTime)}` : "No run yet";
  const latestStoredRunLabel = latestStoredRunTime
    ? `${formatG12DateTime(latestStoredRunTime)} · ${formatG12RelativeTime(latestStoredRunTime)}`
    : "No stored run yet";
  const showingLatestStoredFallback = Boolean(
    latestRun &&
      latestStoredRun &&
      latestRun.fetch_run_id &&
      latestStoredRun.fetch_run_id &&
      latestRun.fetch_run_id !== latestStoredRun.fetch_run_id,
  );

  const latestCards = useMemo(() => {
    const sorted = [...latestStoredRecords].sort(compareByLatestRunCard);
    const limit = Math.max(0, latestStoredRun?.stored_count ?? sorted.length);
    return sorted.slice(0, limit);
  }, [latestStoredRecords, latestStoredRun?.stored_count]);

  const filteredStoredRecords = useMemo(() => {
    const search = normalizeWhitespace(deferredSearchTerm).toLowerCase();

    return allStoredRecords.filter((record) => {
      if (platformFilter !== "ALL" && record.platformCode !== platformFilter) {
        return false;
      }

      if (approvalFilter !== "ALL") {
        const approval = (record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review" ? "NEEDS_REVIEW" : record.actionState.label)
          .toUpperCase();

        if (approvalFilter === "NEEDS_REVIEW" && approval !== "NEEDS_REVIEW") {
          return false;
        }
        if (approvalFilter === "SENT" && approval !== "SENT TO CONTENT DRAFT") {
          return false;
        }
        if (approvalFilter === "DRAFT" && approval !== "DRAFT CREATED") {
          return false;
        }
        if (approvalFilter === "APPROVED" && approval !== "APPROVED") {
          return false;
        }
        if (approvalFilter === "REJECTED" && approval !== "REJECTED") {
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

  const isBusy = loading || refreshing || submittingRun || Boolean(awaitingFetchRunId);
  const latestRunStoredLabel = latestStoredRun ? `Latest stored run: ${formatG12Count(latestStoredRun.stored_count)}` : "Latest stored run: 0";
  const totalStoredCount = allStoredRecords.length;
  const historicalRunCount = new Set(allStoredRecords.map((record) => record.fetchRunId).filter(Boolean)).size;
  const totalStoredLabel = `Total stored insights: ${formatG12Count(totalStoredCount)}`;
  const historicalRunLabel = `Historical saved runs: ${formatG12Count(historicalRunCount)}`;
  const headerStatusTone = getHeaderStatusTone(latestRunStatus);

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
      if (sendingTrendId) {
        return;
      }

      setSendingTrendId(record.id);
      try {
        const response = await request(buildRouteUrl("/api/admin/automations/g12/send-to-content-draft"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            insight_id: record.insight.id,
            fetch_run_id: record.fetchRunId ?? undefined,
          }),
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<G12SendResponse>(response);
        if (!body) {
          throw new Error("Unable to send the selected trend.");
        }

        setSendOutcome(body);
        const approvalState = (body.approval_state ?? "").trim().toUpperCase();
        const pendingHumanApproval = body.status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL";

        if (pendingHumanApproval) {
          toast.info(body.message || "Content check passed. Human approval is still required before this can be used.");
        } else if (body.status === "PASS") {
          if (body.already_sent) {
            toast.info(body.message || "Content draft/check already exists in G4.");
          } else {
            toast.success(body.message || "Content draft/check created in G4.");
          }
        } else if (body.status === "PENDING_APPROVAL" || body.status === "MANUAL_ONLY") {
          toast.info(body.message || "The draft now needs review.");
        } else if (body.status === "NEEDS_EVIDENCE" || body.status === "BLOCK") {
          toast.warning(body.message || (body.status === "NEEDS_EVIDENCE" ? "More evidence is required." : "Blocked safely."));
        } else if (body.status === "ERROR") {
          toast.error(body.message || "Unable to send the selected trend.");
        } else {
          toast.info(body.message || "The selected trend was updated.");
        }

        if (body.status !== "ERROR") {
          window.setTimeout(() => {
            void loadDashboard();
          }, 1200);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send the selected trend.";
        toast.error(message);
      } finally {
        setSendingTrendId(null);
      }
    },
    [loadDashboard, request, sendingTrendId],
  );

  const statusBadge = (
    <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", headerStatusTone)}>
      {latestRunStatus}
    </Badge>
  );

  const headerActions = (
    <Button type="button" className="h-10 rounded-full px-5" onClick={handleRunWorkflow} disabled={isBusy}>
      <RefreshCcw className={cn("mr-2 size-4", isBusy && "animate-spin")} />
      {loading && !dashboard ? "Loading…" : submittingRun ? "Running…" : awaitingFetchRunId ? "Updating…" : "Run Workflow"}
    </Button>
  );

  const renderTrendModalContent = (record: TrendRecord | null) => {
    if (!record) {
      return null;
    }

    return (
      <DialogContent className="!w-[96vw] !max-w-[1280px] max-h-[calc(100vh-2rem)] overflow-hidden p-0">
        <ScrollArea className="max-h-[calc(100vh-2rem)]">
          <div className="space-y-6 p-6 md:p-8">
            <DialogHeader>
              <DialogTitle className="font-serif text-3xl tracking-tight text-primary">{record.trendTitle}</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-muted-foreground">
                Saved in Supabase. Raw content is quarantined. Requires G4/G5 before content use.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {record.platformLabel}
              </Badge>
              {record.trendTopic ? (
                <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {record.trendTopic}
                </Badge>
              ) : null}
              <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", getApprovalTone(record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review" ? "Needs Review" : record.actionState.label))}>
                {record.actionState.label === "Send to Content Draft" || record.actionState.label === "Needs Review"
                  ? "NEEDS_G4_G5_BEFORE_CONTENT_USE"
                  : record.actionState.label}
              </Badge>
              {record.aiGenerated ? (
                <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                  AI summarized
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <DetailLine
                label="Overview"
                value={
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Insight title:</span>{" "}
                      <span className="text-muted-foreground">{record.trendTitle}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Platform:</span>{" "}
                      <span className="text-muted-foreground">{record.platformLabel}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Trend topic:</span>{" "}
                      <span className="text-muted-foreground">{record.trendTopic ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Saved date:</span>{" "}
                      <span className="text-muted-foreground">{record.publishedLabel}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Approval status:</span>{" "}
                      <span className="text-muted-foreground">{record.approvalStatus ?? record.actionState.label}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Fetch run ID:</span> <span className="text-muted-foreground">{record.fetchRunId ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Trend ID:</span> <span className="text-muted-foreground">{record.insight.id}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Metric ID:</span> <span className="text-muted-foreground">{record.metric?.id ?? "—"}</span>
                    </p>
                  </div>
                }
              />
              <DetailLine
                label="Original Post"
                value={
                  record.sourceUrl ? (
                    <Button asChild variant="outline" className="h-9 rounded-full border-border/70 bg-white px-4 text-xs font-semibold">
                      <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                        Open original post
                        <ArrowUpRight className="ml-2 size-4" />
                      </a>
                    </Button>
                  ) : (
                    "Source link not available from fetched data."
                  )
                }
              />
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <DetailLine label="Public Metrics" value={<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><TrendMetricChip label="Views" value={formatCount(record.views)} /><TrendMetricChip label="Likes" value={formatCount(record.likes)} /><TrendMetricChip label="Comments" value={formatCount(record.comments)} /><TrendMetricChip label="Shares" value={formatCount(record.shares)} /><TrendMetricChip label="Saves" value={formatCount(record.saves)} /><TrendMetricChip label="Engagement" value={formatScore(record.engagementRate)} /><TrendMetricChip label="Trend strength" value={formatScore(record.trendStrength)} /><TrendMetricChip label="Brand fit" value={formatScore(record.brandFitScore)} /><TrendMetricChip label="Risk" value={formatScore(record.riskScore)} /></div>} />
              <DetailLine label="AI Insight" value={<div className="space-y-2"><p><span className="font-semibold">AI generated:</span> <span className="text-muted-foreground">{record.aiGenerated ? "true" : "false"}</span></p><p><span className="font-semibold">AI model:</span> <span className="text-muted-foreground">{record.aiModel ?? "—"}</span></p><p><span className="font-semibold">Trend meaning:</span> <span className="text-muted-foreground">{record.savedInsightText}</span></p><p><span className="font-semibold">Hook angle:</span> <span className="text-muted-foreground">{record.hookAngle ?? "—"}</span></p><p><span className="font-semibold">Brand fit reason:</span> <span className="text-muted-foreground">{record.brandFitReason ?? "—"}</span></p><p><span className="font-semibold">Risk notes:</span> <span className="text-muted-foreground">{record.riskNotes ?? "—"}</span></p><p><span className="font-semibold">Content recommendation:</span> <span className="text-muted-foreground">{record.contentRecommendation}</span></p></div>} />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Compliance Notes</p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Raw scraped content is quarantined. Do not copy captions, media, audio, creator identity, or competitor creative. This insight is a planning input only. Content must go through G4/G5 approval before use.
              </p>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <DetailLine
                label="Source / Metadata"
                value={
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Profile username:</span>{" "}
                      <span className="text-muted-foreground">{record.profileUsername ?? record.sourceAccountName}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Published date:</span>{" "}
                      <span className="text-muted-foreground">{record.publishedLabel}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Audio sound:</span>{" "}
                      <span className="text-muted-foreground">{record.audioSound ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Hashtags:</span>{" "}
                      <span className="text-muted-foreground">{record.hashtags.length ? record.hashtags.join(", ") : "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Keyword matches:</span>{" "}
                      <span className="text-muted-foreground">{record.keywordMatches.length ? record.keywordMatches.join(", ") : "—"}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Competitor matches:</span>{" "}
                      <span className="text-muted-foreground">{record.competitorMatches.length ? record.competitorMatches.join(", ") : "—"}</span>
                    </p>
                  </div>
                }
              />
              <DetailLine
                label="Source Caption Preview"
                value={
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{record.captionExcerpt}</p>
                    <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-950">
                      Reference only. Do not copy this caption. Raw scraped content is quarantined.
                    </p>
                  </div>
                }
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDetailState({ record: null, open: false })}>
                Close
              </Button>
              <Button
                type="button"
                className={cn("rounded-full", record.actionState.label === "Needs Review" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "")}
                variant={record.actionState.label === "Send to Content Draft" ? "default" : "outline"}
                onClick={() => {
                  setDetailState({ record: null, open: false });
                  void handleSendToContentDraft(record);
                }}
                disabled={record.actionState.disabled || Boolean(sendingTrendId)}
              >
                <ArrowRight className="mr-2 size-4" />
                {record.actionState.label === "Send to Content Draft" ? "Send to Content Draft" : record.actionState.label}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    );
  };

  return (
    <WorkflowDashboardShell
      eyebrow="Public trend signals"
      title="G12 — Public Trend Fetcher"
      description="Finds safe public trend signals, saves clean trend insights, and keeps raw content quarantined."
      badges={
        <>
          {statusBadge}
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <Clock3 className="mr-2 size-3.5" />
            {latestRunLabel}
          </Badge>
        </>
      }
      actions={headerActions}
    >
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
                  {sendOutcome.review_id ? (
                    <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                      Review linked
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold leading-6 text-foreground">{sendOutcome.message}</p>
                  {sendOutcome.summary ? <p className="text-sm leading-6 text-muted-foreground">{sendOutcome.summary}</p> : null}
                </div>
              </div>

              {sendOutcome.status !== "ERROR" && sendOutcome.g4_detail_href ? (
                <Button asChild type="button" className="rounded-full px-4">
                  <Link href={sendOutcome.g4_detail_href}>{sendOutcome.action_needed ?? "View G4 Review"}</Link>
                </Button>
              ) : null}
            </div>

            {sendOutcome.status !== "ERROR" ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailLine
                    label="Review ID"
                    value={<span className="font-mono text-xs leading-6 text-foreground">{sendOutcome.review_id ?? sendOutcome.g4_review_id ?? "—"}</span>}
                  />
                  <DetailLine
                    label="Asset ID"
                    value={<span className="font-mono text-xs leading-6 text-foreground">{sendOutcome.asset_id ?? "—"}</span>}
                  />
                  <DetailLine
                    label="Approval state"
                    value={<span className="font-mono text-xs leading-6 text-foreground">{sendOutcome.approval_state ?? "—"}</span>}
                  />
                  <DetailLine
                    label="Action needed"
                    value={<span className="text-sm leading-6 text-foreground">{sendOutcome.action_needed ?? "View G4 Review"}</span>}
                  />
                </div>

                <div className="space-y-3">
                  <DetailLine
                    label="Safe rewrite"
                    value={
                      <p className={cn("whitespace-pre-wrap text-sm leading-6 text-foreground", sendOutcome.safe_rewrite ? "text-pretty" : "text-muted-foreground")}>
                        {sendOutcome.safe_rewrite ?? "No safe rewrite was returned."}
                      </p>
                    }
                  />
                  <DetailLine label="Caption suggestions" value={<SuggestionList items={sendOutcome.caption_suggestions ?? []} emptyText="No caption suggestions were returned." />} />
                  <DetailLine label="Hook suggestions" value={<SuggestionList items={sendOutcome.hook_suggestions ?? []} emptyText="No hook suggestions were returned." />} />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {loadError && !dashboard ? (
        <Card role="alert" className="rounded-[24px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-rose-900">{loadError}</p>
            <Button type="button" variant="outline" className="rounded-full border-rose-200 bg-white text-rose-700 hover:bg-rose-50" onClick={() => void loadDashboard()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardHeader className="space-y-3">
          <SectionHeader
            eyebrow="Latest Run"
            title="Latest Stored Trends"
            description="Saved insights from the most recent G12 run that stored results in Supabase."
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
          {latestRun?.status === "BLOCK" && latestRun.failure_reasons.length ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950 shadow-sm">
              <p className="font-semibold">Failure reasons</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {latestRun.failure_reasons.map((reason, index) => (
                  <li key={`g12-failure-${index}`}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {showingLatestStoredFallback ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm">
              <p className="font-semibold">Showing the most recent stored Supabase run</p>
              <p className="mt-1">
                The latest run on {latestRunLabel} stored no insights. These cards are from the last run that stored results: {latestStoredRunLabel}.
              </p>
            </div>
          ) : null}

          {loading && !dashboard ? (
            <div className="grid gap-5 xl:grid-cols-1">
              {Array.from({ length: 1 }).map((_, index) => (
                <TrendCardSkeleton key={`g12-card-skeleton-${index}`} />
              ))}
            </div>
          ) : latestCards.length ? (
            <div className="grid gap-5 xl:grid-cols-1">
              {latestCards.map((record) => (
                <TrendSummaryCard
                  key={record.id}
                  record={record}
                  onViewDetails={(selected) => setDetailState({ record: selected, open: true })}
                  onSend={(selected) => void handleSendToContentDraft(selected)}
                  sending={sendingTrendId === record.id}
                />
              ))}
            </div>
          ) : latestStoredRun ? (
            <EmptyState
              title="No saved trend insights from the latest stored run"
              description={
                latestRun?.status === "BLOCK"
                  ? "This latest run was blocked. Review the failure reasons above."
                  : "The latest stored Supabase run did not return qualified insights."
              }
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
            eyebrow="All Stored Results"
            title="All Stored Results"
            description="All clean G12 trend insights saved in Supabase across every workflow run."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {latestRunStoredLabel}
                </Badge>
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
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search all stored results" className="h-11 rounded-2xl pl-10" />
            </div>

            <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as typeof platformFilter)}>
              <SelectTrigger className="h-11 w-full rounded-2xl">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All platforms</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
              </SelectContent>
            </Select>

            <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as typeof approvalFilter)}>
              <SelectTrigger className="h-11 w-full rounded-2xl">
                <SelectValue placeholder="Approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="NEEDS_REVIEW">Needs G4/G5 before content use</SelectItem>
                <SelectItem value="SENT">Sent to Content Draft</SelectItem>
                <SelectItem value="DRAFT">Draft Created</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-11 w-full rounded-2xl">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="trend_strength">Trend strength</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {visibleStoredRows.length ? (
            <div className="overflow-hidden rounded-[24px] border border-border/60 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[1560px] table-fixed">
                  <colgroup>
                    <col className="w-[130px]" />
                    <col className="w-[96px]" />
                    <col className="w-[170px]" />
                    <col className="w-[230px]" />
                    <col className="w-[78px]" />
                    <col className="w-[78px]" />
                    <col className="w-[78px]" />
                    <col className="w-[96px]" />
                    <col className="w-[88px]" />
                    <col className="w-[72px]" />
                    <col className="w-[250px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">Date saved</TableHead>
                      <TableHead className="px-3">Platform</TableHead>
                      <TableHead className="px-3">Trend topic</TableHead>
                      <TableHead className="px-3">Insight title</TableHead>
                      <TableHead className="px-3">Views</TableHead>
                      <TableHead className="px-3">Likes</TableHead>
                      <TableHead className="px-3">Shares</TableHead>
                      <TableHead className="px-3">Trend strength</TableHead>
                      <TableHead className="px-3">Brand fit</TableHead>
                      <TableHead className="px-3">AI</TableHead>
                      <TableHead className="px-3">Approval status</TableHead>
                      <TableHead className="px-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStoredRows.map((record) => (
                      <TrendTableRow
                        key={record.id}
                        record={record}
                        onViewDetails={(selected) => setDetailState({ record: selected, open: true })}
                        onSend={(selected) => void handleSendToContentDraft(selected)}
                        sending={sendingTrendId === record.id}
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

      <Dialog open={detailState.open} onOpenChange={(open) => setDetailState((current) => ({ ...current, open }))}>
        {renderTrendModalContent(detailState.record)}
      </Dialog>
    </WorkflowDashboardShell>
  );
}
