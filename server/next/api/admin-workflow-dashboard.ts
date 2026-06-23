import "server-only";

import { env } from "@/server/config";
import { postN8nWebhook } from "@/lib/n8n-client";
import { normalizeG1AuditRows } from "@/lib/g1-compliance-guard";
import {
  G12_SUPABASE_TABLES,
  normalizeG12SupabaseInsightRow,
  normalizeG12SupabaseRunRow,
  type G12SupabaseInsight,
  type G12SupabaseRun,
} from "@/server/next/api/g12-trend-fetcher-supabase";
import { getG12TrendFetcherBranchLabel } from "@/lib/g12-trend-fetcher";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  type G4WorkflowDetail,
} from "@/lib/admin/g4-content-review";
import { getG4WorkflowDetail } from "@/server/next/api/g4-content-check-adapter";
import {
  buildG5PublishingSchedulerMessage,
  buildG5WorkflowViewFromDetail,
  loadG5PublishingSchedulerDetail,
  type G5PublishingSchedulerDetail,
} from "@/server/next/api/g5-publishing-scheduler-adapter";
import {
  ADMIN_WORKFLOW_IDS,
  WORKFLOW_CATALOG,
  getWorkflowActionNeeded,
  getWorkflowCatalogEntry,
  getWorkflowDetailHref,
  getWorkflowEmptyStateActionNeeded,
  getWorkflowStatusMessage,
  humanizeReasonText,
  maskIdentifier,
  normalizeWorkflowId,
  normalizeWorkflowUiStatus,
  sanitizeDisplayText,
  type AdminWorkflowId,
  type WorkflowDetailView,
  type WorkflowOutcomeSummary,
  type WorkflowOverviewCard,
  type WorkflowRunValues,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";

type JsonRecord = Record<string, unknown>;

type TableSpec = {
  table: string;
  orderKeys?: string[];
  limit?: number;
};

type TableBundle = {
  table: string;
  rows: JsonRecord[];
};

const DEFAULT_ORDER_KEYS = [
  "checked_at",
  "completed_at",
  "handled_at",
  "time",
  "created_at",
  "updated_at",
  "synced_at",
  "captured_at",
  "stored_at",
  "processed_at",
  "last_run_at",
] as const;

const TABLE_LIMIT = 12;

const tableSpec = (table: string, orderKeys: string[] = [...DEFAULT_ORDER_KEYS], limit = TABLE_LIMIT): TableSpec => ({
  table,
  orderKeys,
  limit,
});

const WORKFLOW_TABLES: Record<AdminWorkflowId, TableSpec[]> = {
  G1: [tableSpec("compliance_runs"), tableSpec("g1_compliance_runs"), tableSpec("g1_audit_logs")],
  G2: [
    tableSpec("g2_account_health", ["checked_at", "created_at", "updated_at", "handled_at", "time"], 10),
    tableSpec("g2_account_health_logs", ["checked_at", "created_at", "updated_at", "handled_at", "time"], 10),
    tableSpec("g2_policy_account_health", ["checked_at", "created_at", "updated_at", "handled_at", "time"], 10),
  ],
  G3: [
    tableSpec("cevonne_g3_consent_sync", ["synced_at", "created_at", "updated_at"]),
    tableSpec("cevonne_g3_opt_out_sync", ["synced_at", "created_at", "updated_at"]),
    tableSpec("cevonne_g3_purchase_events", ["created_at", "purchased_at"]),
    tableSpec("cevonne_g3_privacy_requests", ["created_at", "updated_at"]),
    tableSpec("cevonne_g3_privacy_execution_requests", ["created_at"]),
  ],
  G4: [tableSpec("g4_content_reviews")],
  G5: [tableSpec("g5_publish_results"), tableSpec("g5_publish_schedule_logs"), tableSpec("g5_approval_logs")],
  G6: [tableSpec("g6_messaging_logs"), tableSpec("g6_quiz_runs"), tableSpec("g6_recovery_logs")],
  G7: [tableSpec("g7_inventory_snapshots", ["captured_at", "created_at"]), tableSpec("g7_offer_change_log", ["created_at", "processed_at"])],
  G8: [tableSpec("g8_ugc_proof_logs"), tableSpec("g8_creator_proof_logs"), tableSpec("g8_rights_logs")],
  G9: [tableSpec("g9_ad_recommendations"), tableSpec("g9_ad_dry_runs"), tableSpec("g9_ad_executions")],
  G10: [tableSpec("g10_recommendations"), tableSpec("g10_dry_runs"), tableSpec("g10_experiments")],
  G11: [tableSpec("g11_decision_digests"), tableSpec("g11_recommendations"), tableSpec("g11_action_packets"), tableSpec("g11_audit_logs")],
  G12: [
    tableSpec(G12_SUPABASE_TABLES.fetchRuns, ["completed_at", "created_at"]),
  ],
  WF1: [tableSpec("wf1_queue"), tableSpec("wf1_approvals"), tableSpec("wf1_dry_runs"), tableSpec("wf1_logs"), tableSpec("wf1_buffer_health")],
};

const WORKFLOW_RUN_PATHS: Record<AdminWorkflowId, string | null> = {
  G1: env.n8nG1ComplianceGuardPath,
  G2: env.n8nG2AccountHealthUpdatePath,
  G3: null,
  G4: env.n8nG4ContentCheckPath,
  G5: env.n8nG5PublishingSchedulerPath,
  G6: env.n8nG6MessagingRouterPath,
  G7: env.n8nG7InventoryOfferSafetyPath,
  G8: env.n8nG8UgcCreatorProofPath,
  G9: env.n8nG9AdsRetargetingOptimizerPath,
  G10: env.n8nG10SeoCroPath,
  G11: null,
  G12: null,
  WF1: null,
};

const G3_RUN_URLS = {
  consent: env.cevonneN8nConsentIngestUrl,
  opt_out: env.cevonneN8nOptOutUrl,
  attribution: env.cevonneN8nAttributionEventUrl,
  purchase: env.cevonneN8nPurchaseEventUrl,
  privacy_request: env.cevonneN8nPrivacyRequestUrl,
  privacy_execute: env.cevonneN8nPrivacyExecuteUrl,
} as const;

const G11_RUN_URLS = {
  weekly_digest: env.cevonneN8nWeeklyDigestUrl,
  decision_recommendation: env.cevonneN8nDecisionRecommendationUrl,
  draft_action_packet: env.cevonneN8nDraftActionPacketUrl,
} as const;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord | null => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const flattenRow = (row: JsonRecord) => [
  row,
  asRecord(row.payload),
  asRecord(row.action_packet),
  asRecord(row.data),
  asRecord(row.details),
  asRecord(row.metadata),
  asRecord(row.summary),
  asRecord(row.response),
];

const humanizeLabel = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());

const pickFromCandidates = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) continue;

    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
  }

  return null;
};

const pickDateFromCandidates = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  const raw = pickFromCandidates(candidates, keys);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const formatCandidateValue = (key: string, value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (/email|phone|contact|user_id|account_id|external_contact_id|approval_id|request_id/i.test(key)) {
    return maskIdentifier(text);
  }

  if (/url/i.test(key) || /^https?:\/\//i.test(text)) {
    return null;
  }

  if (/status|result|decision|action|type|lane|channel|platform|branch|event|mode|use|kind/i.test(key)) {
    return humanizeLabel(text);
  }

  return sanitizeDisplayText(text) ?? humanizeLabel(text);
};

const pickFormattedFromCandidates = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) continue;

    for (const key of keys) {
      const formatted = formatCandidateValue(key, candidate[key]);
      if (formatted) {
        return formatted;
      }
    }
  }

  return null;
};

const joinLabels = (values: Array<string | null | undefined>) => {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique.join(" · ") : null;
};

const sortByTimeDesc = (left: WorkflowOutcomeSummary, right: WorkflowOutcomeSummary) => {
  const leftTime = left.time ? new Date(left.time).getTime() : 0;
  const rightTime = right.time ? new Date(right.time).getTime() : 0;

  return rightTime - leftTime;
};

