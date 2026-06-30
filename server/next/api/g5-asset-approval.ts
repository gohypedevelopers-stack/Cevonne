import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { CEVONNE_MANUAL_REVIEW_MESSAGE, CEVONNE_SAFE_RESPONSE_MESSAGE, CEVONNE_TEMPORARY_FAILURE_MESSAGE } from "@/lib/cevonne/response";
import {
  extractG4ContentPreview,
  normalizeG4StringArray,
  normalizeG4Text,
  summarizeG4Outcome,
  type G4ContentPreview,
} from "@/lib/admin/g4-content-review";
import { buildN8nWebhookUrl } from "@/lib/n8n-client";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { env } from "@/server/config";
import { uploadFileToR2 } from "@/server/services/r2";

type JsonRecord = Record<string, unknown>;

export type G5DashboardAssetRecord = {
  asset_id: string;
  asset_title: string | null;
  asset_type: string | null;
  intended_platform: string | null;
  platform: string | null;
  content_text: string | null;
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
  display_status: "Ready for G5 Approval";
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
  display_status: "Ready for G5 Approval";
  created_at: string | null;
  display_title: string;
  display_summary: string;
  platform_label: string;
  content_summary: string | null;
  ai_insight: string | null;
  original_post_data: string | null;
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

const upperText = (value: unknown) => toText(value)?.toUpperCase() ?? null;

const normalizeStateKey = (value: unknown) => upperText(value)?.replace(/[\s-]+/g, "_") ?? null;

const isG4ReadyForG5 = (row: JsonRecord) => {
  const status = normalizeStateKey(row.status);
  const approvalState = normalizeStateKey(row.approval_state);

  return (
    status === "PASS" ||
    status === "MANUAL_ONLY" ||
    status === "APPROVED" ||
    status === "READY_FOR_APPROVAL" ||
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "APPROVED" ||
    approvalState === "PASS"
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
  const assetId =
    pickText(row, ["asset_id", "assetId", "id", "approval_id", "approvalId", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? null;

  if (!assetId) {
    return null;
  }

  return {
    asset_id: assetId,
    asset_title: pickText(row, ["asset_title", "assetTitle", "title", "name", "content_text", "contentText", "caption", "caption_text", "captionText", "summary"]),
    asset_type: pickText(row, ["asset_type", "assetType", "content_type", "contentType", "media_type", "mediaType"]),
    intended_platform: pickText(row, ["intended_platform", "intendedPlatform"]),
    platform: pickText(row, ["platform", "source_platform", "sourcePlatform"]),
    content_text: pickText(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "body", "message"]),
    media_url: pickText(row, ["media_url", "mediaUrl", "public_url", "publicUrl", "url", "image_url", "imageUrl", "video_url", "videoUrl"]),
    storage_url: pickText(row, ["storage_url", "storageUrl", "storage_reference", "storageReference", "storage_key", "storageKey"]),
    compliance_status: pickText(row, ["compliance_status", "complianceStatus", "g1_compliance_status", "g1ComplianceStatus"]),
    approval_status: pickText(row, ["approval_status", "approvalStatus"]),
    approved_by: pickText(row, ["approved_by", "approvedBy"]),
    asset_created_at: pickDate(row, ["asset_created_at", "assetCreatedAt", "created_at", "createdAt"]),
    asset_status: pickText(row, ["asset_status", "assetStatus", "status"]),
    readiness_status: pickText(row, ["readiness_status", "readinessStatus"]),
    manual_publish_status: pickText(row, ["manual_publish_status", "manualPublishStatus", "publish_status", "publishStatus"]),
    approval_id: pickText(row, ["approval_id", "approvalId"]),
    last_manual_publish_result_id: pickText(row, ["last_manual_publish_result_id", "lastManualPublishResultId", "manual_publish_result_id", "manualPublishResultId"]),
    post_url: pickText(row, ["post_url", "postUrl", "instagram_post_url", "instagramPostUrl", "published_url", "publishedUrl"]),
    published_by: pickText(row, ["published_by", "publishedBy"]),
    published_at: pickDate(row, ["published_at", "publishedAt"]),
    state_updated_at: pickDate(row, ["state_updated_at", "stateUpdatedAt", "updated_at", "updatedAt", "modified_at", "modifiedAt"]),
    g4_review_id: pickText(row, ["g4_review_id", "g4ReviewId", "g4_review_uuid", "g4ReviewUuid", "review_id", "reviewId", "content_review_id", "contentReviewId"]),
    g4_review_uuid: pickText(row, ["g4_review_uuid", "g4ReviewUuid"]),
    content_review_id: pickText(row, ["content_review_id", "contentReviewId"]),
    review_id: pickText(row, ["review_id", "reviewId"]),
    source_platform: pickText(row, ["source_platform", "sourcePlatform"]),
    source_event: pickText(row, ["source_event", "sourceEvent"]),
    rights_status: pickText(row, ["rights_status", "rightsStatus"]),
    last_readiness_check_at: pickDate(row, ["last_readiness_check_at", "lastReadinessCheckAt", "readiness_checked_at", "readinessCheckedAt"]),
    last_readiness_check_response: pickText(row, ["last_readiness_check_response", "lastReadinessCheckResponse"]),
    readiness_response: pickText(row, ["readiness_response", "readinessResponse", "n8n_response", "n8nResponse", "response_text", "responseText"]),
    failure_reasons: pickArray(row, ["failure_reasons", "failureReasons", "blocked_reasons", "blockedReasons", "rejection_reasons", "rejectionReasons"]),
  };
};

const normalizeG4ReviewRecord = (row: JsonRecord): G5ApprovedContentRecord | null => {
  const id = pickText(row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]);
  if (!id) {
    return null;
  }

  const preview = extractG4ContentPreview({ raw_payload: row });
  const hookCount = normalizeG4StringArray(row.ai_hook_suggestions).length;
  const captionCount = normalizeG4StringArray(row.ai_caption_suggestions).length;
  const displayTitle = preview.headline?.trim() || preview.productName?.trim() || preview.captionPreview?.trim() || "Content check passed";
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
    display_status: "Ready for G5 Approval",
    created_at: pickDate(row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    hook_count: hookCount,
    caption_count: captionCount,
    platform_label: platformLabel,
    content_text: pickText(row, ["content_text", "contentText", "caption", "caption_text", "captionText", "content", "body", "summary"]),
    caption_preview: pickText(row, ["caption_preview", "captionPreview"]) ?? preview.captionPreview,
    views: preview.views ?? null,
    likes: preview.likes ?? null,
    comments: preview.comments ?? null,
    shares: preview.shares ?? null,
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

const buildSelectableOptions = (texts: string[], kind: "caption" | "hook") =>
  texts.map((text, index) => ({
    id: `${kind}-${index + 1}`,
    label: index === 0 ? `Recommended ${kind}` : `${kind === "caption" ? "Caption" : "Hook"} ${index + 1}`,
    text,
    source: "G4" as const,
  }));

const buildG5SelectedG4Content = (g4Row: JsonRecord, landingRow: JsonRecord | null): G5SelectedG4ContentRecord => {
  const reviewPreview = extractG4ContentPreview(g4Row);
  const landingPreview = extractG4ContentPreview(landingRow ? { raw_payload: landingRow } : null);

  const contentReviewId = pickText(g4Row, ["content_review_id", "contentReviewId", "review_id", "reviewId"]);
  const reviewId = pickText(g4Row, ["review_id", "reviewId", "content_review_id", "contentReviewId"]);
  const id = pickText(g4Row, ["id", "content_review_id", "contentReviewId", "review_id", "reviewId"]) ?? "";
  const displayTitle =
    reviewPreview.headline?.trim() || reviewPreview.productName?.trim() || reviewPreview.captionPreview?.trim() || "Content check passed";

  const captionOptions = buildSelectableOptions(
    collectNormalizedTexts(g4Row.ai_caption_suggestions, g4Row.ai_safe_rewrite),
    "caption"
  );
  const hookOptions = buildSelectableOptions(
    collectNormalizedTexts(g4Row.ai_hook_suggestions, reviewPreview.hookAngle),
    "hook"
  );

  const recommendedCaption =
    captionOptions[0]?.text ??
    normalizeG4Text(g4Row.ai_safe_rewrite) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    null;
  const recommendedHook = hookOptions[0]?.text ?? normalizeG4Text(reviewPreview.hookAngle) ?? null;

  const summaryCandidate =
    normalizeG4Text(g4Row.safe_summary) ??
    normalizeG4Text(reviewPreview.cleanSummary) ??
    summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);

  const claimNotes = collectNormalizedTexts(g4Row.ai_claim_notes);
  const insightCandidate =
    normalizeG4Text(g4Row.ai_risk_summary) ??
    normalizeG4Text(g4Row.ai_human_review_recommendation) ??
    normalizeG4Text(reviewPreview.contentRecommendation) ??
    normalizeG4Text(reviewPreview.hookAngle) ??
    (claimNotes.length ? claimNotes.join(" • ") : null) ??
    null;

  const originalPostBits = [
    normalizeG4Text(landingRow?.headline) ?? landingPreview.headline ?? reviewPreview.headline,
    normalizeG4Text(landingRow?.content_text) ?? landingPreview.contentText ?? reviewPreview.contentText,
    normalizeG4Text(landingRow?.cta_text) ?? landingPreview.ctaText ?? reviewPreview.ctaText,
    normalizeG4Text(landingRow?.ad_promise_text),
    normalizeG4Text(landingRow?.landing_page_url) ?? landingPreview.landingPageUrl ?? reviewPreview.landingPageUrl,
    normalizeG4Text(landingRow?.product_name) ?? landingPreview.productName ?? reviewPreview.productName,
    normalizeG4Text(landingRow?.source_url) ?? landingPreview.sourceUrl ?? reviewPreview.sourceUrl,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const contentSummary = summaryCandidate || null;
  const aiInsight = insightCandidate || null;
  const originalPostData = originalPostBits.length ? originalPostBits.join("\n") : null;
  const displaySummary = contentSummary || aiInsight || summarizeG4Outcome(g4Row as Parameters<typeof summarizeG4Outcome>[0]);

  return {
    id,
    g4_review_uuid: id,
    g4_review_id: id,
    content_review_id: contentReviewId,
    review_id: reviewId,
    status: pickText(g4Row, ["status", "review_status", "reviewStatus"]),
    approval_state: pickText(g4Row, ["approval_state", "approvalState"]),
    display_status: "Ready for G5 Approval",
    created_at: pickDate(g4Row, ["created_at", "createdAt", "updated_at", "updatedAt"]),
    display_title: displayTitle,
    display_summary: displaySummary,
    platform_label: pickText(g4Row, ["platform", "source_platform", "sourcePlatform"]) || "Unknown",
    content_summary: contentSummary,
    ai_insight: aiInsight,
    original_post_data: originalPostData,
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

const isPublishedManually = (asset: G5DashboardAssetRecord) => {
  const status = upperText(asset.asset_status ?? asset.manual_publish_status ?? asset.post_url);
  return Boolean(asset.post_url && asset.published_at) || status === "PUBLISHED_MANUALLY" || status === "PUBLISHED";
};

const isReadyToPublish = (asset: G5DashboardAssetRecord) => {
  const status = upperText(asset.asset_status ?? asset.readiness_status ?? asset.approval_status);
  return (
    status === "APPROVED_READY_TO_PUBLISH" ||
    status === "READY_TO_PUBLISH" ||
    status === "APPROVED" ||
    status === "PASS" ||
    upperText(asset.readiness_status) === "PASS"
  );
};

const isBlocked = (asset: G5DashboardAssetRecord) => {
  const status = upperText(asset.asset_status ?? asset.approval_status ?? asset.readiness_status ?? asset.compliance_status);
  return status === "BLOCKED" || status === "BLOCK" || status === "REJECTED" || status === "FAILED" || status === "ERROR";
};

const buildDashboardSummary = (assets: G5DashboardAssetRecord[]): G5DashboardSummary => {
  const published = assets.filter(isPublishedManually).length;
  const ready = assets.filter((asset) => !isPublishedManually(asset) && isReadyToPublish(asset) && !isBlocked(asset)).length;
  const blocked = assets.filter(isBlocked).length;
  const pending = Math.max(0, assets.length - published - ready - blocked);

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
    const assets = sortAssets(viewResult.rows.map((row) => normalizeAssetRecord(row)).filter((row): row is G5DashboardAssetRecord => Boolean(row)));

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

  const assets = sortAssets([...merged.values()]);
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

  const { data, error } = await client
    .schema("public")
    .from("g4_content_reviews")
    .select("id, content_review_id, review_id, status, approval_state, created_at, platform, safe_summary, ai_safe_rewrite, ai_risk_summary, ai_caption_suggestions, ai_hook_suggestions, ai_human_review_recommendation, raw_payload")
    .or("status.in.(PASS,MANUAL_ONLY,APPROVED),approval_state.in.(PENDING_HUMAN_APPROVAL,READY_FOR_APPROVAL,APPROVED,PASS)")
    .order("created_at", { ascending: false })
    .limit(50);
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

  const reviews = (Array.isArray(data) ? data : [])
    .map((row) => asRecord(row))
    .filter((row): row is JsonRecord => Boolean(row))
    .map((row) => normalizeG4ReviewRecord(row))
    .filter((row): row is G5ApprovedContentRecord => Boolean(row))
    .filter((row) => isG4ReadyForG5(row))
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
    message: reviews.length ? "G4 content ready for G5 approval loaded." : "No G4 content ready for G5 yet.",
    reviews,
  };
}

const G5_G4_DETAIL_COLUMNS = `
  id,
  content_review_id,
  review_id,
  status,
  approval_state,
  created_at,
  safe_summary,
  ai_risk_summary,
  ai_safe_rewrite,
  ai_caption_suggestions,
  ai_hook_suggestions,
  ai_claim_notes,
  ai_human_review_recommendation,
  raw_payload
` as const;

const G5_G4_LANDING_COLUMNS = `
  review_id,
  status,
  content_text,
  headline,
  cta_text,
  ad_promise_text,
  landing_page_url,
  product_name,
  raw_payload,
  source_platform,
  source_event,
  source_url,
  created_at
` as const;

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

  console.info("[g5-asset-approval] selected G4 review query result", {
    supabase: supabaseTarget,
    review_id: normalizedReviewId,
    row_count: g4Rows.length,
  });

  if (!g4Rows.length) {
    return {
      status: "EMPTY",
      source: "TABLE",
      message: "No G4 content ready for G5 yet.",
      review: null,
    };
  }

  const selectedG4Row = g4Rows[0];
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
  let landingRow: JsonRecord | null = null;

  const { data: landingData, error: landingError } = await client
    .schema("public")
    .from("g4_content_landing_checks")
    .select(G5_G4_LANDING_COLUMNS)
    .eq("review_id", selectedReviewKey)
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

  const review = buildG5SelectedG4Content(selectedG4Row, landingRow);

  return {
    status: "PASS",
    source: "TABLE",
    message: "G4 content ready for G5 approval loaded.",
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

export async function registerG5Asset(payload: G5AssetRegisterInput): Promise<G5WebhookResponse> {
  return postG5Webhook(env.n8nG5AssetRegisterPath, payload);
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
