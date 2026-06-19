import "server-only";

import {
  G12_TREND_FETCHER_BRANCHES,
  G12_TREND_FETCHER_GENERAL_BRANCH_KEY,
  G12_TREND_FETCHER_PLATFORM_OPTIONS,
  getG12TrendFetcherBranchLabel,
  normalizeG12TrendFetcherPlatformResults,
  normalizeG12TrendFetcherRunStatus,
  type G12TrendFetcherBranchKey,
  type G12TrendPlatform,
} from "@/lib/g12-trend-fetcher";

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row | null => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Row;
  }

  return null;
};

const pickStringFromRows = (rows: Array<Row | null>, keys: string[]) => {
  for (const row of rows) {
    if (!row) {
      continue;
    }

    const value = pickString(row, keys);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickNumberFromRows = (rows: Array<Row | null>, keys: string[]) => {
  for (const row of rows) {
    if (!row) {
      continue;
    }

    const value = pickNumber(row, keys);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const pickJsonFromRows = (rows: Array<Row | null>, keys: string[]) => {
  for (const row of rows) {
    if (!row) {
      continue;
    }

    const value = pickJson(row, keys);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
};

const buildMetricLabel = (row: Row) => {
  const listToLabel = (value: unknown) => {
    const entries = normalizeStringArray(value).slice(0, 2);
    return entries.length ? entries.join(" / ") : null;
  };

  const intentKeywords = pickJson(row, ["intent_keywords", "intentKeywords"]);
  const keywordMatches = pickJson(row, ["keyword_matches", "keywordMatches"]);
  const competitorMatches = pickJson(row, ["competitor_matches", "competitorMatches"]);

  return (
    listToLabel(intentKeywords) ??
    listToLabel(keywordMatches) ??
    listToLabel(competitorMatches) ??
    pickString(row, ["subcategory", "business_category", "businessCategory"]) ??
    pickString(row, ["platform", "platform_name", "platformName"]) ??
    "Trend signal"
  );
};

const pickPrimaryMetric = (row: Row) => {
  const candidates = [
    { metric_name: "trend_strength", metric_label: "Trend strength", metric_value: pickNumber(row, ["trend_strength", "trendStrength"]) },
    { metric_name: "brand_fit_score", metric_label: "Brand fit score", metric_value: pickNumber(row, ["brand_fit_score", "brandFitScore"]) },
    { metric_name: "risk_score", metric_label: "Risk score", metric_value: pickNumber(row, ["risk_score", "riskScore"]) },
    { metric_name: "engagement_rate", metric_label: "Engagement rate", metric_value: pickNumber(row, ["engagement_rate", "engagementRate"]) },
    { metric_name: "view_engagement", metric_label: "View engagement", metric_value: pickNumber(row, ["view_engagement", "viewEngagement"]) },
    { metric_name: "viral_velocity", metric_label: "Viral velocity", metric_value: pickNumber(row, ["viral_velocity", "viralVelocity"]) },
    { metric_name: "share_intensity", metric_label: "Share intensity", metric_value: pickNumber(row, ["share_intensity", "shareIntensity"]) },
    { metric_name: "comment_intent_score", metric_label: "Comment intent score", metric_value: pickNumber(row, ["comment_intent_score", "commentIntentScore"]) },
    { metric_name: "hook_repetition_score", metric_label: "Hook repetition score", metric_value: pickNumber(row, ["hook_repetition_score", "hookRepetitionScore"]) },
    { metric_name: "audio_reuse_score", metric_label: "Audio reuse score", metric_value: pickNumber(row, ["audio_reuse_score", "audioReuseScore"]) },
    { metric_name: "creator_fit_score", metric_label: "Creator fit score", metric_value: pickNumber(row, ["creator_fit_score", "creatorFitScore"]) },
    { metric_name: "views", metric_label: "Views", metric_value: pickNumber(row, ["views"]) },
    { metric_name: "likes", metric_label: "Likes", metric_value: pickNumber(row, ["likes"]) },
    { metric_name: "comments_count", metric_label: "Comments", metric_value: pickNumber(row, ["comments_count", "commentsCount"]) },
    { metric_name: "shares", metric_label: "Shares", metric_value: pickNumber(row, ["shares"]) },
  ];

  return candidates.find((candidate) => candidate.metric_value !== null) ?? null;
};

export const G12_SUPABASE_TABLES = {
  fetchRuns: "g12_public_fetch_runs",
  insights: "g12_public_trend_insights",
  metrics: "g12_clean_trend_metrics",
  rawScrapeQuarantine: "g12_raw_scrape_quarantine",
} as const;

export const G12_RUN_SELECT =
  "*" as const;

export type G12SupabaseRun = {
  fetch_run_id: string;
  status: string;
  raw_count: number;
  clean_count: number;
  stored_count: number;
  rejected_count: number;
  blocked_count: number;
  completed_at: string | null;
  created_at: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  query: string;
  platforms: G12TrendPlatform[];
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

export type G12SupabaseInsight = {
  id: string;
  fetch_run_id: string | null;
  platform: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  title: string;
  summary: string;
  insight_title: string | null;
  trend_topic: string | null;
  hook_angle: string | null;
  clean_summary: string | null;
  content_recommendation: string | null;
  trend_strength: number | string | null;
  brand_fit_score: number | string | null;
  risk_score: number | string | null;
  approval_status: string | null;
  compliance_note: string | null;
  created_at: string | null;
  stored_at: string | null;
  source_label: string | null;
};

export type G12SupabaseMetric = {
  id: string;
  fetch_run_id: string | null;
  platform: string | null;
  branch_key: G12TrendFetcherBranchKey | null;
  branch_name: string;
  label: string;
  value: number | string | boolean | null;
  metric_name: string | null;
  metric_label: string | null;
  metric_value: number | string | boolean | null;
  metric_unit: string | null;
  status: string | null;
  created_at: string | null;
  stored_at: string | null;
  source_label: string | null;
};

export type G12SupabaseDashboardBundle = {
  run: G12SupabaseRun;
  insights: G12SupabaseInsight[];
  metrics: G12SupabaseMetric[];
  rawCounts: Record<string, number>;
};

const pickString = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
  }

  return null;
};

const pickNumber = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const pickDate = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return null;
};

const pickJson = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }

  return null;
};

const pickScalar = (row: Row, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeBranchKey = (value: unknown): G12TrendFetcherBranchKey | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  if (normalized === G12_TREND_FETCHER_GENERAL_BRANCH_KEY) {
    return G12_TREND_FETCHER_GENERAL_BRANCH_KEY;
  }

  const direct = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.key === normalized);
  if (direct) {
    return direct.key as G12TrendFetcherBranchKey;
  }

  const byName = G12_TREND_FETCHER_BRANCHES.find((branch) => branch.name.toLowerCase() === normalized);
  return (byName?.key as G12TrendFetcherBranchKey | undefined) ?? null;
};