const queryTableRows = async (table: string, limit = TABLE_LIMIT, orderKeys: string[] = [...DEFAULT_ORDER_KEYS]) => {
  for (const orderKey of orderKeys) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order(orderKey, { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      return data as JsonRecord[];
    }
  }

  const { data, error } = await supabaseAdmin.from(table).select("*").limit(limit);
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as JsonRecord[];
};

const queryWorkflowTables = async (workflowId: AdminWorkflowId): Promise<TableBundle[]> => {
  const specs = WORKFLOW_TABLES[workflowId] ?? [];
  const bundles = await Promise.all(
    specs.map(async (spec) => ({
      table: spec.table,
      rows: await queryTableRows(spec.table, spec.limit ?? TABLE_LIMIT, spec.orderKeys ?? [...DEFAULT_ORDER_KEYS]),
    })),
  );

  return bundles.filter((bundle) => bundle.rows.length > 0);
};

const buildGenericOutcome = (
  workflowId: AdminWorkflowId,
  row: JsonRecord,
  sourceLabel: string,
): WorkflowOutcomeSummary | null => {
  const candidates = flattenRow(row);
  const time =
    pickDateFromCandidates(candidates, [
      "checked_at",
      "checkedAt",
      "time",
      "handled_at",
      "handledAt",
      "completed_at",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt",
      "synced_at",
      "syncedAt",
      "captured_at",
      "capturedAt",
      "stored_at",
      "storedAt",
      "processed_at",
      "processedAt",
      "last_run_at",
      "lastRunAt",
    ]) ?? null;

  if (!time) {
    return null;
  }

  const result = normalizeWorkflowUiStatus(
    pickFromCandidates(candidates, [
      "result_or_status",
      "resultOrStatus",
      "result",
      "status",
      "decision",
      "outcome",
      "response_type",
      "responseType",
      "execution_status",
      "executionStatus",
      "approval_status",
      "approvalStatus",
      "card_status",
      "cardStatus",
      "health_status",
      "healthStatus",
      "account_status",
      "accountStatus",
      "state",
    ]),
    WORKFLOW_CATALOG[workflowId].fallbackStatus,
  );

  const checked = joinLabels([
    pickFormattedFromCandidates(candidates, [
      "workflow_requesting_check",
      "workflow_group",
      "workflowGroup",
      "workflow_id",
      "workflowId",
      "branch_name",
      "branchName",
      "branch_key",
      "branchKey",
      "event_type",
      "eventType",
      "lane",
      "action_type_label",
      "actionTypeLabel",
      "decision_type",
      "decisionType",
      "intended_use",
      "intendedUse",
      "change_type",
      "changeType",
      "type",
    ]),
    pickFormattedFromCandidates(candidates, [
      "platform",
      "channel",
      "account_id",
      "accountId",
      "contact_identifier",
      "contactReference",
      "contact_id",
      "contactId",
      "external_contact_id",
      "externalContactId",
      "sku",
      "product_or_sku",
      "productOrSku",
      "query",
      "target_workflow",
      "targetWorkflow",
    ]),
  ]);

  const whatWasChecked = checked ?? WORKFLOW_CATALOG[workflowId].purpose;
  const explicitHappened =
    pickFormattedFromCandidates(candidates, [
      "what_happened",
      "whatHappened",
      "message",
      "summary",
      "notes",
      "description",
      "result_message",
      "resultMessage",
      "content_recommendation",
      "contentRecommendation",
      "compliance_note",
      "complianceNote",
      "reason",
    ]) ?? null;

  const whyItBlockedRaw = pickFromCandidates(candidates, [
    "why_it_blocked",
    "whyItBlocked",
    "fail_reason",
    "failReason",
    "failure_reason",
    "failureReason",
    "technical_reason",
    "technicalReason",
    "blocked_reason",
    "blockedReason",
  ]);

  const whyItBlocked = result === "BLOCK" || result === "ERROR" || result === "NEEDS_EVIDENCE" || result === "FIX_FIRST" ? humanizeReasonText(whyItBlockedRaw) : null;
  const whatHappened = explicitHappened ?? getWorkflowStatusMessage(result);
  const actionNeeded =
    pickFormattedFromCandidates(candidates, ["action_needed", "actionNeeded", "next_step", "nextStep", "guidance", "resolution"]) ??
    getWorkflowActionNeeded({
      workflowId,
      status: result,
      reason: whyItBlockedRaw,
      rowHints: [whatWasChecked, whatHappened, sourceLabel].filter(Boolean) as string[],
    });

  return {
    time,
    result,
    whatWasChecked,
    whatHappened,
    actionNeeded,
    whyItBlocked,
    sourceLabel: sanitizeDisplayText(sourceLabel),
  };
};

const G2_SAFE_SOURCE_LABEL = "n8n Supabase";
const G2_INTERNAL_NOTE_PATTERN = /\b(dev|seed|rpc|webhook|supabase|service role|source route|table|node|payload|internal|placeholder|replace with)\b/i;

const getG2DisplayStatus = (value?: string | null): WorkflowUiStatus => {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (!normalized) {
    return "MANUAL_ONLY";
  }

  if (["WARNING", "UNKNOWN", "REVIEW", "NEEDS_REVIEW", "MANUAL_ONLY", "PENDING"].includes(normalized)) {
    return "MANUAL_ONLY";
  }

  return normalizeWorkflowUiStatus(value, "MANUAL_ONLY");
};

const getG2StatusMessage = (status: WorkflowUiStatus) => {
  if (status === "PASS") {
    return "Account health check passed.";
  }

  if (status === "ERROR") {
    return "The health check could not be completed.";
  }

  return "Account health needs review.";
};

const getG2ActionNeeded = (status: WorkflowUiStatus) => {
  if (status === "PASS") {
    return "No action needed.";
  }

  if (status === "ERROR") {
    return "Developer/admin review is needed.";
  }

  return "Review account status before running affected workflows.";
};

const getG2EvidenceSummary = (candidates: Array<JsonRecord | null>) => {
  const note = sanitizeDisplayText(
    pickFormattedFromCandidates(candidates, [
      "evidence_note",
      "evidenceNote",
      "evidence_summary",
      "evidenceSummary",
      "policy_note",
      "policyNote",
      "notes",
      "description",
    ]),
  );

  if (note && !G2_INTERNAL_NOTE_PATTERN.test(note)) {
    return note;
  }

  const hasEvidenceLink = Boolean(pickFromCandidates(candidates, ["evidence_url", "evidenceUrl"]));
  if (hasEvidenceLink) {
    return "Evidence link recorded.";
  }

  return null;
};

const buildG2Outcome = (row: JsonRecord, sourceLabel = G2_SAFE_SOURCE_LABEL): WorkflowOutcomeSummary | null => {
  const candidates = flattenRow(row);
  const time =
    pickDateFromCandidates(candidates, [
      "checked_at",
      "checkedAt",
      "handled_at",
      "handledAt",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt",
      "time",
    ]) ?? null;

  if (!time) {
    return null;
  }

  const rawStatus =
    pickFromCandidates(candidates, [
      "result_or_status",
      "resultOrStatus",
      "result",
      "status",
      "health_status",
      "healthStatus",
      "account_status",
      "accountStatus",
    ]) ?? null;
  const result = getG2DisplayStatus(rawStatus);
  const platform = pickFormattedFromCandidates(candidates, ["platform"]) ?? null;
  const account =
    pickFormattedFromCandidates(candidates, ["account_name", "accountName", "account_id", "accountId", "account"]) ?? null;
  const platformLabel = platform ?? "Unavailable";
  const whatWasChecked = joinLabels([platformLabel, account]) ?? "Account health snapshot";
  const evidenceSummary = getG2EvidenceSummary(candidates);
  const whatHappened = getG2StatusMessage(result);
  const actionNeeded = getG2ActionNeeded(result);

  return {
    time,
    handledAt: time,
    summary: whatHappened,
    result,
    whatWasChecked,
    whatHappened,
    actionNeeded,
    whyItBlocked: result === "ERROR" ? "The health check could not be completed." : result === "PASS" ? null : "Account health needs review.",
    sourceLabel,
    details: {
      platform: platformLabel,
      account: account,
      evidenceSummary,
      whatWasChecked,
      sourceLabel,
    },
  };
};

