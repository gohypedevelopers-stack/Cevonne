import "server-only";

import { randomUUID } from "node:crypto";

import {
  getG4ActionNeeded,
  normalizeG4StringArray,
  normalizeG4Text,
  summarizeG4Outcome,
} from "@/lib/admin/g4-content-review";
import { getWorkflowDetailHref, humanizeReasonText } from "@/lib/admin/workflows";
import { postN8nWebhook, type N8nWebhookResult, type N8nWebhookStatus } from "@/lib/n8n-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/server/config/env";
import { slugify } from "@/server/utils/strings";
import {
  G12_SUPABASE_TABLES,
  normalizeG12SupabaseInsightRow,
  type G12SupabaseInsight,
} from "@/server/next/api/g12-trend-fetcher-supabase";

export type G12SendToContentDraftInput = {
  insight_id?: string | null;
  trend_id?: string | null;
  raw_id?: string | null;
  metric_id?: string | null;
  asset_id?: string | null;
  approval_id?: string | null;
  g4_review_id?: string | null;
  fetch_run_id?: string | null;
};

export type G12SendToContentDraftResponse = {
  status: N8nWebhookStatus;
  message: string;
  summary: string | null;
  action_needed: string | null;
  approval_status: string | null;
  already_sent: boolean;
  g4_detail_href: string;
  review_id: string | null;
  g4_review_id: string | null;
  approval_id: string | null;
  asset_id: string | null;
  approval_state: string | null;
  safe_rewrite: string | null;
  caption_suggestions: string[];
  hook_suggestions: string[];
  content_draft_id: string | null;
  insight_id: string | null;
  fetch_run_id: string | null;
  request_id: string;
  sent_at: string;
  handled_at: string | null;
};

export type G12SendToContentDraftResult = {
  httpStatus: number;
  body: G12SendToContentDraftResponse;
};

type G4ContentReviewRow = {
  id?: string | null;
  review_id?: string | null;
  content_review_id?: string | null;
  status?: string | null;
  approval_state?: string | null;
  asset_id?: string | null;
  ai_safe_rewrite?: string | null;
  ai_caption_suggestions?: unknown;
  ai_hook_suggestions?: unknown;
  ai_human_review_recommendation?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  requires_human_approval?: boolean | null;
  failure_reasons?: unknown;
  safe_summary?: string | null;
  raw_payload?: unknown;
  source_event?: string | null;
};

type G4ReviewSnapshot = {
  id: string | null;
  review_id: string | null;
  asset_id: string | null;
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE" | "ERROR";
  approval_state: string | null;
  safe_rewrite: string | null;
  caption_suggestions: string[];
  hook_suggestions: string[];
  action_needed: string | null;
  summary: string | null;
};

const G4_CONTENT_REVIEW_TABLE = "g4_content_reviews";
const G12_TO_G4_IDEMPOTENCY_PREFIX = "g12_to_g4:";
const G4_NOT_CONNECTED_MESSAGE =
  "G4 content check is not connected yet. Activate the G4 n8n workflow or update the G4 webhook path.";
const G4_NOT_CONNECTED_ACTION = "Connect G4 content check endpoint.";
const G12_MISSING_INSIGHT_MESSAGE = "This saved insight could not be found.";
const G12_MISSING_REQUEST_MESSAGE = "Provide an insight_id or fetch_run_id.";
const G12_GENERIC_FAILURE_MESSAGE = "Unable to send the saved insight to G4 right now.";
const G12_G4_DETAIL_HREF = getWorkflowDetailHref("G4");
const G4_REVIEW_LOOKUP_ATTEMPTS = 4;
const G4_REVIEW_LOOKUP_DELAY_MS = 500;

const toText = (value: unknown, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const text = toText(value, "");
    if (text) {
      return text;
    }
  }

  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readRecordText = (record: G4ContentReviewRow | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key as keyof G4ContentReviewRow];
    const text = toText(value, "");
    if (text) {
      return text;
    }
  }

  return null;
};

const isLocalSendMarker = (insight: G12SupabaseInsight) => {
  const approval = toText(insight.approval_status, "").toUpperCase();
  if (/(REJECT|BLOCK|DENIED|DECLINED|FAILED|FAIL)/.test(approval)) {
    return false;
  }

  return Boolean(insight.g4_review_id) || /(SENT|DRAFT|REVIEW_REQUESTED|IN_REVIEW)/.test(approval);
};

const normalizeApprovalState = (value: unknown) => toText(value, "").toUpperCase();

const buildStableAssetId = (insight: G12SupabaseInsight) => {
  const fallbackHeadline = firstText(insight.insight_title, insight.title, insight.trend_topic);
  return (
    firstText(insight.asset_id, insight.trend_id, insight.insight_id, insight.id) ??
    (fallbackHeadline ? slugify(fallbackHeadline) : null) ??
    `g12-${insight.id}`
  );
};

const buildSourceTrendId = (insight: G12SupabaseInsight) =>
  firstText(insight.trend_id, insight.fetch_run_id, insight.insight_id, insight.id);

const buildHeadline = (insight: G12SupabaseInsight) => firstText(insight.insight_title, insight.title, insight.trend_topic);

