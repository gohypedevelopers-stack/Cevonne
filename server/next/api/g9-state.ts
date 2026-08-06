type JsonRecord = Record<string, unknown>;

export type G9ApprovalUiDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";
export type G9ApprovalDecision = "APPROVED" | "REJECTED" | "NEEDS_CHANGES";
export type G9DerivedStatus =
  | "NO_ACTION"
  | "READY"
  | "PENDING_APPROVAL"
  | "APPROVED_FOR_DRY_RUN"
  | "NEEDS_REVIEW"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "BLOCKED"
  | "DRY_RUN_COMPLETE"
  | "CONNECTION_ISSUE";

export type G9RecommendationStateRow = {
  action_type?: string;
  recommendation_type?: string;
  /** Denormalized legacy value. The mapper intentionally does not use it. */
  approval_status?: string;
  compliance_status?: string;
  raw_payload?: unknown;
};

export type G9ApprovalStateRow = {
  approval_id?: string;
  approval_status?: string;
};

export type G9ExecutionStateRow = {
  status?: string;
  api_response?: unknown;
  request_payload?: unknown;
};

export type G9DerivedState = {
  status: G9DerivedStatus;
  actionType: string | null;
  requiresApproval: boolean;
  hasSuccessfulDryRun: boolean;
};

export const G9_ALLOWED_DRY_RUN_ACTIONS = new Set(["META_UPDATE_ADSET_BUDGET", "META_PAUSE_AD"]);

const asRecord = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};

const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const asBoolean = (value: unknown) => value === true || (typeof value === "string" && value.toLowerCase() === "true");
const toUpper = (value: unknown) => asText(value)?.toUpperCase() ?? "";

export const getG9DryRunSignals = (execution?: G9ExecutionStateRow) => {
  const response = asRecord(execution?.api_response);
  const request = asRecord(execution?.request_payload);
  const responseType = toUpper(response.response_type);
  const executionMode = toUpper(response.execution_mode);
  const dryRun = asBoolean(response.dry_run) || asBoolean(request.dry_run);
  const notExecuted = asBoolean(response.not_executed);
  const externalActionAttempted = asBoolean(response.external_action_attempted);
  const successfulLog = ["SUCCESS", "PASS", "COMPLETED"].includes(toUpper(execution?.status)) ||
    ["PASS", "SUCCESS", "DRY_RUN_SUCCESS"].includes(toUpper(response.status));
  const loggedDryRun = ["G9_DRY_RUN_COMPLETED", "G9_EXECUTION_LOGGED"].includes(responseType);
  const safeDryRunEvidence = executionMode === "DRY_RUN" || dryRun || notExecuted;
  return {
    responseType,
    executionMode,
    dryRun,
    notExecuted,
    externalActionAttempted,
    complete: successfulLog && loggedDryRun && safeDryRunEvidence && !externalActionAttempted,
  };
};

/** Uses the confirmed `ad_execution_logs.api_response` audit format, never a status string alone. */
export const isG9DryRunComplete = (execution?: G9ExecutionStateRow) => getG9DryRunSignals(execution).complete;

export const G9_ALREADY_COMPLETED_MESSAGE = "Dry run already completed. No live Meta change was made.";

export const getG9ExecutableActionType = (row: G9RecommendationStateRow) => {
  const raw = asRecord(row.raw_payload);
  const candidates = [raw.recommended_action, raw.recommendation_type, row.recommendation_type, row.action_type].map(toUpper);
  return candidates.find((action) => G9_ALLOWED_DRY_RUN_ACTIONS.has(action)) ?? null;
};

/**
 * The one state mapper for G9 cards, overview counts, activity actions, and mutations.
 * It deliberately ignores stale denormalized approval fields on recommendations.
 */
export const deriveG9UiState = (
  row: G9RecommendationStateRow,
  approval?: G9ApprovalStateRow,
  successfulExecution?: G9ExecutionStateRow,
): G9DerivedState => {
  const actionType = getG9ExecutableActionType(row);
  const requiresApproval = Boolean(actionType);
  const compliance = toUpper(row.compliance_status);

  if (successfulExecution && isG9DryRunComplete(successfulExecution)) {
    return { status: "DRY_RUN_COMPLETE", actionType, requiresApproval, hasSuccessfulDryRun: true };
  }
  if (compliance === "BLOCK") return { status: "BLOCKED", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (compliance === "MANUAL_ONLY") return { status: "NEEDS_REVIEW", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (compliance === "ERROR") return { status: "CONNECTION_ISSUE", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (!actionType) return { status: "NO_ACTION", actionType: null, requiresApproval: false, hasSuccessfulDryRun: false };

  const approvalStatus = toUpper(approval?.approval_status);
  if (approvalStatus === "REJECTED") return { status: "REJECTED", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (approvalStatus === "NEEDS_CHANGES") return { status: "CHANGES_REQUESTED", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (approvalStatus === "APPROVED" && asText(approval?.approval_id)) return { status: "APPROVED_FOR_DRY_RUN", actionType, requiresApproval, hasSuccessfulDryRun: false };
  if (approvalStatus === "PENDING" && asText(approval?.approval_id)) return { status: "PENDING_APPROVAL", actionType, requiresApproval, hasSuccessfulDryRun: false };
  return { status: "NEEDS_REVIEW", actionType, requiresApproval, hasSuccessfulDryRun: false };
};

export const canG9ReviewAndDecide = (state: G9DerivedState, approval?: G9ApprovalStateRow) =>
  state.status === "PENDING_APPROVAL" && Boolean(state.actionType) && Boolean(asText(approval?.approval_id));

export const canG9RunDryRun = (state: G9DerivedState, approval?: G9ApprovalStateRow) =>
  state.status === "APPROVED_FOR_DRY_RUN" && Boolean(state.actionType) && toUpper(approval?.approval_status) === "APPROVED" && Boolean(asText(approval?.approval_id));

const decisionForN8n: Record<G9ApprovalUiDecision, G9ApprovalDecision> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_CHANGES: "NEEDS_CHANGES",
};

export const buildG9ApprovalPayload = (input: {
  recommendationId: string;
  approvalId: string;
  decision: G9ApprovalUiDecision;
  reviewerId: string;
  note: string | null;
}) => ({
  recommendation_id: input.recommendationId,
  approval_id: input.approvalId,
  decision: decisionForN8n[input.decision],
  reviewer_id: input.reviewerId,
  reviewer_note: input.decision === "REJECT" ? null : input.note,
  rejection_reason: input.decision === "REJECT" ? input.note : null,
  actor: input.reviewerId,
});

export const buildG9DryRunPayload = (input: {
  recommendationId: string;
  approvalId: string;
  actionType: string;
  actor: string;
}) => ({
  platform: "META" as const,
  action_type: input.actionType,
  recommendation_id: input.recommendationId,
  approval_id: input.approvalId,
  actor: input.actor,
});