const buildG2Outcomes = (bundles: TableBundle[]) => {
  const outcomes = bundles
    .flatMap((bundle) =>
      bundle.rows
        .map((row) => buildG2Outcome(row, G2_SAFE_SOURCE_LABEL))
        .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
    )
    .sort(sortByTimeDesc);

  const deduped: WorkflowOutcomeSummary[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    const dedupeKey = [
      outcome.time ?? "",
      outcome.result,
      outcome.details?.platform ?? "",
      outcome.details?.account ?? "",
      outcome.whatHappened,
    ].join("|");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(outcome);
  }

  return deduped.slice(0, 10);
};

const buildG2DetailResponse = async (): Promise<{
  workflowGroup: "G2";
  title: string;
  purpose: string;
  status: WorkflowUiStatus | "EMPTY";
  lastRunAt: string | null;
  latestOutcome: WorkflowOutcomeSummary | null;
  recentOutcomes: WorkflowOutcomeSummary[];
  workflow: WorkflowDetailView;
  message: string;
}> => {
  const bundles = await queryWorkflowTables("G2");
  const outcomes = buildG2Outcomes(bundles);
  const workflow = buildWorkflowView("G2", outcomes);

  return {
    workflowGroup: "G2",
    title: workflow.title,
    purpose: workflow.purpose,
    status: workflow.status,
    lastRunAt: workflow.lastRunAt,
    latestOutcome: workflow.latestOutcome,
    recentOutcomes: workflow.recentOutcomes,
    workflow,
    message: workflow.latestOutcome ? "G2 account health detail loaded from Supabase." : workflow.emptyStateCopy,
  };
};

const buildG1Outcomes = (bundles: TableBundle[]) => {
  const normalizedRows = normalizeG1AuditRows(bundles.flatMap((bundle) => bundle.rows));
  const outcomes = normalizedRows
    .map<WorkflowOutcomeSummary>((decision) => {
      const result = normalizeWorkflowUiStatus(decision.decision, WORKFLOW_CATALOG.G1.fallbackStatus);
      const checked = joinLabels([decision.requestedByWorkflow, decision.actionTypeLabel, decision.platform]) ?? "Workflow safety check";
      const blockedReason = humanizeReasonText(decision.failureReason ?? decision.technicalReason);

      return {
        time: decision.time,
        result,
        whatWasChecked: checked,
        whatHappened: getWorkflowStatusMessage(result),
        actionNeeded: getWorkflowActionNeeded({
          workflowId: "G1",
          status: result,
          reason: decision.failureReason ?? decision.technicalReason,
          rowHints: [checked, decision.platform].filter(Boolean) as string[],
        }),
        whyItBlocked: blockedReason,
        sourceLabel: sanitizeDisplayText(decision.requestedByWorkflowGroup),
      };
    })
    .sort(sortByTimeDesc);

  if (outcomes.length > 0) {
    return outcomes;
  }

  return bundles.flatMap((bundle) =>
    bundle.rows
      .map((row) => buildGenericOutcome("G1", row, bundle.table))
      .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
  );
};

const G5_SOURCE_LABELS: Record<string, string> = {
  g5_approval_logs: "Approval review",
  g5_publish_schedule_logs: "Schedule update",
  g5_publish_results: "Publish result",
};

const getG5SourceLabel = (tableName: string) => G5_SOURCE_LABELS[tableName] ?? "Publishing update";

const buildG5Outcome = (row: JsonRecord, sourceLabel: string): WorkflowOutcomeSummary | null => {
  const candidates = flattenRow(row);
  const time =
    pickDateFromCandidates(candidates, [
      "handled_at",
      "completed_at",
      "published_at",
      "scheduled_at",
      "created_at",
      "updated_at",
      "time",
    ]) ?? null;

  if (!time) {
    return null;
  }

  const rawStatus =
    pickFromCandidates(candidates, [
      "status",
      "approval_status",
      "publish_status",
      "result",
      "stage",
      "outcome",
      "response_type",
    ]) ?? null;
  const normalizedRawStatus = typeof rawStatus === "string" ? rawStatus.trim().toUpperCase() : "";
  const result =
    normalizedRawStatus === "SCHEDULED" || normalizedRawStatus === "QUEUED" || normalizedRawStatus === "PUBLISHED" || normalizedRawStatus === "LIVE"
      ? "PASS"
      : normalizeWorkflowUiStatus(rawStatus, WORKFLOW_CATALOG.G5.fallbackStatus);
  const stageLabel =
    pickFormattedFromCandidates(candidates, ["stage", "event_type", "action_type", "publish_stage", "schedule_mode"]) ?? sourceLabel;
  const assetLabel = joinLabels([
    pickFormattedFromCandidates(candidates, ["asset_id", "assetId"]),
    pickFormattedFromCandidates(candidates, ["headline", "asset_headline", "caption_headline", "title"]),
    pickFormattedFromCandidates(candidates, ["caption", "asset_caption"]),
  ]);
  const checked = joinLabels([stageLabel, assetLabel, pickFormattedFromCandidates(candidates, ["platform"])]) ?? "Publishing scheduler";
  const explicitHappened =
    pickFormattedFromCandidates(candidates, [
      "what_happened",
      "whatHappened",
      "message",
      "summary",
      "notes",
      "description",
      "result_message",
      "resultMessage",
      "reviewer_note",
      "reviewerNote",
      "reviewer_action",
      "reviewerAction",
    ]) ?? null;
  const fallbackHappened =
    sourceLabel === "Approval review"
      ? "The asset was reviewed."
      : sourceLabel === "Schedule update"
        ? "The approved asset was queued for scheduling."
        : sourceLabel === "Publish result"
          ? "The publishing result was recorded."
          : "The publishing step was recorded.";
  const whatHappened =
    explicitHappened ??
    (result === "PASS"
      ? sourceLabel === "Approval review"
        ? "The asset was approved for the next publishing step."
        : sourceLabel === "Schedule update"
          ? "The approved asset was queued for publishing."
          : sourceLabel === "Publish result"
            ? "The asset was published successfully."
            : "The publishing step completed successfully."
      : result === "DRY_RUN"
        ? "The publishing dry-run completed safely."
        : result === "BLOCK"
          ? "The publishing step was safely blocked."
          : result === "MANUAL_ONLY"
            ? "Human review is still needed."
            : result === "PENDING_APPROVAL"
              ? "The asset is waiting for review."
              : fallbackHappened);
  const whyItBlockedRaw = pickFromCandidates(candidates, [
    "why_it_blocked",
    "whyItBlocked",
    "fail_reason",
    "failReason",
    "failure_reason",
    "failureReason",
    "technical_reason",
    "technicalReason",
    "blocked_reason",
    "blockedReason",
  ]);
  const whyItBlocked =
    result === "BLOCK" || result === "ERROR" || result === "NEEDS_EVIDENCE" || result === "FIX_FIRST" || result === "PENDING_APPROVAL"
      ? humanizeReasonText(whyItBlockedRaw) ?? "Waiting for the next safe step."
      : null;
  const actionNeeded =
    pickFormattedFromCandidates(candidates, ["action_needed", "actionNeeded", "next_step", "nextStep", "guidance", "resolution"]) ??
    (result === "PASS"
      ? sourceLabel === "Approval review"
        ? "Run a publishing dry-run next."
        : sourceLabel === "Schedule update"
          ? "Check the scheduling details."
          : sourceLabel === "Publish result"
            ? "Review the publish result."
            : "Continue to the next safe step."
      : result === "DRY_RUN"
        ? "Review the dry-run result."
        : result === "PENDING_APPROVAL"
          ? "Review the asset and choose approve, reject, or request a fix."
          : result === "BLOCK"
            ? "Fix the issue before trying again."
            : result === "MANUAL_ONLY"
              ? "Review the asset manually."
              : "Check the publishing details.");

  return {
    time,
    result,
    whatWasChecked: checked,
    whatHappened,
    actionNeeded,
    whyItBlocked,
    sourceLabel,
  };
};

