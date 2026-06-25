import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { type G4WorkflowDetail, extractG4ContentPreview, getG4ActionNeeded, mapG4Status, normalizeG4Text, normalizeG4Timestamp, summarizeG4Outcome } from "@/lib/admin/g4-content-review";
import { type G5PublishingLatestOutcome, type G5PublishingOutcome, type G5PublishingSchedulerDetail, type G5PublishingSchedulerStatus, type G5PublishingSelectedAsset } from "@/lib/admin/g5-publishing-scheduler";
import { getG5PrimaryAction } from "@/lib/admin/g5-publishing-scheduler";
import { getWorkflowEmptyStateActionNeeded, getWorkflowStatusMessage, humanizeReasonText, normalizeWorkflowUiStatus, sanitizeDisplayText, type WorkflowOutcomeSummary, type WorkflowDetailView, type WorkflowUiStatus } from "@/lib/admin/workflows";
import { postN8nWebhook } from "@/lib/n8n-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/server/config";
import { getG4WorkflowDetail } from "@/server/next/api/g4-content-check-adapter";

export type { G5PublishingSchedulerDetail };

type JsonRecord = Record<string, unknown>;

type G4ReviewRow = JsonRecord & {
  id?: string | null;
  content_review_id?: string | null;
  review_id?: string | null;
  workflow_group?: string | null;
  workflow_id?: string | null;
  action_type?: string | null;
  platform?: string | null;
  asset_id?: string | null;
  asset_type?: string | null;
  status?: string | null;
  approval_state?: string | null;
  failure_reasons?: unknown;
  safe_summary?: string | null;
  ai_risk_summary?: string | null;
  ai_safe_rewrite?: string | null;
  ai_caption_suggestions?: unknown;
  ai_hook_suggestions?: unknown;
  ai_claim_notes?: unknown;
  ai_human_review_recommendation?: string | null;
  claim_ids_checked?: unknown;
  landing_page_match_status?: string | null;
  requires_human_approval?: boolean | null;
  evidence_url?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  raw_payload?: unknown;
};

type G5ApprovalRow = JsonRecord & {
  id?: string | null;
  approval_id?: string | null;
  asset_id?: string | null;
  workflow_group?: string | null;
  workflow_id?: string | null;
  decision?: string | null;
  reviewer?: string | null;
  reason?: string | null;
  evidence_url?: string | null;
  approved_at?: string | null;
  expires_at?: string | null;
  locked?: boolean | null;
  created_at?: string | null;
};

type G1ComplianceRunRow = JsonRecord & {
  id?: string | null;
  workflow_group?: string | null;
  workflow_id?: string | null;
  action_type?: string | null;
  platform?: string | null;
  account_id?: string | null;
  asset_id?: string | null;
  execution_mode?: string | null;
  status?: string | null;
  response_type?: string | null;
  fail_reason?: string | null;
  failure_reasons?: unknown;
  policy_ids_checked?: unknown;
  action_packet?: unknown;
  client_summary?: string | null;
  handled_at?: string | null;
  created_at?: string | null;
};

type G1ComplianceTokenRow = JsonRecord & {
  id?: string | null;
  compliance_run_id?: string | null;
  token?: string | null;
  action_hash?: string | null;
  status?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  used_at?: string | null;
  created_at?: string | null;
};

type G2AccountHealthRow = JsonRecord & {
  id?: string | null;
  platform?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  status?: string | null;
  mode?: string | null;
  evidence_url?: string | null;
  evidence_note?: string | null;
  checked_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkflowExecutionLogRow = JsonRecord & {
  id?: string | null;
  workflow_group?: string | null;
  workflow_id?: string | null;
  action_type?: string | null;
  platform?: string | null;
  status?: string | null;
  dry_run?: boolean | null;
  created_at?: string | null;
};

export type G5PublishingDryRunInput = {
  approval_id?: string | null;
  asset_id?: string | null;
  requested_by?: string | null;
  notes?: string | null;
};

export type G5PublishingDryRunResponse = {
  status: G5PublishingSchedulerStatus;
  result: G5PublishingSchedulerStatus;
  message: string;
  summary: string;
  action_needed: string;
  dry_run: true;
  not_executed: true;
  handled_at: string;
  workflowGroup: "G5";
  workflowId: "WF1";
  title: string;
  purpose: string;
  outcome: G5PublishingOutcome;
  g1_compliance_run_id: string | null;
  workflow_execution_log_id: string | null;
  compliance_token_issued: boolean;
};

const G5_WORKFLOW_GROUP = "G5" as const;
const G5_WORKFLOW_ID = "WF1" as const;
const G5_TITLE = "Publishing Scheduler" as const;
const G5_PURPOSE =
  "Schedules approved assets only after review, dry-run, and live safety checks are complete." as const;

const G5_APPROVAL_SELECT = "id, approval_id, asset_id, workflow_group, workflow_id, decision, reviewer, reason, evidence_url, approved_at, expires_at, locked, created_at" as const;
const G4_REVIEW_SELECT =
  "id, content_review_id, review_id, workflow_group, workflow_id, action_type, platform, asset_id, asset_type, status, approval_state, failure_reasons, safe_summary, ai_risk_summary, ai_safe_rewrite, ai_caption_suggestions, ai_hook_suggestions, ai_claim_notes, ai_human_review_recommendation, claim_ids_checked, landing_page_match_status, requires_human_approval, evidence_url, reviewed_at, created_at, raw_payload" as const;
const G1_RUN_SELECT =
  "id, workflow_group, workflow_id, action_type, platform, account_id, asset_id, execution_mode, status, response_type, fail_reason, failure_reasons, policy_ids_checked, action_packet, client_summary, handled_at, created_at" as const;
const G1_TOKEN_SELECT = "id, compliance_run_id, token, action_hash, status, issued_at, expires_at, used_at, created_at" as const;
const G2_HEALTH_SELECT = "id, platform, account_id, account_name, status, mode, evidence_url, evidence_note, checked_at, expires_at, created_at, updated_at" as const;
const G5_EXECUTION_LOG_SELECT = "id, workflow_group, workflow_id, action_type, platform, status, dry_run, created_at" as const;
const SAFE_POLICY_IDS = ["G1_REQUIRED_FIELDS", "G1_REMOVED_AUTOMATIONS", "G2_ACCOUNT_HEALTH", "G4_CONTENT_REVIEW", "G5_APPROVAL"] as const;

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

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  const text = toText(value)?.toLowerCase() ?? "";
  if (!text) {
    return null;
  }

  if (["true", "1", "yes", "on"].includes(text)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(text)) {
    return false;
  }

  return null;
};

const parseDate = (value: unknown) => {
  const text = toText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const readText = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const text = toText(row[key]);
    if (text) {
      return text;
    }
  }

  return null;
};

const readDate = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const date = parseDate(row[key]);
    if (date) {
      return date;
    }
  }

  return null;
};

const readBoolean = (row: JsonRecord | null | undefined, keys: string[]) => {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toBoolean(row[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const coerceG5Status = (value: unknown, fallback: G5PublishingSchedulerStatus): G5PublishingSchedulerStatus => {
  const normalized = normalizeWorkflowUiStatus(value, fallback as WorkflowUiStatus);

  if (normalized === "RECOMMENDATION_ONLY" || normalized === "DO_NOT_SCALE") {
    return "MANUAL_ONLY";
  }

  return normalized as G5PublishingSchedulerStatus;
};

const readPayload = (row: JsonRecord | null | undefined) => {
  const payload = asRecord(row?.raw_payload);
  return asRecord(payload?.raw_payload) ?? payload;
};

const safeDisplayText = (value: unknown) => {
  const text = toText(value);
  if (!text) {
    return null;
  }

  if (/https?:\/\//i.test(text)) {
    return null;
  }

  return sanitizeDisplayText(text) ?? text;
};

const safeReferenceLabel = (value: unknown, fallback: string) => {
  const text = toText(value);
  if (!text) {
    return null;
  }

  if (/https?:\/\//i.test(text)) {
    return fallback;
  }

  return sanitizeDisplayText(text) ?? fallback;
};

const safeSummaryFromObject = (value: unknown, fallback: string) => {
  if (typeof value === "string") {
    const text = safeDisplayText(value);
    return text ?? fallback;
  }

  if (isRecord(value)) {
    const text = safeDisplayText(value.summary) ?? safeDisplayText(value.message) ?? safeDisplayText(value.notes);
    return text ?? fallback;
  }

  return fallback;
};

const humanizeLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const isMissingTableError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  return error.code === "PGRST205" || /Could not find the table/i.test(error.message ?? "");
};

const isMissingColumnError = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return false;
  }

  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
};