const buildContentText = (insight: G12SupabaseInsight) => {
  const meaning = firstText(insight.clean_summary, insight.summary);
  const recommendation = firstText(insight.content_recommendation);
  const hook = firstText(insight.hook_angle);

  const parts = [
    meaning,
    recommendation ? `Recommendation: ${recommendation}` : null,
    hook ? `Hook: ${hook}` : null,
  ].filter(Boolean) as string[];

  return parts.join(" ").trim() || "Clean trend insight stored in Supabase.";
};

const buildG4ReviewSummary = (snapshot: G4ReviewSnapshot) => {
  if (snapshot.status === "BLOCK") {
    return snapshot.summary ?? "This content was blocked before it could move forward.";
  }

  if (snapshot.status === "NEEDS_EVIDENCE") {
    return snapshot.summary ?? "This content needs evidence before it can continue.";
  }

  if (snapshot.status === "MANUAL_ONLY") {
    return snapshot.summary ?? "This content needs manual review before it can continue.";
  }

  if (snapshot.status === "PENDING_APPROVAL") {
    return null;
  }

  if (snapshot.approval_state === "PENDING_HUMAN_APPROVAL") {
    return null;
  }

  return snapshot.summary ?? null;
};

const buildG4ActionNeededCopy = (snapshot: G4ReviewSnapshot) => {
  if (snapshot.status === "BLOCK") {
    return snapshot.action_needed ?? "Fix content";
  }

  if (snapshot.status === "NEEDS_EVIDENCE") {
    return snapshot.action_needed ?? "Add evidence";
  }

  if (snapshot.status === "MANUAL_ONLY") {
    return snapshot.action_needed ?? "Manual review";
  }

  if (snapshot.status === "PENDING_APPROVAL" || snapshot.approval_state === "PENDING_HUMAN_APPROVAL") {
    return "Send for Human Approval";
  }

  return snapshot.action_needed ?? getG4ActionNeeded({ status: snapshot.status, approval_state: snapshot.approval_state });
};

const buildG4ReviewSnapshot = (row: G4ContentReviewRow | null | undefined, fallbackReviewId: string | null = null): G4ReviewSnapshot => {
  const rowId = readRecordText(row, ["id"]);
  const reviewId = firstText(readRecordText(row, ["review_id", "content_review_id", "id"]), fallbackReviewId);
  const approvalState = normalizeApprovalState(row?.approval_state);
  const normalizedStatus = normalizeApprovalState(row?.status);
  const status: G4ReviewSnapshot["status"] =
    normalizedStatus === "BLOCK" ||
    normalizedStatus === "MANUAL_ONLY" ||
    normalizedStatus === "NEEDS_EVIDENCE" ||
    normalizedStatus === "PENDING_APPROVAL" ||
    normalizedStatus === "ERROR"
      ? normalizedStatus
      : "PASS";
  const assetId = readRecordText(row, ["asset_id"]);
  const safeRewrite = normalizeG4Text(row?.ai_safe_rewrite) ?? null;
  const captionSuggestions = normalizeG4StringArray(row?.ai_caption_suggestions).map((value) => normalizeG4Text(value) ?? value);
  const hookSuggestions = normalizeG4StringArray(row?.ai_hook_suggestions).map((value) => normalizeG4Text(value) ?? value);
  const reviewSummary = normalizeG4Text(row?.safe_summary) ?? summarizeG4Outcome(row);
  const humanReviewRecommendation = normalizeG4Text(row?.ai_human_review_recommendation);
  const snapshot: G4ReviewSnapshot = {
    id: rowId,
    review_id: reviewId,
    asset_id: assetId,
    status,
    approval_state: approvalState || null,
    safe_rewrite: safeRewrite,
    caption_suggestions: captionSuggestions,
    hook_suggestions: hookSuggestions,
    action_needed: humanReviewRecommendation,
    summary: reviewSummary,
  };

  return {
    ...snapshot,
    action_needed: buildG4ActionNeededCopy(snapshot),
    summary: buildG4ReviewSummary(snapshot),
  };
};

const buildG4ReviewSelect = `
  id,
  review_id,
  content_review_id,
  status,
  approval_state,
  asset_id,
  ai_safe_rewrite,
  ai_caption_suggestions,
  ai_hook_suggestions,
  ai_human_review_recommendation,
  created_at,
  reviewed_at,
  requires_human_approval,
  failure_reasons,
  safe_summary,
  raw_payload,
  source_event
` as const;

