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
  type G4ContentReviewRecord,
  type G4WorkflowDetail,
} from "@/lib/admin/g4-content-review";

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

const asG4Row = (row: Record<string, unknown>): G4Row => row as G4Row;

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

const buildG4RecentOutcome = (row: G4Row): G4WorkflowDetail["recentOutcomes"][number] | null => {
  const time = normalizeG4Timestamp(row.created_at);
  if (!time) {
    return null;
  }

  const result = mapG4Status(row);

  return {
    time,
    result,
    reviewId: normalizeG4Text(row.review_id) ?? normalizeG4Text(row.content_review_id),
    assetId: normalizeG4Text(row.asset_id),
    platform: normalizeG4Text(row.platform),
    approvalState: normalizeG4Text(row.approval_state),
    whatHappened: summarizeG4Outcome(row),
    actionNeeded: getG4ActionNeeded(row),
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
  const recentOutcomes = rows
    .map((row) => buildG4RecentOutcome(row))
    .filter((value): value is NonNullable<ReturnType<typeof buildG4RecentOutcome>> => Boolean(value));

  return {
    workflowGroup: "G4",
    title: G4_WORKFLOW_TITLE,
    purpose: G4_WORKFLOW_PURPOSE,
    status: mapG4Status(latest),
    lastRunAt: normalizeG4Timestamp(latest.created_at),
    latestOutcome: buildG4LatestOutcome(latest),
    contentPreview: extractG4ContentPreview(latest),
    actionNeeded: getG4ActionNeeded(latest),
    cleanAiOutput: buildG4CleanAiOutput(latest),
    recentOutcomes,
  };
}