const queryRows = async <T extends JsonRecord>(
  table: string,
  select: string,
  options: {
    filters?: Array<[string, string | number | boolean | null]>;
    orderKeys?: string[];
    limit?: number;
  } = {},
): Promise<T[]> => {
  const orderKeys = options.orderKeys?.length ? options.orderKeys : ["created_at"];
  const limit = options.limit ?? 10;

  for (const orderKey of orderKeys) {
    let query: any = supabaseAdmin.from(table).select(select);

    for (const [column, value] of options.filters ?? []) {
      if (value === null) {
        query = query.is(column, null);
      } else {
        query = query.eq(column, value);
      }
    }

    const { data, error } = await query.order(orderKey, { ascending: false, nullsFirst: false }).limit(limit);

    if (!error && Array.isArray(data)) {
      return data as T[];
    }

    if (isMissingTableError(error)) {
      return [];
    }

    if (isMissingColumnError(error)) {
      continue;
    }

    return [];
  }

  return [];
};

const queryFirstRow = async <T extends JsonRecord>(
  table: string,
  select: string,
  options: {
    filters?: Array<[string, string | number | boolean | null]>;
    orderKeys?: string[];
  } = {},
): Promise<T | null> => {
  const rows = await queryRows<T>(table, select, {
    filters: options.filters,
    orderKeys: options.orderKeys,
    limit: 1,
  });

  return rows[0] ?? null;
};

const normalizeG5ApprovalStatus = (approval: G5ApprovalRow | null): G5PublishingSchedulerStatus => {
  if (!approval) {
    return "PENDING_APPROVAL";
  }

  const decision = toText(approval.decision)?.toUpperCase() ?? "";
  if (decision === "APPROVED") {
    return "PASS";
  }

  if (decision === "PENDING") {
    return "PENDING_APPROVAL";
  }

  if (["REJECTED", "CHANGES_REQUESTED", "DECLINED", "BLOCK", "BLOCKED"].includes(decision)) {
    return "BLOCK";
  }

  if (!decision) {
    return "PENDING_APPROVAL";
  }

  return coerceG5Status(decision, "PENDING_APPROVAL");
};

const normalizeAccountHealthStatus = (row: G2AccountHealthRow | null): G5PublishingSchedulerStatus => {
  if (!row) {
    return "NEEDS_EVIDENCE";
  }

  const status = toText(row.status)?.toUpperCase() ?? "";
  if (!status) {
    return "NEEDS_EVIDENCE";
  }

  if (["CLEAN", "ACTIVE", "PASS", "READY", "OK"].includes(status)) {
    return "PASS";
  }

  if (["WARNING", "MANUAL_ONLY", "REVIEW", "NEEDS_REVIEW"].includes(status)) {
    return "MANUAL_ONLY";
  }

  if (["RESTRICTED", "SUSPENDED", "BLOCK", "BLOCKED", "FAIL", "FAILED", "DISABLED"].includes(status)) {
    return "BLOCK";
  }

  if (["UNKNOWN", "PENDING"].includes(status)) {
    return "NEEDS_EVIDENCE";
  }

  return "NEEDS_EVIDENCE";
};

const normalizeComplianceStatus = (row: G1ComplianceRunRow | null, token: G1ComplianceTokenRow | null): G5PublishingSchedulerStatus => {
  if (!row) {
    return "NOT_RUN_YET";
  }

  const status = coerceG5Status(row.status, "ERROR");
  if (status !== "PASS") {
    return status;
  }

  const tokenStatus = toText(token?.status)?.toUpperCase() ?? "";
  const tokenIssued = tokenStatus === "ISSUED" || tokenStatus === "VALID";
  const tokenUsable = tokenIssued && (!token?.expires_at || new Date(token.expires_at).getTime() > Date.now()) && !token?.used_at;

  return tokenUsable ? "PASS" : "NEEDS_EVIDENCE";
};

const normalizeDryRunStatus = (row: WorkflowExecutionLogRow | null): G5PublishingSchedulerStatus => {
  if (!row) {
    return "NOT_RUN_YET";
  }

  const status = coerceG5Status(row.status, "ERROR");
  if (row.dry_run) {
    if (status === "PASS") {
      return "DRY_RUN";
    }

    if (status === "DRY_RUN") {
      return "DRY_RUN";
    }
  }

  return status;
};

const getActionTypeLabel = (value: string | null | undefined) => {
  const text = toText(value)?.toUpperCase() ?? "";
  if (text === "SCHEDULE_POST" || text === "PUBLISH_DRY_RUN") {
    return "Publishing dry-run";
  }

  if (text.includes("PUBLISH")) {
    return "Publishing";
  }

  if (text.includes("SCHEDULE")) {
    return "Scheduling";
  }

  if (text.includes("APPROVAL")) {
    return "Approval";
  }

  if (text.includes("ACCOUNT")) {
    return "Account health";
  }

  return humanizeLabel(value) ?? "Publishing update";
};

const getApprovalOutcomeSummary = (row: G5ApprovalRow) => {
  const decision = toText(row.decision)?.toUpperCase() ?? "";
  if (decision === "APPROVED") {
    return "The asset was approved for the next publishing step.";
  }

  if (decision === "PENDING") {
    return "The asset is waiting for G5 approval.";
  }

  if (decision === "CHANGES_REQUESTED") {
    return "Changes were requested before publishing can continue.";
  }

  if (decision === "REJECTED") {
    return "The asset was rejected and stopped safely.";
  }

  return "The G5 approval record was updated.";
};

const getApprovalActionNeeded = (row: G5ApprovalRow) => {
  const decision = toText(row.decision)?.toUpperCase() ?? "";
  if (decision === "APPROVED") {
    return "Run the publishing dry-run before moving forward.";
  }

  if (decision === "PENDING") {
    return "Open approval and record the missing decision.";
  }

  if (decision === "CHANGES_REQUESTED") {
    return "Update the asset and resubmit it for approval.";
  }

  if (decision === "REJECTED") {
    return "Review the rejection before trying again.";
  }

  return "Review the approval decision.";
};

const getG1OutcomeSummary = (row: G1ComplianceRunRow) => {
  const status = coerceG5Status(row.status, "ERROR");
  if (status === "PASS") {
    return safeSummaryFromObject(row.client_summary, "Compliance check passed.");
  }

  if (status === "BLOCK" || status === "NEEDS_EVIDENCE" || status === "FIX_FIRST") {
    return safeSummaryFromObject(row.client_summary, "Publishing dry-run was stopped because safety checks did not pass.");
  }

  if (status === "MANUAL_ONLY") {
    return safeSummaryFromObject(row.client_summary, "The compliance check needs manual review.");
  }

  if (status === "ERROR") {
    return safeSummaryFromObject(row.client_summary, "The compliance check could not be completed.");
  }

  return safeSummaryFromObject(row.client_summary, "The compliance check was recorded.");
};