const buildSafePayload = (insight: G12SupabaseInsight) => {
  const assetId = buildStableAssetId(insight);
  const headline = buildHeadline(insight);
  const contentText = buildContentText(insight);
  const sourceTrendId = buildSourceTrendId(insight);
  const sourcePlatform = "G12";
  const idempotencyKey = `${G12_TO_G4_IDEMPOTENCY_PREFIX}${assetId}`;
  const platform = firstText(insight.platform) ?? "INSTAGRAM";
  const sourceUrl = firstText(insight.source_url);

  return {
    workflow_group: "G4",
    workflow_id: "G12",
    source_workflow_group: "G12",
    source_workflow_id: "G12",
    source_platform: sourcePlatform,
    source_event: "SAFE_TREND_TO_CONTENT_REVIEW",
    source_type: "PUBLIC_TREND_CLEAN_INSIGHT",
    action_type: "CONTENT_DRAFT_CHECK",
    asset_id: assetId,
    asset_type: "TREND_CONTENT_IDEA",
    content_format: "SHORT_VIDEO_CAPTION",
    headline,
    content_text: contentText,
    platform,
    source_trend_id: sourceTrendId,
    source_url: sourceUrl,
    actor: "website_admin",
    requested_by: "website_admin",
    idempotency_key: idempotencyKey,
    insight_id: insight.id,
    fetch_run_id: insight.fetch_run_id,
    trend_topic: firstText(insight.trend_topic, insight.insight_title, insight.title),
    insight_title: headline,
    trend_meaning: contentText,
    clean_summary: firstText(insight.clean_summary),
    content_recommendation: firstText(insight.content_recommendation),
    hook_angle: firstText(insight.hook_angle),
    quarantine_notice: "Raw scraped content is quarantined and must not be reused directly.",
    requires_g4_review: true,
    requires_g5_approval: true,
  };
};

const isConnectedWebhookIssue = (response: N8nWebhookResult) => {
  const responseText = [
    response.message,
    response.response_text,
    typeof response.http_status === "number" ? String(response.http_status) : null,
    response.raw && typeof response.raw === "object" && !Array.isArray(response.raw)
      ? toText((response.raw as Record<string, unknown>).message)
      : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    response.http_status === 404 ||
    response.http_status === 410 ||
    responseText.includes("not registered") ||
    responseText.includes("missing n8n webhook configuration") ||
    responseText.includes("invalid n8n webhook url") ||
    responseText.includes("invalid n8n webhook url protocol") ||
    responseText.includes("webhook is not registered") ||
    responseText.includes("webhook not registered")
  );
};

const humanizeFailureReason = (response: N8nWebhookResult) => {
  const candidates = [
    response.fail_reason,
    ...(Array.isArray(response.failure_reasons) ? response.failure_reasons : []),
    response.message,
  ];

  for (const candidate of candidates) {
    const reason = humanizeReasonText(candidate);
    if (reason) {
      return reason;
    }
  }

  return "The content check was blocked before a draft was created.";
};

const buildG12ApprovalStatus = (review: Pick<G4ReviewSnapshot, "status" | "approval_state">) => {
  const approvalState = normalizeApprovalState(review.approval_state);

  if (approvalState === "APPROVED") {
    return "SENT_TO_CONTENT_DRAFT";
  }

  if (approvalState === "REJECTED" || approvalState === "NOT_APPROVED" || approvalState === "DECLINED" || approvalState === "DENIED") {
    return "REJECTED";
  }

  if (review.status === "BLOCK") {
    return "REJECTED";
  }

  if (review.status === "MANUAL_ONLY" || review.status === "NEEDS_EVIDENCE" || approvalState === "CHANGES_REQUESTED") {
    return "NEEDS_G4_G5_BEFORE_CONTENT_USE";
  }

  if (
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "PENDING_APPROVAL" ||
    approvalState === "REVIEW_REQUESTED" ||
    approvalState === "IN_REVIEW" ||
    review.status === "PENDING_APPROVAL" ||
    review.status === "PASS"
  ) {
    return "SENT_TO_CONTENT_DRAFT";
  }

  return "NEEDS_G4_G5_BEFORE_CONTENT_USE";
};

const buildUpdateFields = (review: G4ReviewSnapshot, handledAt: string) => {
  const approvalStatus = buildG12ApprovalStatus(review);
  const g4ReviewUuid = review.id;
  const fields: Record<string, unknown> = {
    approval_status: approvalStatus,
    updated_at: handledAt,
  };

  if (approvalStatus === "SENT_TO_CONTENT_DRAFT") {
    if (g4ReviewUuid) {
      fields.approval_id = g4ReviewUuid;
      fields.g4_review_id = g4ReviewUuid;
    }
    fields.selected_for_review = true;
    fields.wf1_handoff_ready = true;
  }

  return fields;
};

const loadG12InsightByColumn = async (column: string, value: string): Promise<G12SupabaseInsight | null> => {
  const { data, error } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeG12SupabaseInsightRow(data as Record<string, unknown>);
};

const loadG12InsightByIdentifier = async (identifier: string) => {
  const columns = ["id", "insight_id", "trend_id", "raw_id", "metric_id", "asset_id", "approval_id", "g4_review_id"] as const;

  for (const column of columns) {
    const insight = await loadG12InsightByColumn(column, identifier);
    if (insight) {
      return insight;
    }
  }

  return null;
};

const loadInsightByFetchRunId = async (fetchRunId: string) => {
  const { data, error } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .select("*")
    .eq("fetch_run_id", fetchRunId)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeG12SupabaseInsightRow(data as Record<string, unknown>);
};

const loadG12Insight = async (input: G12SendToContentDraftInput) => {
  const insightId = toText(input.insight_id, "");
  const trendId = toText(input.trend_id, "");
  const rawId = toText(input.raw_id, "");
  const metricId = toText(input.metric_id, "");
  const assetId = toText(input.asset_id, "");
  const approvalId = toText(input.approval_id, "");
  const g4ReviewId = toText(input.g4_review_id, "");
  const fetchRunId = toText(input.fetch_run_id, "");

  const identifiers = [insightId, trendId, rawId, metricId, assetId, approvalId, g4ReviewId].filter(Boolean);
  if (!identifiers.length && !fetchRunId) {
    return null;
  }

  for (const identifier of identifiers) {
    const insight = await loadG12InsightByIdentifier(identifier);
    if (insight) {
      if (fetchRunId && insight.fetch_run_id && insight.fetch_run_id !== fetchRunId) {
        return null;
      }

      return insight;
    }
  }

  if (fetchRunId) {
    return loadInsightByFetchRunId(fetchRunId);
  }

  return null;
};

