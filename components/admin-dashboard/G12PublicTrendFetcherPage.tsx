"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Clock3, Play, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import WorkflowDashboardShell from "@/components/admin-dashboard/WorkflowDashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
  G12_TREND_FETCHER_QUERY_DEFAULT,
  G12_TREND_FETCHER_RESULT_CAP_DEFAULT,
  G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT,
  buildG12ManualPayload,
  formatG12Count,
  formatG12DateTime,
  formatG12RelativeTime,
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

type G12LatestResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  message: string;
  source?: string | null;
  run: G12LatestRun | null;
  insights: G12InsightRecord[];
  metrics: G12MetricRecord[];
  rawItems: G12RawItemRecord[];
  rawCounts: Record<string, number>;
};

type G12RunResponse = {
  status: string;
  message: string;
  fetch_run_id?: string | null;
  fetchRunId?: string | null;
  run?: G12LatestRun | null;
  insights?: G12InsightRecord[];
  metrics?: G12MetricRecord[];
  rawItems?: G12RawItemRecord[];
  rawCounts?: Record<string, number>;
};

type G12SendResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message: string;
  summary?: string | null;
  action_needed?: string | null;
  already_sent?: boolean;
  g4_detail_href?: string | null;
  g4_review_id?: string | null;
  request_id?: string | null;
  sent_at?: string | null;
  content_draft_id?: string | null;
  insight_id?: string | null;
  fetch_run_id?: string | null;
  handled_at?: string | null;
};

type TrendActionState = {
  label: string;
  tone: "send" | "review" | "final";
  disabled: boolean;
  note: string;
};

type TrendCardData = {
  insight: G12InsightRecord;
  metric: G12MetricRecord | null;
  fetchRunId: string | null;
  title: string;
  hookAngle: string | null;
  trendTopic: string | null;
  platformLabel: string;
  sourcePlatformCode: string;
  sourceAccountName: string;
  publishedKind: "Published" | "Detected" | "Saved";
  publishedLabel: string;
  publishedRelative: string | null;
  publishedTimestamp: string | null;
  originalCaptionPreview: string;
  sourceUrl: string | null;
  audioSound: string | null;
  hashtags: string[];
  savedInsightText: string;
  contentRecommendation: string;
  cleanMetricSummary: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  brandFitScore: number | null;
  riskScore: number | null;
  actionState: TrendActionState;
};

type TrendHeaderStatus = "PASS" | "BLOCK" | "NEEDS ACCESS" | "Loading";

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

const CAPTION_PREVIEW_LIMIT = 320;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, limit = CAPTION_PREVIEW_LIMIT) => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  const sliced = normalized.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  const cutPoint = lastSpace > limit * 0.6 ? lastSpace : limit;
  return `${sliced.slice(0, cutPoint).trimEnd()}…`;
};

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
      // Ignore strings that are not JSON objects.
    }
  }

  return null;
};

const pickRecordText = (record: Record<string, unknown> | null | undefined, keys: string[]) => pickRecordValue(record, keys);

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

const normalizeExternalUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^\/\//.test(trimmed)) {
    return `https:${trimmed}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(trimmed) || trimmed.startsWith("www.")) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  return trimmed;
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

const metricCountFormatter = new Intl.NumberFormat("en-IN");
const metricScoreFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const formatMetricValue = (value: number | null) => {
  if (value === null) {
    return "—";
  }

  return Number.isInteger(value) ? metricCountFormatter.format(value) : metricScoreFormatter.format(value);
};

const formatCompactMetricValue = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return compactFormatter.format(value);
};

const formatHashtag = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#+/, "")}`;
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
          const label = pickRecordText(parsed as Record<string, unknown>, ["name", "tag", "value", "label", "text"]);
          if (label) {
            normalized.push(label);
            continue;
          }
        }
      } catch {
        // Keep the original string when it is already plain text.
      }

      normalized.push(trimmed);
      continue;
    }

    if (typeof entry === "number" || typeof entry === "bigint" || typeof entry === "boolean") {
      normalized.push(String(entry));
      continue;
    }

    if (typeof entry === "object" && entry !== null) {
      const label = pickRecordText(entry as Record<string, unknown>, ["name", "tag", "value", "label", "text"]);
      if (label) {
        normalized.push(label);
      }
    }
  }

  return Array.from(new Set(normalized)).filter(Boolean);
};