const getG1ActionNeeded = (row: G1ComplianceRunRow, token: G1ComplianceTokenRow | null) => {
  const status = coerceG5Status(row.status, "ERROR");
  if (status === "PASS" && token) {
    return "Review the dry-run result before enabling live scheduling.";
  }

  if (status === "PASS") {
    return "Issue the compliance token before continuing.";
  }

  if (status === "BLOCK" || status === "NEEDS_EVIDENCE" || status === "FIX_FIRST") {
    return "View Safety Checks before trying again.";
  }

  if (status === "MANUAL_ONLY") {
    return "Review the compliance checks manually.";
  }

  if (status === "ERROR") {
    return "Check the workflow state and retry.";
  }

  return "Review the compliance check.";
};

const getHealthOutcomeSummary = (row: G2AccountHealthRow) => {
  const status = normalizeAccountHealthStatus(row);
  if (status === "PASS") {
    return "Account health is clean.";
  }

  if (status === "MANUAL_ONLY") {
    return "Account health needs manual review.";
  }

  if (status === "BLOCK") {
    return "Account health is blocking publishing.";
  }

  return "Account health needs evidence.";
};

const getHealthActionNeeded = (row: G2AccountHealthRow) => {
  const status = normalizeAccountHealthStatus(row);
  if (status === "PASS") {
    return "No action needed.";
  }

  if (status === "MANUAL_ONLY") {
    return "Review account health before running affected workflows.";
  }

  if (status === "BLOCK") {
    return "View Account Health before trying again.";
  }

  return "View Account Health to confirm the clean state.";
};

const getExecutionOutcomeSummary = (row: WorkflowExecutionLogRow) => {
  const status = normalizeDryRunStatus(row);
  if (row.dry_run) {
    if (status === "DRY_RUN") {
      return "Publishing dry-run completed safely. No live post was scheduled.";
    }

    if (status === "BLOCK") {
      return "Publishing dry-run was blocked safely.";
    }

    if (status === "MANUAL_ONLY") {
      return "Publishing stays manual-only.";
    }
  }

  if (status === "PASS") {
    return "Publishing completed successfully.";
  }

  if (status === "BLOCK") {
    return "Publishing was safely blocked.";
  }

  if (status === "MANUAL_ONLY") {
    return "Publishing is manual-only for this asset.";
  }

  if (status === "ERROR") {
    return "The publishing scheduler could not complete.";
  }

  if (status === "NEEDS_EVIDENCE") {
    return "Publishing is waiting on more evidence.";
  }

  return "Publishing execution was recorded.";
};

const getExecutionActionNeeded = (row: WorkflowExecutionLogRow) => {
  const status = normalizeDryRunStatus(row);
  if (row.dry_run) {
    if (status === "DRY_RUN") {
      return "Review the dry-run result before enabling live scheduling.";
    }

    if (status === "BLOCK") {
      return "Review Safety Checks before trying again.";
    }

    if (status === "MANUAL_ONLY") {
      return "Keep publishing manual-only until the remaining checks are complete.";
    }
  }

  if (status === "PASS") {
    return "No action needed.";
  }

  if (status === "BLOCK" || status === "NEEDS_EVIDENCE" || status === "FIX_FIRST") {
    return "Fix the issue before continuing.";
  }

  if (status === "MANUAL_ONLY") {
    return "Review the workflow manually.";
  }

  if (status === "ERROR") {
    return "Check the workflow state and retry.";
  }

  return "Review the execution log.";
};

const buildG5SelectedAsset = (input: {
  approval: G5ApprovalRow | null;
  g4Review: G4ReviewRow | null;
  g1Run: G1ComplianceRunRow | null;
  g2Health: G2AccountHealthRow | null;
}): G5PublishingSelectedAsset => {
  const g4Payload = readPayload(input.g4Review);
  const g1Payload = asRecord(input.g1Run?.action_packet) ?? readPayload(input.g1Run);

  const mediaReference =
    safeReferenceLabel(g4Payload?.media_reference ?? g4Payload?.media_url ?? g1Payload?.media_reference ?? g1Payload?.media_url, "Media reference recorded") ?? null;
  const storageReference =
    safeReferenceLabel(g4Payload?.storage_reference ?? g4Payload?.storage_url ?? g1Payload?.storage_reference ?? g1Payload?.storage_url, "Storage reference recorded") ?? null;

  const contentPreview = (() => {
    if (!input.g4Review) {
      return null;
    }

    const preview = extractG4ContentPreview(input.g4Review);
    const parts = [preview.headline, preview.contentText, preview.ctaText, preview.productName].filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(" · ") : null;
  })();

  const title =
    safeDisplayText(g4Payload?.headline) ??
    safeDisplayText(g4Payload?.product_name) ??
    safeDisplayText(input.g4Review?.safe_summary) ??
    safeDisplayText(input.approval?.reason) ??
    input.g4Review?.asset_id ??
    input.approval?.asset_id ??
    null;

  const liveExecutionEnabled = (() => {
    const explicit = readBoolean(g4Payload, ["live_execution_enabled"]);
    if (explicit !== null) {
      return explicit;
    }

    const noExternalWrite = readBoolean(g4Payload, ["no_external_write"]);
    if (noExternalWrite !== null) {
      return !noExternalWrite;
    }

    return null;
  })();

  const rollbackPayload =
    safeReferenceLabel(g4Payload?.rollback_payload ?? g1Payload?.rollback_payload, "Rollback payload recorded") ?? null;

  const finalHumanApprovalState = safeDisplayText(g4Payload?.final_human_approval_state ?? g1Payload?.final_human_approval_state) ?? null;

  const accountHealthStatus = normalizeAccountHealthStatus(input.g2Health);
  const g4ReviewStatus = input.g4Review ? mapG4Status(input.g4Review) : null;
  const g4ApprovalState = safeDisplayText(input.g4Review?.approval_state);
  const claimContentResult = input.g4Review ? summarizeG4Outcome(input.g4Review) : null;
  const riskSummary = safeDisplayText(input.g4Review?.ai_risk_summary ?? input.g4Review?.safe_summary);
  const aiReviewSummary =
    safeDisplayText(input.g4Review?.ai_human_review_recommendation) ??
    safeDisplayText(input.g4Review?.ai_safe_rewrite) ??
    safeDisplayText(input.g4Review?.safe_summary);

  return {
    assetId: input.g4Review?.asset_id ?? input.approval?.asset_id ?? input.g1Run?.asset_id ?? null,
    title,
    contentPreview,
    mediaReference,
    storageReference,
    g4ReviewId: input.g4Review?.review_id ?? input.g4Review?.content_review_id ?? null,
    approvalId: input.approval?.approval_id ?? null,
    platform: safeDisplayText(g4Payload?.platform ?? input.g1Run?.platform ?? input.g2Health?.platform),
    accountId: safeDisplayText(input.g2Health?.account_id ?? input.g1Run?.account_id),
    actionType: safeDisplayText(g1Payload?.action_type ?? g4Payload?.action_type ?? input.g1Run?.action_type) ?? null,
    g4ReviewStatus,
    g4ApprovalState,
    riskSummary,
    claimContentResult,
    aiReviewSummary,
    evidenceNote: safeDisplayText(input.g2Health?.evidence_note) ?? safeDisplayText(input.g2Health?.account_name),
    liveExecutionEnabled,
    rollbackPayload,
    finalHumanApprovalState,
    accountHealthStatus,
  };
};