const loadExistingG4Review = async (idempotencyKey: string, assetId: string | null = null) => {
  if (assetId) {
    const byAssetId = await loadG4ReviewByAssetId(assetId);
    if (byAssetId) {
      return byAssetId;
    }
  }

  const { data, error } = await supabaseAdmin
    .from(G4_CONTENT_REVIEW_TABLE)
    .select(buildG4ReviewSelect)
    .contains("raw_payload", { idempotency_key: idempotencyKey })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !isRecord(data)) {
    return null;
  }

  return data as G4ContentReviewRow;
};

const loadG4ReviewByAssetId = async (assetId: string) => {
  const { data, error } = await supabaseAdmin
    .from(G4_CONTENT_REVIEW_TABLE)
    .select(buildG4ReviewSelect)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !isRecord(data)) {
    return null;
  }

  return data as G4ContentReviewRow;
};

const loadG4ReviewByReviewId = async (reviewId: string) => {
  const columns = ["id", "review_id", "content_review_id"] as const;

  for (const column of columns) {
    const { data, error } = await supabaseAdmin
      .from(G4_CONTENT_REVIEW_TABLE)
      .select(buildG4ReviewSelect)
      .eq(column, reviewId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && isRecord(data)) {
      return data as G4ContentReviewRow;
    }
  }

  return null;
};

const summarizeExistingG4Review = (review: G4ContentReviewRow) => {
  const safeSummary = humanizeReasonText(review.safe_summary);
  if (safeSummary) {
    return safeSummary;
  }

  const failureReasons = Array.isArray(review.failure_reasons) ? review.failure_reasons : [review.failure_reasons];
  for (const reason of failureReasons) {
    const summary = humanizeReasonText(reason as string | null | undefined);
    if (summary) {
      return summary;
    }
  }

  const status = toText(review.status, "").toUpperCase();
  if (status === "BLOCK") {
    return "The content check was blocked before a draft was created.";
  }

  if (status === "MANUAL_ONLY") {
    return "Manual review is required before this can continue.";
  }

  return "The insight already has a G4 review record.";
};

const loadG4ReviewFromSources = async (input: {
  idempotencyKey: string;
  assetId: string | null;
  reviewIds: Array<string | null | undefined>;
}) => {
  for (const reviewId of input.reviewIds) {
    const normalizedReviewId = toText(reviewId, "");
    if (!normalizedReviewId) {
      continue;
    }

    const review = await loadG4ReviewByReviewId(normalizedReviewId);
    if (review) {
      return review;
    }
  }

  if (input.assetId) {
    const byAssetId = await loadG4ReviewByAssetId(input.assetId);
    if (byAssetId) {
      return byAssetId;
    }
  }

  return loadExistingG4Review(input.idempotencyKey, input.assetId);
};

const waitForG4Review = async (input: {
  idempotencyKey: string;
  assetId: string | null;
  reviewIds: Array<string | null | undefined>;
}) => {
  for (let attempt = 0; attempt < G4_REVIEW_LOOKUP_ATTEMPTS; attempt += 1) {
    const review = await loadG4ReviewFromSources(input);
    if (review) {
      return review;
    }

    if (attempt < G4_REVIEW_LOOKUP_ATTEMPTS - 1) {
      await sleep(G4_REVIEW_LOOKUP_DELAY_MS * (attempt + 1));
    }
  }

  return null;
};

const updateG4ReviewByColumn = async (column: "id" | "review_id" | "content_review_id" | "asset_id", value: string, update: Record<string, unknown>) => {
  const { data, error } = await supabaseAdmin
    .from(G4_CONTENT_REVIEW_TABLE)
    .update(update)
    .eq(column, value)
    .select(buildG4ReviewSelect)
    .maybeSingle();

  if (error || !data || !isRecord(data)) {
    return null;
  }

  return data as G4ContentReviewRow;
};