const normalizePlatform = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized || null;
};

const normalizePlatformList = (value: unknown): G12TrendPlatform[] => {
  if (!Array.isArray(value)) {
    return [...G12_TREND_FETCHER_PLATFORM_OPTIONS] as G12TrendPlatform[];
  }

  const platforms = value
    .map((entry) => normalizePlatform(entry))
    .filter((entry): entry is G12TrendPlatform => entry === "INSTAGRAM" || entry === "TIKTOK");

  return platforms.length ? Array.from(new Set(platforms)) : ([...G12_TREND_FETCHER_PLATFORM_OPTIONS] as G12TrendPlatform[]);
};

const normalizeTimestamp = (row: Row, keys: string[]) => pickDate(row, keys);

const normalizeRunStatus = (row: Row) =>
  normalizeG12TrendFetcherRunStatus(
    pickString(row, ["status", "run_status", "result_status", "state", "fetch_status"]) ?? row.status,
  );

export const normalizeG12SupabaseRunRow = (row: Row): G12SupabaseRun | null => {
  const fetch_run_id = pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "public_id", "publicId", "id"]);
  if (!fetch_run_id) {
    return null;
  }

  const rawPayload = asRow(pickJson(row, ["raw_payload", "rawPayload"]));
  const rawRequest = asRow(pickJson(row, ["raw_request", "rawRequest"]));
  const nestedRawPayload = asRow(pickJsonFromRows([rawPayload, rawRequest], ["raw_payload"]));

  const raw_count = pickNumber(row, ["raw_count", "rawCount", "total_raw_count", "totalRawCount"]) ?? 0;
  const clean_count = pickNumber(row, ["clean_count", "cleanCount", "total_clean_count", "totalCleanCount"]) ?? 0;
  const stored_count = pickNumber(row, ["stored_count", "storedCount", "total_stored_count", "totalStoredCount"]) ?? 0;
  const rejected_count = pickNumber(row, ["rejected_count", "rejectedCount", "total_rejected_count", "totalRejectedCount"]) ?? 0;
  const blocked_count = pickNumber(row, ["blocked_count", "blockedCount", "total_blocked_count", "totalBlockedCount"]) ?? 0;
  const completed_at = normalizeTimestamp(row, ["completed_at", "completedAt", "finished_at", "finishedAt", "created_at", "createdAt", "updated_at", "updatedAt"]);
  const branch_key = normalizeBranchKey(
    pickStringFromRows(
      [row, rawPayload, rawRequest, nestedRawPayload],
      ["branch_key", "branchKey", "branch", "branch_name", "branchName", "workflow_branch"],
    ),
  );
  const platformResultsValue = pickJsonFromRows(
    [row, rawPayload, rawRequest, nestedRawPayload],
    ["platform_results", "platformResults", "platform_metrics", "platform_stats", "platformStats"],
  );
  const requestedPlatforms = pickJsonFromRows(
    [row, rawPayload, rawRequest, nestedRawPayload],
    ["requested_platforms", "requestedPlatforms", "platforms", "platforms_json"],
  );
  const fallbackPlatforms =
    platformResultsValue && typeof platformResultsValue === "object" && !Array.isArray(platformResultsValue)
      ? Object.keys(platformResultsValue as Record<string, unknown>)
      : null;
  const platforms = normalizePlatformList(requestedPlatforms ?? fallbackPlatforms);
  const platform_results = normalizeG12TrendFetcherPlatformResults(platformResultsValue, {
    raw_count,
    clean_count,
    stored_count,
    rejected_count,
    blocked_count,
  }).map((result) => ({
    platform: result.platform,
    raw_count: result.raw_count,
    clean_count: result.clean_count,
    stored_count: result.stored_count,
    rejected_count: result.rejected_count,
    blocked_count: result.blocked_count,
  }));
  const keywordList = normalizeStringArray(
    pickJsonFromRows([row, rawPayload, rawRequest, nestedRawPayload], ["keywords"]),
  );
  const query =
    pickStringFromRows([row, rawPayload, rawRequest, nestedRawPayload], ["query", "search_query", "searchQuery", "term"]) ??
    keywordList[0] ??
    "";

  return {
    fetch_run_id,
    status: normalizeRunStatus(row),
    raw_count,
    clean_count,
    stored_count,
    rejected_count,
    blocked_count,
    completed_at,
    created_at: normalizeTimestamp(row, ["created_at", "createdAt"]),
    branch_key,
    query,
    platforms,
    top_comments_limit:
      pickNumberFromRows(
        [row, rawPayload, rawRequest, nestedRawPayload],
        ["top_comments_limit", "topCommentsLimit", "comments_limit", "commentsLimit"],
      ) ?? 0,
    platform_results,
  };
};