const buildG5Outcomes = (bundles: TableBundle[]) => {
  const outcomes = bundles
    .flatMap((bundle) =>
      bundle.rows
        .map((row) => buildG5Outcome(row, getG5SourceLabel(bundle.table)))
        .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
    )
    .sort(sortByTimeDesc);

  if (outcomes.length > 0) {
    return outcomes;
  }

  return bundles.flatMap((bundle) =>
    bundle.rows
      .map((row) => buildGenericOutcome("G5", row, getG5SourceLabel(bundle.table)))
      .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
  );
};

const buildG12Outcomes = (bundles: TableBundle[]) => {
  const runs = bundles.flatMap((bundle) =>
    bundle.rows
      .map((row) => normalizeG12SupabaseRunRow(row))
      .filter((value): value is NonNullable<ReturnType<typeof normalizeG12SupabaseRunRow>> => Boolean(value)),
  );

  const outcomes = runs
    .map<WorkflowOutcomeSummary>((run) => {
      const branchLabel = run.branch_key ? getG12TrendFetcherBranchLabel(run.branch_key) : "General manual fetch";
      const platformsLabel = run.platforms.length ? run.platforms.map((platform) => humanizeLabel(platform)).join(" + ") : "Public trends";
      const checked = joinLabels([branchLabel, platformsLabel, run.query]) ?? "Public trend fetch";
      const result = normalizeWorkflowUiStatus(run.status, WORKFLOW_CATALOG.G12.fallbackStatus);
      const whatHappened =
        result === "PASS"
          ? `Stored ${run.stored_count} clean insight${run.stored_count === 1 ? "" : "s"}.`
          : result === "BLOCK"
            ? "The fetch safely stopped before a risky action."
            : result === "ERROR"
              ? "The fetch hit a system problem."
              : result === "DRY_RUN"
                ? "The fetch completed in dry-run mode."
                : "The fetch is still being processed.";

      return {
        time: run.completed_at ?? run.created_at ?? new Date().toISOString(),
        result,
        whatWasChecked: checked,
        whatHappened,
        actionNeeded:
          result === "PASS"
            ? "Review the clean insights."
            : result === "BLOCK"
              ? "Fix the issue before running again."
              : result === "ERROR"
                ? "Ask admin or developer to check the run."
                : "Wait for the fetch to finish.",
        whyItBlocked: result === "BLOCK" ? "The workflow safely stopped the request." : null,
        sourceLabel: "Supabase fetch run",
      };
    })
    .sort(sortByTimeDesc);

  if (outcomes.length > 0) {
    return outcomes;
  }

  return bundles.flatMap((bundle) =>
    bundle.rows
      .map((row) => buildGenericOutcome("G12", row, bundle.table))
      .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
  );
};

const g12MetricCountFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const g12MetricScoreFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

type G12SavedInsightView = {
  insightId: string;
  fetchRunId: string | null;
  title: string;
  trendTopic: string | null;
  platform: string | null;
  branchType: string | null;
  insightSummary: string;
  hookAngle: string | null;
  contentRecommendation: string | null;
  publishedAt: string | null;
  audioSound: string | null;
  hashtags: string[];
  riskLevel: number | null;
  brandFitScore: number | null;
  cleanMetricSummary: string | null;
  createdAt: string | null;
};

type G12LatestOutcomeView = {
  result: WorkflowUiStatus;
  summary: string;
  savedInsightPreview: string | null;
  actionNeeded: string;
  fetchRunId: string | null;
  insightCount: number;
};

type G12RecentOutcomeView = WorkflowOutcomeSummary & {
  fetchRunId: string | null;
  insightCount: number;
  savedInsightPreview: string | null;
};

type G12WorkflowDetailData = {
  workflowGroup: "G12";
  latestOutcome: G12LatestOutcomeView | null;
  savedInsights: G12SavedInsightView[];
  recentOutcomes: G12RecentOutcomeView[];
  workflow: WorkflowDetailView;
  status: "PASS" | "EMPTY";
  message: string;
};

const formatG12MetricCount = (value: number) => g12MetricCountFormatter.format(value);
const formatG12MetricScore = (value: number) => g12MetricScoreFormatter.format(value);

