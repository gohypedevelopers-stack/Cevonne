import {
  CEVONNE_WORKFLOW_DIRECTORY,
  type CevonneWorkflowGroup,
  type CevonneWorkflowLifecycleState,
  type CevonneWorkflowStatus,
} from "@/lib/cevonne/admin-model";

export type N8nWorkflowCard = {
  group: CevonneWorkflowGroup;
  name: string;
  purpose: string;
  description: string;
  status: CevonneWorkflowStatus;
  lifecycleState: CevonneWorkflowLifecycleState;
  safetyNote: string;
  routeNames: string[];
  requiredApprovals: string[];
  requiredComplianceChecks: string[];
  safeActions: string[];
  recommendationOnly?: boolean;
  lastRunAt: string;
  lastResponseType: string;
  pendingApprovalsCount: number;
  latestFailureReason?: string | null;
  latestExecutionId: string;
  latestPublicId: string;
  latestExecutionStatus: CevonneWorkflowStatus;
  latestExecutionLifecycle: CevonneWorkflowLifecycleState;
  relatedG1ComplianceRuns: string[];
  connectedBackendRoutes: string[];
  adminNotes?: string | null;
};

export type N8nOverviewSummary = {
  total_workflows: number;
  active_workflows: number;
  manual_only_workflows: number;
  blocked_error_workflows: number;
  pending_approvals: number;
  latest_execution_status: string;
  latest_execution_response_type: string | null;
  latest_execution_at: string | null;
};

export type N8nOverviewResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  summary: N8nOverviewSummary;
  workflows: N8nWorkflowCard[];
};

export type N8nExecutionRecord = {
  executionId: string;
  publicId: string;
  workflowGroup: CevonneWorkflowGroup;
  workflowName: string;
  routeName: string;
  status: CevonneWorkflowStatus;
  responseType: string;
  failureReason?: string | null;
  requestedByWorkflow?: string | null;
  requestedByWorkflowGroup?: CevonneWorkflowGroup | null;
  workflowId?: string | null;
  actionType?: string | null;
  actionTypeLabel?: string | null;
  platform?: string | null;
  executedAt: string;
  actor: "website" | "admin";
  adminUserId?: string | null;
  adminEmail?: string | null;
  requestId: string;
  dryRun: boolean;
  notExecuted: boolean;
  safePublicIds: string[];
  summary: string;
};

export type G5PublishingAssetSnapshot = {
  assetId: string | null;
  platform: string | null;
  headline: string | null;
  caption: string | null;
  content: string | null;
  mediaReference: string | null;
  storageReference: string | null;
  g1GateStatus: string | null;
  g2GateStatus: string | null;
  g4ReviewStatus: string | null;
  g7ProofStatus: string | null;
  g8ProofStatus: string | null;
  riskSummary: string | null;
  approvalNotes: string | null;
  rollbackPayloadReady: boolean;
  dryRunStatus: "NOT_RUN" | "SUCCESS" | "FAILED" | null;
  finalHumanApprovalState: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | null;
  scheduledFor: string | null;
};

export type N8nApprovalRecord = {
  approvalId: string;
  publicId: string;
  workflowGroup: CevonneWorkflowGroup;
  workflowName: string;
  actionType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requestedBy: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  reviewerAction?: string | null;
  summary: string;
  approvalNotes?: string | null;
  requireConfirmation: boolean;
  assetSnapshot?: G5PublishingAssetSnapshot | null;
  adminUserId?: string | null;
  adminEmail?: string | null;
};

export type N8nAuditLogRecord = {
  auditId: string;
  publicId: string;
  workflowGroup: CevonneWorkflowGroup | "GLOBAL";
  actionType:
    | "VIEW_WORKFLOWS"
    | "VIEW_WORKFLOW_DETAIL"
    | "VIEW_EXECUTIONS"
    | "VIEW_AUDIT_LOGS"
    | "VIEW_APPROVALS"
    | "APPROVAL_DECISION"
    | "G2_ACCOUNT_HEALTH_UPDATE"
    | "WORKFLOW_SAFE_TEST"
    | "MANUAL_REVIEW"
    | "G11_WEEKLY_DIGEST_REQUEST"
    | "G11_DECISION_RECOMMENDATION_REQUEST"
    | "G11_DRAFT_ACTION_PACKET_REQUEST";
  routeName: string;
  resultStatus: CevonneWorkflowStatus;
  responseType: string;
  failureReason?: string | null;
  payloadSummary: string;
  timestamp: string;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
  safePublicIds: string[];
};

export type N8nWorkflowDetailResponse = {
  status?: string;
  response_type?: string;
  message?: string;
  workflow: N8nWorkflowCard;
  latest_executions: N8nExecutionRecord[];
  approvals: N8nApprovalRecord[];
  audit_logs: N8nAuditLogRecord[];
  related_g1_compliance_runs: N8nExecutionRecord[];
};

const fallbackNow = Date.now();
const minutesAgo = (minutes: number) => new Date(fallbackNow - minutes * 60_000).toISOString();

export const statusToneClasses: Record<CevonneWorkflowStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PASS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BLOCK: "bg-rose-100 text-rose-800 border-rose-200",
  MANUAL_ONLY: "bg-amber-100 text-amber-800 border-amber-200",
  ERROR: "bg-rose-100 text-rose-800 border-rose-200",
  PENDING: "bg-sky-100 text-sky-800 border-sky-200",
  NOT_BUILT: "bg-slate-100 text-slate-700 border-slate-200",
  DRY_RUN: "bg-cyan-100 text-cyan-800 border-cyan-200",
  RECOMMENDATION_ONLY: "bg-violet-100 text-violet-800 border-violet-200",
};