const syncG4ReviewReadyForApproval = async (review: G4ContentReviewRow, handledAt: string) => {
  const update = {
    status: "PASS",
    approval_state: null,
    requires_human_approval: false,
    reviewed_at: handledAt,
  };

  const candidates: Array<[column: "id" | "review_id" | "content_review_id" | "asset_id", value: string]> = [];
  const reviewId = toText(review.id, "");
  const rowReviewId = toText(review.review_id, "");
  const contentReviewId = toText(review.content_review_id, "");
  const assetId = toText(review.asset_id, "");

  if (reviewId) {
    candidates.push(["id", reviewId]);
  }
  if (rowReviewId) {
    candidates.push(["review_id", rowReviewId]);
  }
  if (contentReviewId) {
    candidates.push(["content_review_id", contentReviewId]);
  }
  if (assetId) {
    candidates.push(["asset_id", assetId]);
  }

  let lastError: unknown = null;
  for (const [column, value] of candidates) {
    const updated = await updateG4ReviewByColumn(column, value, update);
    if (updated) {
      console.info("[g12-send-to-content-draft] G4 draft-ready update response", {
        review_id: updated.id ?? updated.review_id ?? updated.content_review_id,
        asset_id: updated.asset_id ?? null,
        approval_state: updated.approval_state ?? null,
        requires_human_approval: updated.requires_human_approval ?? null,
        status: updated.status ?? null,
        reviewed_at: updated.reviewed_at ?? null,
        created_at: updated.created_at ?? null,
      });
      return updated;
    }

    lastError = { column, value };
  }

  console.warn("[g12-send-to-content-draft] Failed to sync G4 draft-ready status", {
    review_id: review.id ?? review.review_id ?? review.content_review_id,
    asset_id: review.asset_id ?? null,
    last_error: lastError,
    handled_at: handledAt,
  });

  return null;
};

const isG4ApprovalInFlight = (value: string | null | undefined) => {
  const approvalState = toText(value, "").toUpperCase();

  return (
    approvalState === "APPROVED" ||
    approvalState === "PENDING_HUMAN_APPROVAL" ||
    approvalState === "PENDING_APPROVAL" ||
    approvalState === "READY_FOR_APPROVAL" ||
    approvalState === "REVIEW_REQUESTED" ||
    approvalState === "IN_REVIEW"
  );
};

const updateG12InsightByColumn = async (
  column: "id" | "trend_id" | "insight_id" | "raw_id" | "metric_id" | "asset_id" | "approval_id" | "g4_review_id",
  value: string,
  update: Record<string, unknown>,
) => {
  const { data, error } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .update(update)
    .eq(column, value)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeG12SupabaseInsightRow(data as Record<string, unknown>);
};

const syncG12Insight = async (insight: G12SupabaseInsight, update: Record<string, unknown>) => {
  const candidates: Array<[column: "id" | "trend_id" | "insight_id" | "raw_id" | "metric_id" | "asset_id" | "approval_id" | "g4_review_id", value: string]> = [];
  const rowId = toText(insight.id, "");
  const trendId = toText(insight.trend_id, "");
  const insightId = toText(insight.insight_id, "");
  const rawId = toText(insight.raw_id, "");
  const metricId = toText(insight.metric_id, "");
  const assetId = toText(insight.asset_id, "");
  const approvalId = toText(insight.approval_id, "");
  const g4ReviewId = toText(insight.g4_review_id, "");

  if (rowId) {
    candidates.push(["id", rowId]);
  }
  if (trendId) {
    candidates.push(["trend_id", trendId]);
  }
  if (insightId) {
    candidates.push(["insight_id", insightId]);
  }
  if (rawId) {
    candidates.push(["raw_id", rawId]);
  }
  if (metricId) {
    candidates.push(["metric_id", metricId]);
  }
  if (assetId) {
    candidates.push(["asset_id", assetId]);
  }
  if (approvalId) {
    candidates.push(["approval_id", approvalId]);
  }
  if (g4ReviewId) {
    candidates.push(["g4_review_id", g4ReviewId]);
  }

  let lastError: unknown = null;
  for (const [column, value] of candidates) {
    const updatedInsight = await updateG12InsightByColumn(column, value, update);
    if (updatedInsight) {
      console.info("[g12-send-to-content-draft] approval update response", {
        insight_id: updatedInsight.id,
        trend_id: updatedInsight.trend_id,
        approval_status: updatedInsight.approval_status,
        approval_id: updatedInsight.approval_id,
        g4_review_id: updatedInsight.g4_review_id,
        raw_id: updatedInsight.raw_id,
        metric_id: updatedInsight.metric_id,
        selected_for_review: updatedInsight.selected_for_review,
        wf1_handoff_ready: updatedInsight.wf1_handoff_ready,
        updated_at: updatedInsight.updated_at,
      });
      return true;
    }

    lastError = { column, value };
  }

  console.warn("[g12-send-to-content-draft] Failed to sync insight status", {
    insight_id: insight.id,
    trend_id: insight.trend_id ?? null,
    asset_id: insight.asset_id ?? null,
    last_error: lastError,
    update,
  });

  return false;
};

const buildG4OutcomeMessage = (review: G4ReviewSnapshot, status: G4ReviewSnapshot["status"], alreadySent: boolean) => {
  if (status === "BLOCK") {
    return "Blocked safely.";
  }

  if (status === "NEEDS_EVIDENCE") {
    return review.summary ?? "This content needs evidence before it can continue.";
  }

  if (status === "MANUAL_ONLY") {
    return review.summary ?? "Manual review required.";
  }

  if (review.approval_state === "APPROVED") {
    return alreadySent ? "Draft already exists and is approved." : "Draft created and approved successfully.";
  }

  if (status === "PENDING_APPROVAL" || review.approval_state === "PENDING_HUMAN_APPROVAL") {
    return "Sent to content draft. Human approval is still required before this can be used.";
  }

  return alreadySent ? "Draft already exists and is ready for G4 approval." : "Draft created and is ready for G4 approval.";
};