const normalizeG12NumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const truncateG12Text = (value: string | null | undefined, maxLength = 140) => {
  const text = sanitizeDisplayText(value);
  if (!text) {
    return null;
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const readG12Number = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
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

const readG12String = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

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

const readG12StringArray = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return [];
  }

  const normalizeEntry = (value: unknown) => {
    if (typeof value === "string") {
      const text = sanitizeDisplayText(value);
      if (!text) {
        return null;
      }

      if (text.startsWith("{") && text.endsWith("}")) {
        try {
          const parsed = JSON.parse(text);
          const parsedRecord = asRecord(parsed);
          if (parsedRecord) {
            return (
              readG12String(parsedRecord, ["name", "tag", "value", "label", "text"]) ??
              null
            );
          }
        } catch {
          // Ignore malformed embedded JSON strings.
        }
      }

      return text.replace(/^#+/, "").trim() || null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    const record = asRecord(value);
    if (record) {
      return readG12String(record, ["name", "tag", "value", "label", "text"]);
    }

    return null;
  };

  for (const key of keys) {
    const value = row[key];
    const entries = Array.isArray(value) ? value : value == null ? [] : [value];

    const normalized = entries
      .map(normalizeEntry)
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => entry.replace(/^#+/, "").trim())
      .filter(Boolean);

    if (normalized.length) {
      return [...new Set(normalized)];
    }
  }

  return [];
};

const isGenericG12SourceSummary = (value: string) =>
  /public\s+.*signal\./i.test(value) ||
  /metrics calculated from public trend intelligence/i.test(value) ||
  /raw content remains quarantined/i.test(value);

const buildG12TrendLabel = (value: string | null | undefined) => {
  const text = sanitizeDisplayText(value);
  if (!text) {
    return null;
  }

  const trimmed = text.replace(/trends?$/i, "").trim();
  const humanized = humanizeLabel(trimmed || text);
  return /trends?$/i.test(text) ? `${humanized} trend` : humanized;
};

const buildG12InsightSummary = (insight: G12SupabaseInsight) => {
  return (
    sanitizeDisplayText(insight.clean_summary) ??
    sanitizeDisplayText(insight.summary) ??
    sanitizeDisplayText(insight.content_recommendation) ??
    sanitizeDisplayText(insight.hook_angle) ??
    "No saved insight text was stored for this run."
  );
};

const getG12PlatformContext = (runRow: JsonRecord | null | undefined, platform: string | null) => {
  if (!runRow || !platform) {
    return null;
  }

  const platformResults = asRecord(runRow.platform_results);
  if (!platformResults) {
    return null;
  }

  const platformResult = asRecord(platformResults[platform] ?? platformResults[platform.toUpperCase()] ?? null);
  return platformResult ?? null;
};

const getG12BranchType = (runRow: JsonRecord | null | undefined, insight: G12SupabaseInsight) => {
  const platformContext = getG12PlatformContext(runRow, insight.platform);
  return (
    pickFormattedFromCandidates([platformContext, runRow ?? null], ["branch_name", "branchName", "trend_branch", "trendBranch", "branch_key", "branchKey"]) ??
    (insight.branch_key ? getG12TrendFetcherBranchLabel(insight.branch_key) : null) ??
    null
  );
};

const buildG12CleanMetricSummary = (metric: JsonRecord | null) => {
  if (!metric) {
    return null;
  }

  const summaryParts: string[] = [];
  const views = readG12Number(metric, ["views"]);
  const likes = readG12Number(metric, ["likes"]);
  const shares = readG12Number(metric, ["shares"]);
  const comments = readG12Number(metric, ["comments_count", "commentsCount"]);
  const trendStrength = readG12Number(metric, ["trend_strength", "trendStrength"]);
  const brandFitScore = readG12Number(metric, ["brand_fit_score", "brandFitScore"]);
  const riskScore = readG12Number(metric, ["risk_score", "riskScore"]);
  const engagementRate = readG12Number(metric, ["engagement_rate", "engagementRate"]);

  if (views !== null) {
    summaryParts.push(`${formatG12MetricCount(views)} views`);
  }

  if (likes !== null) {
    summaryParts.push(`${formatG12MetricCount(likes)} likes`);
  }

  if (shares !== null) {
    summaryParts.push(`${formatG12MetricCount(shares)} shares`);
  }

  if (comments !== null) {
    summaryParts.push(`${formatG12MetricCount(comments)} comments`);
  }

  if (engagementRate !== null) {
    summaryParts.push(`engagement ${formatG12MetricScore(engagementRate)}`);
  }

  if (trendStrength !== null) {
    summaryParts.push(`trend strength ${formatG12MetricScore(trendStrength)}`);
  }

  if (brandFitScore !== null) {
    summaryParts.push(`brand fit ${formatG12MetricScore(brandFitScore)}`);
  }

  if (riskScore !== null) {
    summaryParts.push(`risk ${formatG12MetricScore(riskScore)}`);
  }

  return summaryParts.length ? summaryParts.join(" · ") : null;
};

const buildG12SavedInsightPreview = (insight: G12SavedInsightView) =>
  truncateG12Text(insight.hookAngle ?? insight.title ?? insight.insightSummary, 160);

const buildG12SavedInsightView = (insight: G12SupabaseInsight, runRow: JsonRecord | null, metric: JsonRecord | null): G12SavedInsightView => {
  const brandFitScore = normalizeG12NumericValue(insight.brand_fit_score ?? readG12Number(metric, ["brand_fit_score", "brandFitScore"]));
  const riskLevel = normalizeG12NumericValue(insight.risk_score ?? readG12Number(metric, ["risk_score", "riskScore"]));
  const branchType = getG12BranchType(runRow, insight);
  const title = buildG12TrendLabel(insight.insight_title ?? insight.title ?? insight.trend_topic ?? insight.hook_angle ?? null) ?? "Saved insight";
  const trendTopic = buildG12TrendLabel(insight.trend_topic) ?? sanitizeDisplayText(insight.trend_topic);
  const publishedAt = pickDateFromCandidates([metric], ["published_at", "publishedAt"]);

  return {
    insightId: insight.id,
    fetchRunId: insight.fetch_run_id,
    title,
    trendTopic,
    platform: insight.platform,
    branchType: sanitizeDisplayText(branchType),
    insightSummary: buildG12InsightSummary(insight),
    hookAngle: sanitizeDisplayText(insight.hook_angle),
    contentRecommendation: sanitizeDisplayText(insight.content_recommendation),
    publishedAt,
    audioSound: readG12String(metric, ["audio_sound", "audioSound"]),
    hashtags: readG12StringArray(metric, ["hashtags", "hash_tags", "hashtag_list", "hashtagList"]),
    riskLevel,
    brandFitScore,
    cleanMetricSummary: buildG12CleanMetricSummary(metric),
    createdAt: insight.created_at ?? insight.stored_at ?? null,
  };
};

const buildG12DetailLatestOutcome = (run: G12SupabaseRun, savedInsights: G12SavedInsightView[]): G12LatestOutcomeView => {
  const result = normalizeWorkflowUiStatus(run.status, WORKFLOW_CATALOG.G12.fallbackStatus);
  const insightCount = Math.max(0, Number(run.stored_count) || 0);
  const hasSavedInsights = savedInsights.length > 0;

  let summary = "The fetch is still being processed.";
  let actionNeeded = "Wait for the fetch to finish.";
  let savedInsightPreview: string | null = null;

  if (result === "PASS") {
    if (insightCount <= 0) {
      summary = "No clean insights were saved from this run.";
      actionNeeded = "No clean insights were saved from this run.";
    } else if (!hasSavedInsights) {
      summary =
        "Insight count was recorded, but the saved insight details were not found. Ask admin/developer to check G12 Supabase logging.";
      actionNeeded = summary;
    } else {
      summary = `Stored ${insightCount} clean insight${insightCount === 1 ? "" : "s"}. See the saved insight${insightCount === 1 ? "" : "s"} below.`;
      actionNeeded =
        insightCount === 1
          ? "Review the clean insight. If you want to use it for content, send it through G4 content check and G5 approval first."
          : "Review the clean insights. If you want to use them for content, send them through G4 content check and G5 approval first.";
      savedInsightPreview = buildG12SavedInsightPreview(savedInsights[0]);
    }
  } else if (result === "BLOCK") {
    summary = "The fetch safely stopped before a risky action.";
    actionNeeded = "Fix the issue before running again.";
  } else if (result === "ERROR") {
    summary = "The fetch hit a system problem.";
    actionNeeded = "Ask admin or developer to check the run.";
  } else if (result === "DRY_RUN") {
    summary = "The fetch completed in dry-run mode.";
    actionNeeded = "Wait for the fetch to finish.";
  }

  return {
    result,
    summary,
    savedInsightPreview,
    actionNeeded,
    fetchRunId: run.fetch_run_id,
    insightCount,
  };
};

const buildG12DetailRecentOutcome = (
  run: G12SupabaseRun,
  runRow: JsonRecord | null,
  savedInsights: G12SavedInsightView[],
): G12RecentOutcomeView => {
  const result = normalizeWorkflowUiStatus(run.status, WORKFLOW_CATALOG.G12.fallbackStatus);
  const latestOutcome = buildG12DetailLatestOutcome(run, savedInsights);
  const branchLabel = run.branch_key ? getG12TrendFetcherBranchLabel(run.branch_key) : "General manual fetch";
  const platformsLabel = run.platforms.length ? run.platforms.map((platform) => humanizeLabel(platform)).join(" + ") : "Public trends";
  const whatWasChecked = joinLabels([branchLabel, platformsLabel, run.query]) ?? "Public trend fetch";

  return {
    time: run.completed_at ?? run.created_at ?? new Date().toISOString(),
    result,
    whatWasChecked,
    whatHappened: latestOutcome.summary,
    actionNeeded: latestOutcome.actionNeeded,
    whyItBlocked: result === "BLOCK" ? "The workflow safely stopped the request." : null,
    sourceLabel: "Supabase fetch run",
    fetchRunId: run.fetch_run_id,
    insightCount: latestOutcome.insightCount,
    savedInsightPreview: latestOutcome.savedInsightPreview,
  };
};

const buildG12DetailResponse = async (): Promise<G12WorkflowDetailData> => {
  const [runRows, insightRows, metricRows] = await Promise.all([
    queryTableRows(G12_SUPABASE_TABLES.fetchRuns, 10, ["completed_at", "created_at"]),
    queryTableRows(G12_SUPABASE_TABLES.insights, 100, ["created_at", "updated_at", "stored_at"]),
    queryTableRows(G12_SUPABASE_TABLES.metrics, 100, ["created_at", "updated_at", "stored_at"]),
  ]);

  const runs = runRows
    .map((row) => normalizeG12SupabaseRunRow(row))
    .filter((value): value is G12SupabaseRun => Boolean(value))
    .sort((left, right) => (new Date(right.completed_at ?? right.created_at ?? 0).getTime() - new Date(left.completed_at ?? left.created_at ?? 0).getTime()));

  const runRowsById = new Map<string, JsonRecord>();
  for (const row of runRows) {
    const id = typeof row.fetch_run_id === "string" && row.fetch_run_id.trim() ? row.fetch_run_id.trim() : null;
    if (id) {
      runRowsById.set(id, row);
    }
  }

  const metricMap = new Map<string, JsonRecord>();
  for (const row of metricRows) {
    const metricId = typeof row.metric_id === "string" && row.metric_id.trim() ? row.metric_id.trim() : null;
    if (metricId) {
      metricMap.set(metricId, row);
    }
  }

  const runIdSet = new Set(runs.map((run) => run.fetch_run_id).filter((value): value is string => Boolean(value)));
  const normalizedInsights = insightRows
    .map((row, index) => normalizeG12SupabaseInsightRow(row, index))
    .filter((value): value is G12SupabaseInsight => Boolean(value))
    .filter((insight) => (insight.fetch_run_id ? runIdSet.has(insight.fetch_run_id) : false))
    .sort((left, right) => {
      const leftTime = new Date(left.created_at ?? 0).getTime();
      const rightTime = new Date(right.created_at ?? 0).getTime();
      return rightTime - leftTime;
    });

  const savedInsights = normalizedInsights.map((insight) => {
    const metric = insight.metric_id ? metricMap.get(insight.metric_id) ?? null : null;
    return buildG12SavedInsightView(insight, insight.fetch_run_id ? runRowsById.get(insight.fetch_run_id) ?? null : null, metric);
  });

  const detailOutcomes = runs.map((run) => {
    const insightsForRun = savedInsights.filter((insight) => insight.fetchRunId === run.fetch_run_id);
    return buildG12DetailRecentOutcome(run, runRowsById.get(run.fetch_run_id) ?? null, insightsForRun);
  });

  const workflow = buildWorkflowView(
    "G12",
    detailOutcomes.map((outcome) => ({
      time: outcome.time,
      result: outcome.result,
      whatWasChecked: outcome.whatWasChecked,
      whatHappened: outcome.whatHappened,
      actionNeeded: outcome.actionNeeded,
      whyItBlocked: outcome.whyItBlocked,
      sourceLabel: outcome.sourceLabel,
    })),
  );

  const latestRun = runs[0] ?? null;
  const latestOutcome = latestRun ? buildG12DetailLatestOutcome(latestRun, savedInsights.filter((insight) => insight.fetchRunId === latestRun.fetch_run_id)) : null;

  return {
    workflowGroup: "G12",
    latestOutcome,
    savedInsights,
    recentOutcomes: detailOutcomes,
    workflow,
    status: workflow.latestOutcome ? "PASS" : "EMPTY",
    message: workflow.latestOutcome ? "G12 workflow detail loaded from Supabase." : workflow.emptyStateCopy,
  };
};

const G4_WORKFLOW_TITLE = "G4 Content / Landing / Claim Check" as const;
const G4_WORKFLOW_PURPOSE =
  "Checks captions, claims, landing-page wording, and risky language before content moves forward.";
const G4_WORKFLOW_DETAIL_HREF = "/dashboard/n8n-automations/g4" as const;
const G4_WORKFLOW_EMPTY_COPY = "No content checks yet." as const;
const G4_WORKFLOW_ERROR_COPY = "Unable to load content checks right now." as const;

const buildG4OutcomeFromDetail = (
  outcome: G4WorkflowDetail["recentOutcomes"][number],
): WorkflowOutcomeSummary => ({
  time: outcome.time,
  result: outcome.result,
  whatWasChecked: G4_WORKFLOW_PURPOSE,
  whatHappened: outcome.whatHappened,
  actionNeeded: outcome.actionNeeded,
  whyItBlocked: outcome.result === "BLOCK" ? outcome.whatHappened : null,
  sourceLabel: "G4 content review",
});

const buildG4LatestOutcomeSummary = (detail: G4WorkflowDetail): WorkflowOutcomeSummary | null => {
  if (!detail.latestOutcome) {
    return null;
  }

  return {
    time: detail.latestOutcome.handledAt ?? detail.lastRunAt,
    result: detail.latestOutcome.result,
    whatWasChecked: G4_WORKFLOW_PURPOSE,
    whatHappened: detail.latestOutcome.summary,
    actionNeeded: detail.actionNeeded,
    whyItBlocked: detail.latestOutcome.result === "BLOCK" ? detail.latestOutcome.failureReasons.join(" · ") || null : null,
    sourceLabel: "G4 content review",
  };
};

const buildG4WorkflowView = (detail: G4WorkflowDetail): WorkflowDetailView => ({
  workflowId: "G4",
  title: G4_WORKFLOW_TITLE,
  purpose: G4_WORKFLOW_PURPOSE,
  detailHref: G4_WORKFLOW_DETAIL_HREF,
  status: detail.status,
  lastRunAt: detail.lastRunAt,
  latestAssetId: detail.latestOutcome?.assetId ?? null,
  latestOutcome: buildG4LatestOutcomeSummary(detail),
  recentOutcomes: detail.recentOutcomes.map(buildG4OutcomeFromDetail),
  runLabel: "Start Content Check",
  runEnabled: false,
  runDisabledReason: "Content checks are available through the approved workflow trigger.",
  emptyStateCopy: G4_WORKFLOW_EMPTY_COPY,
  mainActionNeeded: detail.actionNeeded,
});

const buildG4DetailResponse = async (): Promise<{
  workflowGroup: "G4";
  workflow: WorkflowDetailView;
  g4Detail: G4WorkflowDetail;
  status: "PASS" | "EMPTY";
  message: string;
}> => {
  const detail = await getG4WorkflowDetail();
  const workflow = buildG4WorkflowView(detail);

  return {
    workflowGroup: "G4",
    workflow,
    g4Detail: detail,
    status: workflow.latestOutcome ? "PASS" : "EMPTY",
    message:
      detail.status === "ERROR"
        ? G4_WORKFLOW_ERROR_COPY
        : workflow.latestOutcome
          ? "G4 content checks loaded."
          : workflow.emptyStateCopy,
  };
};

const buildGenericOutcomes = (workflowId: AdminWorkflowId, bundles: TableBundle[]) =>
  bundles
    .flatMap((bundle) =>
      bundle.rows
        .map((row) => buildGenericOutcome(workflowId, row, bundle.table))
        .filter((value): value is WorkflowOutcomeSummary => Boolean(value)),
    )
    .sort(sortByTimeDesc);

const loadWorkflowOutcomes = async (workflowId: AdminWorkflowId) => {
  if (workflowId === "G2") {
    const bundles = await queryWorkflowTables(workflowId);
    return buildG2Outcomes(bundles);
  }

  if (workflowId === "G4") {
    const detail = await getG4WorkflowDetail();

    if (detail.status === "ERROR") {
      const errorOutcome: WorkflowOutcomeSummary = {
        time: new Date().toISOString(),
        result: "ERROR",
        whatWasChecked: detail.purpose,
        whatHappened: detail.actionNeeded,
        actionNeeded: detail.actionNeeded,
        whyItBlocked: null,
        sourceLabel: "G4 content review",
      };

      return [errorOutcome];
    }

    return detail.recentOutcomes.map(buildG4OutcomeFromDetail).sort(sortByTimeDesc);
  }

  if (workflowId === "G5") {
    const detail = await loadG5PublishingSchedulerDetail();
    const workflow = buildG5WorkflowViewFromDetail(detail);
    return workflow.latestOutcome ? [workflow.latestOutcome, ...workflow.recentOutcomes] : workflow.recentOutcomes;
  }

  const bundles = await queryWorkflowTables(workflowId);

  switch (workflowId) {
    case "G1":
      return buildG1Outcomes(bundles);
    case "G12":
      return buildG12Outcomes(bundles);
    default:
      return buildGenericOutcomes(workflowId, bundles);
  }
};

const buildWorkflowView = (workflowId: AdminWorkflowId, outcomes: WorkflowOutcomeSummary[]): WorkflowDetailView => {
  const entry = WORKFLOW_CATALOG[workflowId];
  const latestOutcome = outcomes[0] ?? null;

  return {
    workflowId,
    title: entry.title,
    purpose: entry.purpose,
    detailHref: entry.detailHref,
    status: latestOutcome?.result ?? entry.fallbackStatus,
    lastRunAt: latestOutcome?.time ?? null,
    latestOutcome,
    recentOutcomes: outcomes.slice(0, 10),
    runLabel: entry.runLabel,
    runEnabled: entry.runEnabled,
    runDisabledReason: entry.runDisabledReason,
    emptyStateCopy: entry.emptyStateCopy,
    mainActionNeeded: latestOutcome?.actionNeeded ?? getWorkflowEmptyStateActionNeeded(workflowId),
  };
};

export type WorkflowDashboardOverviewResponse = {
  status: "PASS" | "EMPTY";
  message: string;
  workflows: WorkflowOverviewCard[];
};

export type WorkflowDashboardDetailResponse = {
  status: WorkflowUiStatus | "EMPTY";
  message: string;
  workflowGroup: AdminWorkflowId;
  workflow: WorkflowDetailView;
  title?: string;
  purpose?: string;
  lastRunAt?: string | null;
  latestOutcome?: WorkflowOutcomeSummary | G12LatestOutcomeView | null;
  recentOutcomes?: WorkflowOutcomeSummary[] | G12RecentOutcomeView[];
  savedInsights?: G12SavedInsightView[];
  g4Detail?: G4WorkflowDetail | null;
  g5Detail?: G5PublishingSchedulerDetail | null;
};

export type WorkflowDashboardRunResponse = {
  status: WorkflowUiStatus;
  message: string;
  response_type: string | null;
  handled_at: string;
  outcome: WorkflowOutcomeSummary;
  workflowId: AdminWorkflowId;
  title: string;
  purpose: string;
};

export const loadWorkflowDashboardOverview = async (): Promise<WorkflowDashboardOverviewResponse> => {
  const workflows = await Promise.all(
    ADMIN_WORKFLOW_IDS.map(async (workflowId) => {
      const workflow = buildWorkflowView(workflowId, await loadWorkflowOutcomes(workflowId));
      const card: WorkflowOverviewCard = {
        workflowId,
        title: workflow.title,
        purpose: workflow.purpose,
        detailHref: workflow.detailHref,
        status: workflow.status,
        lastRunAt: workflow.lastRunAt,
        latestAssetId: workflow.latestAssetId ?? null,
        mainActionNeeded: workflow.mainActionNeeded,
        runEnabled: workflow.runEnabled,
        runDisabledReason: workflow.runDisabledReason,
        runLabel: workflow.runLabel,
        emptyStateCopy: workflow.emptyStateCopy,
      };

      return card;
    }),
  );

  return {
    status: workflows.some((workflow) => workflow.lastRunAt) ? "PASS" : "EMPTY",
    message: workflows.some((workflow) => workflow.lastRunAt)
      ? "Workflow overview loaded."
      : "No workflow outcomes are stored yet.",
    workflows,
  };
};

export const loadWorkflowDashboardDetail = async (workflowIdInput: string): Promise<WorkflowDashboardDetailResponse | null> => {
  const workflowId = normalizeWorkflowId(workflowIdInput);
  if (!workflowId) {
    return null;
  }

  if (workflowId === "G2") {
    return buildG2DetailResponse();
  }

  if (workflowId === "G12") {
    return buildG12DetailResponse();
  }

  if (workflowId === "G4") {
    return buildG4DetailResponse();
  }

  if (workflowId === "G5") {
    const detail = await loadG5PublishingSchedulerDetail();
    const workflow = buildG5WorkflowViewFromDetail(detail);

    return {
      status: workflow.status,
      message: buildG5PublishingSchedulerMessage(detail),
      workflowGroup: "G5",
      workflow,
      latestOutcome: workflow.latestOutcome ?? null,
      recentOutcomes: workflow.recentOutcomes,
      g5Detail: detail,
    };
  }

  const workflow = buildWorkflowView(workflowId, await loadWorkflowOutcomes(workflowId));
  return {
    status: workflow.latestOutcome ? "PASS" : "EMPTY",
    message: workflow.latestOutcome ? "Workflow detail loaded from Supabase." : workflow.emptyStateCopy,
    workflowGroup: workflowId,
    workflow,
  };
};

const summarizeRunPayload = (workflowId: AdminWorkflowId, values: WorkflowRunValues) => {
  const candidates = [values as JsonRecord];
  switch (workflowId) {
    case "G1":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["workflow_requesting_check"]),
        pickFormattedFromCandidates(candidates, ["action_type"]),
        pickFormattedFromCandidates(candidates, ["platform"]),
      ]);
    case "G2":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["platform"]),
        pickFormattedFromCandidates(candidates, ["account_id"]),
        pickFormattedFromCandidates(candidates, ["status"]),
      ]);
    case "G3":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["lane"]),
        pickFormattedFromCandidates(candidates, ["contact_identifier"]),
        pickFormattedFromCandidates(candidates, ["channel"]),
      ]);
    case "G4":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["intended_use"]),
        pickFormattedFromCandidates(candidates, ["platform"]),
      ]);
    case "G5":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["asset_id"]),
        pickFormattedFromCandidates(candidates, ["platform"]),
        pickFormattedFromCandidates(candidates, ["schedule_mode"]),
      ]);
    case "G6":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["contact_reference"]),
        pickFormattedFromCandidates(candidates, ["channel"]),
        pickFormattedFromCandidates(candidates, ["action"]),
      ]);
    case "G7":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["product_or_sku"]),
        pickFormattedFromCandidates(candidates, ["proof_type"]),
      ]);
    case "G8":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["creator_handle"]),
        pickFormattedFromCandidates(candidates, ["intended_use"]),
      ]);
    case "G9":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["platform"]),
        pickFormattedFromCandidates(candidates, ["account_id"]),
        pickFormattedFromCandidates(candidates, ["recommendation_action_type"]),
      ]);
    case "G10":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["page_url"]),
        pickFormattedFromCandidates(candidates, ["seo_cro_action_type"]),
      ]);
    case "G11":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["decision_type"]),
        pickFormattedFromCandidates(candidates, ["target_workflow"]),
      ]);
    case "G12":
      return joinLabels([
        pickFormattedFromCandidates(candidates, ["branch_key"]),
        pickFormattedFromCandidates(candidates, ["query"]),
        pickFormattedFromCandidates(candidates, ["platforms"]),
      ]);
    default:
      return null;
  }
};