export const lifecycleToneClasses: Record<CevonneWorkflowLifecycleState, string> = {
  COMPLETE: "text-emerald-700",
  REVIEW: "text-amber-700",
  PENDING: "text-sky-700",
  DRY_RUN: "text-cyan-700",
  RECOMMENDATION_ONLY: "text-violet-700",
  NOT_BUILT: "text-slate-600",
};

export const approvalRiskToneClasses = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-sky-100 text-sky-800 border-sky-200",
  HIGH: "bg-amber-100 text-amber-800 border-amber-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
} as const;

export const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatRelativeTime = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diff = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "day";
  let valueInUnits = diff;
  for (const [threshold, nextUnit] of units) {
    if (abs < threshold) {
      unit = nextUnit;
      break;
    }
    valueInUnits = Math.round(valueInUnits / threshold);
    unit = nextUnit;
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(valueInUnits, unit);
};

export const buildFallbackWorkflow = (entry: (typeof CEVONNE_WORKFLOW_DIRECTORY)[number], index: number): N8nWorkflowCard => ({
  group: entry.group,
  name: entry.name,
  purpose: entry.purpose,
  description: entry.description,
  status: entry.status,
  lifecycleState: entry.lifecycleState,
  safetyNote: entry.safetyNote,
  routeNames: entry.routeNames,
  requiredApprovals: entry.requiredApprovals,
  requiredComplianceChecks: entry.requiredComplianceChecks,
  safeActions: entry.safeActions,
  recommendationOnly: entry.recommendationOnly,
  lastRunAt: minutesAgo(25 - index * 2),
  lastResponseType: entry.group === "G11" ? "RECOMMENDATION_ONLY" : `${entry.group}_MOCK_RESPONSE`,
  pendingApprovalsCount: entry.group === "G1" || entry.group === "G3" ? 0 : 1,
  latestFailureReason:
    entry.group === "G6"
      ? "Final partner route not confirmed."
      : entry.group === "G8"
        ? "Creator rights proof has not been verified yet."
        : entry.group === "G10"
          ? "Experiment approval is pending."
          : null,
  latestExecutionId: `fallback-${entry.group.toLowerCase()}-execution`,
  latestPublicId: `fallback-${entry.group.toLowerCase()}-public`,
  latestExecutionStatus: entry.status,
  latestExecutionLifecycle: entry.lifecycleState,
  relatedG1ComplianceRuns: entry.group === "G1" ? [] : ["fallback-g1-compliance-run"],
  connectedBackendRoutes: entry.routeNames,
  adminNotes: entry.group === "G11" ? "Recommendation-only. No external writes." : null,
});

export const FALLBACK_WORKFLOWS = CEVONNE_WORKFLOW_DIRECTORY.map((entry, index) => buildFallbackWorkflow(entry, index));

export const FALLBACK_OVERVIEW: N8nOverviewResponse = {
  summary: {
    total_workflows: FALLBACK_WORKFLOWS.length,
    active_workflows: FALLBACK_WORKFLOWS.filter((workflow) => workflow.status === "ACTIVE").length,
    manual_only_workflows: FALLBACK_WORKFLOWS.filter((workflow) => workflow.status === "MANUAL_ONLY").length,
    blocked_error_workflows: FALLBACK_WORKFLOWS.filter((workflow) => workflow.status === "BLOCK" || workflow.status === "ERROR").length,
    pending_approvals: FALLBACK_WORKFLOWS.reduce((acc, workflow) => acc + workflow.pendingApprovalsCount, 0),
    latest_execution_status: FALLBACK_WORKFLOWS[0]?.status || "PENDING",
    latest_execution_response_type: FALLBACK_WORKFLOWS[0]?.lastResponseType || null,
    latest_execution_at: FALLBACK_WORKFLOWS[0]?.lastRunAt || null,
  },
  workflows: FALLBACK_WORKFLOWS,
};

export const buildFallbackDetail = (workflowGroup: CevonneWorkflowGroup): N8nWorkflowDetailResponse | null => {
  const workflow = FALLBACK_WORKFLOWS.find((entry) => entry.group === workflowGroup);
  if (!workflow) return null;

  const execution: N8nExecutionRecord = {
    executionId: `fallback-${workflowGroup.toLowerCase()}-detail-execution`,
    publicId: `fallback-${workflowGroup.toLowerCase()}-detail-public`,
    workflowGroup,
    workflowName: workflow.name,
    routeName: workflow.routeNames[0] ?? `/api/cevonne/admin/${workflowGroup.toLowerCase()}`,
    status: workflow.status,
    responseType: workflow.lastResponseType,
    failureReason: workflow.latestFailureReason ?? null,
    executedAt: workflow.lastRunAt,
    actor: "admin",
    adminUserId: "system",
    adminEmail: "system@cevonne.com",
    requestId: `fallback-request-${workflowGroup.toLowerCase()}`,
    dryRun: workflow.status === "DRY_RUN" || workflow.group === "G11",
    notExecuted: workflow.status === "NOT_BUILT" || workflow.status === "RECOMMENDATION_ONLY",
    safePublicIds: [workflow.latestPublicId],
    summary: workflow.latestFailureReason ?? `${workflow.name} recorded successfully.`,
  };

  return {
    workflow,
    latest_executions: [execution],
    approvals: [],
    audit_logs: [],
    related_g1_compliance_runs: workflow.group === "G1" ? [] : [execution],
  };
};

export const normalizeWorkflowGroup = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return CEVONNE_WORKFLOW_DIRECTORY.find((workflow) => workflow.group === normalized)?.group ?? null;
};