const buildG4OutcomeSummary = (review: G4ReviewSnapshot, status: G4ReviewSnapshot["status"], alreadySent: boolean) => {
  if (status === "BLOCK" || status === "NEEDS_EVIDENCE" || status === "MANUAL_ONLY") {
    return review.summary;
  }

  if (review.approval_state === "APPROVED") {
    return alreadySent ? "The draft already exists and approval is recorded." : "Human approval has been recorded.";
  }

  if (status === "PENDING_APPROVAL" || review.approval_state === "PENDING_HUMAN_APPROVAL") {
    return null;
  }

  return alreadySent ? "The draft already exists and is ready for G4 approval." : "The draft is ready for G4 approval.";
};

const buildOutcomeResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  status: G4ReviewSnapshot["status"],
  alreadySent: boolean,
): G12SendToContentDraftResult => ({
  httpStatus: 200,
  body: {
    status,
    message: buildG4OutcomeMessage(review, status, alreadySent),
    summary: buildG4OutcomeSummary(review, status, alreadySent),
    action_needed: buildG4ActionNeededCopy(review),
    already_sent: alreadySent,
    g4_detail_href: G12_G4_DETAIL_HREF,
    review_id: review.review_id,
    g4_review_id: review.id,
    approval_id: review.id,
    asset_id: review.asset_id,
    approval_state: review.approval_state,
    safe_rewrite: review.safe_rewrite,
    caption_suggestions: review.caption_suggestions,
    hook_suggestions: review.hook_suggestions,
    content_draft_id: review.review_id,
    approval_status: buildG12ApprovalStatus(review),
    insight_id: insight.id,
    fetch_run_id: insight.fetch_run_id,
    request_id: requestId,
    sent_at: sentAt,
    handled_at: handledAt,
  },
});

const buildPassResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  alreadySent: boolean,
): G12SendToContentDraftResult => buildOutcomeResponse(insight, requestId, sentAt, handledAt, review, "PASS", alreadySent);

const buildBlockedResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  alreadySent = false,
): G12SendToContentDraftResult => buildOutcomeResponse(insight, requestId, sentAt, handledAt, review, "BLOCK", alreadySent);

const buildManualReviewResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  alreadySent = false,
): G12SendToContentDraftResult => buildOutcomeResponse(insight, requestId, sentAt, handledAt, review, "MANUAL_ONLY", alreadySent);

const buildNeedsEvidenceResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  alreadySent = false,
): G12SendToContentDraftResult => buildOutcomeResponse(insight, requestId, sentAt, handledAt, review, "NEEDS_EVIDENCE", alreadySent);

const buildPendingApprovalResponse = (
  insight: G12SupabaseInsight,
  requestId: string,
  sentAt: string,
  handledAt: string,
  review: G4ReviewSnapshot,
  alreadySent = false,
): G12SendToContentDraftResult => buildOutcomeResponse(insight, requestId, sentAt, handledAt, review, "PENDING_APPROVAL", alreadySent);

const buildErrorResponse = (
  status: number,
  message: string,
  insightId: string | null = null,
  fetchRunId: string | null = null,
  actionNeeded: string | null = null,
  summary: string | null = null,
): G12SendToContentDraftResult => {
  const requestId = randomUUID();
  const now = new Date().toISOString();

  return {
    httpStatus: status,
    body: {
      status: "ERROR",
      message,
      summary,
      action_needed: actionNeeded,
      already_sent: false,
      g4_detail_href: G12_G4_DETAIL_HREF,
      review_id: null,
      g4_review_id: null,
      approval_id: null,
      asset_id: null,
      approval_state: null,
      approval_status: null,
      safe_rewrite: null,
      caption_suggestions: [],
      hook_suggestions: [],
      content_draft_id: null,
      insight_id: insightId,
      fetch_run_id: fetchRunId,
      request_id: requestId,
      sent_at: now,
      handled_at: now,
    },
  };
};