const resolveRunTarget = (workflowId: AdminWorkflowId, values: WorkflowRunValues) => {
  const requestedBy = typeof values.requested_by === "string" && values.requested_by.trim() ? values.requested_by.trim() : "admin";
  const dryRun = values.dry_run !== false;
  const notes = typeof values.notes === "string" && values.notes.trim() ? values.notes.trim() : null;
  const basePayload: JsonRecord = {
    workflow_group: workflowId,
    workflow_id: workflowId,
    requested_by: requestedBy,
    actor: requestedBy,
    dry_run: dryRun,
    notes,
    source_platform: "WEBSITE",
    source_route: `/api/admin/workflow-dashboard/${workflowId}/run`,
  };

  switch (workflowId) {
    case "G1":
      return {
        path: WORKFLOW_RUN_PATHS.G1,
        payload: {
          ...basePayload,
          workflow_requesting_check: values.workflow_requesting_check,
          action_type: values.action_type,
          platform: values.platform,
        },
        dryRun,
      };
    case "G2":
      return {
        path: WORKFLOW_RUN_PATHS.G2,
        payload: {
          ...basePayload,
          platform: values.platform,
          account_id: values.account_id,
          status: values.status,
          health_status: values.status,
          evidence_url: values.evidence_url ?? null,
        },
        dryRun,
      };
    case "G3": {
      const lane = typeof values.lane === "string" ? values.lane.trim() : "";
      if (lane === "consent") {
        return {
          url: G3_RUN_URLS.consent,
          payload: {
            ...basePayload,
            event_type: "CONSENT_INGEST",
            contact_id: values.contact_identifier,
            channel: values.channel,
            consent_status: values.consent_status,
            explicit_consent: values.consent_status === "YES",
            privacy_policy_version: env.cevonnePrivacyPolicyVersion,
            source_event: "admin_dashboard_run",
            source_platform: "WEBSITE",
          },
          dryRun,
        };
      }

      if (lane === "opt_out") {
        return {
          url: G3_RUN_URLS.opt_out,
          payload: {
            ...basePayload,
            event_type: "OPT_OUT",
            contact_id: values.contact_identifier,
            channel: values.channel,
            opt_out_reason: values.opt_out_reason ?? "admin_request",
            source_event: "admin_dashboard_run",
            source_platform: "WEBSITE",
          },
          dryRun,
        };
      }

      if (lane === "attribution") {
        return {
          url: G3_RUN_URLS.attribution,
          payload: {
            ...basePayload,
            event_type: "ATTRIBUTION_EVENT",
            contact_id: values.contact_identifier,
            event_name: values.attribution_event ?? "admin_dashboard_run",
            source_platform: "WEBSITE",
            tracking_consent_status: values.consent_status ?? "YES",
          },
          dryRun,
        };
      }

      if (lane === "purchase") {
        return {
          url: G3_RUN_URLS.purchase,
          payload: {
            ...basePayload,
            event_type: "PURCHASE_EVENT",
            order_id: values.attribution_event ?? values.contact_identifier,
            contact_id: values.contact_identifier,
            purchase_value: values.purchase_value ?? null,
            currency: "INR",
            items: [],
            source_platform: "WEBSITE",
          },
          dryRun,
        };
      }

      return {
        url: G3_RUN_URLS.privacy_request,
        payload: {
          ...basePayload,
          event_type: "PRIVACY_REQUEST",
          contact_id: values.contact_identifier,
          request_type: values.request_type ?? "DELETE",
          verification_status: "PENDING",
          source_platform: "WEBSITE",
        },
        dryRun,
      };
    }
    case "G4":
      return {
        path: WORKFLOW_RUN_PATHS.G4,
        payload: {
          ...basePayload,
          content_text: values.content_text,
          intended_use: values.intended_use,
          platform: values.platform,
        },
        dryRun,
      };
    case "G5":
      return {
        path: WORKFLOW_RUN_PATHS.G5,
        payload: {
          ...basePayload,
          asset_id: values.asset_id,
          platform: values.platform,
          schedule_mode: values.schedule_mode,
          scheduled_for: values.scheduled_for ?? null,
        },
        dryRun,
      };
    case "G6":
      return {
        path: WORKFLOW_RUN_PATHS.G6,
        payload: {
          ...basePayload,
          contact_reference: values.contact_reference,
          channel: values.channel,
          action: values.action,
          message_or_action: values.message_or_action,
        },
        dryRun,
      };
    case "G7":
      return {
        path: WORKFLOW_RUN_PATHS.G7,
        payload: {
          ...basePayload,
          product_or_sku: values.product_or_sku,
          offer_or_stock_claim: values.offer_or_stock_claim,
          proof_type: values.proof_type ?? null,
        },
        dryRun,
      };
    case "G8":
      return {
        path: WORKFLOW_RUN_PATHS.G8,
        payload: {
          ...basePayload,
          ugc_source_url: values.ugc_source_url,
          creator_handle: values.creator_handle,
          intended_use: values.intended_use,
        },
        dryRun,
      };
    case "G9":
      return {
        path: WORKFLOW_RUN_PATHS.G9,
        payload: {
          ...basePayload,
          platform: values.platform,
          account_id: values.account_id,
          recommendation_action_type: values.recommendation_action_type,
          campaign_adset_ad_id: values.campaign_adset_ad_id ?? null,
          metrics: values.metrics ?? null,
          rollback_payload: values.rollback_payload ?? null,
        },
        dryRun,
      };
    case "G10":
      return {
        path: WORKFLOW_RUN_PATHS.G10,
        payload: {
          ...basePayload,
          page_url: values.page_url,
          seo_cro_action_type: values.seo_cro_action_type,
          recommendation_notes: values.recommendation_notes,
        },
        dryRun,
      };
    case "G11": {
      const decisionType = typeof values.decision_type === "string" ? values.decision_type.trim() : "";
      const url =
        decisionType === "decision_recommendation"
          ? G11_RUN_URLS.decision_recommendation
          : decisionType === "draft_action_packet"
            ? G11_RUN_URLS.draft_action_packet
            : G11_RUN_URLS.weekly_digest;

      return {
        url,
        payload: {
          ...basePayload,
          event_type:
            decisionType === "decision_recommendation"
              ? "G11_DECISION_RECOMMENDATION_REQUEST"
              : decisionType === "draft_action_packet"
                ? "G11_DRAFT_ACTION_PACKET_REQUEST"
                : "G11_WEEKLY_DIGEST_REQUEST",
          decision_type: values.decision_type,
          target_workflow: values.target_workflow,
          supporting_context: values.supporting_context ?? null,
        },
        dryRun,
      };
    }
    case "G12":
      return {
        url: env.n8nG12PublicTrendFetchUrl || undefined,
        payload: {
          ...basePayload,
          platforms: values.platforms,
          query: values.query,
          fetch_limit: values.fetch_limit,
          top_comments_limit: values.top_comments_limit ?? 0,
          branch_key: values.branch_key ?? "general_public_trend_fetch",
        },
        dryRun,
      };
    case "WF1":
    default:
      return null;
  }
};

