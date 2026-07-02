import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { CEVONNE_MANUAL_REVIEW_MESSAGE, CEVONNE_SAFE_RESPONSE_MESSAGE, CEVONNE_TEMPORARY_FAILURE_MESSAGE } from "@/lib/cevonne/response";
import {
  extractG4ContentPreview,
  getG4ReviewSourceIds,
  normalizeG4StringArray,
  normalizeG4Text,
  summarizeG4Outcome,
  type G4ContentPreview,
} from "@/lib/admin/g4-content-review";
import { G12_SUPABASE_TABLES } from "@/server/next/api/g12-trend-fetcher-supabase";
import { buildN8nWebhookUrl } from "@/lib/n8n-client";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { env } from "@/server/config";
import { getCevonneAdminApprovals } from "@/server/next/api/cevonne-admin-store";
import { uploadFileToR2 } from "@/server/services/r2";

type JsonRecord = Record<string, unknown>;
type G4SourcePreview = Pick<G4ContentPreview, "captionPreview" | "views" | "likes" | "comments" | "shares" | "sourceUrl">;
type G4SourcePreviewDetails = G4SourcePreview & {
  profileUsername?: string | null;
  audioSound?: string | null;
  engagementRate?: string | null;
  trendStrength?: string | null;
  brandFitScore?: string | null;
  riskScore?: string | null;
};

type G5ClientStatus =
  | "Ready for G5"
  | "Pending approval"
  | "Approved"
  | "Ready to publish"
  | "Published manually"
  | "Rejected"
  | "Blocked";

type G5ClientTab = "approved_content" | "pending_approval" | "ready_to_publish" | "published_manually" | "blocked_rejected";

type G5OriginalPostDetails = {
  platform: string | null;
  handle: string | null;
  caption: string | null;
  post_url: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  audio: string | null;
  engagement_rate: string | null;
};

type G5AiDirectionDetails = {
  content_angle: string | null;
  safe_rewrite: string | null;
  hook_angle: string | null;
  risk_summary: string | null;
  compliance_note: string | null;
};

export type G5DashboardAssetRecord = {
  asset_id: string;
  asset_title: string | null;
  asset_type: string | null;
  intended_platform: string | null;
  platform: string | null;
  content_text: string | null;
  hook_angle: string | null;
  media_url: string | null;
  storage_url: string | null;
  compliance_status: string | null;
  approval_status: string | null;
  approved_by: string | null;
  asset_created_at: string | null;
  asset_status: string | null;
  readiness_status: string | null;
  manual_publish_status: string | null;
  approval_id: string | null;
  last_manual_publish_result_id: string | null;
  post_url: string | null;
  published_by: string | null;
  published_at: string | null;
  state_updated_at: string | null;
  g4_review_id: string | null;
  g4_review_uuid: string | null;
  content_review_id: string | null;
  review_id: string | null;
  source_platform: string | null;
  source_event: string | null;
  rights_status: string | null;
  last_readiness_check_at: string | null;
  last_readiness_check_response: string | null;
  readiness_response: string | null;
  failure_reasons: string[];
  client_status: G5ClientStatus;
  client_tab: G5ClientTab;
};

export type G5DashboardSummary = {
  total: number;
  pending_approval: number;
  ready_to_publish: number;
  published_manually: number;
  blocked: number;
};

export type G5DashboardResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "VIEW" | "FALLBACK" | "UNAVAILABLE";
  message: string;
  summary: G5DashboardSummary;
  assets: G5DashboardAssetRecord[];
};

export type G5ApprovedContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: "Ready for G5";
  created_at: string | null;
  display_title: string;
  display_summary: string;
  hook_count: number;
  caption_count: number;
  platform_label: string;
  content_text: string | null;
  caption_preview: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  title: string | null;
  asset_id: string | null;
  platform: string | null;
};

export type G5ApprovedContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "TABLE" | "UNAVAILABLE";
  message: string;
  reviews: G5ApprovedContentRecord[];
};

export type G5G4CaptionOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

export type G5G4HookOption = {
  id: string;
  label: string;
  text: string;
  source: "G4";
};

export type G5SelectedG4ContentRecord = {
  id: string;
  g4_review_uuid: string;
  g4_review_id: string;
  content_review_id: string | null;
  review_id: string | null;
  status: string | null;
  approval_state: string | null;
  display_status: "Ready for G5";
  created_at: string | null;
  display_title: string;
  display_summary: string;
  platform_label: string;
  caption_preview: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  profile_username: string | null;
  audio_sound: string | null;
  trend_strength: string | null;
  brand_fit_score: string | null;
  risk_score: string | null;
  source_url: string | null;
  ai_safe_rewrite: string | null;
  hook_angle: string | null;
  ai_risk_summary: string | null;
  ai_compliance_note: string | null;
  content_summary: string | null;
  ai_insight: string | null;
  original_post_data: string | null;
  engagement_rate: string | null;
  content: {
    title: string | null;
    summary: string | null;
    platform: string | null;
    created_at: string | null;
  };
  original_post: G5OriginalPostDetails;
  ai_direction: G5AiDirectionDetails;
  caption_options: G5G4CaptionOption[];
  hook_options: G5G4HookOption[];
  recommended_caption: string | null;
  recommended_hook: string | null;
};

export type G5SelectedG4ContentResponse = {
  status: "PASS" | "EMPTY" | "ERROR";
  source: "TABLE" | "UNAVAILABLE";
  message: string;
  review: G5SelectedG4ContentRecord | null;
};

export type G5WebhookResponse = JsonRecord & {
  status: string;
  message: string;
  response_type: string | null;
  handled_at: string | null;
  request_id: string;
  sent_at: string;
  webhook_url: string;
  http_status: number | null;
  response_text: string | null;
  raw: JsonRecord | null;
};

export type G5AssetRegisterInput = {
  workflow_id: "G5";
  action_type: "IG_PUBLISH_POST";
  platform: "INSTAGRAM";
  asset_type: string;
  asset_title: string;
  content_text: string;
  hook_angle?: string | null;
  media_url: string;
  storage_url: string;
  g4_review_id: string;
  g4_review_uuid: string;
  content_review_id: string;
  review_id: string;
  source_platform: "WEBSITE";
  source_event: "CLIENT_UPLOAD";
  rights_status: "OWNED_OR_INTERNAL";
  actor: string;
};

export type G5ApprovalDecisionInput = {
  approval_id: string;
  decision: "APPROVED" | "REJECTED";
  reviewer_id: string;
  reviewer_note?: string | null;
  rejection_reason?: string | null;
};

export type G5ReadinessCheckInput = {
  workflow_id: "G5";
  requested_by_workflow: "G5";
  action_type: "MANUAL_PUBLISH_READY_CHECK";
  execution_mode: "DRY_RUN";
  provider: "MANUAL_FALLBACK";
  platform: "INSTAGRAM";
  account_id: string;
  asset_id: string;
  content_review_id: string;
  g4_review_id: string;
  approval_id: string;
  asset_type: string;
  media_url: string;
  caption: string;
  actor: string;
};

