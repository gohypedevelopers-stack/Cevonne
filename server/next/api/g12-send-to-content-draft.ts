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
  fetch_run_id?: string | null;
};

export type G12SendToContentDraftResponse = {
  status: N8nWebhookStatus;
  message: string;
  summary: string | null;
  action_needed: string | null;
  already_sent: boolean;
  g4_detail_href: string;
  review_id: string | null;
  g4_review_id: string | null;
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
  failure_reasons?: unknown;
  safe_summary?: string | null;
  raw_payload?: unknown;
  source_event?: string | null;
};

type G4ReviewSnapshot = {
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
  const reviewId = firstText(readRecordText(row, ["review_id", "content_review_id"]), fallbackReviewId);
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

const buildUpdateFields = (
  insight: G12SupabaseInsight,
  finalStatus: "PASS" | "MANUAL_ONLY" | "BLOCK" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE",
  g4ReviewId: string | null,
  handledAt: string,
) => {
  const approvalStatus =
    finalStatus === "PASS" || finalStatus === "PENDING_APPROVAL"
      ? "DRAFT_CREATED"
      : finalStatus === "MANUAL_ONLY"
        ? "REVIEW_REQUESTED"
        : finalStatus === "NEEDS_EVIDENCE"
          ? "NEEDS_EVIDENCE"
          : "G4_BLOCKED";

  return {
    g4_review_id: g4ReviewId ?? insight.g4_review_id,
    approval_status: approvalStatus,
    updated_at: handledAt,
  };
};

const loadInsightById = async (insightId: string, fetchRunId: string | null): Promise<G12SupabaseInsight | null | "MISMATCH"> => {
  const { data, error } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .select("*")
    .eq("id", insightId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const insight = normalizeG12SupabaseInsightRow(data as Record<string, unknown>);
  if (!insight) {
    return null;
  }

  if (fetchRunId && insight.fetch_run_id && insight.fetch_run_id !== fetchRunId) {
    return "MISMATCH";
  }

  return insight;
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
  const fetchRunId = toText(input.fetch_run_id, "");

  if (!insightId && !fetchRunId) {
    return null;
  }

  if (insightId) {
    const insight = await loadInsightById(insightId, fetchRunId || null);
    if (insight === "MISMATCH") {
      return null;
    }

    if (insight) {
      return insight;
    }
  }

  if (fetchRunId) {
    return loadInsightByFetchRunId(fetchRunId);
  }

  return null;
};

const loadExistingG4Review = async (idempotencyKey: string) => {
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

const loadG4ReviewByReviewId = async (reviewId: string) => {
  const query = supabaseAdmin.from(G4_CONTENT_REVIEW_TABLE).select(buildG4ReviewSelect).order("created_at", {
    ascending: false,
    nullsFirst: false,
  });

  const byReviewId = await query.eq("review_id", reviewId).maybeSingle();
  if (!byReviewId.error && byReviewId.data && isRecord(byReviewId.data)) {
    return byReviewId.data as G4ContentReviewRow;
  }

  const byContentReviewId = await supabaseAdmin
    .from(G4_CONTENT_REVIEW_TABLE)
    .select(buildG4ReviewSelect)
    .order("created_at", { ascending: false, nullsFirst: false })
    .eq("content_review_id", reviewId)
    .maybeSingle();

  if (!byContentReviewId.error && byContentReviewId.data && isRecord(byContentReviewId.data)) {
    return byContentReviewId.data as G4ContentReviewRow;
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

const getG12UpdateStatus = (status: G4ReviewSnapshot["status"]): "PASS" | "MANUAL_ONLY" | "BLOCK" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE" => {
  if (status === "BLOCK") {
    return "BLOCK";
  }

  if (status === "MANUAL_ONLY") {
    return "MANUAL_ONLY";
  }

  if (status === "NEEDS_EVIDENCE") {
    return "NEEDS_EVIDENCE";
  }

  if (status === "PENDING_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  return "PASS";
};

const syncG12Insight = async (insight: G12SupabaseInsight, update: Record<string, unknown>) => {
  const { error } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .update(update)
    .eq("id", insight.id);

  if (error) {
    return false;
  }

  return true;
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

  if (status === "PENDING_APPROVAL" || review.approval_state === "PENDING_HUMAN_APPROVAL") {
    return "Content check passed. Human approval is still required before this can be used.";
  }

  return alreadySent ? "Content draft/check already exists in G4." : "Content draft/check created in G4.";
};

const buildG4OutcomeSummary = (review: G4ReviewSnapshot, status: G4ReviewSnapshot["status"], alreadySent: boolean) => {
  if (status === "BLOCK" || status === "NEEDS_EVIDENCE" || status === "MANUAL_ONLY") {
    return review.summary;
  }

  if (status === "PENDING_APPROVAL" || review.approval_state === "PENDING_HUMAN_APPROVAL") {
    return null;
  }

  return alreadySent ? "The insight already has a G4 review record." : null;
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
    g4_review_id: review.review_id,
    asset_id: review.asset_id,
    approval_state: review.approval_state,
    safe_rewrite: review.safe_rewrite,
    caption_suggestions: review.caption_suggestions,
    hook_suggestions: review.hook_suggestions,
    content_draft_id: review.review_id,
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
      asset_id: null,
      approval_state: null,
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
  const fetchRunId = toText(input.fetch_run_id, "");

  if (!insightId && !fetchRunId) {
    return buildErrorResponse(400, G12_MISSING_REQUEST_MESSAGE);
  }

  const insight = await loadG12Insight({ insight_id: insightId || null, fetch_run_id: fetchRunId || null });
  if (!insight) {
    return buildErrorResponse(404, G12_MISSING_INSIGHT_MESSAGE, insightId || null, fetchRunId || null);
  }

  const payload = buildSafePayload(insight);
  const idempotencyKey = toText(payload.idempotency_key, "");
  const localReviewId = firstText(insight.g4_review_id);

  if (isLocalSendMarker(insight)) {
    const now = new Date().toISOString();
    const localReviewRow = localReviewId ? await loadG4ReviewByReviewId(localReviewId) : await loadExistingG4Review(idempotencyKey);
    const localReview = buildG4ReviewSnapshot(localReviewRow, localReviewId);
    await syncG12Insight(insight, buildUpdateFields(insight, getG12UpdateStatus(localReview.status), localReview.review_id, now));
    if (localReview.status === "BLOCK") {
      return buildBlockedResponse(insight, randomUUID(), now, now, localReview, true);
    }
    if (localReview.status === "MANUAL_ONLY") {
      return buildManualReviewResponse(insight, randomUUID(), now, now, localReview, true);
    }
    if (localReview.status === "NEEDS_EVIDENCE") {
      return buildNeedsEvidenceResponse(insight, randomUUID(), now, now, localReview, true);
    }
    if (localReview.status === "PENDING_APPROVAL") {
      return buildPendingApprovalResponse(insight, randomUUID(), now, now, localReview, true);
    }
    return buildPassResponse(insight, randomUUID(), now, now, localReview, true);
  }

  const existingReview = await loadExistingG4Review(idempotencyKey);
  if (existingReview) {
    const existingReviewSnapshot = buildG4ReviewSnapshot(existingReview);
    const handledAt = toText(existingReview.created_at, new Date().toISOString());
    const now = new Date().toISOString();

    await syncG12Insight(
      insight,
      buildUpdateFields(insight, getG12UpdateStatus(existingReviewSnapshot.status), existingReviewSnapshot.review_id, now),
    );

    if (existingReviewSnapshot.status === "BLOCK") {
      return buildBlockedResponse(insight, randomUUID(), now, handledAt, existingReviewSnapshot, true);
    }

    if (existingReviewSnapshot.status === "MANUAL_ONLY") {
      return buildManualReviewResponse(insight, randomUUID(), now, handledAt, existingReviewSnapshot, true);
    }

    if (existingReviewSnapshot.status === "NEEDS_EVIDENCE") {
      return buildNeedsEvidenceResponse(insight, randomUUID(), now, handledAt, existingReviewSnapshot, true);
    }

    if (existingReviewSnapshot.status === "PENDING_APPROVAL") {
      return buildPendingApprovalResponse(insight, randomUUID(), now, handledAt, existingReviewSnapshot, true);
    }

    return buildPassResponse(insight, randomUUID(), now, handledAt, existingReviewSnapshot, true);
  }

  const sentAt = new Date().toISOString();
  const webhookResponse = await postN8nWebhook({
    path: env.n8nG4ContentCheckPath,
    payload,
  });

  const webhookReviewId = firstText(
    webhookResponse.review_id,
    webhookResponse.content_review_id,
    webhookResponse.draft_id,
    webhookResponse.content_draft_id,
    webhookResponse.id,
    webhookResponse.event_id,
  );

  if (webhookResponse.status === "ERROR") {
    if (isConnectedWebhookIssue(webhookResponse)) {
      return buildErrorResponse(503, G4_NOT_CONNECTED_MESSAGE, insight.id, insight.fetch_run_id, G4_NOT_CONNECTED_ACTION, "No registered G4 endpoint was available.");
    }

    return buildErrorResponse(500, G12_GENERIC_FAILURE_MESSAGE, insight.id, insight.fetch_run_id);
  }

  const handledAt = toText(webhookResponse.handled_at, sentAt);
  const webhookReviewRow = webhookReviewId ? await loadG4ReviewByReviewId(webhookReviewId) : null;
  const webhookReview = buildG4ReviewSnapshot(webhookReviewRow, webhookReviewId);

  if (webhookResponse.status === "BLOCK") {
    await syncG12Insight(insight, buildUpdateFields(insight, "BLOCK", webhookReview.review_id, handledAt));
    return buildBlockedResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReview, false);
  }

  if (webhookResponse.status === "MANUAL_ONLY") {
    await syncG12Insight(insight, buildUpdateFields(insight, "MANUAL_ONLY", webhookReview.review_id, handledAt));
    return buildManualReviewResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReview, false);
  }

  if (webhookResponse.status === "NEEDS_EVIDENCE") {
    await syncG12Insight(insight, buildUpdateFields(insight, "NEEDS_EVIDENCE", webhookReview.review_id, handledAt));
    return buildNeedsEvidenceResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReview, false);
  }

  if (webhookResponse.status === "PENDING_APPROVAL") {
    await syncG12Insight(insight, buildUpdateFields(insight, "PENDING_APPROVAL", webhookReview.review_id, handledAt));
    return buildPendingApprovalResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReview, false);
  }

  await syncG12Insight(insight, buildUpdateFields(insight, getG12UpdateStatus(webhookReview.status), webhookReview.review_id, handledAt));
  return buildPassResponse(insight, webhookResponse.request_id, sentAt, handledAt, webhookReview, false);
}

export const g12ContentDraftConnectedMessage = G4_NOT_CONNECTED_MESSAGE;
export const g12ContentDraftConnectedAction = G4_NOT_CONNECTED_ACTION;
export const g12ContentDraftMissingInsightMessage = G12_MISSING_INSIGHT_MESSAGE;