export const normalizeG12SupabaseInsightRow = (row: Row, index = 0): G12SupabaseInsight | null => {
  const id = pickString(row, ["id", "trend_id", "trendId", "insight_id", "insightId", "public_id", "publicId"]) ?? `g12-insight-${index + 1}`;

  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "branch", "branch_name", "branchName"]),
  );
  const branch_name =
    pickString(row, ["branch_name", "branchName", "branch", "workflow_group", "source_type", "provider"]) ??
    getG12TrendFetcherBranchLabel(branch_key) ??
    "General";
  const platform =
    normalizePlatform(pickString(row, ["platform", "platform_name", "platformName"])) ??
    ((pickJson(row, ["platform_results", "platformResults"]) && typeof pickJson(row, ["platform_results", "platformResults"]) === "object")
      ? "MULTI"
      : "UNKNOWN");

  const insight_title = pickString(row, ["insight_title", "insightTitle"]);
  const trend_topic = pickString(row, ["trend_topic", "trendTopic", "topic"]);
  const hook_angle = pickString(row, ["hook_angle", "hookAngle", "hook"]);
  const clean_summary = pickString(row, ["clean_summary", "cleanSummary"]);
  const summary =
    pickString(row, ["source_summary", "sourceSummary"]) ??
    clean_summary ??
    pickString(row, ["summary", "content_recommendation", "contentRecommendation", "description", "body", "notes"]) ??
    "Clean trend insight stored after filtering.";

  return {
    id,
    fetch_run_id: pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "source_fetch_run_id"]),
    platform,
    branch_key,
    branch_name,
    title:
      insight_title ||
      trend_topic ||
      hook_angle ||
      `${platform === "UNKNOWN" ? "Platform" : platform} trend insight`,
    summary,
    insight_title,
    trend_topic,
    hook_angle,
    clean_summary,
    content_recommendation: pickString(row, ["content_recommendation", "contentRecommendation", "recommendation", "content_recommendation_text"]),
    trend_strength: pickNumber(row, ["trend_strength", "trendStrength"]) ?? pickString(row, ["trend_strength", "trendStrength"]),
    brand_fit_score: pickNumber(row, ["brand_fit_score", "brandFitScore"]) ?? pickString(row, ["brand_fit_score", "brandFitScore"]),
    risk_score: pickNumber(row, ["risk_score", "riskScore"]) ?? pickString(row, ["risk_score", "riskScore"]),
    approval_status: pickString(row, ["approval_status", "approvalStatus"]),
    compliance_note: pickString(row, ["compliance_note", "complianceNote"]),
    created_at: normalizeTimestamp(row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    stored_at: normalizeTimestamp(row, ["stored_at", "storedAt"]),
    source_label: pickString(row, ["source_label", "sourceLabel", "source", "actor"]),
  };
};