export async function sendG12TrendToContentDraft(
  input: G12SendToContentDraftInput,
): Promise<G12SendToContentDraftResult> {
  const insightId = toText(input.insight_id, "");
  const trendId = toText(input.trend_id, "");
  const assetId = toText(input.asset_id, "");
  const approvalId = toText(input.approval_id, "");
  const g4ReviewId = toText(input.g4_review_id, "");
  const fetchRunId = toText(input.fetch_run_id, "");

  if (!insightId && !trendId && !assetId && !approvalId && !g4ReviewId && !fetchRunId) {
    return buildErrorResponse(400, G12_MISSING_REQUEST_MESSAGE);
  }

  const insight = await loadG12Insight({
    insight_id: insightId || null,
    trend_id: trendId || null,
    asset_id: assetId || null,
    approval_id: approvalId || null,
    g4_review_id: g4ReviewId || null,
    fetch_run_id: fetchRunId || null,
  });
  if (!insight) {
    return buildErrorResponse(404, G12_MISSING_INSIGHT_MESSAGE, insightId || null, fetchRunId || null);
  }

  const payload = buildSafePayload(insight);
  const idempotencyKey = toText(payload.idempotency_key, "");
  const requestId = randomUUID();
  const reviewIds = [g4ReviewId, approvalId, insight.g4_review_id, insight.approval_id, insight.asset_id];

  console.info("[g12-send-to-content-draft] request payload sent to draft API", {
    request_id: requestId,
    insight_id: insight.id,
    trend_id: insight.trend_id ?? null,
    asset_id: payload.asset_id,
    fetch_run_id: insight.fetch_run_id,
    idempotency_key: idempotencyKey,
    payload,
  });

  const preExistingReview = await loadG4ReviewFromSources({
    idempotencyKey,
    assetId: payload.asset_id,
    reviewIds,
  });

  if (preExistingReview) {
    const handledAt = toText(preExistingReview.reviewed_at ?? preExistingReview.created_at, new Date().toISOString());
    const preExistingSnapshot = buildG4ReviewSnapshot(preExistingReview);

    if (preExistingSnapshot.status === "BLOCK") {
      await syncG12Insight(insight, buildUpdateFields(preExistingSnapshot, handledAt));
      return buildBlockedResponse(insight, requestId, handledAt, handledAt, preExistingSnapshot, true);
    }

    if (preExistingSnapshot.status === "MANUAL_ONLY") {
      await syncG12Insight(insight, buildUpdateFields(preExistingSnapshot, handledAt));
      return buildManualReviewResponse(insight, requestId, handledAt, handledAt, preExistingSnapshot, true);
    }

    if (preExistingSnapshot.status === "NEEDS_EVIDENCE") {
      await syncG12Insight(insight, buildUpdateFields(preExistingSnapshot, handledAt));
      return buildNeedsEvidenceResponse(insight, requestId, handledAt, handledAt, preExistingSnapshot, true);
    }

      const approvedReview = isG4ApprovalInFlight(preExistingSnapshot.approval_state)
        ? preExistingReview
        : (await syncG4ReviewReadyForApproval(preExistingReview, handledAt) ?? preExistingReview);
    const approvedSnapshot = buildG4ReviewSnapshot(approvedReview, approvedReview.review_id ?? approvedReview.content_review_id ?? approvedReview.id);
    const approvalHandledAt = toText(approvedReview.reviewed_at ?? approvedReview.created_at, handledAt);
    await syncG12Insight(insight, buildUpdateFields(approvedSnapshot, approvalHandledAt));
    return buildPassResponse(insight, requestId, approvalHandledAt, approvalHandledAt, approvedSnapshot, true);
  }

  const existingReview = await loadExistingG4Review(idempotencyKey, payload.asset_id);
  if (existingReview) {
    const handledAt = toText(existingReview.reviewed_at ?? existingReview.created_at, new Date().toISOString());
    const existingReviewSnapshot = buildG4ReviewSnapshot(existingReview);

    if (existingReviewSnapshot.status === "BLOCK") {
      await syncG12Insight(insight, buildUpdateFields(existingReviewSnapshot, handledAt));
      return buildBlockedResponse(insight, requestId, handledAt, handledAt, existingReviewSnapshot, true);
    }

    if (existingReviewSnapshot.status === "MANUAL_ONLY") {
      await syncG12Insight(insight, buildUpdateFields(existingReviewSnapshot, handledAt));
      return buildManualReviewResponse(insight, requestId, handledAt, handledAt, existingReviewSnapshot, true);
    }

    if (existingReviewSnapshot.status === "NEEDS_EVIDENCE") {
      await syncG12Insight(insight, buildUpdateFields(existingReviewSnapshot, handledAt));
      return buildNeedsEvidenceResponse(insight, requestId, handledAt, handledAt, existingReviewSnapshot, true);
    }

    const approvedReview = isG4ApprovalInFlight(existingReviewSnapshot.approval_state)
      ? existingReview
      : (await syncG4ReviewReadyForApproval(existingReview, handledAt) ?? existingReview);
    const approvedSnapshot = buildG4ReviewSnapshot(approvedReview, approvedReview.review_id ?? approvedReview.content_review_id ?? approvedReview.id);
    const approvalHandledAt = toText(approvedReview.reviewed_at ?? approvedReview.created_at, handledAt);
    await syncG12Insight(insight, buildUpdateFields(approvedSnapshot, approvalHandledAt));
    return buildPassResponse(insight, requestId, approvalHandledAt, approvalHandledAt, approvedSnapshot, true);
  }

  const sentAt = new Date().toISOString();
  const webhookResponse = await postN8nWebhook({
    path: env.n8nG4ContentCheckPath,
    requestId,
    payload,
  });

  console.info("[g12-send-to-content-draft] draft creation response", {
    request_id: webhookResponse.request_id,
    status: webhookResponse.status,
    message: webhookResponse.message,
    response_type: webhookResponse.response_type ?? null,
    review_id: webhookResponse.review_id ?? null,
    content_review_id: webhookResponse.content_review_id ?? null,
    draft_id: webhookResponse.draft_id ?? null,
    content_draft_id: webhookResponse.content_draft_id ?? null,
    handled_at: webhookResponse.handled_at ?? null,
    http_status: webhookResponse.http_status ?? null,
  });

  const webhookReviewId = firstText(
    webhookResponse.review_id,
    webhookResponse.content_review_id,
    webhookResponse.draft_id,
    webhookResponse.content_draft_id,
    webhookResponse.id,
    webhookResponse.event_id,
  );

  const webhookReview = await waitForG4Review({
    idempotencyKey,
    assetId: payload.asset_id,
    reviewIds: [webhookReviewId, g4ReviewId, approvalId, insight.g4_review_id, insight.approval_id],
  });

  if (webhookResponse.status === "ERROR") {
    console.warn("[g12-send-to-content-draft] first draft request failed", {
      request_id: webhookResponse.request_id,
      insight_id: insight.id,
      asset_id: payload.asset_id,
      fetch_run_id: insight.fetch_run_id,
      idempotency_key: idempotencyKey,
      failure_reason: webhookResponse.message,
      http_status: webhookResponse.http_status ?? null,
      response_text: webhookResponse.response_text ?? null,
      fail_reason: webhookResponse.fail_reason ?? null,
      failure_reasons: webhookResponse.failure_reasons ?? null,
    });

    if (webhookReview) {
      const recoveredHandledAt = toText(webhookReview.reviewed_at ?? webhookReview.created_at, sentAt);
      const recoveredSnapshot = buildG4ReviewSnapshot(webhookReview, webhookReviewId);
      if (recoveredSnapshot.status === "BLOCK") {
        await syncG12Insight(insight, buildUpdateFields(recoveredSnapshot, recoveredHandledAt));
        return buildBlockedResponse(insight, webhookResponse.request_id, sentAt, recoveredHandledAt, recoveredSnapshot, false);
      }

      if (recoveredSnapshot.status === "MANUAL_ONLY") {
        await syncG12Insight(insight, buildUpdateFields(recoveredSnapshot, recoveredHandledAt));
        return buildManualReviewResponse(insight, webhookResponse.request_id, sentAt, recoveredHandledAt, recoveredSnapshot, false);
      }

      if (recoveredSnapshot.status === "NEEDS_EVIDENCE") {
        await syncG12Insight(insight, buildUpdateFields(recoveredSnapshot, recoveredHandledAt));
        return buildNeedsEvidenceResponse(insight, webhookResponse.request_id, sentAt, recoveredHandledAt, recoveredSnapshot, false);
      }

      const readyReview = (await syncG4ReviewReadyForApproval(webhookReview, recoveredHandledAt)) ?? webhookReview;
      const readySnapshot = buildG4ReviewSnapshot(readyReview, readyReview.review_id ?? readyReview.content_review_id ?? readyReview.id);
      const approvalHandledAt = toText(readyReview.reviewed_at ?? readyReview.created_at, recoveredHandledAt);
      await syncG12Insight(insight, buildUpdateFields(readySnapshot, approvalHandledAt));
      return buildPassResponse(insight, webhookResponse.request_id, sentAt, approvalHandledAt, readySnapshot, false);
    }

    if (isConnectedWebhookIssue(webhookResponse)) {
      return buildErrorResponse(503, G4_NOT_CONNECTED_MESSAGE, insight.id, insight.fetch_run_id, G4_NOT_CONNECTED_ACTION, "No registered G4 endpoint was available.");
    }

    return buildErrorResponse(
      500,
      webhookResponse.message || G12_GENERIC_FAILURE_MESSAGE,
      insight.id,
      insight.fetch_run_id,
      null,
      webhookResponse.response_text ? humanizeReasonText(webhookResponse.response_text) ?? webhookResponse.response_text : null,
    );
  }

  if (!webhookReview) {
    return buildErrorResponse(
      500,
      "The draft was created, but the review row was not available yet.",
      insight.id,
      insight.fetch_run_id,
      null,
      "The workflow response did not include a readable review identifier.",
    );
  }

  const handledAt = toText(webhookReview.reviewed_at ?? webhookReview.created_at ?? webhookResponse.handled_at, sentAt);
  const webhookReviewSnapshot = buildG4ReviewSnapshot(webhookReview, webhookReviewId);

  if (webhookResponse.status === "BLOCK") {
    await syncG12Insight(insight, buildUpdateFields(webhookReviewSnapshot, handledAt));
    return buildBlockedResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReviewSnapshot, false);
  }

  if (webhookResponse.status === "MANUAL_ONLY") {
    await syncG12Insight(insight, buildUpdateFields(webhookReviewSnapshot, handledAt));
    return buildManualReviewResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReviewSnapshot, false);
  }

  if (webhookResponse.status === "NEEDS_EVIDENCE") {
    await syncG12Insight(insight, buildUpdateFields(webhookReviewSnapshot, handledAt));
    return buildNeedsEvidenceResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReviewSnapshot, false);
  }

  const readyReview = (await syncG4ReviewReadyForApproval(webhookReview, handledAt)) ?? webhookReview;
  const readySnapshot = buildG4ReviewSnapshot(readyReview, readyReview.review_id ?? readyReview.content_review_id ?? readyReview.id);
  const approvalHandledAt = toText(readyReview.reviewed_at ?? readyReview.created_at, handledAt);
  await syncG12Insight(insight, buildUpdateFields(readySnapshot, approvalHandledAt));
  return buildPassResponse(insight, webhookResponse.request_id, sentAt, approvalHandledAt, readySnapshot, false);
}

export const g12ContentDraftConnectedMessage = G4_NOT_CONNECTED_MESSAGE;
export const g12ContentDraftConnectedAction = G4_NOT_CONNECTED_ACTION;
export const g12ContentDraftMissingInsightMessage = G12_MISSING_INSIGHT_MESSAGE;
