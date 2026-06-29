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
const G4_FETCH_LIMIT = 100 as const;
const G4_UNIQUE_ROW_LIMIT = 10 as const;

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

const getJsonRecordCandidates = (record: JsonRecord | null | undefined) => {
  const direct = asJsonRecord(record);
  const payload = asJsonRecord(direct?.raw_payload);
  const nestedPayload = asJsonRecord(payload?.raw_payload);

  return [direct, payload, nestedPayload].filter((value): value is JsonRecord => Boolean(value));
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

const readG4RawPayloadText = (row: Pick<G4ContentReviewRecord, "raw_payload"> | null | undefined, keys: string[]) => {
  const payload = asJsonRecord(row?.raw_payload);
  const nestedPayload = asJsonRecord(payload?.raw_payload);

  return readJsonRecordText(payload, keys) ?? readJsonRecordText(nestedPayload, keys);
};

const getG4SourceTrendId = (row: Pick<G4ContentReviewRecord, "raw_payload"> | null | undefined) =>
  readG4RawPayloadText(row, [
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
  ]);

const getG4SourceLookupKey = (row: Pick<G4ContentReviewRecord, "raw_payload" | "asset_id"> | null | undefined) =>
  getG4SourceTrendId(row) ?? readG4RawPayloadText(row, ["asset_id", "assetId"]) ?? normalizeG4Text(row?.asset_id);

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

const indexRecordByKeys = (map: Map<string, JsonRecord>, record: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    const value = readJsonRecordTextFromCandidates([record], [key]);
    if (value) {
      map.set(value, record);
    }
  }
};

const normalizeG4SourceMatchText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const buildG4SourceMatchFingerprint = (preview: Pick<G4ContentPreview, "headline" | "cleanSummary" | "contentRecommendation" | "hookAngle">) => {
  const tokens = [preview.headline, preview.cleanSummary, preview.contentRecommendation, preview.hookAngle]
    .map((value) => normalizeG4SourceMatchText(value))
    .filter(Boolean);

  return tokens.length ? tokens.join("||") : null;
};

const buildInsightSourceMatchFingerprint = (record: JsonRecord) => {
  const tokens = [
    readJsonRecordTextFromCandidates([record], ["insight_title", "insightTitle", "title", "headline", "name", "trend_topic", "trendTopic"]),
    readJsonRecordTextFromCandidates([record], ["clean_summary", "cleanSummary", "source_summary", "sourceSummary", "summary"]),
    readJsonRecordTextFromCandidates([record], ["content_recommendation", "contentRecommendation", "recommendation", "content_recommendation_text"]),
    readJsonRecordTextFromCandidates([record], ["hook_angle", "hookAngle", "hook"]),
  ]
    .map((value) => normalizeG4SourceMatchText(value))
    .filter(Boolean);

  return tokens.length ? tokens.join("||") : null;
};