const buildG5Readiness = (input: {
  selectedAsset: G5PublishingSelectedAsset;
  g4Review: G4ReviewRow | null;
  approval: G5ApprovalRow | null;
  g1Run: G1ComplianceRunRow | null;
  g1Token: G1ComplianceTokenRow | null;
  g2Health: G2AccountHealthRow | null;
  executionLog: WorkflowExecutionLogRow | null;
}): G5PublishingSchedulerDetail["readiness"] => {
  const g4Review = input.g4Review ? mapG4Status(input.g4Review) : "NEEDS_EVIDENCE";
  const approval = normalizeG5ApprovalStatus(input.approval);
  const g1Compliance = normalizeComplianceStatus(input.g1Run, input.g1Token);
  const g2AccountHealth = normalizeAccountHealthStatus(input.g2Health);

  const mediaReference = input.selectedAsset.mediaReference ? "PASS" : "NEEDS_EVIDENCE";
  const storageReference = input.selectedAsset.storageReference ? "PASS" : "NEEDS_EVIDENCE";
  const rollbackPayload = input.selectedAsset.rollbackPayload ? "PASS" : "NEEDS_EVIDENCE";
  const finalHumanApproval = input.selectedAsset.finalHumanApprovalState?.toUpperCase() === "APPROVED" ? "PASS" : "PENDING_APPROVAL";

  const publishingDryRun = normalizeDryRunStatus(input.executionLog);

  return {
    g4Review,
    g5Approval: approval,
    g1Compliance,
    g2AccountHealth,
    mediaReference,
    storageReference,
    publishingDryRun,
    rollbackPayload,
    finalHumanApproval,
  };
};

const hasDryRunPrerequisites = (readiness: G5PublishingSchedulerDetail["readiness"]) =>
  (readiness.g4Review === "PASS" || readiness.g4Review === "PENDING_APPROVAL") &&
  readiness.g5Approval === "PASS" &&
  readiness.g2AccountHealth === "PASS" &&
  readiness.mediaReference === "PASS" &&
  readiness.storageReference === "PASS";

const hasLivePrerequisites = (detail: G5PublishingSchedulerDetail) =>
  hasDryRunPrerequisites(detail.readiness) &&
  detail.readiness.g1Compliance === "PASS" &&
  detail.readiness.publishingDryRun === "DRY_RUN" &&
  detail.readiness.rollbackPayload === "PASS" &&
  detail.readiness.finalHumanApproval === "PASS" &&
  detail.selectedAsset.liveExecutionEnabled === true;

const findLatestRelevantTime = (times: Array<string | null | undefined>) => {
  const parsedTimes = times
    .map((value) => parseDate(value))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return parsedTimes[0] ?? null;
};

const buildSyntheticCurrentOutcome = (detail: Pick<G5PublishingSchedulerDetail, "status" | "readiness" | "selectedAsset" | "lastRunAt">): G5PublishingLatestOutcome => {
  const status = detail.status;
  return {
    result: status,
    summary:
      status === "NEEDS_EVIDENCE"
        ? detail.selectedAsset.mediaReference === null || detail.selectedAsset.storageReference === null
          ? "Publishing is not ready because no approved media file is attached."
          : detail.selectedAsset.g4ReviewId === null
            ? "Publishing is blocked safely because the asset has not passed G4 content review."
            : "Publishing is not ready because required evidence is missing."
        : status === "PENDING_APPROVAL"
          ? "Publishing is waiting for G5 approval."
          : status === "FIX_FIRST"
            ? "Approved asset found, but publishing dry-run has not been completed."
            : status === "MANUAL_ONLY"
              ? "Live publishing is manual-only until rollback, dry-run proof, and final human approval are complete."
              : getWorkflowStatusMessage(status),
    actionNeeded: getG5PrimaryAction(detail).description,
    handledAt: detail.lastRunAt,
    stage: "Publishing readiness",
    details: detail.selectedAsset.assetId,
  };
};

const buildExecutionOutcome = (row: WorkflowExecutionLogRow): G5PublishingOutcome => {
  const status = normalizeDryRunStatus(row);
  const stage = row.dry_run ? "Publishing dry-run" : getActionTypeLabel(row.action_type);
  const time = row.created_at ?? null;

  return {
    time,
    stage,
    status,
    whatHappened: getExecutionOutcomeSummary(row),
    actionNeeded: getExecutionActionNeeded(row),
    details: row.action_type ? `Action type: ${humanizeLabel(row.action_type) ?? row.action_type}` : null,
    handledAt: row.created_at ?? null,
    result: status,
    sourceLabel: "workflow execution log",
  };
};

const toLatestOutcomeSummary = (outcome: G5PublishingOutcome): G5PublishingLatestOutcome => ({
  result: outcome.result,
  summary: outcome.whatHappened,
  actionNeeded: outcome.actionNeeded,
  handledAt: outcome.handledAt,
  stage: outcome.stage,
  details: outcome.details,
});

const buildApprovalOutcome = (row: G5ApprovalRow): G5PublishingOutcome => {
  const status = normalizeG5ApprovalStatus(row);
  const time = row.approved_at ?? row.created_at ?? null;

  return {
    time,
    stage: "Approval",
    status,
    whatHappened: getApprovalOutcomeSummary(row),
    actionNeeded: getApprovalActionNeeded(row),
    details: row.reason ? safeDisplayText(row.reason) : row.evidence_url ? "Evidence recorded." : null,
    handledAt: row.approved_at ?? row.created_at ?? null,
    result: status,
    sourceLabel: "G5 approval",
  };
};

const buildG4Outcome = (row: G4ReviewRow): G5PublishingOutcome => {
  const status = mapG4Status(row);
  const time = row.reviewed_at ?? row.created_at ?? null;

  return {
    time,
    stage: "G4 review",
    status,
    whatHappened: summarizeG4Outcome(row),
    actionNeeded: getG4ActionNeeded(row),
    details:
      safeDisplayText(row.safe_summary) ??
      safeDisplayText(row.ai_human_review_recommendation) ??
      safeDisplayText(row.ai_risk_summary) ??
      null,
    handledAt: row.reviewed_at ?? row.created_at ?? null,
    result: status,
    sourceLabel: "G4 content review",
  };
};

const buildG1Outcome = (row: G1ComplianceRunRow, token: G1ComplianceTokenRow | null): G5PublishingOutcome => {
  const status = coerceG5Status(row.status, "ERROR");
  const time = row.handled_at ?? row.created_at ?? null;

  return {
    time,
    stage: "G1 compliance",
    status,
    whatHappened: getG1OutcomeSummary(row),
    actionNeeded: getG1ActionNeeded(row, token),
    details: token ? "Compliance token issued." : "Compliance token missing.",
    handledAt: row.handled_at ?? row.created_at ?? null,
    result: status,
    sourceLabel: "G1 compliance run",
  };
};

const buildHealthOutcome = (row: G2AccountHealthRow): G5PublishingOutcome => {
  const status = normalizeAccountHealthStatus(row);
  const time = row.checked_at ?? row.updated_at ?? row.created_at ?? null;

  return {
    time,
    stage: "Account health",
    status,
    whatHappened: getHealthOutcomeSummary(row),
    actionNeeded: getHealthActionNeeded(row),
    details: safeDisplayText(row.evidence_note) ?? safeDisplayText(row.account_name) ?? null,
    handledAt: row.checked_at ?? row.updated_at ?? row.created_at ?? null,
    result: status,
    sourceLabel: "G2 account health",
  };
};

const buildWorkflowExecutionOutcomes = (rows: WorkflowExecutionLogRow[]) => rows.map(buildExecutionOutcome);

const toWorkflowOutcomeSummary = (outcome: G5PublishingOutcome): WorkflowOutcomeSummary => ({
  time: outcome.time,
  result: outcome.result,
  whatWasChecked: outcome.stage,
  whatHappened: outcome.whatHappened,
  actionNeeded: outcome.actionNeeded,
  whyItBlocked: outcome.status === "BLOCK" || outcome.status === "ERROR" || outcome.status === "NEEDS_EVIDENCE" || outcome.status === "FIX_FIRST" ? outcome.details : null,
  sourceLabel: outcome.sourceLabel,
  summary: outcome.whatHappened,
  handledAt: outcome.handledAt,
  details: {
    whatWasChecked: outcome.stage,
    sourceLabel: outcome.sourceLabel,
  },
});

