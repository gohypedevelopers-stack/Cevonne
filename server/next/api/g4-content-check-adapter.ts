import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  extractG4ContentPreview,
  getG4ActionNeeded,
  mapG4Status,
  normalizeG4StringArray,
  normalizeG4Text,
  normalizeG4Timestamp,
  summarizeG4Outcome,
  type G4ContentPreview,
  type G4ApprovalRequest,
  type G4ContentReviewRecord,
  type G4WorkflowDetail,
} from "@/lib/admin/g4-content-review";
import {
  getCevonneAdminApprovalBySource,
  queueCevonneAdminApprovalRequest,
} from "@/server/next/api/cevonne-admin-store";
import { G12_SUPABASE_TABLES } from "@/server/next/api/g12-trend-fetcher-supabase";

const G4_SELECT_COLUMNS = `
  created_at,
  content_review_id,
  review_id,
  workflow_group,
  workflow_id,
  action_type,
  platform,
  asset_id,
  asset_type,
  status,
  approval_state,
  failure_reasons,
  safe_summary,
  ai_used,
  ai_risk_summary,
  ai_safe_rewrite,
  ai_caption_suggestions,
  ai_hook_suggestions,
  ai_claim_notes,
  ai_human_review_recommendation,
  claim_ids_checked,
  landing_page_match_status,
  requires_human_approval,
  raw_payload
` as const;

const G4_WORKFLOW_TITLE = "G4 Content / Landing / Claim Check" as const;
const G4_WORKFLOW_PURPOSE =
  "Checks captions, claims, landing-page wording, and risky language before content moves forward." as const;
const G4_EMPTY_ACTION = "Check content to see the latest result." as const;
const G4_ERROR_ACTION = "Unable to load content checks right now." as const;

type G4Row = G4ContentReviewRecord & Record<string, unknown>;
type JsonRecord = Record<string, unknown>;
type G4SourcePreview = Pick<
  G4ContentPreview,
  "captionPreview" | "profileUsername" | "audioSound" | "views" | "likes" | "comments" | "shares" | "trendStrength" | "brandFitScore" | "riskScore" | "sourceUrl"
>;

const asG4Row = (row: Record<string, unknown>): G4Row => row as G4Row;

const asJsonRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
};