const buildRunOutcome = (
  workflowId: AdminWorkflowId,
  values: WorkflowRunValues,
  result: { response: Awaited<ReturnType<typeof postN8nWebhook>>; target: ReturnType<typeof resolveRunTarget> },
): WorkflowDashboardRunResponse => {
  const entry = WORKFLOW_CATALOG[workflowId];
  const status = normalizeWorkflowUiStatus(result.response.status, entry.fallbackStatus);
  const reason = result.response.fail_reason ?? result.response.failure_reasons?.[0] ?? null;
  const whatWasChecked = summarizeRunPayload(workflowId, values) ?? entry.purpose;
  const whatHappened =
    sanitizeDisplayText(result.response.message) ?? getWorkflowStatusMessage(status);

  return {
    status,
    message: whatHappened,
    response_type: result.response.response_type ?? null,
    handled_at: result.response.handled_at ?? new Date().toISOString(),
    outcome: {
      time: result.response.handled_at ?? new Date().toISOString(),
      result: status,
      whatWasChecked,
      whatHappened,
      actionNeeded: getWorkflowActionNeeded({
        workflowId,
        status,
        reason,
        rowHints: [whatWasChecked, whatHappened].filter(Boolean) as string[],
      }),
      whyItBlocked: status === "BLOCK" || status === "ERROR" || status === "NEEDS_EVIDENCE" || status === "FIX_FIRST" ? humanizeReasonText(reason) : null,
      sourceLabel: "n8n",
    },
    workflowId,
    title: entry.title,
    purpose: entry.purpose,
  };
};