const toLatestOutcome = (outcome: G5PublishingOutcome): G5PublishingLatestOutcome => ({
  result: outcome.result,
  summary: outcome.whatHappened,
  actionNeeded: outcome.actionNeeded,
  handledAt: outcome.handledAt,
  stage: outcome.stage,
  details: outcome.details,
});

const toCurrentOutcomeSummary = (outcome: G5PublishingLatestOutcome): WorkflowOutcomeSummary => ({
  time: outcome.handledAt,
  result: outcome.result,
  whatWasChecked: outcome.stage ?? "Publishing readiness",
  whatHappened: outcome.summary,
  actionNeeded: outcome.actionNeeded,
  whyItBlocked: outcome.result === "BLOCK" || outcome.result === "ERROR" || outcome.result === "NEEDS_EVIDENCE" || outcome.result === "FIX_FIRST" ? outcome.details : null,
  sourceLabel: "G5 publishing scheduler",
  summary: outcome.summary,
  handledAt: outcome.handledAt,
  details: {
    whatWasChecked: outcome.stage ?? "Publishing readiness",
    sourceLabel: "G5 publishing scheduler",
  },
});

const buildWorkflowView = (detail: G5PublishingSchedulerDetail): WorkflowDetailView => ({
  workflowId: G5_WORKFLOW_ID,
  title: detail.title,
  purpose: detail.purpose,
  detailHref: "/dashboard/n8n-automations/g5",
  status: detail.status,
  lastRunAt: detail.lastRunAt,
  latestAssetId: detail.selectedAsset.assetId ?? null,
  latestOutcome: toCurrentOutcomeSummary(detail.latestOutcome),
  recentOutcomes: detail.recentOutcomes.map(toWorkflowOutcomeSummary),
  runLabel: "Run Publishing Dry Run",
  runEnabled: false,
  runDisabledReason: "G5 is controlled through evidence, approval, dry-run, and live safety checks.",
  emptyStateCopy: "No real G5 outcomes have been recorded yet. Publishing stays blocked until the required evidence is present.",
  mainActionNeeded: detail.latestOutcome.actionNeeded,
});

const readLatestApprovedApproval = async () => {
  const approved = await queryFirstRow<G5ApprovalRow>(
    "g5_approvals",
    G5_APPROVAL_SELECT,
    {
      filters: [["workflow_group", G5_WORKFLOW_GROUP], ["decision", "APPROVED"]],
      orderKeys: ["approved_at", "created_at"],
    },
  );

  if (approved) {
    return approved;
  }

  return queryFirstRow<G5ApprovalRow>(
    "g5_approvals",
    G5_APPROVAL_SELECT,
    {
      filters: [["workflow_group", G5_WORKFLOW_GROUP]],
      orderKeys: ["approved_at", "created_at"],
    },
  );
};

const readLatestG4ReviewForAsset = async (assetId: string | null) => {
  if (assetId) {
    const row = await queryFirstRow<G4ReviewRow>(
      "g4_content_reviews",
      G4_REVIEW_SELECT,
      {
        filters: [["workflow_group", "G4"], ["asset_id", assetId]],
        orderKeys: ["reviewed_at", "created_at"],
      },
    );

    if (row) {
      return row;
    }
  }

  return queryFirstRow<G4ReviewRow>(
    "g4_content_reviews",
    G4_REVIEW_SELECT,
    {
      filters: [["workflow_group", "G4"]],
      orderKeys: ["reviewed_at", "created_at"],
    },
  );
};

const readLatestG1RunForAsset = async (assetId: string | null) => {
  if (assetId) {
    const rows = await queryRows<G1ComplianceRunRow>(
      "g1_compliance_runs",
      G1_RUN_SELECT,
      {
        filters: [["workflow_group", G5_WORKFLOW_GROUP], ["asset_id", assetId]],
        orderKeys: ["handled_at", "created_at"],
        limit: 5,
      },
    );

    if (rows.length) {
      return rows;
    }
  }

  return queryRows<G1ComplianceRunRow>(
    "g1_compliance_runs",
    G1_RUN_SELECT,
    {
      filters: [["workflow_group", G5_WORKFLOW_GROUP]],
      orderKeys: ["handled_at", "created_at"],
      limit: 5,
    },
  );
};

const readLatestG1TokenForRun = async (runId: string | null) => {
  if (!runId) {
    return null;
  }

  return queryFirstRow<G1ComplianceTokenRow>(
    "g1_compliance_tokens",
    G1_TOKEN_SELECT,
    {
      filters: [["compliance_run_id", runId]],
      orderKeys: ["issued_at", "created_at"],
    },
  );
};

const readLatestHealthRow = async (platform: string | null, accountId: string | null) => {
  if (platform && accountId) {
    const row = await queryFirstRow<G2AccountHealthRow>(
      "g2_account_health",
      G2_HEALTH_SELECT,
      {
        filters: [["platform", platform], ["account_id", accountId]],
        orderKeys: ["checked_at", "updated_at", "created_at"],
      },
    );

    if (row) {
      return row;
    }
  }

  if (platform) {
    const row = await queryFirstRow<G2AccountHealthRow>(
      "g2_account_health",
      G2_HEALTH_SELECT,
      {
        filters: [["platform", platform]],
        orderKeys: ["checked_at", "updated_at", "created_at"],
      },
    );

    if (row) {
      return row;
    }
  }

  return queryFirstRow<G2AccountHealthRow>(
    "g2_account_health",
    G2_HEALTH_SELECT,
    {
      orderKeys: ["checked_at", "updated_at", "created_at"],
    },
  );
};

const readLatestExecutionLogs = async () =>
  queryRows<WorkflowExecutionLogRow>("workflow_execution_logs", G5_EXECUTION_LOG_SELECT, {
    filters: [["workflow_group", G5_WORKFLOW_GROUP]],
    orderKeys: ["created_at"],
    limit: 10,
  });