export type G5ManualPublishResultInput = {
  asset_id: string;
  approval_id: string;
  platform: "INSTAGRAM";
  post_url: string;
  published_by: string;
  published_at?: string | null;
  notes?: string | null;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord | null => (isRecord(value) ? value : null);

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const toText = (value: unknown) => {
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

  return null;
};

const toDate = (value: unknown) => {
  const text = toText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const pickText = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toText(row[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickDate = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toDate(row[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickArray = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return [];
  }

  for (const key of keys) {
    const value = row[key];
    if (!Array.isArray(value)) {
      continue;
    }

    return value
      .map((entry) => toText(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  return [];
};

const getJsonRecordCandidates = (record: JsonRecord | null | undefined) => {
  const direct = asRecord(record);
  const payload = asRecord(direct?.raw_payload);
  const nestedPayload = asRecord(payload?.raw_payload);

  return [direct, payload, nestedPayload].filter((value): value is JsonRecord => Boolean(value));
};

const readJsonRecordText = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = toText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readJsonRecordTextFromCandidates = (records: Array<JsonRecord | null | undefined>, keys: string[]) => {
  for (const record of records) {
    for (const candidate of getJsonRecordCandidates(record)) {
      const value = readJsonRecordText(candidate, keys);
      if (value) {
        return value;
      }
    }
  }

  return null;
};

const getG4SourceLookupKey = (row: JsonRecord | null | undefined) =>
  readJsonRecordTextFromCandidates(
    [row],
    [
      "source_trend_id",
      "sourceTrendId",
      "trend_id",
      "trendId",
      "insight_id",
      "insightId",
      "source_insight_id",
      "sourceInsightId",
      "fetch_run_id",
      "fetchRunId",
      "asset_id",
      "assetId",
    ],
  );

const loadG4SourcePreviewMap = async (rows: JsonRecord[]) => {
  const client = getN8nSupabaseAdmin();
  const previewByLookupKey = new Map<string, G4SourcePreviewDetails>();

  if (!client) {
    return previewByLookupKey;
  }

  const sourceLookupKeys = [...new Set(rows.map((row) => getG4SourceLookupKey(row)).filter((value): value is string => Boolean(value)))];
  if (!sourceLookupKeys.length) {
    return previewByLookupKey;
  }

  const [insightByTrendResult, insightByRunResult] = await Promise.all([
    client.schema("public").from(G12_SUPABASE_TABLES.insights).select("*").in("trend_id", sourceLookupKeys).order("created_at", { ascending: false, nullsFirst: false }).limit(250),
    client.schema("public").from(G12_SUPABASE_TABLES.insights).select("*").in("fetch_run_id", sourceLookupKeys).order("created_at", { ascending: false, nullsFirst: false }).limit(250),
  ]);

  if (insightByTrendResult.error || insightByRunResult.error) {
    console.warn("[g5-asset-approval] failed to load G12 source previews for G5 reviews", {
      trend_error: insightByTrendResult.error?.message ?? null,
      run_error: insightByRunResult.error?.message ?? null,
    });
    return previewByLookupKey;
  }

  const insightRecords = [
    ...(Array.isArray(insightByTrendResult.data) ? insightByTrendResult.data : []),
    ...(Array.isArray(insightByRunResult.data) ? insightByRunResult.data : []),
  ]
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  const insightByLookupKey = new Map<string, JsonRecord>();
  const metricIds = new Set<string>();
  const rawIds = new Set<string>();

  for (const record of insightRecords) {
    for (const key of [
      readJsonRecordTextFromCandidates([record], ["trend_id"]),
      readJsonRecordTextFromCandidates([record], ["fetch_run_id"]),
      readJsonRecordTextFromCandidates([record], ["asset_id"]),
      readJsonRecordTextFromCandidates([record], ["insight_id"]),
    ]) {
      if (key && !insightByLookupKey.has(key)) {
        insightByLookupKey.set(key, record);
      }
    }

    const metricId = readJsonRecordTextFromCandidates([record], ["metric_id"]);
    if (metricId) {
      metricIds.add(metricId);
    }

    const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
    if (rawId) {
      rawIds.add(rawId);
    }
  }

  const metricByMetricId = new Map<string, JsonRecord>();
  if (metricIds.size) {
    const { data: metricRows, error: metricError } = await client
      .schema("public")
      .from(G12_SUPABASE_TABLES.metrics)
      .select("*")
      .in("metric_id", [...metricIds]);

    if (metricError) {
      console.warn("[g5-asset-approval] failed to load G12 metric rows for G5 reviews", metricError);
    } else {
      for (const record of (Array.isArray(metricRows) ? metricRows : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const metricId = readJsonRecordTextFromCandidates([record], ["metric_id"]);
        if (metricId && !metricByMetricId.has(metricId)) {
          metricByMetricId.set(metricId, record);
        }

        const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
        if (rawId) {
          rawIds.add(rawId);
        }
      }
    }
  }

  const rawByRawId = new Map<string, JsonRecord>();
  if (rawIds.size) {
    const { data: rawRows, error: rawError } = await client
      .schema("public")
      .from(G12_SUPABASE_TABLES.rawScrapeQuarantine)
      .select("*")
      .in("raw_id", [...rawIds]);

    if (rawError) {
      console.warn("[g5-asset-approval] failed to load G12 raw scrape rows for G5 reviews", rawError);
    } else {
      for (const record of (Array.isArray(rawRows) ? rawRows : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
        if (rawId && !rawByRawId.has(rawId)) {
          rawByRawId.set(rawId, record);
        }
      }
    }
  }

  for (const sourceLookupKey of sourceLookupKeys) {
    const insight = insightByLookupKey.get(sourceLookupKey) ?? null;
    const metricId = readJsonRecordTextFromCandidates([insight], ["metric_id"]);
    const metric = metricId ? metricByMetricId.get(metricId) ?? null : null;
    const rawId = readJsonRecordTextFromCandidates([metric, insight], ["raw_id"]);
    const rawScrape = rawId ? rawByRawId.get(rawId) ?? null : null;

    previewByLookupKey.set(sourceLookupKey, {
      profileUsername: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["profile_username", "profileUsername", "username", "handle"]),
      audioSound: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["audio_sound", "audioSound", "sound", "music"]),
      engagementRate: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["engagement_rate", "engagementRate"]),
      trendStrength: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["trend_strength", "trendStrength"]),
      brandFitScore: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["brand_fit_score", "brandFitScore"]),
      riskScore: readJsonRecordTextFromCandidates([rawScrape, metric, insight], ["risk_score", "riskScore"]),
      captionPreview: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["caption_excerpt", "captionExcerpt", "caption_preview", "captionPreview", "caption", "text", "description"],
      ),
      views: readJsonRecordTextFromCandidates([rawScrape, metric], ["views"]),
      likes: readJsonRecordTextFromCandidates([rawScrape, metric], ["likes"]),
      comments: readJsonRecordTextFromCandidates([rawScrape, metric], ["comments_count", "commentsCount", "comments"]),
      shares: readJsonRecordTextFromCandidates([rawScrape, metric], ["shares"]),
      sourceUrl: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["source_url", "sourceUrl", "content_url", "contentUrl", "profile_public_link", "profilePublicLink", "url", "post_url", "postUrl", "web_video_url", "webVideoUrl", "permalink"],
      ),
    });
  }

  return previewByLookupKey;
};

const upperText = (value: unknown) => toText(value)?.toUpperCase() ?? null;

const normalizeStateKey = (value: unknown) => upperText(value)?.replace(/[\s-]+/g, "_") ?? null;

const pickTextFromCandidates = (row: JsonRecord | null | undefined, keys: string[]) => readJsonRecordTextFromCandidates([row], keys);

const pickDateFromCandidates = (row: JsonRecord | null | undefined, keys: string[]) => {
  const text = pickTextFromCandidates(row, keys);
  return text ? toDate(text) : null;
};

const collectTextValuesFromCandidates = (rows: JsonRecord[], keys: string[]) => {
  const values = new Set<string>();

  for (const row of rows) {
    for (const key of keys) {
      const value = pickTextFromCandidates(row, [key]);
      if (value) {
        values.add(value);
      }
    }
  }

  return [...values];
};

const G5_G4_ASSET_LINKS_TABLE = "g5_g4_asset_links" as const;

const normalizeG4ApprovedContentKeyText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const getG4ApprovedContentCreatedAtValue = (row: JsonRecord) => {
  const createdAt = pickDateFromCandidates(row, ["created_at", "createdAt", "updated_at", "updatedAt"]);
  return createdAt ? Date.parse(createdAt) || 0 : 0;
};

const buildG4ApprovedContentIdentity = (row: JsonRecord) => {
  const preview = extractG4ContentPreview(row);

  const contentReviewId = pickTextFromCandidates(row, ["content_review_id", "contentReviewId"]);
  const reviewId = pickTextFromCandidates(row, ["review_id", "reviewId"]);
  const sourceUrl =
    pickTextFromCandidates(row, ["source_url", "sourceUrl", "original_post_url", "originalPostUrl", "post_url", "postUrl", "permalink"]) ??
    preview.sourceUrl;
  const caption = normalizeG4Text(
    preview.captionPreview ??
      pickTextFromCandidates(row, ["caption_preview", "captionPreview", "content_text", "contentText", "caption", "caption_text", "captionText"]) ??
      preview.contentText,
  );
  const platform = normalizeG4Text(pickTextFromCandidates(row, ["platform", "source_platform", "sourcePlatform"]));
  const title = normalizeG4Text(preview.headline ?? pickTextFromCandidates(row, ["title", "headline", "name"]) ?? preview.productName);
  const createdAt = pickDateFromCandidates(row, ["created_at", "createdAt", "updated_at", "updatedAt"]);
  const createdDate = createdAt ? createdAt.slice(0, 10) : null;
  const rowId = pickTextFromCandidates(row, ["id"]);

  const candidateKeys = [
    contentReviewId ? `content_review_id:${normalizeG4ApprovedContentKeyText(contentReviewId)}` : null,
    reviewId ? `review_id:${normalizeG4ApprovedContentKeyText(reviewId)}` : null,
    sourceUrl ? `source_url:${normalizeG4ApprovedContentKeyText(sourceUrl)}` : null,
    caption ? `caption_platform:${normalizeG4ApprovedContentKeyText(caption)}|${normalizeG4ApprovedContentKeyText(platform)}` : null,
    title ? `title_created:${normalizeG4ApprovedContentKeyText(title)}|${normalizeG4ApprovedContentKeyText(createdDate)}` : null,
    rowId ? `id:${normalizeG4ApprovedContentKeyText(rowId)}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    candidateKeys,
    primaryKey: candidateKeys[0] ?? null,
  };
};

const dedupeG4ApprovedContentRows = (rows: JsonRecord[]) => {
  const uniqueRows: JsonRecord[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const identity = buildG4ApprovedContentIdentity(row);
    const key = identity.primaryKey;

    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
};

const getG5ClientStatusInfo = (asset: Pick<
  G5DashboardAssetRecord,
  "approval_status" | "asset_status" | "manual_publish_status" | "post_url" | "published_at" | "last_manual_publish_result_id"
>) => {
  const contentApprovalStatus = normalizeStateKey(asset.approval_status);
  const publishStateStatus = normalizeStateKey(asset.asset_status);
  const manualPublishStatus = normalizeStateKey(asset.manual_publish_status);
  const hasManualPublishResult = Boolean(asset.last_manual_publish_result_id || (asset.post_url && asset.published_at));

  if (hasManualPublishResult || manualPublishStatus === "PUBLISHED_MANUALLY" || publishStateStatus === "PUBLISHED_MANUALLY" || publishStateStatus === "PUBLISHED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Published manually" as const,
      clientTab: "published_manually" as const,
    };
  }

  if (publishStateStatus === "APPROVED_READY_TO_PUBLISH" || publishStateStatus === "READY_TO_PUBLISH") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Ready to publish" as const,
      clientTab: "ready_to_publish" as const,
    };
  }

  if (publishStateStatus === "APPROVED" || contentApprovalStatus === "APPROVED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Approved" as const,
      clientTab: "ready_to_publish" as const,
    };
  }

  if (
    publishStateStatus === "PENDING_APPROVAL" ||
    contentApprovalStatus === "PENDING_APPROVAL" ||
    contentApprovalStatus === "PENDING"
  ) {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Pending approval" as const,
      clientTab: "pending_approval" as const,
    };
  }

  if (publishStateStatus === "REJECTED" || contentApprovalStatus === "REJECTED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Rejected" as const,
      clientTab: "blocked_rejected" as const,
    };
  }

  if (publishStateStatus === "BLOCKED" || publishStateStatus === "FAILED" || publishStateStatus === "ERROR" || contentApprovalStatus === "BLOCKED") {
    return {
      contentApprovalStatus,
      publishStateStatus,
      manualPublishStatus,
      clientStatus: "Blocked" as const,
      clientTab: "blocked_rejected" as const,
    };
  }

  return {
    contentApprovalStatus,
    publishStateStatus,
    manualPublishStatus,
    clientStatus: "Pending approval" as const,
    clientTab: "pending_approval" as const,
  };
};

const isG4ReadyForG5 = (row: JsonRecord) => {
  const status = normalizeStateKey(row.status);
  const approvalState = normalizeStateKey(row.approval_state);

  return (
    status === "PASS" ||
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "APPROVED"
  );
};

const describeN8nSupabaseTarget = () => {
  const rawUrl = env.n8nSupabaseUrl.trim();
  if (!rawUrl) {
    return "missing";
  }

  try {
    const parsed = new URL(rawUrl);
    const project = parsed.hostname.split(".")[0] || parsed.hostname;
    return `${parsed.hostname} (project ${project})`;
  } catch {
    return "invalid-url";
  }
};

const mergeRecords = <T extends JsonRecord>(base: T, next: Partial<T>) => {
  const merged = { ...base };

  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    merged[key as keyof T] = value as T[keyof T];
  }

  return merged;
};

const normalizeAssetRecord = (row: JsonRecord): G5DashboardAssetRecord | null => {
  const assetId = pickTextFromCandidates(row, ["asset_id", "assetId", "id", "approval_id", "approvalId", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? null;

  if (!assetId) {
    return null;
  }

  const assetTitle = pickTextFromCandidates(row, ["asset_title", "assetTitle", "title", "name", "content_text", "contentText", "caption", "caption_text", "captionText", "summary"]);
  const assetType = pickTextFromCandidates(row, ["asset_type", "assetType", "content_type", "contentType", "media_type", "mediaType"]);
  const intendedPlatform = pickTextFromCandidates(row, ["intended_platform", "intendedPlatform"]);
  const platform = pickTextFromCandidates(row, ["platform", "source_platform", "sourcePlatform"]);
  const contentText = pickTextFromCandidates(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "body", "message"]);
  const hookAngle = pickTextFromCandidates(row, ["hook_angle", "hookAngle", "selected_hook", "selectedHook", "ai_hook_angle"]);
  const mediaUrl = pickTextFromCandidates(row, ["media_url", "mediaUrl", "public_url", "publicUrl", "url", "image_url", "imageUrl", "video_url", "videoUrl"]);
  const storageUrl = pickTextFromCandidates(row, ["storage_url", "storageUrl", "storage_reference", "storageReference", "storage_key", "storageKey"]);
  const complianceStatus = pickTextFromCandidates(row, ["compliance_status", "complianceStatus", "g1_compliance_status", "g1ComplianceStatus"]);
  const approvalStatus = pickTextFromCandidates(row, ["approval_status", "approvalStatus"]);
  const approvedBy = pickTextFromCandidates(row, ["approved_by", "approvedBy"]);
  const assetCreatedAt = pickDateFromCandidates(row, ["asset_created_at", "assetCreatedAt", "created_at", "createdAt"]);
  const assetStatus = pickTextFromCandidates(row, ["asset_status", "assetStatus", "status"]);
  const readinessStatus = pickTextFromCandidates(row, ["readiness_status", "readinessStatus"]);
  const manualPublishStatus = pickTextFromCandidates(row, ["manual_publish_status", "manualPublishStatus", "publish_status", "publishStatus"]);
  const approvalId = pickTextFromCandidates(row, ["approval_id", "approvalId"]);
  const lastManualPublishResultId = pickTextFromCandidates(row, ["last_manual_publish_result_id", "lastManualPublishResultId", "manual_publish_result_id", "manualPublishResultId"]);
  const postUrl = pickTextFromCandidates(row, ["post_url", "postUrl", "instagram_post_url", "instagramPostUrl", "published_url", "publishedUrl"]);
  const publishedBy = pickTextFromCandidates(row, ["published_by", "publishedBy"]);
  const publishedAt = pickDateFromCandidates(row, ["published_at", "publishedAt"]);
  const stateUpdatedAt = pickDateFromCandidates(row, ["state_updated_at", "stateUpdatedAt", "updated_at", "updatedAt", "modified_at", "modifiedAt"]);
  const g4ReviewId = pickTextFromCandidates(row, ["g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const g4ReviewUuid = pickTextFromCandidates(row, ["g4_review_uuid", "g4ReviewUuid"]);
  const contentReviewId = pickTextFromCandidates(row, ["content_review_id", "contentReviewId"]);
  const reviewId = pickTextFromCandidates(row, ["review_id", "reviewId"]);
  const sourcePlatform = pickTextFromCandidates(row, ["source_platform", "sourcePlatform"]);
  const sourceEvent = pickTextFromCandidates(row, ["source_event", "sourceEvent"]);
  const rightsStatus = pickTextFromCandidates(row, ["rights_status", "rightsStatus"]);
  const lastReadinessCheckAt = pickDateFromCandidates(row, ["last_readiness_check_at", "lastReadinessCheckAt", "readiness_checked_at", "readinessCheckedAt"]);
  const lastReadinessCheckResponse = pickTextFromCandidates(row, ["last_readiness_check_response", "lastReadinessCheckResponse"]);
  const readinessResponse = pickTextFromCandidates(row, ["readiness_response", "readinessResponse", "n8n_response", "n8nResponse", "response_text", "responseText"]);
  const failureReasons = pickArray(row, ["failure_reasons", "failureReasons", "blocked_reasons", "blockedReasons", "rejection_reasons", "rejectionReasons"]);
  const clientStatusInfo = getG5ClientStatusInfo({
    approval_status: approvalStatus,
    asset_status: assetStatus,
    manual_publish_status: manualPublishStatus,
    post_url: postUrl,
    published_at: publishedAt,
    last_manual_publish_result_id: lastManualPublishResultId,
  });

  return {
    asset_id: assetId,
    asset_title: assetTitle,
    asset_type: assetType,
    intended_platform: intendedPlatform,
    platform,
    content_text: contentText,
    hook_angle: hookAngle,
    media_url: mediaUrl,
    storage_url: storageUrl,
    compliance_status: complianceStatus,
    approval_status: approvalStatus,
    approved_by: approvedBy,
    asset_created_at: assetCreatedAt,
    asset_status: assetStatus,
    readiness_status: readinessStatus,
    manual_publish_status: manualPublishStatus,
    approval_id: approvalId,
    last_manual_publish_result_id: lastManualPublishResultId,
    post_url: postUrl,
    published_by: publishedBy,
    published_at: publishedAt,
    state_updated_at: stateUpdatedAt,
    g4_review_id: g4ReviewId,
    g4_review_uuid: g4ReviewUuid,
    content_review_id: contentReviewId,
    review_id: reviewId,
    source_platform: sourcePlatform,
    source_event: sourceEvent,
    rights_status: rightsStatus,
    last_readiness_check_at: lastReadinessCheckAt,
    last_readiness_check_response: lastReadinessCheckResponse,
    readiness_response: readinessResponse,
    failure_reasons: failureReasons,
    client_status: clientStatusInfo.clientStatus,
    client_tab: clientStatusInfo.clientTab,
  };
};

const normalizeG4ReviewRecord = (row: JsonRecord, sourcePreview?: Partial<G4SourcePreview> | null): G5ApprovedContentRecord | null => {
  const id = pickText(row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  if (!id) {
    return null;
  }

  const preview = extractG4ContentPreview({ raw_payload: row });
  const safeRewriteText = normalizeG4Text(row.ai_safe_rewrite);
  const hookAngleText = normalizeG4Text(preview.hookAngle);
  const hookCount = collectSelectableOptionTexts(normalizeG4StringArray(row.ai_hook_suggestions), [hookAngleText]).options.length;
  const captionCount = collectSelectableOptionTexts(normalizeG4StringArray(row.ai_caption_suggestions), []).options.length;
  const displayTitle =
    preview.headline?.trim() ||
    preview.productName?.trim() ||
    sourcePreview?.captionPreview?.trim() ||
    preview.captionPreview?.trim() ||
    "Content check passed";
  const displaySummary =
    normalizeG4Text(row.safe_summary) ||
    normalizeG4Text(row.ai_safe_rewrite) ||
    normalizeG4Text(preview.cleanSummary) ||
    normalizeG4Text(preview.contentRecommendation) ||
    "Approved content ready for G5.";
  const platformLabel = pickText(row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown";

  return {
    id,
    g4_review_uuid: id,
    g4_review_id: id,
    content_review_id: pickText(row, ["content_review_id", "contentReviewId"]),
    review_id: pickText(row, ["review_id", "reviewId"]),
    status: pickText(row, ["status", "review_status", "reviewStatus"]),
    approval_state: pickText(row, ["approval_state", "approvalState"]),
    display_status: "Ready for G5",
    created_at: pickDate(row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    hook_count: hookCount,
    caption_count: captionCount,
    platform_label: platformLabel,
    content_text:
      pickText(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "content", "body", "message", "summary"]) ??
      preview.contentText ??
      sourcePreview?.captionPreview ??
      preview.captionPreview ??
      null,
    caption_preview:
      pickText(row, ["caption_preview", "captionPreview"]) ??
      sourcePreview?.captionPreview ??
      preview.captionPreview ??
      preview.contentText ??
      null,
    views: sourcePreview?.views ?? preview.views ?? null,
    likes: sourcePreview?.likes ?? preview.likes ?? null,
    comments: sourcePreview?.comments ?? preview.comments ?? null,
    shares: sourcePreview?.shares ?? preview.shares ?? null,
    title: pickText(row, ["title", "name", "headline"]) ?? preview.headline ?? null,
    asset_id: pickText(row, ["asset_id", "assetId"]),
    platform: pickText(row, ["platform", "source_platform", "sourcePlatform"]),
  };
};

const normalizeSelectionText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const collectNormalizedTexts = (...values: unknown[]) => {
  const normalized = new Set<string>();

  for (const value of values) {
    for (const candidate of normalizeG4StringArray(value)) {
      const text = normalizeG4Text(candidate);
      if (text) {
        normalized.add(text);
      }
    }
  }

  return [...normalized];
};

const looksLikeComplianceNote = (text: string) => {
  const normalized = normalizeSelectionText(text);
  if (!normalized) {
    return false;
  }

  return [
    "ensure all claims",
    "await further review",
    "include appropriate rights",
    "before publishing",
    "supported by evidence",
    "rights for any ugc",
    "creator content used",
    "review and approval",
    "claims about lipstick",
  ].some((phrase) => normalized.includes(phrase));
};

const collectSelectableOptionTexts = (texts: string[], excludedTexts: Array<string | null | undefined> = [], maxOptions = 3) => {
  const excluded = new Set(excludedTexts.map((text) => normalizeSelectionText(text)).filter(Boolean));
  const seen = new Set<string>();
  const options: string[] = [];
  const suppressed: string[] = [];

  for (const rawText of texts) {
    const text = normalizeG4Text(rawText);
    if (!text) {
      continue;
    }

    const normalized = normalizeSelectionText(text);
    if (!normalized || excluded.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);

    if (looksLikeComplianceNote(text)) {
      suppressed.push(text);
      continue;
    }

    options.push(text);
    if (options.length >= maxOptions) {
      break;
    }
  }

  return { options, suppressed };
};

const buildSelectableOptions = (texts: string[], kind: "caption" | "hook", excludedTexts: Array<string | null | undefined> = [], maxOptions = 3) =>
  collectSelectableOptionTexts(texts, excludedTexts, maxOptions).options.map((text, index) => ({
    id: `${kind}-${index + 2}`,
    label: `${kind === "caption" ? "Caption" : "Hook"} ${index + 2}`,
    text,
    source: "G4" as const,
  }));

const buildG5SelectedG4Content = (
  g4Row: JsonRecord,
  landingRow: JsonRecord | null,
  sourcePreview?: Partial<G4SourcePreviewDetails> | null
): G5SelectedG4ContentRecord => {
  const reviewPreview = extractG4ContentPreview(g4Row);
  const landingPreview = extractG4ContentPreview(landingRow ? { raw_payload: landingRow } : null);

  const contentReviewId = pickText(g4Row, ["content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const reviewId = pickText(g4Row, ["review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const id = pickText(g4Row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? "";
  const displayTitle =
    reviewPreview.headline?.trim() || reviewPreview.productName?.trim() || reviewPreview.captionPreview?.trim() || "Content check passed";

  const captionSuggestionTexts = normalizeG4StringArray(g4Row.ai_caption_suggestions);
  const hookSuggestionTexts = normalizeG4StringArray(g4Row.ai_hook_suggestions);
  const safeRewriteText =
    normalizeG4Text(g4Row.ai_safe_rewrite) ??
    normalizeG4Text(g4Row.rewritten_caption) ??
    normalizeG4Text(g4Row.safe_summary) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    captionSuggestionTexts[0] ??
    null;
  const hookAngleText = normalizeG4Text(g4Row.hook_angle) ?? normalizeG4Text(reviewPreview.hookAngle) ?? hookSuggestionTexts[0] ?? null;
  const contentAngleText =
    normalizeG4Text(g4Row.ai_insight) ??
    normalizeG4Text(g4Row.ai_summary) ??
    normalizeG4Text(g4Row.content_summary) ??
    normalizeG4Text(reviewPreview.contentRecommendation) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    null;

  const captionSelection = collectSelectableOptionTexts(captionSuggestionTexts, [], 3);
  const hookSelection = collectSelectableOptionTexts(hookSuggestionTexts, [hookAngleText], 3);
  const captionOptions = buildSelectableOptions(captionSelection.options, "caption");
  const hookOptions = buildSelectableOptions(hookSelection.options, "hook");

  const recommendedCaption = safeRewriteText ?? captionSelection.options[0] ?? normalizeG4Text(reviewPreview.cleanSummary) ?? null;
  const recommendedHook = hookAngleText ?? hookSelection.options[0] ?? null;

  const summaryCandidate =
    normalizeG4Text(g4Row.safe_summary) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);

  const claimNotes = collectNormalizedTexts(g4Row.ai_claim_notes);
  const insightCandidate =
    normalizeG4Text(g4Row.ai_risk_summary) ??
    normalizeG4Text(g4Row.risk_summary) ??
    normalizeG4Text(g4Row.ai_human_review_recommendation) ??
    normalizeG4Text(reviewPreview.contentRecommendation) ??
    (claimNotes.length ? claimNotes.join(" • ") : null) ??
    null;

  const complianceCandidates = [
    normalizeG4Text(g4Row.ai_human_review_recommendation),
    normalizeG4Text(g4Row.compliance_note),
    normalizeG4Text(g4Row.risk_summary),
    normalizeG4Text(g4Row.ai_risk_summary),
    ...captionSelection.suppressed,
    ...hookSelection.suppressed,
    ...(claimNotes.length ? claimNotes : []),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const contentSummary = summaryCandidate || null;
  const aiInsight = insightCandidate || null;
  const originalPostPlatform = pickText(landingRow, ["source_platform", "sourcePlatform", "platform"]) ?? pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) ?? null;
  const originalPostHandle =
    pickText(landingRow, ["profile_username", "profileUsername", "username", "handle", "creator_handle", "creatorHandle"]) ??
    sourcePreview?.profileUsername ??
    reviewPreview.profileUsername ??
    null;
  const originalPostCaption =
    normalizeG4Text(landingRow?.caption_text) ??
    normalizeG4Text(landingRow?.caption) ??
    normalizeG4Text(landingRow?.content_text) ??
    sourcePreview?.captionPreview ??
    reviewPreview.captionPreview ??
    normalizeG4Text(g4Row.caption_preview) ??
    normalizeG4Text(g4Row.caption) ??
    null;
  const originalPostUrl =
    pickText(landingRow, ["source_url", "sourceUrl", "post_url", "postUrl", "landing_page_url", "landingPageUrl"]) ??
    sourcePreview?.sourceUrl ??
    reviewPreview.sourceUrl ??
    null;
  const originalPostViews = sourcePreview?.views ?? reviewPreview.views ?? landingPreview.views ?? null;
  const originalPostLikes = sourcePreview?.likes ?? reviewPreview.likes ?? landingPreview.likes ?? null;
  const originalPostComments = sourcePreview?.comments ?? reviewPreview.comments ?? landingPreview.comments ?? null;
  const originalPostShares = sourcePreview?.shares ?? reviewPreview.shares ?? landingPreview.shares ?? null;
  const originalPostAudio = sourcePreview?.audioSound ?? reviewPreview.audioSound ?? landingPreview.audioSound ?? null;
  const originalPostEngagementRate = sourcePreview?.engagementRate ?? pickText(g4Row, ["engagement_rate", "engagementRate"]) ?? null;
  const originalPostData = [
    originalPostPlatform ? `Platform: ${originalPostPlatform}` : null,
    originalPostHandle ? `Handle: ${originalPostHandle}` : null,
    originalPostCaption ? `Caption: ${originalPostCaption}` : null,
    originalPostUrl ? `Post URL: ${originalPostUrl}` : null,
    originalPostViews ? `Views: ${originalPostViews}` : null,
    originalPostLikes ? `Likes: ${originalPostLikes}` : null,
    originalPostComments ? `Comments: ${originalPostComments}` : null,
    originalPostShares ? `Shares: ${originalPostShares}` : null,
    originalPostAudio ? `Audio: ${originalPostAudio}` : null,
    originalPostEngagementRate ? `Engagement rate: ${originalPostEngagementRate}` : null,
  ].filter((value): value is string => Boolean(value && value.trim())).join("\n") || null;
  const displaySummary = contentSummary || aiInsight || summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);
  const aiDirection = {
    content_angle: contentAngleText,
    safe_rewrite: recommendedCaption,
    hook_angle: recommendedHook,
    risk_summary: normalizeG4Text(g4Row.ai_risk_summary) ?? normalizeG4Text(g4Row.risk_summary) ?? null,
    compliance_note: complianceCandidates.length ? complianceCandidates[0] : null,
  };

  return {
    id,
    g4_review_uuid: id,
    g4_review_id: id,
    content_review_id: contentReviewId,
    review_id: reviewId,
    status: pickText(g4Row, ["status", "review_status", "reviewStatus"]),
    approval_state: pickText(g4Row, ["approval_state", "approvalState"]),
    display_status: "Ready for G5",
    created_at: pickDate(g4Row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    platform_label: pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown",
    ai_risk_summary: aiDirection.risk_summary,
    ai_compliance_note: aiDirection.compliance_note,
    caption_preview: reviewPreview.captionPreview ?? landingPreview.captionPreview ?? null,
    views: sourcePreview?.views ?? reviewPreview.views ?? landingPreview.views ?? null,
    likes: sourcePreview?.likes ?? reviewPreview.likes ?? landingPreview.likes ?? null,
    comments: sourcePreview?.comments ?? reviewPreview.comments ?? landingPreview.comments ?? null,
    shares: sourcePreview?.shares ?? reviewPreview.shares ?? landingPreview.shares ?? null,
    profile_username: sourcePreview?.profileUsername ?? reviewPreview.profileUsername ?? landingPreview.profileUsername ?? null,
    audio_sound: sourcePreview?.audioSound ?? reviewPreview.audioSound ?? landingPreview.audioSound ?? null,
    trend_strength: sourcePreview?.trendStrength ?? reviewPreview.trendStrength ?? landingPreview.trendStrength ?? null,
    brand_fit_score: sourcePreview?.brandFitScore ?? reviewPreview.brandFitScore ?? landingPreview.brandFitScore ?? null,
    risk_score: sourcePreview?.riskScore ?? reviewPreview.riskScore ?? landingPreview.riskScore ?? null,
    source_url: sourcePreview?.sourceUrl ?? reviewPreview.sourceUrl ?? landingPreview.sourceUrl ?? null,
    ai_safe_rewrite: recommendedCaption,
    hook_angle: hookAngleText,
    content_summary: contentSummary,
    ai_insight: aiInsight,
    engagement_rate: originalPostEngagementRate,
    original_post_data: originalPostData,
    content: {
      title: displayTitle,
      summary: displaySummary,
      platform: pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown",
      created_at: pickDate(g4Row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    },
    original_post: {
      platform: originalPostPlatform,
      handle: originalPostHandle,
      caption: originalPostCaption,
      post_url: originalPostUrl,
      views: originalPostViews,
      likes: originalPostLikes,
      comments: originalPostComments,
      shares: originalPostShares,
      audio: originalPostAudio,
      engagement_rate: originalPostEngagementRate,
    },
    ai_direction: aiDirection,
    caption_options: captionOptions,
    hook_options: hookOptions,
    recommended_caption: recommendedCaption,
    recommended_hook: recommendedHook,
  };
};

const isMissingRelationError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "42P01" || code === "42703" || code === "PGRST205" || /could not find the table|does not exist/i.test(message);
};

const queryPublicRows = async (table: string, limit = 200) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return { rows: [] as JsonRecord[], error: null as string | null, available: false };
  }

  const { data, error } = await client.schema("public").from(table).select("*").limit(limit);
  if (error) {
    return {
      rows: [] as JsonRecord[],
      error: error.message || "Query failed.",
      available: !isMissingRelationError(error),
    };
  }

  return {
    rows: (Array.isArray(data) ? data : []).map((row) => asRecord(row)).filter((row): row is JsonRecord => Boolean(row)),
    error: null as string | null,
    available: true,
  };
};

const getAssetRecencyValue = (asset: G5DashboardAssetRecord) => {
  const candidates = [asset.state_updated_at, asset.published_at, asset.last_readiness_check_at, asset.asset_created_at];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const value = Date.parse(candidate);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const isPublishedManually = (asset: G5DashboardAssetRecord) => asset.client_tab === "published_manually";

const isReadyToPublish = (asset: G5DashboardAssetRecord) => asset.client_tab === "ready_to_publish";

const isBlocked = (asset: G5DashboardAssetRecord) => asset.client_tab === "blocked_rejected";

const logG5NormalizedAssetStatuses = (assets: G5DashboardAssetRecord[]) => {
  for (const asset of assets) {
    const statusInfo = getG5ClientStatusInfo(asset);
    console.log("G5 normalized asset status", {
      assetId: asset.asset_id,
      g4ReviewId: asset.g4_review_id ?? asset.g4_review_uuid ?? asset.content_review_id ?? asset.review_id ?? null,
      contentApprovalStatus: statusInfo.contentApprovalStatus,
      publishStateStatus: statusInfo.publishStateStatus,
      manualPublishStatus: statusInfo.manualPublishStatus,
      finalClientStatus: statusInfo.clientStatus,
      finalClientTab: statusInfo.clientTab,
    });
  }
};

const finalizeG5AssetRecord = (asset: G5DashboardAssetRecord): G5DashboardAssetRecord => {
  const statusInfo = getG5ClientStatusInfo(asset);

  return {
    ...asset,
    client_status: statusInfo.clientStatus,
    client_tab: statusInfo.clientTab,
  };
};

const buildDashboardSummary = (assets: G5DashboardAssetRecord[]): G5DashboardSummary => {
  const published = assets.filter(isPublishedManually).length;
  const ready = assets.filter((asset) => !isPublishedManually(asset) && isReadyToPublish(asset) && !isBlocked(asset)).length;
  const blocked = assets.filter(isBlocked).length;
  const pending = assets.filter((asset) => asset.client_tab === "pending_approval").length;

  return {
    total: assets.length,
    pending_approval: pending,
    ready_to_publish: ready,
    published_manually: published,
    blocked,
  };
};

const sortAssets = (assets: G5DashboardAssetRecord[]) =>
  [...assets].sort((left, right) => getAssetRecencyValue(right) - getAssetRecencyValue(left));

const createEmptyDashboardResponse = (source: G5DashboardResponse["source"], message: string): G5DashboardResponse => ({
  status: "EMPTY",
  source,
  message,
  summary: {
    total: 0,
    pending_approval: 0,
    ready_to_publish: 0,
    published_manually: 0,
    blocked: 0,
  },
  assets: [],
});

const defaultWebhookMessage = (status: string, fallbackToTemporaryFailure = false) => {
  switch (status) {
    case "PASS":
    case "APPROVED":
      return "Recorded.";
    case "PENDING_APPROVAL":
      return "Waiting for approval.";
    case "APPROVED_READY_TO_PUBLISH":
    case "READY_TO_PUBLISH":
      return "Ready to publish manually.";
    case "PUBLISHED_MANUALLY":
      return "Manual publish result recorded.";
    case "REJECTED":
    case "BLOCK":
    case "BLOCKED":
      return CEVONNE_SAFE_RESPONSE_MESSAGE;
    case "MANUAL_ONLY":
      return CEVONNE_MANUAL_REVIEW_MESSAGE;
    case "ERROR":
      return CEVONNE_TEMPORARY_FAILURE_MESSAGE;
    default:
      return fallbackToTemporaryFailure ? CEVONNE_TEMPORARY_FAILURE_MESSAGE : "Recorded.";
  }
};

const buildWebhookHeaders = (requestId: string, sentAt: string, dryRun: boolean) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cevonne-Source": "admin-panel",
    "X-Cevonne-Request-Id": requestId,
    "X-Cevonne-Timestamp": sentAt,
    "X-Cevonne-Dry-Run": dryRun ? "true" : "false",
  };

  if (env.n8nWebhookSecret.trim()) {
    headers.Authorization = `Bearer ${env.n8nWebhookSecret.trim()}`;
    headers["X-Cevonne-Webhook-Secret"] = env.n8nWebhookSecret.trim();
  }

  return headers;
};

const postG5Webhook = async (path: string, payload: JsonRecord, options: { dryRun?: boolean } = {}): Promise<G5WebhookResponse> => {
  const requestId = randomUUID();
  const sentAt = new Date().toISOString();
  const webhookUrl = buildN8nWebhookUrl(path);
  const dryRun = Boolean(options.dryRun ?? payload.dry_run ?? false);

  if (!webhookUrl) {
    return {
      status: "ERROR",
      message: "Missing n8n webhook configuration.",
      response_type: null,
      handled_at: null,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: null,
      response_text: null,
      raw: null,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: buildWebhookHeaders(requestId, sentAt, dryRun),
      body: JSON.stringify({
        ...payload,
        request_id: requestId,
        received_at: sentAt,
        dry_run: dryRun,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!responseText.trim()) {
      return {
        status: "ERROR",
        message: "n8n returned an empty response.",
        response_type: null,
        handled_at: null,
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: responseText,
        raw: null,
      };
    }

    let raw: JsonRecord | null = null;
    try {
      const parsed = JSON.parse(responseText);
      raw = asRecord(parsed);
    } catch {
      raw = null;
    }

    if (!raw) {
      return {
        status: "ERROR",
        message: "n8n returned invalid JSON.",
        response_type: null,
        handled_at: null,
        request_id: requestId,
        sent_at: sentAt,
        webhook_url: webhookUrl,
        http_status: response.status,
        response_text: responseText,
        raw: null,
      };
    }

    const status = upperText(raw.status) ?? (response.ok ? "PASS" : "ERROR");
    const handledAt = toText(raw.handled_at ?? raw.handledAt) ?? null;
    const message = toText(raw.message) ?? defaultWebhookMessage(status, !response.ok);
    const responseType = toText(raw.response_type ?? raw.responseType) ?? null;

    return {
      ...raw,
      status,
      message,
      response_type: responseType,
      handled_at: handledAt,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: response.status,
      response_text: responseText,
      raw,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "n8n request timed out." : "Failed to call n8n webhook.";
    return {
      status: "ERROR",
      message,
      response_type: null,
      handled_at: null,
      request_id: requestId,
      sent_at: sentAt,
      webhook_url: webhookUrl,
      http_status: null,
      response_text: null,
      raw: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function loadG5DashboardAssets(): Promise<G5DashboardResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return createEmptyDashboardResponse("UNAVAILABLE", "G5 dashboard data source is not configured yet.");
  }

  const viewResult = await queryPublicRows("g5_manual_publish_dashboard_view", 250);
  if (viewResult.error === null) {
    const assets = sortAssets(
      viewResult.rows
        .map((row) => normalizeAssetRecord(row))
        .filter((row): row is G5DashboardAssetRecord => Boolean(row))
        .map(finalizeG5AssetRecord),
    );
    logG5NormalizedAssetStatuses(assets);

    return {
      status: assets.length ? "PASS" : "EMPTY",
      source: "VIEW",
      message: assets.length ? "G5 dashboard loaded from the consolidated view." : "No G5 assets have been stored yet.",
      summary: buildDashboardSummary(assets),
      assets,
    };
  }

  const [contentAssetsResult, stateResult, publishResultsResult] = await Promise.all([
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
  ]);

  const merged = new Map<string, G5DashboardAssetRecord>();
  const mergeRows = (rows: JsonRecord[]) => {
    for (const row of rows) {
      const normalized = normalizeAssetRecord(row);
      if (!normalized) {
        continue;
      }

      const current = merged.get(normalized.asset_id);
      merged.set(normalized.asset_id, current ? mergeRecords(current, normalized) : normalized);
    }
  };

  mergeRows(contentAssetsResult.rows);
  mergeRows(stateResult.rows);
  mergeRows(publishResultsResult.rows);

  const assets = sortAssets([...merged.values()].map(finalizeG5AssetRecord));
  logG5NormalizedAssetStatuses(assets);
  return {
    status: assets.length ? "PASS" : "EMPTY",
    source: "FALLBACK",
    message: assets.length ? "G5 dashboard loaded from fallback tables." : "No G5 assets have been stored yet.",
    summary: buildDashboardSummary(assets),
    assets,
  };
}

export async function loadG5ApprovedContent(): Promise<G5ApprovedContentResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] n8n Supabase config missing", {
      supabase: describeN8nSupabaseTarget(),
      env_keys: ["N8N_SUPABASE_URL", "N8N_SUPABASE_SERVICE_ROLE_KEY"],
    });
    return {
      status: "EMPTY",
      source: "UNAVAILABLE",
      message: "G4 content source is not configured yet.",
      reviews: [],
    };
  }

  const supabaseTarget = describeN8nSupabaseTarget();
  console.info("[g5-asset-approval] loading G4 reviews from n8n Supabase", {
    supabase: supabaseTarget,
    table: "public.g4_content_reviews",
  });

  const [contentAssetsResult, stateResult, publishResultsResult, dashboardViewResult, g5G4LinkResult, g4ReviewResult] = await Promise.all([
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
    queryPublicRows("g5_manual_publish_dashboard_view", 250),
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
    client
      .schema("public")
      .from("g4_content_reviews")
      .select("id, content_review_id, review_id, status, approval_state, created_at, platform, safe_summary, ai_safe_rewrite, ai_risk_summary, ai_caption_suggestions, ai_hook_suggestions, ai_human_review_recommendation, raw_payload")
      .or("status.eq.PASS,approval_state.in.(PENDING_HUMAN_APPROVAL,READY_FOR_APPROVAL,APPROVED)")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const { data, error } = g4ReviewResult;
  if (error) {
    console.error("[g5-asset-approval] failed to load G4 reviews", {
      supabase: supabaseTarget,
      table: "public.g4_content_reviews",
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      status: "ERROR",
      source: "UNAVAILABLE",
      message: `Unable to load G4 content reviews: ${error.message || "query failed."}`,
      reviews: [],
    };
  }

  const registeredG4ReviewKeys = new Set(
    collectTextValuesFromCandidates(
      [
        ...contentAssetsResult.rows,
        ...stateResult.rows,
        ...publishResultsResult.rows,
        ...dashboardViewResult.rows,
        ...g5G4LinkResult.rows,
      ],
      ["g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "content_review_id", "contentReviewId", "review_id", "reviewId"],
    )
      .map((value) => normalizeG4ApprovedContentKeyText(value))
      .filter(Boolean),
  );

  const g4Rows = (Array.isArray(data) ? data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));
  const orderedG4Rows = [...g4Rows].sort((left, right) => getG4ApprovedContentCreatedAtValue(right) - getG4ApprovedContentCreatedAtValue(left));
  const dedupedG4Rows = dedupeG4ApprovedContentRows(orderedG4Rows);
  const registeredG4ContentKeys = new Set<string>();

  for (const row of orderedG4Rows) {
    const identity = buildG4ApprovedContentIdentity(row);
    if (identity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key)) && identity.primaryKey) {
      registeredG4ContentKeys.add(identity.primaryKey);
    }
  }

  const sourcePreviewByLookupKey = await loadG4SourcePreviewMap(dedupedG4Rows);

  const reviews = dedupedG4Rows
    .map((row) => {
      const identity = buildG4ApprovedContentIdentity(row);
      const sourceLookupKey = getG4SourceLookupKey(row);
      const sourcePreview = sourceLookupKey ? sourcePreviewByLookupKey.get(sourceLookupKey) ?? null : null;
      const review = normalizeG4ReviewRecord(row, sourcePreview);

      return review ? { review, identity } : null;
    })
    .filter((entry): entry is { review: G5ApprovedContentRecord; identity: ReturnType<typeof buildG4ApprovedContentIdentity> } => Boolean(entry))
    .filter(({ review }) => isG4ReadyForG5(review))
    .filter(({ identity }) => !identity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key)) && !(identity.primaryKey && registeredG4ContentKeys.has(identity.primaryKey)))
    .map(({ review }) => review)
    .sort((left, right) => {
      const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
      const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
      return rightTime - leftTime;
    })
    .slice(0, 50);

  console.info("[g5-asset-approval] loaded G4 reviews for G5", {
    supabase: supabaseTarget,
    row_count: reviews.length,
    ids: reviews.slice(0, 5).map((row) => row.id),
  });

  return {
    status: reviews.length ? "PASS" : "EMPTY",
    source: "TABLE",
    message: reviews.length ? "G4 content ready for G5 loaded." : "No G4 content ready for G5 yet.",
    reviews,
  };
}

const G5_G4_DETAIL_COLUMNS = "*" as const;

const G5_G4_LANDING_COLUMNS = "*" as const;

export async function loadG5SelectedG4Content(reviewId: string): Promise<G5SelectedG4ContentResponse> {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    console.warn("[g5-asset-approval] n8n Supabase config missing", {
      supabase: describeN8nSupabaseTarget(),
      env_keys: ["N8N_SUPABASE_URL", "N8N_SUPABASE_SERVICE_ROLE_KEY"],
    });
    return {
      status: "EMPTY",
      source: "UNAVAILABLE",
      message: "G4 content source is not configured yet.",
      review: null,
    };
  }

  const normalizedReviewId = reviewId.trim();
  const supabaseTarget = describeN8nSupabaseTarget();
  if (!normalizedReviewId) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "Select a G4 review first.",
      review: null,
    };
  }

  console.info("[g5-asset-approval] loading selected G4 content from n8n Supabase", {
    supabase: supabaseTarget,
    review_id: normalizedReviewId,
    table: "public.g4_content_reviews",
  });

  const { data: g4Data, error: g4Error } = await client
    .schema("public")
    .from("g4_content_reviews")
    .select(G5_G4_DETAIL_COLUMNS)
    .or(`id.eq.${normalizedReviewId},content_review_id.eq.${normalizedReviewId},review_id.eq.${normalizedReviewId}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (g4Error) {
    console.error("[g5-asset-approval] failed to load selected G4 review", {
      supabase: supabaseTarget,
      review_id: normalizedReviewId,
      table: "public.g4_content_reviews",
      code: g4Error.code,
      message: g4Error.message,
      details: g4Error.details,
      hint: g4Error.hint,
    });

    return {
      status: "ERROR",
      source: "UNAVAILABLE",
      message: `Unable to load selected G4 content: ${g4Error.message || "query failed."}`,
      review: null,
    };
  }

  const g4Rows = (Array.isArray(g4Data) ? g4Data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  if (!g4Rows.length) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "No G4 content ready for G5 yet.",
      review: null,
    };
  }

  const selectedG4Row = g4Rows[0];
  const sourcePreviewByLookupKey = await loadG4SourcePreviewMap([selectedG4Row]);

  console.info("[g5-asset-approval] selected G4 review query result", {
    supabase: supabaseTarget,
    review_id: normalizedReviewId,
    row_count: g4Rows.length,
  });

  const selectedSourceLookupKey = getG4SourceLookupKey(selectedG4Row);
  const selectedSourcePreview = selectedSourceLookupKey ? sourcePreviewByLookupKey.get(selectedSourceLookupKey) ?? null : null;
  console.info("[g5-asset-approval] selected G4 review row keys", {
    supabase: supabaseTarget,
    review_id: normalizedReviewId,
    keys: Object.keys(selectedG4Row),
  });
  console.info("[g5-asset-approval] selected G4 review row", {
    supabase: supabaseTarget,
    review_id: normalizedReviewId,
    row: selectedG4Row,
  });

  const selectedReviewKey = pickText(selectedG4Row, ["content_review_id", "review_id", "id"]) ?? normalizedReviewId;
  const [contentAssetsResult, stateResult, publishResultsResult, dashboardViewResult, linkRowsResult] = await Promise.all([
    queryPublicRows("content_assets", 250),
    queryPublicRows("g5_asset_publish_state", 250),
    queryPublicRows("g5_manual_publish_results", 250),
    queryPublicRows("g5_manual_publish_dashboard_view", 250),
    queryPublicRows(G5_G4_ASSET_LINKS_TABLE, 500),
  ]);
  const registeredG4ReviewKeys = new Set(
    collectTextValuesFromCandidates(
      [
        ...contentAssetsResult.rows,
        ...stateResult.rows,
        ...publishResultsResult.rows,
        ...dashboardViewResult.rows,
        ...linkRowsResult.rows,
      ],
      ["g4_review_uuid", "g4ReviewUuid", "content_review_id", "contentReviewId", "review_id", "reviewId"],
    )
      .map((value) => normalizeG4ApprovedContentKeyText(value))
      .filter(Boolean),
  );
  const selectedIdentity = buildG4ApprovedContentIdentity(selectedG4Row);

  if (selectedIdentity.candidateKeys.some((key) => registeredG4ReviewKeys.has(key))) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "This G4 content is already registered as a G5 asset.",
      review: null,
    };
  }

  let landingRow: JsonRecord | null = null;

  const { data: landingData, error: landingError } = await client
    .schema("public")
    .from("g4_content_landing_checks")
    .select(G5_G4_LANDING_COLUMNS)
    .or(`id.eq.${normalizedReviewId},content_review_id.eq.${normalizedReviewId},review_id.eq.${normalizedReviewId},id.eq.${selectedReviewKey},content_review_id.eq.${selectedReviewKey},review_id.eq.${selectedReviewKey}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (landingError) {
    console.error("[g5-asset-approval] failed to load G4 landing checks for selected review", {
      supabase: supabaseTarget,
      review_id: normalizedReviewId,
      content_review_id: selectedReviewKey,
      table: "public.g4_content_landing_checks",
      code: landingError.code,
      message: landingError.message,
      details: landingError.details,
      hint: landingError.hint,
    });
  } else {
    const landingRows = (Array.isArray(landingData) ? landingData : [])
      .map((row) => asRecord(row))
      .filter((row): row is JsonRecord => Boolean(row));

    console.info("[g5-asset-approval] selected G4 landing check query result", {
      supabase: supabaseTarget,
      review_id: normalizedReviewId,
      content_review_id: selectedReviewKey,
      row_count: landingRows.length,
    });

    if (landingRows.length) {
      landingRow = landingRows[0];
      console.info("[g5-asset-approval] selected G4 landing row keys", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId,
        content_review_id: selectedReviewKey,
        keys: Object.keys(landingRow),
      });
      console.info("[g5-asset-approval] selected G4 landing row", {
        supabase: supabaseTarget,
        review_id: normalizedReviewId,
        content_review_id: selectedReviewKey,
        row: landingRow,
      });
    }
  }

  const review = buildG5SelectedG4Content(selectedG4Row, landingRow, selectedSourcePreview);

  return {
    status: "PASS",
    source: "TABLE",
    message: "G4 content ready for G5 loaded.",
    review,
  };
}

export async function uploadG5Media(file: File) {
  const asset = await uploadFileToR2(file);

  return {
    status: "PASS",
    message: "Media uploaded to R2.",
    media_url: asset.url,
    storage_url: asset.storageKey,
    storage_key: asset.storageKey,
    filename: asset.originalName,
    content_type: asset.mimeType,
    kind: asset.kind,
    size: asset.size,
  };
}

const persistG5AssetLink = async (payload: G5AssetRegisterInput, response: G5WebhookResponse) => {
  const client = getN8nSupabaseAdmin();
  if (!client) {
    return;
  }

  const assetId =
    pickTextFromCandidates(response, ["asset_id", "assetId"]) ?? pickTextFromCandidates(response.raw, ["asset_id", "assetId"]);
  const approvalId =
    pickTextFromCandidates(response, ["approval_id", "approvalId"]) ?? pickTextFromCandidates(response.raw, ["approval_id", "approvalId"]);

  if (!assetId || !approvalId) {
    console.warn("[g5-asset-approval] skipping G4/G5 asset link insert because the webhook response was missing identifiers", {
      asset_id: assetId,
      approval_id: approvalId,
      g4_review_uuid: payload.g4_review_uuid,
    });
    return;
  }

  const { error } = await client.schema("public").from(G5_G4_ASSET_LINKS_TABLE).insert({
    g4_review_uuid: payload.g4_review_uuid,
    content_review_id: payload.content_review_id,
    review_id: payload.review_id,
    asset_id: assetId,
    approval_id: approvalId,
  });

  if (error) {
    const logPayload = {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      g4_review_uuid: payload.g4_review_uuid,
      content_review_id: payload.content_review_id,
      review_id: payload.review_id,
      asset_id: assetId,
      approval_id: approvalId,
    };

    if (isMissingRelationError(error)) {
      console.info("[g5-asset-approval] G4/G5 asset link table is not available yet", logPayload);
      return;
    }

    console.warn("[g5-asset-approval] failed to insert G4/G5 asset link", logPayload);
  }
};

export async function registerG5Asset(payload: G5AssetRegisterInput): Promise<G5WebhookResponse> {
  const response = await postG5Webhook(env.n8nG5AssetRegisterPath, payload);

  if (response.status !== "ERROR") {
    await persistG5AssetLink(payload, response);
  }

  return response;
}

export async function submitG5ApprovalDecision(payload: G5ApprovalDecisionInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5ApprovalDecisionPath, payload);
}

export async function runG5ReadinessCheck(payload: G5ReadinessCheckInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5PublishingActionPath, payload, { dryRun: true });
}

export async function recordG5ManualPublishResult(payload: G5ManualPublishResultInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5ManualPublishResultPath, payload);
}

export const buildG5WebhookChecksum = (payload: JsonRecord) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");