export const runWorkflowDashboardWorkflow = async (
  workflowIdInput: string,
  values: WorkflowRunValues,
): Promise<WorkflowDashboardRunResponse | null> => {
  const workflowId = normalizeWorkflowId(workflowIdInput);
  if (!workflowId) {
    return null;
  }

  if (workflowId === "WF1") {
    return {
      status: "BLOCK",
      message: "This workflow runs automatically or needs manual approval first.",
      response_type: null,
      handled_at: new Date().toISOString(),
      outcome: {
        time: new Date().toISOString(),
        result: "BLOCK",
        whatWasChecked: WORKFLOW_CATALOG.WF1.purpose,
        whatHappened: "This workflow runs automatically or needs manual approval first.",
        actionNeeded: WORKFLOW_CATALOG.WF1.runDisabledReason ?? "This workflow runs automatically or needs manual approval first.",
        whyItBlocked: "Manual run is disabled.",
        sourceLabel: "workflow",
      },
      workflowId,
      title: WORKFLOW_CATALOG.WF1.title,
      purpose: WORKFLOW_CATALOG.WF1.purpose,
    };
  }

  const target = resolveRunTarget(workflowId, values);
  if (!target) {
    return null;
  }

  if (!target.path && !target.url) {
    return {
      status: "ERROR",
      message: "Missing n8n webhook configuration.",
      response_type: null,
      handled_at: new Date().toISOString(),
      outcome: {
        time: new Date().toISOString(),
        result: "ERROR",
        whatWasChecked: summarizeRunPayload(workflowId, values) ?? WORKFLOW_CATALOG[workflowId].purpose,
        whatHappened: "Missing n8n webhook configuration.",
        actionNeeded: "Ask admin or developer to check the workflow configuration.",
        whyItBlocked: "Missing n8n webhook configuration.",
        sourceLabel: "configuration",
      },
      workflowId,
      title: WORKFLOW_CATALOG[workflowId].title,
      purpose: WORKFLOW_CATALOG[workflowId].purpose,
    };
  }

  const response = await postN8nWebhook({
    path: target.path ?? undefined,
    url: target.url ?? undefined,
    payload: target.payload,
    dryRun: target.dryRun,
  });

  return buildRunOutcome(workflowId, values, { response, target });
};