const buildSelectedAssetAndEvidence = async (approval: G5ApprovalRow | null, g4Detail: G4WorkflowDetail) => {
  const g4Review = await readLatestG4ReviewForAsset(approval?.asset_id ?? null);
  const assetId = g4Review?.asset_id ?? approval?.asset_id ?? null;
  const g1Runs = await readLatestG1RunForAsset(assetId);
  const g1Run = g1Runs[0] ?? null;
  const g1Token = await readLatestG1TokenForRun(g1Run?.id ?? null);

  const payload = readPayload(g4Review);
  const platform = safeDisplayText(payload?.platform ?? g1Run?.platform) ?? null;
  const packetAccountId = g1Run?.action_packet && isRecord(g1Run.action_packet) ? (g1Run.action_packet as JsonRecord).account_id : null;
  const accountId = safeDisplayText(g1Run?.account_id) ?? safeDisplayText(packetAccountId) ?? null;
  const g2Health = await readLatestHealthRow(platform, accountId);
  const executionLogs = await readLatestExecutionLogs();

  const selectedAsset = buildG5SelectedAsset({
    approval,
    g4Review,
    g1Run,
    g2Health,
  });

  const readiness = buildG5Readiness({
    selectedAsset,
    g4Review,
    approval,
    g1Run,
    g1Token,
    g2Health,
    executionLog: executionLogs[0] ?? null,
  });

  const executionOutcomes = buildWorkflowExecutionOutcomes(executionLogs);
  const recentOutcomes = [
    ...(g4Review ? [buildG4Outcome(g4Review)] : []),
    ...(approval ? [buildApprovalOutcome(approval)] : []),
    ...(g2Health ? [buildHealthOutcome(g2Health)] : []),
    ...g1Runs.map((run) => buildG1Outcome(run, run.id === g1Run?.id ? g1Token : null)),
    ...executionOutcomes,
  ]
    .sort((left, right) => new Date(right.time ?? 0).getTime() - new Date(left.time ?? 0).getTime())
    .filter((outcome, index, all) => {
      const key = `${outcome.time ?? ""}|${outcome.stage}|${outcome.status}|${outcome.whatHappened}|${outcome.actionNeeded}`;
      return all.findIndex((candidate) => `${candidate.time ?? ""}|${candidate.stage}|${candidate.status}|${candidate.whatHappened}|${candidate.actionNeeded}` === key) === index;
    })
    .slice(0, 10);

  const status = determineG5Status({
    selectedAsset,
    g4Review,
    approval,
    g1Run,
    g1Token,
    g2Health,
    executionLog: executionLogs[0] ?? null,
  });
  const lastRunAt = findLatestRelevantTime([
    executionLogs[0]?.created_at ?? null,
    g1Run?.handled_at ?? g1Run?.created_at ?? null,
    approval?.approved_at ?? approval?.created_at ?? null,
    g4Review?.reviewed_at ?? g4Review?.created_at ?? null,
    g2Health?.checked_at ?? g2Health?.updated_at ?? g2Health?.created_at ?? null,
  ]);
  const latestOutcome = executionLogs[0]
    ? toLatestOutcomeSummary(buildExecutionOutcome(executionLogs[0]))
    : buildSyntheticCurrentOutcome({
        status,
        lastRunAt,
        readiness,
        selectedAsset,
      });

  const detail: G5PublishingSchedulerDetail = {
    workflowGroup: G5_WORKFLOW_GROUP,
    title: G5_TITLE,
    purpose: G5_PURPOSE,
    status,
    lastRunAt,
    latestOutcome,
    readiness,
    selectedAsset,
    recentOutcomes,
    g4Detail,
  };

  return detail;
};