const buildTrendHashtags = (rawItem: G12RawItemRecord | null) => {
  const payload = getRawPayloadRecord(rawItem);
  const candidates = [
    rawItem?.hashtags,
    rawItem?.hash_tags,
    rawItem?.hashtag_list,
    rawItem?.hashtagList,
    payload?.hashtags,
    payload?.hash_tags,
    payload?.hashtag_list,
    payload?.hashtagList,
  ];

  const hashtags = candidates.flatMap((candidate) => normalizeLooseStringArray(candidate));
  return Array.from(new Set(hashtags));
};

const getRawPayloadRecord = (record: G12RawItemRecord | null | undefined) =>
  pickRecordObject(record, ["raw_payload", "rawPayload", "payload", "data", "details", "metadata"]);

const getRawItemText = (record: G12RawItemRecord | null | undefined, keys: string[]) => {
  const direct = pickRecordText(record, keys);
  if (direct) {
    return direct;
  }

  const payload = getRawPayloadRecord(record);
  return pickRecordText(payload, keys);
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

const getHeaderStatusTone = (status: TrendHeaderStatus) => {
  switch (status) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NEEDS ACCESS":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-border/70 bg-secondary/20 text-muted-foreground";
  }
};

const getActionTone = (label: string) => {
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
      return "border-primary/20 bg-primary/10 text-primary";
  }
};

const getPublishedKind = (metric: G12MetricRecord | null, insight: G12InsightRecord) => {
  if (metric?.published_at) {
    return "Published" as const;
  }

  if (metric?.created_at || insight.created_at) {
    return "Detected" as const;
  }

  return "Saved" as const;
};

const buildOriginalCaptionPreview = (insight: G12InsightRecord, metric: G12MetricRecord | null, rawItem: G12RawItemRecord | null) =>
  firstText(
    insight.caption_preview,
    metric?.caption_preview,
    getRawItemText(rawItem, ["caption", "text", "description"]),
    getRawItemText(rawItem, ["caption_preview", "captionPreview"]),
  ) ??
  "Original caption preview not available from fetched data.";

const buildSourceUrl = (insight: G12InsightRecord, metric: G12MetricRecord | null, rawItem: G12RawItemRecord | null) =>
  normalizeExternalUrl(
    firstText(
      insight.source_url,
      metric?.source_url,
      getRawItemText(rawItem, ["source_url", "sourceUrl"]),
      getRawItemText(rawItem, ["url", "postUrl", "webVideoUrl", "permalink"]),
    ),
  );

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
  const rawIdCandidates = [
    firstText(insight.raw_id),
    firstText(metric?.raw_id),
  ].filter(Boolean) as string[];
  const metricIdCandidates = [
    firstText(insight.metric_id),
    firstText(metric?.id),
  ].filter(Boolean) as string[];
  const sourceUrlCandidates = [
    firstText(insight.source_url),
    firstText(metric?.source_url),
    firstText(metric?.content_url),
    firstText(metric?.profile_public_link),
  ].filter(Boolean) as string[];

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

        return platformCode && rawPlatform && platformCode === rawPlatform;
      }) ?? exactMatches[0]
    );
  }

  const platformMatches = runItems.filter((rawItem) => {
    const rawPlatform = normalizePlatformCode(
      getRawItemText(rawItem, ["platform", "source_platform", "platform_name", "sourcePlatform"]),
      getRawItemText(rawItem, ["platform_name", "platformName"]),
    );

    return Boolean(platformCode && rawPlatform && platformCode === rawPlatform);
  });

  if (platformMatches.length > 0) {
    return platformMatches[Math.min(index, platformMatches.length - 1)] ?? platformMatches[0];
  }

  return runItems.length === 1 ? runItems[0] : null;
};