const readJsonRecordText = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = normalizeG4Text(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readG4RawPayloadText = (row: Pick<G4ContentReviewRecord, "raw_payload"> | null | undefined, keys: string[]) => {
  const payload = asJsonRecord(row?.raw_payload);
  const nestedPayload = asJsonRecord(payload?.raw_payload);

  return readJsonRecordText(payload, keys) ?? readJsonRecordText(nestedPayload, keys);
};

const getG4SourceTrendId = (row: Pick<G4ContentReviewRecord, "raw_payload"> | null | undefined) =>
  readG4RawPayloadText(row, ["source_trend_id", "sourceTrendId", "trend_id", "trendId"]);

const mergeG4ContentPreview = (base: G4ContentPreview, sourcePreview: Partial<G4SourcePreview> | null): G4ContentPreview => {
  if (!sourcePreview) {
    return base;
  }

  return {
    ...base,
    captionPreview: sourcePreview.captionPreview ?? base.captionPreview,
    profileUsername: sourcePreview.profileUsername ?? base.profileUsername,
    audioSound: sourcePreview.audioSound ?? base.audioSound,
    views: sourcePreview.views ?? base.views,
    likes: sourcePreview.likes ?? base.likes,
    comments: sourcePreview.comments ?? base.comments,
    shares: sourcePreview.shares ?? base.shares,
    trendStrength: sourcePreview.trendStrength ?? base.trendStrength,
    brandFitScore: sourcePreview.brandFitScore ?? base.brandFitScore,
    riskScore: sourcePreview.riskScore ?? base.riskScore,
    sourceUrl: sourcePreview.sourceUrl ?? base.sourceUrl,
  };
};

const loadG4SourcePreviewMap = async (rows: G4Row[]) => {
  const sourceTrendIds = [...new Set(rows.map((row) => getG4SourceTrendId(row)).filter((value): value is string => Boolean(value)))];
  const previewByTrendId = new Map<string, G4SourcePreview>();

  if (!sourceTrendIds.length) {
    return previewByTrendId;
  }

  const { data: insightRows, error: insightError } = await supabaseAdmin
    .from(G12_SUPABASE_TABLES.insights)
    .select("trend_id, metric_id, trend_strength, brand_fit_score, risk_score")
    .in("trend_id", sourceTrendIds);

  if (insightError) {
    console.warn("[g4-content-check-adapter] Failed to load G12 insight rows for source previews", insightError);
    return previewByTrendId;
  }

  const insightRecords = (Array.isArray(insightRows) ? insightRows : [])
    .map((row) => asJsonRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  const insightByTrendId = new Map<string, JsonRecord>();
  const metricIds = new Set<string>();
  for (const record of insightRecords) {
    const trendId = readJsonRecordText(record, ["trend_id"]);
    if (!trendId) {
      continue;
    }

    insightByTrendId.set(trendId, record);
    const metricId = readJsonRecordText(record, ["metric_id"]);
    if (metricId) {
      metricIds.add(metricId);
    }
  }

  const metricByMetricId = new Map<string, JsonRecord>();
  if (metricIds.size) {
    const { data: metricRows, error: metricError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.metrics)
      .select("metric_id, raw_id, profile_username, profile_public_link, content_url, audio_sound, views, likes, comments_count, shares")
      .in("metric_id", [...metricIds]);

    if (metricError) {
      console.warn("[g4-content-check-adapter] Failed to load G12 metric rows for source previews", metricError);
    } else {
      for (const record of (Array.isArray(metricRows) ? metricRows : []).map((row) => asJsonRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const metricId = readJsonRecordText(record, ["metric_id"]);
        if (metricId) {
          metricByMetricId.set(metricId, record);
        }
      }
    }
  }

  const rawIds = new Set<string>();
  for (const record of metricByMetricId.values()) {
    const rawId = readJsonRecordText(record, ["raw_id"]);
    if (rawId) {
      rawIds.add(rawId);
    }
  }

  const rawByRawId = new Map<string, JsonRecord>();
  if (rawIds.size) {
    const { data: rawRows, error: rawError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.rawScrapeQuarantine)
      .select("raw_id, caption_excerpt, profile_username, profile_public_link, content_url, audio_sound, views, likes, comments_count, shares")
      .in("raw_id", [...rawIds]);

    if (rawError) {
      console.warn("[g4-content-check-adapter] Failed to load G12 raw scrape rows for source previews", rawError);
    } else {
      for (const record of (Array.isArray(rawRows) ? rawRows : []).map((row) => asJsonRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const rawId = readJsonRecordText(record, ["raw_id"]);
        if (rawId) {
          rawByRawId.set(rawId, record);
        }
      }
    }
  }

  for (const sourceTrendId of sourceTrendIds) {
    const insight = insightByTrendId.get(sourceTrendId) ?? null;
    const metricId = readJsonRecordText(insight, ["metric_id"]);
    const metric = metricId ? metricByMetricId.get(metricId) ?? null : null;
    const rawId = readJsonRecordText(metric, ["raw_id"]);
    const rawScrape = rawId ? rawByRawId.get(rawId) ?? null : null;

    previewByTrendId.set(sourceTrendId, {
      captionPreview: readJsonRecordText(rawScrape, ["caption_excerpt", "captionPreview", "caption"]),
      profileUsername:
        readJsonRecordText(rawScrape, ["profile_username", "profileUsername", "username", "handle"]) ??
        readJsonRecordText(metric, ["profile_username", "profileUsername", "username", "handle"]),
      audioSound: readJsonRecordText(metric, ["audio_sound", "audioSound", "sound", "music"]) ?? readJsonRecordText(rawScrape, ["audio_sound", "audioSound", "sound", "music"]),
      views: readJsonRecordText(rawScrape, ["views"]) ?? readJsonRecordText(metric, ["views"]),
      likes: readJsonRecordText(rawScrape, ["likes"]) ?? readJsonRecordText(metric, ["likes"]),
      comments: readJsonRecordText(rawScrape, ["comments_count", "commentsCount", "comments"]) ?? readJsonRecordText(metric, ["comments_count", "commentsCount", "comments"]),
      shares: readJsonRecordText(rawScrape, ["shares"]) ?? readJsonRecordText(metric, ["shares"]),
      trendStrength: readJsonRecordText(insight, ["trend_strength", "trendStrength"]),
      brandFitScore: readJsonRecordText(insight, ["brand_fit_score", "brandFitScore"]),
      riskScore: readJsonRecordText(insight, ["risk_score", "riskScore"]),
      sourceUrl:
        readJsonRecordText(rawScrape, ["content_url", "contentUrl", "source_url", "sourceUrl", "profile_public_link", "profilePublicLink", "url"]) ??
        readJsonRecordText(metric, ["content_url", "contentUrl", "profile_public_link", "profilePublicLink"]),
    });
  }

  return previewByTrendId;
};

const getG4ApprovalSourceId = (row: Pick<G4ContentReviewRecord, "review_id" | "content_review_id" | "asset_id">) =>
  normalizeG4Text(row.review_id) ?? normalizeG4Text(row.content_review_id) ?? normalizeG4Text(row.asset_id);

const buildG4LatestOutcome = (row: G4Row): G4WorkflowDetail["latestOutcome"] => ({
  result: mapG4Status(row),
  reviewId: normalizeG4Text(row.review_id) ?? normalizeG4Text(row.content_review_id),
  assetId: normalizeG4Text(row.asset_id),
  platform: normalizeG4Text(row.platform),
  approvalState: normalizeG4Text(row.approval_state),
  summary: summarizeG4Outcome(row),
  riskSummary: normalizeG4Text(row.ai_risk_summary),
  failureReasons: normalizeG4StringArray(row.failure_reasons),
  landingPageStatus: normalizeG4Text(row.landing_page_match_status),
  handledAt: normalizeG4Timestamp(row.created_at),
});

const buildG4RecentOutcome = (row: G4Row, sourcePreview?: Partial<G4SourcePreview> | null): G4WorkflowDetail["recentOutcomes"][number] | null => {
  const time = normalizeG4Timestamp(row.created_at);
  if (!time) {
    return null;
  }

  const result = mapG4Status(row);
  const cleanAiOutput = buildG4CleanAiOutput(row);
  const contentPreview = mergeG4ContentPreview(extractG4ContentPreview(row), sourcePreview ?? null);

  return {
    time,
    result,
    reviewId: normalizeG4Text(row.review_id) ?? normalizeG4Text(row.content_review_id),
    assetId: normalizeG4Text(row.asset_id),
    platform: normalizeG4Text(row.platform),
    approvalState: normalizeG4Text(row.approval_state),
    contentPreview,
    whatHappened: summarizeG4Outcome(row),
    actionNeeded: getG4ActionNeeded(row),
    cleanAiOutput,
    approvalRequest: buildG4ApprovalRequest(row),
  };
};

const buildG4CleanAiOutput = (row: G4Row): G4WorkflowDetail["cleanAiOutput"] => {
  const hasVisibleAiOutput =
    Boolean(normalizeG4Text(row.ai_safe_rewrite)) ||
    normalizeG4StringArray(row.ai_caption_suggestions).length > 0 ||
    normalizeG4StringArray(row.ai_hook_suggestions).length > 0 ||
    normalizeG4StringArray(row.ai_claim_notes).length > 0 ||
    Boolean(normalizeG4Text(row.ai_risk_summary)) ||
    Boolean(normalizeG4Text(row.ai_human_review_recommendation));

  if (!hasVisibleAiOutput) {
    return null;
  }

  return {
    riskSummary: normalizeG4Text(row.ai_risk_summary),
    safeRewrite: normalizeG4Text(row.ai_safe_rewrite),
    captionSuggestions: normalizeG4StringArray(row.ai_caption_suggestions).map((entry) => normalizeG4Text(entry) ?? entry),
    hookSuggestions: normalizeG4StringArray(row.ai_hook_suggestions).map((entry) => normalizeG4Text(entry) ?? entry),
    claimNotes: normalizeG4StringArray(row.ai_claim_notes).map((entry) => normalizeG4Text(entry) ?? entry),
    humanReviewRecommendation: normalizeG4Text(row.ai_human_review_recommendation),
    aiIsFinalApproval: false,
  };
};

const buildG4ApprovalRequest = (row: G4Row): G4ApprovalRequest | null => {
  const sourceId = getG4ApprovalSourceId(row);
  const approval = getCevonneAdminApprovalBySource({
    workflowGroup: "G4",
    sourceId,
  });

  if (!approval) {
    return null;
  }

  return {
    approvalId: approval.approvalId,
    status: approval.status,
    createdAt: approval.createdAt,
    requestedBy: approval.requestedBy,
    reviewerAction: approval.reviewerAction ?? null,
  };
};

const findG4ApprovalTarget = (detail: G4WorkflowDetail, sourceId?: string | null) => {
  const normalizedSourceId = sourceId?.trim() || null;
  if (normalizedSourceId) {
    const matchedRow = detail.recentOutcomes.find((row) => row.reviewId === normalizedSourceId || row.assetId === normalizedSourceId);
    return matchedRow ? { row: matchedRow, sourceId: normalizedSourceId } : null;
  }

  const latestRow = detail.recentOutcomes[0];
  if (!latestRow) {
    return null;
  }

  return {
    row: latestRow,
    sourceId: latestRow.reviewId ?? latestRow.assetId ?? null,
  };
};

const buildEmptyDetail = (status: G4WorkflowDetail["status"], actionNeeded: string): G4WorkflowDetail => ({
  workflowGroup: "G4",
  title: G4_WORKFLOW_TITLE,
  purpose: G4_WORKFLOW_PURPOSE,
  status,
  lastRunAt: null,
  latestOutcome: null,
  contentPreview: extractG4ContentPreview(null),
  actionNeeded,
  cleanAiOutput: null,
  approvalRequest: null,
  recentOutcomes: [],
});

export async function getG4WorkflowDetail(): Promise<G4WorkflowDetail> {
  const { data, error } = await supabaseAdmin
    .from("g4_content_reviews")
    .select(G4_SELECT_COLUMNS)
    .eq("workflow_group", "G4")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return buildEmptyDetail("ERROR", G4_ERROR_ACTION);
  }

  const rows = Array.isArray(data) ? data.map((row) => asG4Row(row as Record<string, unknown>)) : [];
  if (!rows.length) {
    return buildEmptyDetail("MANUAL_ONLY", G4_EMPTY_ACTION);
  }

  const latest = rows[0];
  const sourcePreviewByTrendId = await loadG4SourcePreviewMap(rows);
  const latestSourcePreview = sourcePreviewByTrendId.get(getG4SourceTrendId(latest) ?? "") ?? null;
  const recentOutcomes = rows
    .map((row) => buildG4RecentOutcome(row, sourcePreviewByTrendId.get(getG4SourceTrendId(row) ?? "") ?? null))
    .filter((value): value is NonNullable<ReturnType<typeof buildG4RecentOutcome>> => Boolean(value));

  return {
    workflowGroup: "G4",
    title: G4_WORKFLOW_TITLE,
    purpose: G4_WORKFLOW_PURPOSE,
    status: mapG4Status(latest),
    lastRunAt: normalizeG4Timestamp(latest.created_at),
    latestOutcome: buildG4LatestOutcome(latest),
    contentPreview: mergeG4ContentPreview(extractG4ContentPreview(latest), latestSourcePreview),
    actionNeeded: getG4ActionNeeded(latest),
    cleanAiOutput: buildG4CleanAiOutput(latest),
    approvalRequest: buildG4ApprovalRequest(latest),
    recentOutcomes,
  };
}

export async function queueG4ApprovalRequest(input: {
  adminUserId: string;
  adminEmail: string | null;
  sourceId?: string | null;
  ipUserAgentHash?: string | null;
}) {
  const detail = await getG4WorkflowDetail();
  const target = findG4ApprovalTarget(detail, input.sourceId);
  if (!target) {
    return {
      status: "ERROR" as const,
      message: input.sourceId ? "The selected G4 content review could not be found." : "No G4 content review is available to send for approval.",
      approvalId: null,
      alreadyQueued: false,
      approvalRequest: null,
    };
  }

  if (target.row.approvalRequest) {
    return {
      status: "PASS" as const,
      message:
        target.row.approvalRequest.status === "PENDING"
          ? "This content is already queued for approval."
          : "This content already has an approval record.",
      approvalId: target.row.approvalRequest.approvalId,
      alreadyQueued: true,
      approvalRequest: target.row.approvalRequest,
    };
  }

  if (target.row.result !== "PENDING_APPROVAL") {
    return {
      status: "BLOCK" as const,
      message: input.sourceId ? "The selected G4 content review is not waiting for approval." : "The latest G4 content review is not waiting for approval.",
      approvalId: null,
      alreadyQueued: false,
      approvalRequest: null,
    };
  }

  const sourceId = target.sourceId;
  if (!sourceId) {
    return {
      status: "ERROR" as const,
      message: "The selected G4 review is missing a review or asset identifier.",
      approvalId: null,
      alreadyQueued: false,
      approvalRequest: null,
    };
  }

  const summaryParts = [
    target.row.whatHappened,
    target.row.assetId ? `Asset ${target.row.assetId}` : null,
    target.row.platform ? `Platform ${target.row.platform}` : null,
  ].filter((value): value is string => Boolean(value));

  const queued = queueCevonneAdminApprovalRequest({
    workflowGroup: "G4",
    actionType: "CONTENT_APPROVAL",
    riskLevel: "MEDIUM",
    requestedBy: input.adminEmail ?? "admin",
    summary: summaryParts.join(" | "),
    requireConfirmation: true,
    routeName: "/api/admin/workflow-dashboard/g4/send-approval",
    sourceId,
    assetId: target.row.assetId,
    platform: target.row.platform,
    approvalNotes: target.row.cleanAiOutput?.humanReviewRecommendation ?? target.row.cleanAiOutput?.riskSummary ?? null,
    adminUserId: input.adminUserId,
    adminEmail: input.adminEmail,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
  });

  if (!queued) {
    return {
      status: "ERROR" as const,
      message: "Unable to queue the G4 approval request right now.",
      approvalId: null,
      alreadyQueued: false,
      approvalRequest: null,
    };
  }

  return {
    status: "PASS" as const,
    message: queued.created ? "Approval request queued." : "This content already has an approval record.",
    approvalId: queued.approval.approvalId,
    alreadyQueued: !queued.created,
    approvalRequest: {
      approvalId: queued.approval.approvalId,
      status: queued.approval.status,
      createdAt: queued.approval.createdAt,
      requestedBy: queued.approval.requestedBy,
      reviewerAction: queued.approval.reviewerAction ?? null,
    },
  };
}

export async function queueLatestG4ApprovalRequest(input: {
  adminUserId: string;
  adminEmail: string | null;
  ipUserAgentHash?: string | null;
}) {
  return queueG4ApprovalRequest(input);
}