const determineG5Status = (input: {
  selectedAsset: G5PublishingSelectedAsset;
  g4Review: G4ReviewRow | null;
  approval: G5ApprovalRow | null;
  g1Run: G1ComplianceRunRow | null;
  g1Token: G1ComplianceTokenRow | null;
  g2Health: G2AccountHealthRow | null;
  executionLog: WorkflowExecutionLogRow | null;
}): G5PublishingSchedulerStatus => {
  const executionStatus = input.executionLog ? normalizeDryRunStatus(input.executionLog) : null;
  if (executionStatus) {
    if (executionStatus === "DRY_RUN") {
      return input.selectedAsset.liveExecutionEnabled === true &&
        input.selectedAsset.rollbackPayload !== null &&
        input.selectedAsset.finalHumanApprovalState?.toUpperCase() === "APPROVED"
        ? "DRY_RUN"
        : "MANUAL_ONLY";
    }

    if (executionStatus === "PASS" && input.executionLog?.dry_run === false) {
      return "PASS";
    }

    return executionStatus;
  }

  const g4Ready = input.g4Review ? mapG4Status(input.g4Review) : "NEEDS_EVIDENCE";
  if (g4Ready === "BLOCK" || g4Ready === "ERROR") {
    return g4Ready;
  }

  if (input.selectedAsset.g4ReviewId === null || g4Ready === "NEEDS_EVIDENCE") {
    return "NEEDS_EVIDENCE";
  }

  const approval = normalizeG5ApprovalStatus(input.approval);
  if (approval === "BLOCK" || approval === "ERROR") {
    return approval;
  }

  if (approval === "PENDING_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  const health = normalizeAccountHealthStatus(input.g2Health);
  if (health === "BLOCK" || health === "ERROR") {
    return health;
  }

  if (health !== "PASS") {
    return "NEEDS_EVIDENCE";
  }

  if (!input.selectedAsset.mediaReference || !input.selectedAsset.storageReference) {
    return "NEEDS_EVIDENCE";
  }

  const compliance = normalizeComplianceStatus(input.g1Run, input.g1Token);
  if (compliance === "BLOCK" || compliance === "ERROR") {
    return compliance;
  }

  if (compliance !== "PASS") {
    return "FIX_FIRST";
  }

  if (!input.selectedAsset.rollbackPayload || input.selectedAsset.finalHumanApprovalState?.toUpperCase() !== "APPROVED" || input.selectedAsset.liveExecutionEnabled !== true) {
    return "MANUAL_ONLY";
  }

  return "FIX_FIRST";
};

const buildG5DetailMessage = (detail: G5PublishingSchedulerDetail) => {
  if (detail.latestOutcome.stage === "Publishing readiness") {
    return detail.latestOutcome.summary;
  }

  return detail.latestOutcome.summary || getWorkflowStatusMessage(detail.status);
};

export async function loadG5PublishingSchedulerDetail(): Promise<G5PublishingSchedulerDetail> {
  const [g4Detail, approval] = await Promise.all([getG4WorkflowDetail(), readLatestApprovedApproval()]);
  const detail = await buildSelectedAssetAndEvidence(approval, g4Detail);

  detail.g4Detail = g4Detail;

  return detail;
}

const buildG5ActionPacket = (input: {
  approval: G5ApprovalRow;
  selectedAsset: G5PublishingSelectedAsset;
  g4Review: G4ReviewRow | null;
  g1Run: G1ComplianceRunRow | null;
  g2Health: G2AccountHealthRow | null;
  requestId: string;
  requestedBy: string;
  notes?: string | null;
}) => {
  const rawPayload = readPayload(input.g4Review);
  const actionPacket = {
    workflow_group: G5_WORKFLOW_GROUP,
    workflow_id: G5_WORKFLOW_ID,
    requested_by: input.requestedBy,
    requested_by_role: "ADMIN",
    source_route: "/api/admin/automations/g5/run-publishing-dry-run",
    source_platform: "WEBSITE",
    dry_run: true,
    not_executed: true,
    notes: input.notes ?? null,
    asset_id: input.selectedAsset.assetId,
    approval_id: input.approval.approval_id,
    g4_review_id: input.selectedAsset.g4ReviewId,
    platform: input.selectedAsset.platform,
    account_id: input.selectedAsset.accountId,
    action_type: input.selectedAsset.actionType,
    media_reference: input.selectedAsset.mediaReference,
    storage_reference: input.selectedAsset.storageReference,
    rollback_payload: input.selectedAsset.rollbackPayload,
    final_human_approval_state: input.selectedAsset.finalHumanApprovalState,
    live_execution_enabled: input.selectedAsset.liveExecutionEnabled,
    g1_compliance_run_id: input.g1Run?.id ?? null,
    g2_account_health_id: input.g2Health?.id ?? null,
    request_id: input.requestId,
    content_review_id: input.selectedAsset.g4ReviewId,
    source_event: rawPayload?.source_event ?? "G5_DRY_RUN_REQUEST",
  };

  return actionPacket;
};

const insertG1ComplianceRun = async (input: {
  actionPacket: JsonRecord;
  approval: G5ApprovalRow;
  selectedAsset: G5PublishingSelectedAsset;
  g1Status: G5PublishingSchedulerStatus;
  responseType: string;
  summary: string;
  handledAt: string;
  dryRun: boolean;
}) => {
  const record = {
    workflow_group: G5_WORKFLOW_GROUP,
    workflow_id: G5_WORKFLOW_ID,
    action_type: "SCHEDULE_POST",
    platform: input.selectedAsset.platform,
    account_id: input.selectedAsset.accountId,
    asset_id: input.selectedAsset.assetId,
    execution_mode: input.dryRun ? "DRY_RUN" : "LIVE",
    status: input.g1Status,
    response_type: input.responseType,
    fail_reason: input.g1Status === "BLOCK" || input.g1Status === "ERROR" || input.g1Status === "NEEDS_EVIDENCE" || input.g1Status === "FIX_FIRST" ? input.summary : null,
    failure_reasons: input.g1Status === "PASS" ? [] : [input.summary],
    policy_ids_checked: [...SAFE_POLICY_IDS],
    action_packet: input.actionPacket,
    client_summary: input.summary,
    handled_at: input.handledAt,
    created_at: input.handledAt,
  };

  const { data, error } = await supabaseAdmin.from("g1_compliance_runs").insert(record).select("id, created_at").maybeSingle();
  if (error || !data) {
    return null;
  }

  return data as { id?: string | null; created_at?: string | null };
};

const issueComplianceToken = async (runId: string, actionPacket: JsonRecord, handledAt: string) => {
  const token = randomBytes(24).toString("hex");
  const actionHash = createHash("sha256").update(JSON.stringify(actionPacket)).digest("hex");
  const expiresAt = new Date(Date.parse(handledAt) + 30 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("g1_compliance_tokens")
    .insert({
      compliance_run_id: runId,
      token,
      action_hash: actionHash,
      status: "ISSUED",
      issued_at: handledAt,
      expires_at: expiresAt,
      used_at: null,
      created_at: handledAt,
    })
    .select("id, token, status, expires_at")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as G1ComplianceTokenRow;
};

const markComplianceTokenUsed = async (tokenId: string, usedAt: string) => {
  const { error } = await supabaseAdmin
    .from("g1_compliance_tokens")
    .update({ used_at: usedAt })
    .eq("id", tokenId);

  return !error;
};

const insertWorkflowExecutionLog = async (input: {
  selectedAsset: G5PublishingSelectedAsset;
  status: G5PublishingSchedulerStatus;
  dryRun: boolean;
  handledAt: string;
  actionType: string;
}) => {
  const { data, error } = await supabaseAdmin
    .from("workflow_execution_logs")
    .insert({
      workflow_group: G5_WORKFLOW_GROUP,
      workflow_id: G5_WORKFLOW_ID,
      action_type: input.actionType,
      platform: input.selectedAsset.platform,
      status: input.status,
      dry_run: input.dryRun,
      created_at: input.handledAt,
    })
    .select("id, created_at")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as { id?: string | null; created_at?: string | null };
};

const buildFailureResponse = (input: {
  status: G5PublishingSchedulerStatus;
  result?: G5PublishingSchedulerStatus;
  summary: string;
  actionNeeded: string;
  handledAt?: string;
  selectedAsset?: G5PublishingSelectedAsset | null;
  g1RunId?: string | null;
  workflowExecutionLogId?: string | null;
  complianceTokenIssued?: boolean;
}): G5PublishingDryRunResponse => {
  const handledAt = input.handledAt ?? new Date().toISOString();
  return {
    status: input.status,
    result: input.result ?? input.status,
    message: input.summary,
    summary: input.summary,
    action_needed: input.actionNeeded,
    dry_run: true,
    not_executed: true,
    handled_at: handledAt,
    workflowGroup: G5_WORKFLOW_GROUP,
    workflowId: G5_WORKFLOW_ID,
    title: G5_TITLE,
    purpose: G5_PURPOSE,
    outcome: {
      time: handledAt,
      stage: "Publishing readiness",
      status: input.status,
      whatHappened: input.summary,
      actionNeeded: input.actionNeeded,
      details: input.selectedAsset?.assetId ?? null,
      handledAt,
      result: input.result ?? input.status,
      sourceLabel: "G5 publishing scheduler",
    },
    g1_compliance_run_id: input.g1RunId ?? null,
    workflow_execution_log_id: input.workflowExecutionLogId ?? null,
    compliance_token_issued: input.complianceTokenIssued ?? false,
  };
};

const extractG5ResponseMessage = (response: Awaited<ReturnType<typeof postN8nWebhook>>) => {
  const text = safeDisplayText(response.message) ?? safeDisplayText(response.response_text) ?? null;
  return text ?? getWorkflowStatusMessage("ERROR");
};

const getFailureActionNeeded = (status: G5PublishingSchedulerStatus, primaryActionDescription: string) => {
  if (status === "PENDING_APPROVAL" || status === "NEEDS_EVIDENCE" || status === "FIX_FIRST" || status === "MANUAL_ONLY") {
    return primaryActionDescription;
  }

  if (status === "BLOCK") {
    return "View Safety Checks before trying again.";
  }

  if (status === "ERROR") {
    return "Check the workflow state and retry.";
  }

  return primaryActionDescription;
};

export async function runG5PublishingDryRun(input: G5PublishingDryRunInput = {}): Promise<G5PublishingDryRunResponse> {
  const detail = await loadG5PublishingSchedulerDetail();
  const requestedBy = safeDisplayText(input.requested_by) ?? "admin";
  const notes = safeDisplayText(input.notes);

  const approval = detail.selectedAsset.approvalId
    ? await queryFirstRow<G5ApprovalRow>(
        "g5_approvals",
        G5_APPROVAL_SELECT,
        {
          filters: [["approval_id", detail.selectedAsset.approvalId]],
          orderKeys: ["approved_at", "created_at"],
        },
      )
    : null;

  if (!approval || normalizeG5ApprovalStatus(approval) !== "PASS") {
    return buildFailureResponse({
      status: "PENDING_APPROVAL",
      summary: "Publishing is blocked safely because the asset has not passed G5 approval.",
      actionNeeded: "Open Approval and record the missing decision.",
      selectedAsset: detail.selectedAsset,
      complianceTokenIssued: false,
    });
  }

  if (detail.readiness.g4Review === "NEEDS_EVIDENCE") {
    return buildFailureResponse({
      status: "NEEDS_EVIDENCE",
      summary: "Publishing is blocked safely because the asset has not passed G4 content review.",
      actionNeeded: "Open G4 Content Check before trying again.",
      selectedAsset: detail.selectedAsset,
      complianceTokenIssued: false,
    });
  }

  if (!detail.selectedAsset.mediaReference || !detail.selectedAsset.storageReference) {
    return buildFailureResponse({
      status: "NEEDS_EVIDENCE",
      summary: "Publishing is not ready because no approved media file is attached.",
      actionNeeded: "Attach or select the approved media file before running publishing dry-run.",
      selectedAsset: detail.selectedAsset,
      complianceTokenIssued: false,
    });
  }

  if (detail.readiness.g2AccountHealth !== "PASS") {
    return buildFailureResponse({
      status: detail.readiness.g2AccountHealth === "BLOCK" ? "BLOCK" : "NEEDS_EVIDENCE",
      summary: "Publishing is waiting on a clean account-health check.",
      actionNeeded: "View Account Health before trying again.",
      selectedAsset: detail.selectedAsset,
      complianceTokenIssued: false,
    });
  }

  const latestG1Run = await queryFirstRow<G1ComplianceRunRow>(
    "g1_compliance_runs",
    G1_RUN_SELECT,
    {
      filters: [["workflow_group", G5_WORKFLOW_GROUP], ["asset_id", detail.selectedAsset.assetId]],
      orderKeys: ["handled_at", "created_at"],
    },
  );

  const latestG1Token = await readLatestG1TokenForRun(latestG1Run?.id ?? null);
  if (latestG1Run && normalizeComplianceStatus(latestG1Run, latestG1Token) === "PASS" && latestG1Token) {
    const currentStatus = detail.status === "MANUAL_ONLY" ? "MANUAL_ONLY" : detail.status;
    const summary =
      currentStatus === "MANUAL_ONLY"
        ? "Publishing dry-run completed safely. No live post was scheduled."
        : "Publishing dry-run completed safely. No live post was scheduled.";
    return {
      status: currentStatus,
      result: "PASS",
      message: summary,
      summary,
      action_needed: getFailureActionNeeded(currentStatus, getG5PrimaryAction(detail).description),
      dry_run: true,
      not_executed: true,
      handled_at: latestG1Run.handled_at ?? latestG1Run.created_at ?? new Date().toISOString(),
      workflowGroup: G5_WORKFLOW_GROUP,
      workflowId: G5_WORKFLOW_ID,
      title: G5_TITLE,
      purpose: G5_PURPOSE,
      outcome: {
        time: latestG1Run.handled_at ?? latestG1Run.created_at ?? new Date().toISOString(),
        stage: "Publishing readiness",
        status: currentStatus,
        whatHappened: summary,
        actionNeeded: getFailureActionNeeded(currentStatus, getG5PrimaryAction(detail).description),
        details: detail.selectedAsset.assetId,
        handledAt: latestG1Run.handled_at ?? latestG1Run.created_at ?? new Date().toISOString(),
        result: "PASS",
        sourceLabel: "G5 publishing scheduler",
      },
      g1_compliance_run_id: latestG1Run.id ?? null,
      workflow_execution_log_id: null,
      compliance_token_issued: true,
    };
  }

  const requestId = randomUUID();
  const handledAt = new Date().toISOString();
  const actionPacket = buildG5ActionPacket({
    approval,
    selectedAsset: detail.selectedAsset,
    g4Review: await readLatestG4ReviewForAsset(detail.selectedAsset.assetId ?? null),
    g1Run: latestG1Run,
    g2Health: await readLatestHealthRow(detail.selectedAsset.platform, detail.selectedAsset.accountId),
    requestId,
    requestedBy,
    notes,
  });

  const g1Response = await postN8nWebhook({
    path: env.n8nG1ComplianceGuardPath,
    payload: {
      ...actionPacket,
      request_id: requestId,
      dry_run: true,
    },
    dryRun: true,
  });

  const g1OutcomeStatus = coerceG5Status(g1Response.status, "ERROR");
  const g1Summary = safeDisplayText(g1Response.message) ?? getWorkflowStatusMessage(g1OutcomeStatus);
  const g1RunInsert = await insertG1ComplianceRun({
    actionPacket,
    approval,
    selectedAsset: detail.selectedAsset,
    g1Status: g1OutcomeStatus,
    responseType: g1Response.response_type ?? "G5_PUBLISHING_DRY_RUN_CHECK",
    summary: g1Summary,
    handledAt: g1Response.handled_at ?? handledAt,
    dryRun: true,
  });

  if (g1OutcomeStatus !== "PASS") {
    const workflowExecutionLog = await insertWorkflowExecutionLog({
      selectedAsset: detail.selectedAsset,
      status: g1OutcomeStatus,
      dryRun: true,
      handledAt: g1Response.handled_at ?? handledAt,
      actionType: "PUBLISH_DRY_RUN",
    });

    return buildFailureResponse({
      status: g1OutcomeStatus === "ERROR" ? "ERROR" : g1OutcomeStatus,
      result: g1OutcomeStatus === "ERROR" ? "ERROR" : g1OutcomeStatus,
      summary:
        g1OutcomeStatus === "BLOCK" || g1OutcomeStatus === "NEEDS_EVIDENCE" || g1OutcomeStatus === "FIX_FIRST"
          ? "Publishing dry-run was stopped because safety checks did not pass."
          : g1Summary,
      actionNeeded:
        g1OutcomeStatus === "BLOCK" || g1OutcomeStatus === "NEEDS_EVIDENCE" || g1OutcomeStatus === "FIX_FIRST"
          ? "View Safety Checks before trying again."
          : getWorkflowEmptyStateActionNeeded("G5"),
      handledAt: g1Response.handled_at ?? handledAt,
      selectedAsset: detail.selectedAsset,
      g1RunId: g1RunInsert?.id ?? null,
      workflowExecutionLogId: workflowExecutionLog?.id ?? null,
      complianceTokenIssued: false,
    });
  }

  const complianceToken = g1RunInsert?.id ? await issueComplianceToken(g1RunInsert.id, actionPacket, g1Response.handled_at ?? handledAt) : null;
  if (!complianceToken?.token || !g1RunInsert?.id) {
    const workflowExecutionLog = await insertWorkflowExecutionLog({
      selectedAsset: detail.selectedAsset,
      status: "ERROR",
      dryRun: true,
      handledAt: g1Response.handled_at ?? handledAt,
      actionType: "PUBLISH_DRY_RUN",
    });

    return buildFailureResponse({
      status: "ERROR",
      result: "ERROR",
      summary: "The compliance token could not be issued.",
      actionNeeded: "Check the workflow state and retry.",
      handledAt: g1Response.handled_at ?? handledAt,
      selectedAsset: detail.selectedAsset,
      g1RunId: g1RunInsert?.id ?? null,
      workflowExecutionLogId: workflowExecutionLog?.id ?? null,
      complianceTokenIssued: false,
    });
  }

  const g5Response = await postN8nWebhook({
    path: env.n8nG5PublishingSchedulerPath,
    payload: {
      ...actionPacket,
      compliance_token: complianceToken.token,
      compliance_run_id: g1RunInsert.id,
      compliance_token_id: complianceToken.id ?? null,
      dry_run: true,
      not_executed: true,
    },
    dryRun: true,
  });

  const finalStatus = coerceG5Status(g5Response.status, "ERROR");
  const summary =
    finalStatus === "PASS" || finalStatus === "DRY_RUN"
      ? "Publishing dry-run completed safely. No live post was scheduled."
      : safeDisplayText(g5Response.message) ?? getWorkflowStatusMessage(finalStatus);
  const workflowExecutionLog = await insertWorkflowExecutionLog({
    selectedAsset: detail.selectedAsset,
    status: finalStatus === "PASS" ? "DRY_RUN" : finalStatus,
    dryRun: true,
    handledAt: g5Response.handled_at ?? handledAt,
    actionType: "PUBLISH_DRY_RUN",
  });

  const tokenMarked = complianceToken.id ? await markComplianceTokenUsed(complianceToken.id, g5Response.handled_at ?? handledAt) : false;

  return {
    status: finalStatus === "PASS" ? "DRY_RUN" : finalStatus,
    result: finalStatus === "PASS" ? "PASS" : finalStatus,
    message: summary,
    summary,
    action_needed:
      finalStatus === "PASS"
        ? "Review the dry-run result before enabling live scheduling."
        : getFailureActionNeeded(finalStatus, getG5PrimaryAction(detail).description),
    dry_run: true,
    not_executed: true,
    handled_at: g5Response.handled_at ?? handledAt,
    workflowGroup: G5_WORKFLOW_GROUP,
    workflowId: G5_WORKFLOW_ID,
    title: G5_TITLE,
    purpose: G5_PURPOSE,
    outcome: {
      time: g5Response.handled_at ?? handledAt,
      stage: "Publishing dry-run",
      status: finalStatus === "PASS" ? "DRY_RUN" : finalStatus,
      whatHappened: summary,
      actionNeeded:
        finalStatus === "PASS"
          ? "Review the dry-run result before enabling live scheduling."
          : getFailureActionNeeded(finalStatus, getG5PrimaryAction(detail).description),
      details: detail.selectedAsset.assetId,
      handledAt: g5Response.handled_at ?? handledAt,
      result: finalStatus === "PASS" ? "DRY_RUN" : finalStatus,
      sourceLabel: "workflow execution log",
    },
    g1_compliance_run_id: g1RunInsert.id ?? null,
    workflow_execution_log_id: workflowExecutionLog?.id ?? null,
    compliance_token_issued: tokenMarked,
  };
}

export const buildG5WorkflowViewFromDetail = buildWorkflowView;
export const buildG5WorkflowOutcomeSummary = toWorkflowOutcomeSummary;
export const buildG5PublishingSchedulerMessage = buildG5DetailMessage;