export const normalizeG12SupabaseMetricRow = (row: Row, index = 0): G12SupabaseMetric => {
  const id = pickString(row, ["id", "metric_id", "metricId", "public_id", "publicId"]) ?? `g12-metric-${index + 1}`;
  const branch_key = normalizeBranchKey(
    pickString(row, ["branch_key", "branchKey", "branch", "branch_name", "branchName"]),
  );
  const branch_name =
    pickString(row, ["branch_name", "branchName", "branch", "subcategory", "business_category", "businessCategory", "workflow_group", "source_type", "provider"]) ??
    getG12TrendFetcherBranchLabel(branch_key) ??
    "General";
  const selectedMetric = pickPrimaryMetric(row);
  const metric_name = pickString(row, ["metric_name", "metricName", "name", "label", "key", "title"]) ?? selectedMetric?.metric_name ?? null;
  const metric_label = pickString(row, ["metric_label", "metricLabel"]) ?? selectedMetric?.metric_label ?? null;
  const metric_value =
    pickScalar(row, ["metric_value", "metricValue", "value", "amount", "score", "count"]) ??
    selectedMetric?.metric_value ??
    null;

  return {
    id,
    fetch_run_id: pickString(row, ["fetch_run_id", "fetchRunId", "run_id", "runId", "source_fetch_run_id"]),
    platform: normalizePlatform(pickString(row, ["platform", "platform_name", "platformName"])) ?? null,
    branch_key,
    branch_name,
    label:
      [buildMetricLabel(row), metric_label || metric_name]
        .filter(Boolean)
        .join(" | ") || `Metric ${index + 1}`,
    value: metric_value,
    metric_name,
    metric_label,
    metric_value,
    metric_unit: pickString(row, ["metric_unit", "metricUnit", "unit"]),
    status: pickString(row, ["status", "state", "result_status"]),
    created_at: normalizeTimestamp(row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    stored_at: normalizeTimestamp(row, ["stored_at", "storedAt"]),
    source_label: pickString(row, ["source_label", "sourceLabel", "source", "actor"]),
  };
};

export const countG12RawCounts = (rows: Row[]) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const platform = normalizePlatform(row.platform) ?? "UNKNOWN";
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});