const loadG4SourcePreviewMap = async (rows: G4Row[]) => {
  const sourceTrendIds = [...new Set(rows.map((row) => getG4SourceLookupKey(row)).filter((value): value is string => Boolean(value)))];
  const previewByTrendId = new Map<string, G4SourcePreview>();

  if (!sourceTrendIds.length) {
    return previewByTrendId;
  }

  const insightSelect = "*" as const;
  const [insightByTrendResult, insightByRunResult, recentInsightsResult] = await Promise.all([
    supabaseAdmin.from(G12_SUPABASE_TABLES.insights).select(insightSelect).in("trend_id", sourceTrendIds),
    supabaseAdmin.from(G12_SUPABASE_TABLES.insights).select(insightSelect).in("fetch_run_id", sourceTrendIds),
    supabaseAdmin.from(G12_SUPABASE_TABLES.insights).select(insightSelect).order("created_at", { ascending: false, nullsFirst: false }).limit(250),
  ]);

  const insightErrors = [
    insightByTrendResult.error,
    insightByRunResult.error,
    recentInsightsResult.error,
  ].filter(Boolean);
  if (insightErrors.length === 3) {
    console.warn("[g4-content-check-adapter] Failed to load G12 insight rows for source previews", insightErrors);
    return previewByTrendId;
  }

  const insightRecords = [
    ...(Array.isArray(insightByTrendResult.data) ? insightByTrendResult.data : []),
    ...(Array.isArray(insightByRunResult.data) ? insightByRunResult.data : []),
    ...(Array.isArray(recentInsightsResult.data) ? recentInsightsResult.data : []),
  ]
    .map((row) => asJsonRecord(row))
    .filter((row): row is JsonRecord => Boolean(row));

  const insightBySourceKey = new Map<string, JsonRecord>();
  const insightByFingerprint = new Map<string, JsonRecord>();
  const metricIds = new Set<string>();
  const rawIds = new Set<string>();
  for (const record of insightRecords) {
    indexRecordByKeys(insightBySourceKey, record, ["trend_id", "fetch_run_id"]);
    const fingerprint = buildInsightSourceMatchFingerprint(record);
    if (fingerprint && !insightByFingerprint.has(fingerprint)) {
      insightByFingerprint.set(fingerprint, record);
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
    const { data: metricRows, error: metricError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.metrics)
      .select("*")
      .in("metric_id", [...metricIds]);

    if (metricError) {
      console.warn("[g4-content-check-adapter] Failed to load G12 metric rows for source previews", metricError);
    } else {
      for (const record of (Array.isArray(metricRows) ? metricRows : []).map((row) => asJsonRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const metricId = readJsonRecordTextFromCandidates([record], ["metric_id"]);
        if (metricId) {
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
    const { data: rawRows, error: rawError } = await supabaseAdmin
      .from(G12_SUPABASE_TABLES.rawScrapeQuarantine)
      .select("*")
      .in("raw_id", [...rawIds]);

    if (rawError) {
      console.warn("[g4-content-check-adapter] Failed to load G12 raw scrape rows for source previews", rawError);
    } else {
      for (const record of (Array.isArray(rawRows) ? rawRows : []).map((row) => asJsonRecord(row)).filter((row): row is JsonRecord => Boolean(row))) {
        const rawId = readJsonRecordTextFromCandidates([record], ["raw_id"]);
        if (rawId) {
          rawByRawId.set(rawId, record);
        }
      }
    }
  }

  for (const row of rows) {
    const sourceTrendId = getG4SourceLookupKey(row);
    if (!sourceTrendId || previewByTrendId.has(sourceTrendId)) {
      continue;
    }

    const rowPreview = extractG4ContentPreview(row);
    const sourceFingerprint = buildG4SourceMatchFingerprint(rowPreview);
    const insight = insightBySourceKey.get(sourceTrendId) ?? (sourceFingerprint ? insightByFingerprint.get(sourceFingerprint) ?? null : null);
    const metricId = readJsonRecordTextFromCandidates([insight], ["metric_id"]);
    const metric = metricId ? metricByMetricId.get(metricId) ?? null : null;
    const rawId = readJsonRecordTextFromCandidates([metric, insight], ["raw_id"]);
    const rawScrape = rawId ? rawByRawId.get(rawId) ?? null : null;

    previewByTrendId.set(sourceTrendId, {
      captionPreview: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["caption_excerpt", "captionExcerpt", "caption_preview", "captionPreview", "caption", "text", "description"],
      ),
      profileUsername: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["profile_username", "profileUsername", "username", "handle", "source_account_name", "sourceAccountName", "account_name", "accountName"],
      ),
      audioSound: readJsonRecordTextFromCandidates([metric, rawScrape], ["audio_sound", "audioSound", "sound", "music"]),
      views: readJsonRecordTextFromCandidates([rawScrape, metric], ["views"]),
      likes: readJsonRecordTextFromCandidates([rawScrape, metric], ["likes"]),
      comments: readJsonRecordTextFromCandidates([rawScrape, metric], ["comments_count", "commentsCount", "comments"]),
      shares: readJsonRecordTextFromCandidates([rawScrape, metric], ["shares"]),
      trendStrength: readJsonRecordTextFromCandidates([insight, metric], ["trend_strength", "trendStrength"]),
      brandFitScore: readJsonRecordTextFromCandidates([insight, metric], ["brand_fit_score", "brandFitScore"]),
      riskScore: readJsonRecordTextFromCandidates([insight, metric], ["risk_score", "riskScore"]),
      sourceUrl: readJsonRecordTextFromCandidates(
        [rawScrape, metric, insight],
        ["source_url", "sourceUrl", "content_url", "contentUrl", "profile_public_link", "profilePublicLink", "url", "post_url", "postUrl", "web_video_url", "webVideoUrl", "permalink"],
      ),
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

const normalizeG4FingerprintText = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const getG4RowStableSourceId = (row: G4Row) =>
  getG4SourceTrendId(row) ??
  readG4RawPayloadText(row, ["idempotency_key", "idempotencyKey"]) ??
  readG4RawPayloadText(row, ["insight_id", "insightId"]) ??
  normalizeG4Text(row.asset_id) ??
  normalizeG4Text(row.review_id) ??
  normalizeG4Text(row.content_review_id);

const buildG4RowContentFingerprint = (row: G4Row) => {
  const preview = extractG4ContentPreview(row);
  const contentTokens = [
    preview.headline,
    preview.contentText,
    preview.captionPreview,
    preview.ctaText,
    preview.landingPageUrl,
    preview.pageText,
    preview.productName,
    preview.cleanSummary,
    preview.contentRecommendation,
    preview.hookAngle,
    normalizeG4Text(row.platform),
    normalizeG4Text(row.action_type),
  ]
    .map((value) => normalizeG4FingerprintText(value))
    .filter(Boolean);

  if (!contentTokens.length) {
    return null;
  }

  return contentTokens.join("||");
};

const buildG4RowDeduplicationKey = (row: G4Row) => {
  const stableSourceId = normalizeG4FingerprintText(getG4RowStableSourceId(row));
  const contentFingerprint = buildG4RowContentFingerprint(row);

  if (contentFingerprint) {
    return contentFingerprint;
  }

  if (stableSourceId) {
    return stableSourceId;
  }

  return contentFingerprint ?? normalizeG4FingerprintText(normalizeG4Text(row.review_id));
};

const dedupeG4Rows = (rows: G4Row[]) => {
  const seen = new Set<string>();
  const uniqueRows: G4Row[] = [];

  for (const row of rows) {
    const key = buildG4RowDeduplicationKey(row);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueRows.push(row);

    if (uniqueRows.length >= G4_UNIQUE_ROW_LIMIT) {
      break;
    }
  }

  return uniqueRows;
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
    .limit(G4_FETCH_LIMIT);

  if (error) {
    return buildEmptyDetail("ERROR", G4_ERROR_ACTION);
  }

  const rows = Array.isArray(data) ? data.map((row) => asG4Row(row as Record<string, unknown>)) : [];
  if (!rows.length) {
    return buildEmptyDetail("MANUAL_ONLY", G4_EMPTY_ACTION);
  }

  const uniqueRows = dedupeG4Rows(rows);
  const latest = uniqueRows[0] ?? rows[0];
  const sourcePreviewByTrendId = await loadG4SourcePreviewMap(uniqueRows);
  const latestSourcePreview = sourcePreviewByTrendId.get(getG4SourceLookupKey(latest) ?? "") ?? null;
  const recentOutcomes = uniqueRows
    .map((row) => buildG4RecentOutcome(row, sourcePreviewByTrendId.get(getG4SourceLookupKey(row) ?? "") ?? null))
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