const buildCleanMetricSummary = (metric: G12MetricRecord | null) => {
  if (!metric) {
    return null;
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

  if (views !== null) {
    parts.push(`${formatCompactMetricValue(views)} views`);
  }

  if (likes !== null) {
    parts.push(`${formatCompactMetricValue(likes)} likes`);
  }

  if (shares !== null) {
    parts.push(`${formatCompactMetricValue(shares)} shares`);
  }

  if (comments !== null) {
    parts.push(`${formatCompactMetricValue(comments)} comments`);
  }

  if (saves !== null) {
    parts.push(`${formatCompactMetricValue(saves)} saves`);
  }

  if (engagementRate !== null) {
    parts.push(`engagement ${metricScoreFormatter.format(engagementRate)}`);
  }

  if (trendStrength !== null) {
    parts.push(`trend strength ${metricScoreFormatter.format(trendStrength)}`);
  }

  if (brandFitScore !== null) {
    parts.push(`brand fit ${metricScoreFormatter.format(brandFitScore)}`);
  }

  if (riskScore !== null) {
    parts.push(`risk ${metricScoreFormatter.format(riskScore)}`);
  }

  return parts.length ? parts.join(" · ") : null;
};

const getTrendTimestampValue = (trend: TrendCardData) => {
  const value = trend.publishedTimestamp ?? trend.insight.created_at ?? trend.insight.stored_at ?? trend.metric?.created_at ?? trend.metric?.stored_at;
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const compareTrendRecency = (a: TrendCardData, b: TrendCardData) => {
  const diff = getTrendTimestampValue(b) - getTrendTimestampValue(a);
  if (diff !== 0) {
    return diff;
  }

  return a.title.localeCompare(b.title);
};

const getActionState = (insight: G12InsightRecord, metric: G12MetricRecord | null, riskScore: number | null): TrendActionState => {
  const approval = (insight.approval_status ?? "").trim().toUpperCase();
  const isRejected = /(REJECT|BLOCK|DENIED|DECLINED|FAILED|FAIL)/.test(approval);
  const isApproved = Boolean(insight.g5_approval_id) || /(APPROVED|APPROVE|PASSED|COMPLETE|COMPLETED|READY)/.test(approval);
  const isDraftCreated = Boolean(insight.g4_review_id) || /(DRAFT)/.test(approval);
  const isSent = Boolean(insight.selected_for_review) || Boolean(insight.wf1_handoff_ready) || /(SENT|IN_REVIEW|REVIEW_REQUESTED)/.test(approval);
  const hasFetchRun = Boolean(insight.fetch_run_id ?? metric?.fetch_run_id);

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

const getDerivedTrendCards = (insights: G12InsightRecord[], metrics: G12MetricRecord[], rawItems: G12RawItemRecord[]) => {
  const metricsById = new Map<string, G12MetricRecord>();
  const metricsByRunId = new Map<string, G12MetricRecord[]>();
  const rawItemsByRunId = buildRawItemIndex(rawItems);

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

  return insights.map((insight, index) => {
    const runId = firstText(insight.fetch_run_id);
    const runMetrics = runId ? metricsByRunId.get(runId) ?? [] : [];
    const metric = insight.metric_id ? metricsById.get(insight.metric_id) ?? null : runMetrics[index] ?? runMetrics[0] ?? null;
    const rawItem = resolveRawItemForTrend(insight, metric, rawItemsByRunId, index);

    const sourcePlatformCode = normalizePlatformCode(
      metric?.platform,
      insight.platform,
      insight.source_type,
      insight.provider,
      insight.source_label,
      getRawItemText(rawItem, ["platform", "source_platform", "platform_name", "sourcePlatform"]),
    );

    const title = firstText(insight.title, insight.hook_angle, insight.trend_topic, insight.insight_title) ?? "Saved trend";
    const hookAngle = firstText(insight.hook_angle);
    const trendTopic = firstText(insight.trend_topic);
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
    const publishedKind = getPublishedKind(metric, insight);
    const publishedLabel = publishedTimestamp ? formatG12DateTime(publishedTimestamp) : "Not available";
    const publishedRelative = publishedTimestamp ? formatG12RelativeTime(publishedTimestamp) : null;
    const hashtags =
      metric?.hashtags?.length ? metric.hashtags : buildTrendHashtags(rawItem);
    const originalCaptionPreview = buildOriginalCaptionPreview(insight, metric, rawItem);
    const savedInsightText =
      firstText(insight.summary, insight.source_summary, insight.clean_summary, insight.content_recommendation) ??
      "No saved insight text was stored for this trend.";
    const contentRecommendation = firstText(insight.content_recommendation) ?? "No content recommendation was stored.";

    const views = toNumber(metric?.views);
    const likes = toNumber(metric?.likes);
    const comments = toNumber(metric?.comments_count);
    const shares = toNumber(metric?.shares);
    const saves = toNumber(metric?.saves);
    const engagementRate = toNumber(metric?.engagement_rate);
    const brandFitScore = toNumber(insight.brand_fit_score ?? metric?.brand_fit_score);
    const riskScore = toNumber(insight.risk_score ?? metric?.risk_score);

    return {
      insight,
      metric,
      fetchRunId: runId,
      title,
      hookAngle,
      trendTopic,
      platformLabel: formatPlatformLabel(sourcePlatformCode),
      sourcePlatformCode,
      sourceAccountName,
      publishedKind,
      publishedLabel,
      publishedRelative,
      publishedTimestamp,
      originalCaptionPreview,
      sourceUrl: buildSourceUrl(insight, metric, rawItem),
      audioSound: firstText(metric?.audio_sound),
      hashtags,
      savedInsightText,
      contentRecommendation,
      cleanMetricSummary: buildCleanMetricSummary(metric) ?? "",
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate,
      brandFitScore,
      riskScore,
      actionState: getActionState(insight, metric, riskScore),
    } satisfies TrendCardData;
  });
};

function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground", className)}>{children}</p>;
}

function MetricChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function TrendCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[26px] border-border/60 bg-white shadow-sm">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-44 rounded-full" />
            <Skeleton className="h-7 w-3/5 rounded-2xl" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyTrendsState({ onRunWorkflow, running }: { onRunWorkflow: () => void; running: boolean }) {
  return (
    <Card className="rounded-[28px] border-dashed border-border/70 bg-white/70 shadow-none">
      <CardContent className="space-y-4 p-6 md:p-8">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">No trends saved yet</p>
          <p className="text-sm leading-6 text-foreground text-pretty">
            No trends saved yet. Run the workflow to fetch the latest public trend signals.
          </p>
        </div>

        <Button type="button" className="rounded-full px-5" onClick={onRunWorkflow} disabled={running}>
          <Play data-icon="inline-start" />
          {running ? "Running…" : "Run Workflow"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TrendCard({
  trend,
  sending,
  isCaptionExpanded,
  onToggleCaption,
  onSendDraft,
}: {
  trend: TrendCardData;
  sending: boolean;
  isCaptionExpanded: boolean;
  onToggleCaption: (trendId: string) => void;
  onSendDraft: (trend: TrendCardData) => void;
}) {
  const isMutedFinal = trend.actionState.tone === "final";
  const actionTone = getActionTone(trend.actionState.label);
  const cardBorder =
    trend.actionState.label === "Needs Review"
      ? "border-amber-200/70"
      : trend.actionState.label === "Rejected"
        ? "border-rose-200/70"
        : trend.actionState.label === "Approved"
          ? "border-emerald-200/70"
          : trend.actionState.label === "Draft Created" || trend.actionState.label === "Sent to Content Draft"
            ? "border-sky-200/70"
            : "border-border/60";
  const normalizedCaption = normalizeWhitespace(trend.originalCaptionPreview);
  const captionIsTruncated = normalizedCaption.length > CAPTION_PREVIEW_LIMIT;
  const captionText = isCaptionExpanded || !captionIsTruncated ? normalizedCaption : truncateText(normalizedCaption);
  const sourcePostLabel = trend.sourceUrl ? "Open original post" : "Source link not available from fetched data.";
  const metricPills: Array<[string, ReactNode]> = [
    ["Views", formatMetricValue(trend.views)],
    ["Likes", formatMetricValue(trend.likes)],
    ["Comments", formatMetricValue(trend.comments)],
    ["Shares", formatMetricValue(trend.shares)],
    ...(trend.saves !== null ? ([["Saves", formatMetricValue(trend.saves)] as [string, ReactNode]] as Array<[string, ReactNode]>) : []),
    ["Engagement", formatMetricValue(trend.engagementRate)],
    ["Brand fit", formatMetricValue(trend.brandFitScore)],
    ["Risk", formatMetricValue(trend.riskScore)],
  ];

  return (
    <Card className={cn("overflow-hidden rounded-[24px] bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5", cardBorder)}>
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {trend.platformLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {trend.sourceAccountName}
              </Badge>
              {trend.trendTopic ? (
                <Badge variant="outline" className="rounded-full border-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {trend.trendTopic}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-2xl tracking-tight text-primary text-balance">{trend.title}</h3>
              {trend.hookAngle ? <p className="text-sm leading-6 text-foreground text-pretty">{trend.hookAngle}</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", actionTone)}>
              {trend.actionState.label}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              {trend.publishedKind} {trend.publishedLabel}
            </Badge>
            {trend.publishedRelative ? <p className="text-xs text-muted-foreground">{trend.publishedRelative}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <div>
              <FieldLabel>Original Caption Preview</FieldLabel>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground text-pretty">{captionText}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {captionIsTruncated ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/5"
                    onClick={() => onToggleCaption(trend.insight.id)}
                  >
                    {isCaptionExpanded ? "View less" : "View more"}
                  </Button>
                ) : null}
                <span className="rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs leading-5 text-amber-950">
                  Reference only. Do not copy this caption. Send the trend to Content Draft to create original Cevonne content.
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Saved Insight</FieldLabel>
                <p className="mt-2 text-sm leading-6 text-foreground text-pretty">{trend.savedInsightText}</p>
              </div>
              <div>
                <FieldLabel>Content Recommendation</FieldLabel>
                <p className="mt-2 text-sm leading-6 text-foreground text-pretty">{trend.contentRecommendation}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <FieldLabel>Source Post</FieldLabel>
              <div className="mt-2 space-y-3">
                {trend.sourceUrl ? (
                  <Button asChild variant="outline" className="h-9 rounded-full border-border/70 bg-white px-4 text-xs font-semibold">
                    <a href={trend.sourceUrl} target="_blank" rel="noreferrer">
                      {sourcePostLabel}
                      <ArrowUpRight data-icon="inline-end" className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">{sourcePostLabel}</p>
                )}

                <div className="space-y-1 text-sm leading-6 text-foreground">
                  <p>
                    <span className="font-semibold">Audio:</span> <span className="text-muted-foreground">{trend.audioSound ?? "—"}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Published:</span> <span className="text-muted-foreground">{trend.publishedLabel}</span>
                  </p>
                </div>

                {trend.hashtags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {trend.hashtags.slice(0, 8).map((hashtag) => (
                      <Badge key={`${trend.insight.id}-${hashtag}`} variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        {formatHashtag(hashtag)}
                      </Badge>
                    ))}
                    {trend.hashtags.length > 8 ? (
                      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        +{trend.hashtags.length - 8} more
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <FieldLabel>Performance</FieldLabel>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {metricPills.map(([label, value]) => (
                  <MetricChip key={`${trend.insight.id}-${label}`} label={label} value={value} />
                ))}
              </div>
              {trend.cleanMetricSummary ? <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{trend.cleanMetricSummary}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn("text-sm leading-6 text-pretty", isMutedFinal ? "text-muted-foreground" : "text-foreground")}>{trend.actionState.note}</p>
          <Button
            type="button"
            className={cn("h-10 rounded-full px-5", trend.actionState.label === "Needs Review" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "")}
            variant={trend.actionState.label === "Send to Content Draft" ? "default" : "outline"}
            onClick={() => onSendDraft(trend)}
            disabled={trend.actionState.disabled || sending}
          >
            <ArrowRight data-icon="inline-start" />
            {sending ? "Sending…" : trend.actionState.label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendListRow({
  trend,
  sending,
  onSendDraft,
}: {
  trend: TrendCardData;
  sending: boolean;
  onSendDraft: (trend: TrendCardData) => void;
}) {
  const actionTone = getActionTone(trend.actionState.label);
  const compactCaption = truncateText(normalizeWhitespace(trend.originalCaptionPreview), 140);
  const compactSummary = trend.cleanMetricSummary ? truncateText(trend.cleanMetricSummary, 120) : "No clean summary stored.";
  const sourceLabel = trend.sourceUrl ? "Open original post" : "Source link not available from fetched data.";

  return (
    <div className="grid gap-4 border-t border-border/60 px-4 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {trend.platformLabel}
          </Badge>
          <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {trend.sourceAccountName}
          </Badge>
          <Badge variant="outline" className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", actionTone)}>
            {trend.actionState.label}
          </Badge>
        </div>
        <div className="space-y-1">
          <h4 className="font-serif text-xl tracking-tight text-primary text-balance">{trend.title}</h4>
          {trend.hookAngle ? <p className="text-sm leading-6 text-foreground text-pretty">{trend.hookAngle}</p> : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">{compactCaption}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{trend.publishedLabel}</span>
          <span>{trend.audioSound ?? "No audio"}</span>
          {trend.sourceUrl ? (
            <a href={trend.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
              {sourceLabel}
            </a>
          ) : (
            <span>{sourceLabel}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["Views", formatMetricValue(trend.views)],
            ["Likes", formatMetricValue(trend.likes)],
            ["Comments", formatMetricValue(trend.comments)],
            ["Shares", formatMetricValue(trend.shares)],
            ["Risk", formatMetricValue(trend.riskScore)],
          ].map(([label, value]) => (
            <div key={`${trend.insight.id}-${label}`} className="rounded-full border border-border/60 bg-secondary/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">{compactSummary}</p>
      </div>

      <div className="flex flex-col gap-2 lg:items-end">
        <Button
          type="button"
          className="h-10 rounded-full px-4"
          variant={trend.actionState.label === "Send to Content Draft" ? "default" : "outline"}
          onClick={() => onSendDraft(trend)}
          disabled={trend.actionState.disabled || sending}
        >
          <ArrowRight data-icon="inline-start" />
          {sending ? "Sending…" : trend.actionState.label}
        </Button>
        <p className="max-w-xs text-right text-xs leading-5 text-muted-foreground">{trend.actionState.note}</p>
      </div>
    </div>
  );
}

export default function G12PublicTrendFetcherPage() {
  const { authFetch } = useAuth();
  const request = useCallback(
    (url: string, options: RequestOptions = {}) => {
      const { silent, ...fetchOptions } = options;
      if (authFetch) {
        return authFetch(url, { ...fetchOptions, silent });
      }

      return defaultRequest(url, fetchOptions);
    },
    [authFetch],
  );

  const [snapshot, setSnapshot] = useState<G12LatestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingRun, setSubmittingRun] = useState(false);
  const [awaitingFetchRunId, setAwaitingFetchRunId] = useState<string | null>(null);
  const [sendingTrendId, setSendingTrendId] = useState<string | null>(null);
  const [expandedCaptionIds, setExpandedCaptionIds] = useState<Record<string, boolean>>({});
  const hasLoadedRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);

  const loadLatest = useCallback(async () => {
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
      const body = await parseJsonResponse<G12LatestResponse>(response);

      if (body) {
        setSnapshot(body);
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
    void loadLatest();
  }, [loadLatest]);

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
        const status = normalizeG12TrendFetcherRunStatus(body?.status ?? (response.ok ? "ACCEPTED" : "ERROR"));

        if (status === "PASS" || status === "BLOCK" || status === "ERROR") {
          setAwaitingFetchRunId(null);
          await loadLatest();
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
      }, 5000);
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
  }, [awaitingFetchRunId, loadLatest, request]);

  const trends = useMemo(
    () => getDerivedTrendCards(snapshot?.insights ?? [], snapshot?.metrics ?? [], snapshot?.rawItems ?? []),
    [snapshot],
  );
  const sortedTrends = useMemo(() => [...trends].sort(compareTrendRecency), [trends]);
  const latestTrends = useMemo(() => sortedTrends.slice(0, 5), [sortedTrends]);
  const olderTrends = useMemo(() => sortedTrends.slice(5), [sortedTrends]);
  const latestRun = snapshot?.run ?? null;
  const latestRunTime = latestRun?.completed_at ?? latestRun?.created_at ?? null;
  const headerStatus: TrendHeaderStatus = loading && !snapshot ? "Loading" : !latestRun ? "NEEDS ACCESS" : latestRun.status === "BLOCK" || latestRun.status === "ERROR" ? "BLOCK" : "PASS";
  const headerLastRunLabel = latestRunTime ? `${formatG12DateTime(latestRunTime)} · ${formatG12RelativeTime(latestRunTime)}` : "No run yet";
  const isBusy = loading || refreshing || submittingRun || Boolean(awaitingFetchRunId);
  const runStats = latestRun
    ? [
        { label: "Raw", value: latestRun.raw_count },
        { label: "Clean", value: latestRun.clean_count },
        { label: "Stored", value: latestRun.stored_count },
        { label: "Rejected", value: latestRun.rejected_count },
        { label: "Blocked", value: latestRun.blocked_count },
      ]
    : [];

  const handleRunWorkflow = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setSubmittingRun(true);
    try {
      const payload = buildG12ManualPayload({
        platformSelection: "both",
        query: G12_TREND_FETCHER_QUERY_DEFAULT,
        fetchLimit: G12_TREND_FETCHER_RESULT_CAP_DEFAULT,
        topCommentsLimit: G12_TREND_FETCHER_TOP_COMMENTS_DEFAULT,
        branchKey: G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
      });

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
      const fetchRunId = body?.fetch_run_id ?? body?.fetchRunId ?? null;

      if (!response.ok) {
        throw new Error(body?.message ?? "The workflow could not start.");
      }

      if (status === "ACCEPTED" && fetchRunId) {
        toast.info(body?.message ?? "Workflow run started.");
        setAwaitingFetchRunId(fetchRunId);
        return;
      }

      if (status === "BLOCK") {
        toast.error(body?.message ?? "The workflow was blocked.");
      } else if (status === "PASS") {
        toast.success(body?.message ?? "Workflow run completed.");
      } else {
        toast.info(body?.message ?? "Workflow run accepted.");
      }

      await loadLatest();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the workflow.";
      toast.error(message);
    } finally {
      setSubmittingRun(false);
    }
  }, [isBusy, loadLatest, request]);

  const handleSendToContentDraft = useCallback(
    async (trend: TrendCardData) => {
      if (sendingTrendId) {
        return;
      }

      setSendingTrendId(trend.insight.id);
      try {
        const response = await request(buildRouteUrl("/api/admin/automations/g12/send-to-content-draft"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            insight_id: trend.insight.id,
            fetch_run_id: trend.fetchRunId ?? undefined,
          }),
          cache: "no-store",
          silent: true,
        });

        const body = await parseJsonResponse<G12SendResponse>(response);
        if (!body) {
          throw new Error("Unable to send the selected trend.");
        }

        if (body.status === "PASS") {
          if (body.already_sent) {
            toast.info(body.message || "Content draft/check already exists in G4.");
          } else {
            toast.success(body.message || "Content draft/check created in G4.");
          }
        } else if (body.status === "MANUAL_ONLY") {
          toast.info(body.message || "The draft now needs review.");
        } else if (body.status === "BLOCK") {
          toast.error(body.message || "Blocked safely.");
        } else if (body.status === "ERROR") {
          toast.error(body.message || "Unable to send the selected trend.");
        } else {
          toast.info(body.message || "The selected trend was updated.");
        }

        if (body.status !== "ERROR") {
          window.setTimeout(() => {
            void loadLatest();
          }, 1500);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send the selected trend.";
        toast.error(message);
      } finally {
        setSendingTrendId(null);
      }
    },
    [loadLatest, request, sendingTrendId],
  );

  const headerBadges = (
    <>
      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", getHeaderStatusTone(headerStatus))}>
        {headerStatus}
      </Badge>
      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
        <Clock3 data-icon="inline-start" className="size-3.5" />
        {headerLastRunLabel}
      </Badge>
    </>
  );

  const headerActions = (
    <Button type="button" className="h-10 rounded-full px-5" onClick={handleRunWorkflow} disabled={isBusy}>
      <RefreshCcw data-icon="inline-start" className={cn("size-4", isBusy && "animate-spin")} />
      {loading && !snapshot ? "Loading…" : submittingRun ? "Running…" : awaitingFetchRunId ? "Updating…" : "Run Workflow"}
    </Button>
  );

  const latestCountLabel = snapshot ? `${sortedTrends.length} insights` : "0 insights";
  const storedCountLabel = latestRun ? `${formatG12Count(latestRun.stored_count)} stored` : "0 stored";
  const toggleCaption = useCallback((trendId: string) => {
    setExpandedCaptionIds((current) => ({
      ...current,
      [trendId]: !current[trendId],
    }));
  }, []);

  return (
    <WorkflowDashboardShell
      eyebrow="Public trend signals"
      title="G12 — Public Trend Fetcher"
      description="Finds safe public trend signals and saves usable trend ideas."
      badges={headerBadges}
      actions={headerActions}
    >
      {loadError && !snapshot ? (
        <Card role="alert" className="rounded-[24px] border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-rose-900">{loadError}</p>
            <Button type="button" variant="outline" className="rounded-full border-rose-200 bg-white text-rose-700 hover:bg-rose-50" onClick={() => void loadLatest()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loadError && snapshot ? (
        <Card role="alert" className="rounded-[24px] border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm leading-6 text-amber-950">
            We could not refresh the latest trends right now. Showing the last loaded results.
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] border-border/60 bg-white shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">Latest Trends</p>
              <CardTitle className="font-serif text-3xl tracking-tight text-primary">Latest Trends</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
                The latest five insights are highlighted as cards. Older saved insights are shown below in a compact list.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {latestCountLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {storedCountLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="rounded-[24px] border-dashed border-border/70 bg-muted/15 shadow-none">
            <CardContent className="p-4 text-sm leading-6 text-muted-foreground">
              These trends are saved as inspiration only. To use one for content, send it to Content Draft. It must pass content check and human approval before publishing.
            </CardContent>
          </Card>

          {latestRun ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {runStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{formatG12Count(stat.value)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {loading && !snapshot ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <TrendCardSkeleton key={index} />
              ))}
            </div>
          ) : sortedTrends.length ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Top 5</p>
                    <p className="text-sm leading-6 text-muted-foreground">Latest insights shown as cards.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {latestTrends.length} highlighted
                  </Badge>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {latestTrends.map((trend) => (
                    <TrendCard
                      key={trend.insight.id}
                      trend={trend}
                      sending={sendingTrendId === trend.insight.id}
                      isCaptionExpanded={Boolean(expandedCaptionIds[trend.insight.id])}
                      onToggleCaption={toggleCaption}
                      onSendDraft={(selectedTrend) => {
                        void handleSendToContentDraft(selectedTrend);
                      }}
                    />
                  ))}
                </div>
              </div>

              {olderTrends.length ? (
                <Card className="rounded-[24px] border-border/60 bg-white shadow-sm">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Older insights</p>
                        <CardTitle className="font-serif text-2xl tracking-tight text-primary">Other saved trends</CardTitle>
                        <CardDescription className="text-sm leading-6 text-muted-foreground">
                          Compact list view for older insights so the latest cards stay easy to scan.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-full border-border/70 bg-secondary/20 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        {olderTrends.length} older
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {olderTrends.map((trend) => (
                      <TrendListRow
                        key={trend.insight.id}
                        trend={trend}
                        sending={sendingTrendId === trend.insight.id}
                        onSendDraft={(selectedTrend) => {
                          void handleSendToContentDraft(selectedTrend);
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : (
            <EmptyTrendsState onRunWorkflow={() => void handleRunWorkflow()} running={isBusy} />
          )}
        </CardContent>
      </Card>
    </WorkflowDashboardShell>
  );
}
