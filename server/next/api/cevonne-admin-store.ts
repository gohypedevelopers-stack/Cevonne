import "server-only";

import { randomUUID } from "node:crypto";

import {
  CEVONNE_WORKFLOW_DIRECTORY,
  type CevonneAdminActionType,
  type CevonneApprovalDecision,
  type CevonneApprovalStatus,
  type CevonneHealthStatus,
  type CevonneRiskLevel,
  type CevonneWorkflowDirectoryEntry,
  type CevonneWorkflowGroup,
  type CevonneWorkflowLifecycleState,
  type CevonneWorkflowResponseType,
  type CevonneWorkflowStatus,
  getWorkflowDirectoryEntry,
  WORKFLOW_GROUP_ORDER,
} from "@/lib/cevonne/admin-model";

type WorkflowRecord = CevonneWorkflowDirectoryEntry & {
  lastRunAt: string;
  lastResponseType: CevonneWorkflowResponseType;
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

export type CevonneExecutionRecord = {
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

export type CevonneApprovalRecord = {
  approvalId: string;
  publicId: string;
  workflowGroup: CevonneWorkflowGroup;
  workflowName: string;
  actionType: string;
  riskLevel: CevonneRiskLevel;
  requestedBy: string;
  createdAt: string;
  status: CevonneApprovalStatus;
  reviewerAction?: string | null;
  summary: string;
  requireConfirmation: boolean;
  adminUserId?: string | null;
  adminEmail?: string | null;
};

export type CevonneAuditLogRecord = {
  auditId: string;
  publicId: string;
  workflowGroup: CevonneWorkflowGroup | "GLOBAL";
  actionType: CevonneAdminActionType;
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

type CevonneAdminStoreState = {
  workflows: WorkflowRecord[];
  executions: CevonneExecutionRecord[];
  approvals: CevonneApprovalRecord[];
  auditLogs: CevonneAuditLogRecord[];
};

type AdminContext = {
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
};

type StoreViewResponse = {
  summary: Record<string, unknown>;
  workflows: WorkflowRecord[];
};

type WorkflowDetailResponse = {
  workflow: WorkflowRecord;
  latest_executions: CevonneExecutionRecord[];
  approvals: CevonneApprovalRecord[];
  audit_logs: CevonneAuditLogRecord[];
  related_g1_compliance_runs: CevonneExecutionRecord[];
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const createPublicId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;

const clone = <T,>(value: T): T => structuredClone(value);

const safeJoin = (items: Array<string | undefined | null>, delimiter = " | ") =>
  items.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join(delimiter);

const workflowSeedMeta: Record<
  CevonneWorkflowGroup,
  {
    lastResponseType: string;
    pendingApprovalsCount: number;
    latestFailureReason?: string | null;
    latestExecutionStatus: CevonneWorkflowStatus;
    latestExecutionLifecycle: CevonneWorkflowLifecycleState;
    adminNotes?: string | null;
    relatedG1ComplianceRuns: string[];
  }
> = {
  G1: {
    lastResponseType: "COMPLIANCE_GATE_COMPLETE",
    pendingApprovalsCount: 0,
    latestExecutionStatus: "ACTIVE",
    latestExecutionLifecycle: "COMPLETE",
    relatedG1ComplianceRuns: [],
  },
  G2: {
    lastResponseType: "ACCOUNT_HEALTH_OK",
    pendingApprovalsCount: 1,
    latestExecutionStatus: "ACTIVE",
    latestExecutionLifecycle: "COMPLETE",
    adminNotes: "Health monitor confirms current policy state is stable.",
    relatedG1ComplianceRuns: ["g1-compliance-001"],
  },
  G3: {
    lastResponseType: "G3_PURCHASE_EVENT_RECORDED",
    pendingApprovalsCount: 0,
    latestExecutionStatus: "ACTIVE",
    latestExecutionLifecycle: "COMPLETE",
    adminNotes: "Shared CRM backbone records consent, attribution, purchase, and privacy events.",
    relatedG1ComplianceRuns: ["g1-compliance-001", "g1-consent-review-002"],
  },
  G4: {
    lastResponseType: "CONTENT_REVIEW_PENDING",
    pendingApprovalsCount: 2,
    latestFailureReason: "Awaiting claim approval before publishing.",
    latestExecutionStatus: "MANUAL_ONLY",
    latestExecutionLifecycle: "REVIEW",
    relatedG1ComplianceRuns: ["g1-claim-review-003"],
  },
  G5: {
    lastResponseType: "PUBLISHING_QUEUE_PENDING",
    pendingApprovalsCount: 3,
    latestFailureReason: "Approved assets are queued for schedule confirmation.",
    latestExecutionStatus: "PENDING",
    latestExecutionLifecycle: "PENDING",
    relatedG1ComplianceRuns: ["g1-publish-gate-004"],
  },
  G6: {
    lastResponseType: "MESSAGING_ROUTER_NOT_BUILT",
    pendingApprovalsCount: 1,
    latestFailureReason: "Final partner route not confirmed.",
    latestExecutionStatus: "NOT_BUILT",
    latestExecutionLifecycle: "NOT_BUILT",
    adminNotes: "Keep this disconnected until the partner route is confirmed.",
    relatedG1ComplianceRuns: ["g1-consent-review-002"],
  },
  G7: {
    lastResponseType: "OFFER_PROOF_SYNCED",
    pendingApprovalsCount: 1,
    latestExecutionStatus: "ACTIVE",
    latestExecutionLifecycle: "COMPLETE",
    relatedG1ComplianceRuns: ["g1-offer-proof-005"],
  },
  G8: {
    lastResponseType: "UGC_RIGHTS_QUEUE_EMPTY",
    pendingApprovalsCount: 2,
    latestFailureReason: "Creator rights proof has not been verified yet.",
    latestExecutionStatus: "NOT_BUILT",
    latestExecutionLifecycle: "NOT_BUILT",
    relatedG1ComplianceRuns: ["g1-rights-review-006"],
  },
  G9: {
    lastResponseType: "ADS_RECOMMENDATION_DRY_RUN",
    pendingApprovalsCount: 2,
    latestExecutionStatus: "DRY_RUN",
    latestExecutionLifecycle: "DRY_RUN",
    adminNotes: "Recommendation-only until a human approves production writes.",
    relatedG1ComplianceRuns: ["g1-budget-review-007"],
  },
  G10: {
    lastResponseType: "SEO_CRO_REVIEW_PENDING",
    pendingApprovalsCount: 2,
    latestFailureReason: "Experiment approval is pending.",
    latestExecutionStatus: "PENDING",
    latestExecutionLifecycle: "REVIEW",
    relatedG1ComplianceRuns: ["g1-experiment-review-008"],
  },
  G11: {
    lastResponseType: "RECOMMENDATION_ONLY",
    pendingApprovalsCount: 1,
    latestExecutionStatus: "RECOMMENDATION_ONLY",
    latestExecutionLifecycle: "RECOMMENDATION_ONLY",
    adminNotes: "Recommendation-only. No external writes. Draft action packets only.",
    relatedG1ComplianceRuns: ["g1-digest-review-009"],
  },
};

const createWorkflowRecord = (entry: CevonneWorkflowDirectoryEntry, index: number): WorkflowRecord => {
  const seed = workflowSeedMeta[entry.group];
  const executionId = createPublicId(`cevonne-${entry.group.toLowerCase()}-exec`);
  const publicId = createPublicId(`cevonne-${entry.group.toLowerCase()}-public`);

  return {
    ...entry,
    lastRunAt: minutesAgo(30 - index * 2),
    lastResponseType: seed.lastResponseType,
    pendingApprovalsCount: seed.pendingApprovalsCount,
    latestFailureReason: seed.latestFailureReason ?? null,
    latestExecutionId: executionId,
    latestPublicId: publicId,
    latestExecutionStatus: seed.latestExecutionStatus,
    latestExecutionLifecycle: seed.latestExecutionLifecycle,
    relatedG1ComplianceRuns: seed.relatedG1ComplianceRuns,
    connectedBackendRoutes: entry.routeNames,
    adminNotes: seed.adminNotes ?? null,
  };
};

const createInitialWorkflows = () =>
  WORKFLOW_GROUP_ORDER.map((group, index) => {
    const entry = getWorkflowDirectoryEntry(group);
    if (!entry) {
      throw new Error(`Missing workflow directory entry for ${group}`);
    }

    return createWorkflowRecord(entry, index);
  });

const createInitialApprovals = (): CevonneApprovalRecord[] => [
  {
    approvalId: "approval-g5-publish-001",
    publicId: createPublicId("cevonne-approval"),
    workflowGroup: "G5",
    workflowName: "Publishing Scheduler",
    actionType: "PUBLISH_BATCH",
    riskLevel: "HIGH",
    requestedBy: "merchandising@cevonne.com",
    createdAt: minutesAgo(48),
    status: "PENDING",
    reviewerAction: null,
    summary: "Approve the spring launch publishing batch.",
    requireConfirmation: true,
  },
  {
    approvalId: "approval-g6-recovery-001",
    publicId: createPublicId("cevonne-approval"),
    workflowGroup: "G6",
    workflowName: "Messaging + Quiz + Recovery Router",
    actionType: "CONFIRM_PARTNER_ROUTE",
    riskLevel: "CRITICAL",
    requestedBy: "growth@cevonne.com",
    createdAt: minutesAgo(36),
    status: "PENDING",
    reviewerAction: null,
    summary: "Confirm the verified partner route before messaging can proceed.",
    requireConfirmation: true,
  },
  {
    approvalId: "approval-g8-rights-001",
    publicId: createPublicId("cevonne-approval"),
    workflowGroup: "G8",
    workflowName: "UGC + Creator Proof",
    actionType: "VERIFY_RIGHTS",
    riskLevel: "HIGH",
    requestedBy: "brand@cevonne.com",
    createdAt: minutesAgo(28),
    status: "PENDING",
    reviewerAction: null,
    summary: "Confirm creator rights and disclosure proof before any UGC reuse.",
    requireConfirmation: true,
  },
  {
    approvalId: "approval-g9-budget-001",
    publicId: createPublicId("cevonne-approval"),
    workflowGroup: "G9",
    workflowName: "Ads + Retargeting Optimizer",
    actionType: "APPROVE_DRY_RUN",
    riskLevel: "MEDIUM",
    requestedBy: "media@cevonne.com",
    createdAt: minutesAgo(18),
    status: "PENDING",
    reviewerAction: null,
    summary: "Approve the next dry-run recommendation bundle for ads.",
    requireConfirmation: false,
  },
  {
    approvalId: "approval-g11-draft-001",
    publicId: createPublicId("cevonne-approval"),
    workflowGroup: "G11",
    workflowName: "Decision Engine",
    actionType: "REVIEW_ACTION_PACKET",
    riskLevel: "LOW",
    requestedBy: "admin@cevonne.com",
    createdAt: minutesAgo(12),
    status: "PENDING",
    reviewerAction: null,
    summary: "Review the latest G11 draft action packet.",
    requireConfirmation: false,
  },
];

const createInitialExecutions = (): CevonneExecutionRecord[] => {
  const baseExecutions = WORKFLOW_GROUP_ORDER.map((group, index) => {
    const workflow = getWorkflowDirectoryEntry(group)!;
    const seed = workflowSeedMeta[group];
    const executionId = createPublicId(`cevonne-${group.toLowerCase()}-run`);
    const publicId = createPublicId(`cevonne-${group.toLowerCase()}-public`);

    return {
      executionId,
      publicId,
      workflowGroup: group,
      workflowName: workflow.name,
      routeName: workflow.routeNames[0] ?? `/api/cevonne/admin/${group.toLowerCase()}`,
      status: seed.latestExecutionStatus,
      responseType: seed.lastResponseType,
      failureReason: seed.latestFailureReason ?? null,
      executedAt: minutesAgo(45 - index * 3),
      actor: "admin" as const,
      adminUserId: "system",
      adminEmail: "system@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: group === "G9" || group === "G11",
      notExecuted: group === "G6" || group === "G8",
      safePublicIds: [publicId],
      summary: seed.latestFailureReason ?? `${workflow.name} recorded successfully.`,
    };
  });

  return [
    ...baseExecutions,
    {
      executionId: createPublicId("cevonne-g1-run"),
      publicId: createPublicId("cevonne-g1-public"),
      workflowGroup: "G1",
      workflowName: "Compliance Guard",
      routeName: "/api/cevonne/admin/safe-test",
      status: "PASS",
      responseType: "G1_BUDGET_CHANGE_PASS",
      failureReason: null,
      requestedByWorkflow: "G9 Ads",
      requestedByWorkflowGroup: "G9",
      workflowId: "g9-meta-budget-change-001",
      actionType: "META_UPDATE_ADSET_BUDGET",
      actionTypeLabel: "Meta budget change",
      platform: "Meta",
      executedAt: minutesAgo(6),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "media@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: false,
      safePublicIds: [createPublicId("cevonne-g1-safe")],
      summary: "G9 Ads requested a Meta budget change and G1 passed it.",
    },
    {
      executionId: createPublicId("cevonne-g1-run"),
      publicId: createPublicId("cevonne-g1-public"),
      workflowGroup: "G1",
      workflowName: "Compliance Guard",
      routeName: "/api/cevonne/admin/safe-test",
      status: "BLOCK",
      responseType: "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER",
      failureReason: "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER",
      requestedByWorkflow: "G6 Messaging",
      requestedByWorkflowGroup: "G6",
      workflowId: "g6-instagram-dm-001",
      actionType: "DIRECT_N8N_IG_DM",
      actionTypeLabel: "Instagram DM send",
      platform: "Instagram",
      executedAt: minutesAgo(12),
      actor: "website",
      adminUserId: null,
      adminEmail: null,
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: true,
      safePublicIds: [createPublicId("cevonne-g1-safe")],
      summary: "Instagram DM send blocked. Use approved DM partner route.",
    },
    {
      executionId: createPublicId("cevonne-g1-run"),
      publicId: createPublicId("cevonne-g1-public"),
      workflowGroup: "G1",
      workflowName: "Compliance Guard",
      routeName: "/api/cevonne/admin/manual-review",
      status: "MANUAL_ONLY",
      responseType: "IG_PUBLISH_REVIEW_REQUIRED",
      failureReason: "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
      requestedByWorkflow: "G5 Publishing",
      requestedByWorkflowGroup: "G5",
      workflowId: "g5-instagram-publish-001",
      actionType: "IG_PUBLISH",
      actionTypeLabel: "Instagram post publish",
      platform: "Instagram",
      executedAt: minutesAgo(18),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "content@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: true,
      safePublicIds: [createPublicId("cevonne-g1-safe")],
      summary: "Instagram post publish needs human review.",
    },
    {
      executionId: createPublicId("cevonne-g1-run"),
      publicId: createPublicId("cevonne-g1-public"),
      workflowGroup: "G1",
      workflowName: "Compliance Guard",
      routeName: "/api/cevonne/admin/safe-test",
      status: "BLOCK",
      responseType: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
      failureReason: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
      executedAt: minutesAgo(24),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "growth@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: true,
      safePublicIds: [createPublicId("cevonne-g1-safe")],
      summary: "Google scraping is not allowed. Use approved Google sources only.",
    },
    {
      executionId: createPublicId("cevonne-g11-run"),
      publicId: createPublicId("cevonne-g11-public"),
      workflowGroup: "G11",
      workflowName: "Decision Engine",
      routeName: "/api/cevonne/admin/g11-digest",
      status: "PASS",
      responseType: "G11_WEEKLY_DIGEST_RECORDED",
      failureReason: null,
      executedAt: minutesAgo(8),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "system@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: false,
      safePublicIds: [createPublicId("cevonne-g11-public")],
      summary: "Weekly digest prepared in recommendation-only mode.",
    },
    {
      executionId: createPublicId("cevonne-g11-run"),
      publicId: createPublicId("cevonne-g11-public"),
      workflowGroup: "G11",
      workflowName: "Decision Engine",
      routeName: "/api/cevonne/admin/g11-recommendation",
      status: "PASS",
      responseType: "G11_DECISION_RECOMMENDATION_READY",
      failureReason: null,
      executedAt: minutesAgo(6),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "system@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: false,
      safePublicIds: [createPublicId("cevonne-g11-public")],
      summary: "Decision recommendation created without external execution.",
    },
    {
      executionId: createPublicId("cevonne-g11-run"),
      publicId: createPublicId("cevonne-g11-public"),
      workflowGroup: "G11",
      workflowName: "Decision Engine",
      routeName: "/api/cevonne/admin/g11-action-draft",
      status: "PASS",
      responseType: "G11_DRAFT_ACTION_PACKET_READY",
      failureReason: null,
      executedAt: minutesAgo(4),
      actor: "admin",
      adminUserId: "system",
      adminEmail: "system@cevonne.com",
      requestId: createPublicId("cevonne-request"),
      dryRun: true,
      notExecuted: false,
      safePublicIds: [createPublicId("cevonne-g11-public")],
      summary: "Draft action packet generated in recommendation-only mode.",
    },
  ];
};

const inferAuditActionTypeFromRoute = (routeName: string): CevonneAdminActionType => {
  if (routeName === "/api/cevonne/admin/g11-digest") {
    return "G11_WEEKLY_DIGEST_REQUEST";
  }

  if (routeName === "/api/cevonne/admin/g11-recommendation") {
    return "G11_DECISION_RECOMMENDATION_REQUEST";
  }

  if (routeName === "/api/cevonne/admin/g11-action-draft") {
    return "G11_DRAFT_ACTION_PACKET_REQUEST";
  }

  if (routeName === "/api/cevonne/admin/g2-account-health-update") {
    return "G2_ACCOUNT_HEALTH_UPDATE";
  }

  if (routeName === "/api/cevonne/admin/safe-test") {
    return "WORKFLOW_SAFE_TEST";
  }

  if (routeName === "/api/cevonne/admin/manual-review") {
    return "MANUAL_REVIEW";
  }

  return "VIEW_EXECUTIONS";
};

const createInitialAuditLogs = (executions: CevonneExecutionRecord[]): CevonneAuditLogRecord[] => {
  return executions.map((execution) => ({
    auditId: createPublicId("cevonne-audit"),
    publicId: createPublicId("cevonne-audit-public"),
    workflowGroup: execution.workflowGroup,
    actionType: inferAuditActionTypeFromRoute(execution.routeName),
    routeName: execution.routeName,
    resultStatus: execution.status,
    responseType: execution.responseType,
    failureReason: execution.failureReason ?? null,
    payloadSummary: execution.summary,
    timestamp: execution.executedAt,
    adminUserId: execution.adminUserId,
    adminEmail: execution.adminEmail,
    ipUserAgentHash: null,
    safePublicIds: execution.safePublicIds,
  }));
};

const createInitialState = (): CevonneAdminStoreState => {
  const workflows = createInitialWorkflows();
  const executions = createInitialExecutions();
  const approvals = createInitialApprovals();
  const auditLogs = createInitialAuditLogs(executions);

  return {
    workflows,
    executions,
    approvals,
    auditLogs,
  };
};

const getStore = () => {
  const globalStore = globalThis as typeof globalThis & {
    __cevonneAdminStore?: CevonneAdminStoreState;
  };

  if (!globalStore.__cevonneAdminStore) {
    globalStore.__cevonneAdminStore = createInitialState();
  }

  return globalStore.__cevonneAdminStore;
};

const trimRecords = <T,>(records: T[], limit = 200) => {
  if (records.length > limit) {
    return records.slice(0, limit);
  }

  return records;
};

const buildWorkflowView = (workflow: WorkflowRecord) => ({
  workflow_group: workflow.group,
  workflow_name: workflow.name,
  purpose: workflow.purpose,
  description: workflow.description,
  status: workflow.status,
  lifecycle_state: workflow.lifecycleState,
  last_run_at: workflow.lastRunAt,
  last_response_type: workflow.lastResponseType,
  pending_approvals_count: workflow.pendingApprovalsCount,
  latest_failure_reason: workflow.latestFailureReason ?? null,
  connected_backend_routes: workflow.connectedBackendRoutes,
  safe_actions: workflow.safeActions,
  required_approvals: workflow.requiredApprovals,
  required_compliance_checks: workflow.requiredComplianceChecks,
  safety_note: workflow.safetyNote,
  recommendation_only: Boolean(workflow.recommendationOnly),
  latest_public_id: workflow.latestPublicId,
});

const summarizeApproval = (approval: CevonneApprovalRecord) => ({
  approval_id: approval.approvalId,
  public_id: approval.publicId,
  workflow_group: approval.workflowGroup,
  workflow_name: approval.workflowName,
  action_type: approval.actionType,
  risk_level: approval.riskLevel,
  requested_by: approval.requestedBy,
  created_at: approval.createdAt,
  status: approval.status,
  reviewer_action: approval.reviewerAction ?? null,
  summary: approval.summary,
  require_confirmation: approval.requireConfirmation,
  admin_user_id: approval.adminUserId ?? null,
  admin_email: approval.adminEmail ?? null,
});

const summarizeExecution = (execution: CevonneExecutionRecord) => ({
  execution_id: execution.executionId,
  public_id: execution.publicId,
  workflow_group: execution.workflowGroup,
  workflow_name: execution.workflowName,
  route_name: execution.routeName,
  status: execution.status,
  response_type: execution.responseType,
  failure_reason: execution.failureReason ?? null,
  executed_at: execution.executedAt,
  actor: execution.actor,
  admin_user_id: execution.adminUserId ?? null,
  admin_email: execution.adminEmail ?? null,
  request_id: execution.requestId,
  dry_run: execution.dryRun,
  not_executed: execution.notExecuted,
  safe_public_ids: execution.safePublicIds,
  summary: execution.summary,
});

const summarizeAuditLog = (auditLog: CevonneAuditLogRecord) => ({
  audit_id: auditLog.auditId,
  public_id: auditLog.publicId,
  workflow_group: auditLog.workflowGroup,
  action_type: auditLog.actionType,
  route_name: auditLog.routeName,
  result_status: auditLog.resultStatus,
  response_type: auditLog.responseType,
  failure_reason: auditLog.failureReason ?? null,
  payload_summary: auditLog.payloadSummary,
  timestamp: auditLog.timestamp,
  admin_user_id: auditLog.adminUserId ?? null,
  admin_email: auditLog.adminEmail ?? null,
  ip_user_agent_hash: auditLog.ipUserAgentHash ?? null,
  safe_public_ids: auditLog.safePublicIds,
});

const workflowSort = (a: WorkflowRecord, b: WorkflowRecord) =>
  WORKFLOW_GROUP_ORDER.indexOf(a.group) - WORKFLOW_GROUP_ORDER.indexOf(b.group);

const executionSort = (a: CevonneExecutionRecord, b: CevonneExecutionRecord) =>
  new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime();

const approvalSort = (a: CevonneApprovalRecord, b: CevonneApprovalRecord) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const auditSort = (a: CevonneAuditLogRecord, b: CevonneAuditLogRecord) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

export const getCevonneAdminOverview = (): StoreViewResponse => {
  const store = getStore();
  const workflows = [...store.workflows].sort(workflowSort);
  const latestExecution = [...store.executions].sort(executionSort)[0];

  const summary = {
    total_workflows: workflows.length,
    active_workflows: workflows.filter((workflow) => workflow.status === "ACTIVE").length,
    manual_only_workflows: workflows.filter((workflow) => workflow.status === "MANUAL_ONLY").length,
    blocked_error_workflows: workflows.filter((workflow) => workflow.status === "BLOCK" || workflow.status === "ERROR").length,
    pending_approvals: store.approvals.filter((approval) => approval.status === "PENDING").length,
    latest_execution_status: latestExecution?.status ?? "PENDING",
    latest_execution_response_type: latestExecution?.responseType ?? null,
    latest_execution_at: latestExecution?.executedAt ?? null,
  };

  return {
    summary,
    workflows: workflows.map((workflow) => clone(workflow)),
  };
};

export const getCevonneAdminWorkflowDetail = (workflowGroup: CevonneWorkflowGroup | string): WorkflowDetailResponse | null => {
  const store = getStore();
  const workflow = store.workflows.find((record) => record.group === workflowGroup);
  if (!workflow) {
    return null;
  }

  const latestExecutions = store.executions
    .filter((execution) => execution.workflowGroup === workflow.group)
    .sort(executionSort)
    .slice(0, 5);

  const approvals = store.approvals
    .filter((approval) => approval.workflowGroup === workflow.group)
    .sort(approvalSort)
    .slice(0, 5);

  const auditLogs = store.auditLogs
    .filter((auditLog) => auditLog.workflowGroup === workflow.group || auditLog.workflowGroup === "GLOBAL")
    .sort(auditSort)
    .slice(0, 8);

  const relatedG1Runs = store.executions
    .filter((execution) => execution.workflowGroup === "G1")
    .sort(executionSort)
    .slice(0, 3);

  return {
    workflow: clone(workflow),
    latest_executions: latestExecutions.map((execution) => clone(execution)),
    approvals: approvals.map((approval) => clone(approval)),
    audit_logs: auditLogs.map((auditLog) => clone(auditLog)),
    related_g1_compliance_runs: relatedG1Runs.map((execution) => clone(execution)),
  };
};

export const getCevonneAdminExecutions = (workflowGroup?: string | null) => {
  const store = getStore();
  const executions = workflowGroup
    ? store.executions.filter((execution) => execution.workflowGroup === workflowGroup)
    : store.executions;

  return executions.sort(executionSort).map((execution) => clone(execution));
};

export const getCevonneAdminApprovals = (workflowGroup?: string | null) => {
  const store = getStore();
  const approvals = workflowGroup
    ? store.approvals.filter((approval) => approval.workflowGroup === workflowGroup)
    : store.approvals;

  return approvals.sort(approvalSort).map((approval) => clone(approval));
};

export const getCevonneAdminAuditLogs = (workflowGroup?: string | null) => {
  const store = getStore();
  const logs = workflowGroup
    ? store.auditLogs.filter((auditLog) => auditLog.workflowGroup === workflowGroup)
    : store.auditLogs;

  return logs.sort(auditSort).map((auditLog) => clone(auditLog));
};

const updateWorkflow = (workflowGroup: CevonneWorkflowGroup, updater: (workflow: WorkflowRecord) => void) => {
  const store = getStore();
  const workflow = store.workflows.find((record) => record.group === workflowGroup);
  if (!workflow) {
    return null;
  }

  updater(workflow);
  return clone(workflow);
};

const recordExecution = (input: {
  workflowGroup: CevonneWorkflowGroup;
  routeName: string;
  status: CevonneWorkflowStatus;
  responseType: string;
  summary: string;
  failureReason?: string | null;
  actor: "website" | "admin";
  adminUserId?: string | null;
  adminEmail?: string | null;
  requestId?: string;
  dryRun?: boolean;
  notExecuted?: boolean;
  safePublicIds?: string[];
}) => {
  const store = getStore();
  const workflow = store.workflows.find((record) => record.group === input.workflowGroup);
  if (!workflow) {
    return null;
  }

  const now = new Date().toISOString();
  const execution: CevonneExecutionRecord = {
    executionId: createPublicId(`cevonne-${input.workflowGroup.toLowerCase()}-exec`),
    publicId: createPublicId(`cevonne-${input.workflowGroup.toLowerCase()}-public`),
    workflowGroup: input.workflowGroup,
    workflowName: workflow.name,
    routeName: input.routeName,
    status: input.status,
    responseType: input.responseType,
    failureReason: input.failureReason ?? null,
    executedAt: now,
    actor: input.actor,
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    requestId: input.requestId ?? createPublicId("cevonne-request"),
    dryRun: input.dryRun ?? false,
    notExecuted: input.notExecuted ?? false,
    safePublicIds: input.safePublicIds ?? [createPublicId("cevonne-public")],
    summary: input.summary,
  };

  store.executions = trimRecords([execution, ...store.executions], 300);

  workflow.lastRunAt = now;
  workflow.lastResponseType = input.responseType;
  workflow.latestExecutionId = execution.executionId;
  workflow.latestPublicId = execution.publicId;
  workflow.latestExecutionStatus = input.status;
  workflow.latestExecutionLifecycle = input.status === "RECOMMENDATION_ONLY" ? "RECOMMENDATION_ONLY" : workflow.latestExecutionLifecycle;
  workflow.latestFailureReason = input.failureReason ?? null;
  const preserveWorkflowStatus =
    workflow.status === "DRY_RUN" || workflow.status === "NOT_BUILT" || workflow.status === "RECOMMENDATION_ONLY";

  if (input.status === "MANUAL_ONLY") {
    workflow.status = "MANUAL_ONLY";
  } else if (input.status === "BLOCK" || input.status === "ERROR") {
    workflow.status = input.status;
  } else if (input.status === "PASS" && !preserveWorkflowStatus) {
    workflow.status = "PASS";
  } else if (input.status === "PENDING") {
    workflow.status = "PENDING";
  } else if (input.status === "RECOMMENDATION_ONLY") {
    workflow.status = "RECOMMENDATION_ONLY";
  }

  return clone(execution);
};

export const recordCevonneAdminAuditLog = (input: {
  workflowGroup?: CevonneWorkflowGroup | "GLOBAL";
  actionType: CevonneAdminActionType;
  routeName: string;
  resultStatus: CevonneWorkflowStatus;
  responseType: string;
  payloadSummary: string;
  failureReason?: string | null;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
  safePublicIds?: string[];
}) => {
  const store = getStore();
  const log: CevonneAuditLogRecord = {
    auditId: createPublicId("cevonne-audit"),
    publicId: createPublicId("cevonne-audit-public"),
    workflowGroup: input.workflowGroup ?? "GLOBAL",
    actionType: input.actionType,
    routeName: input.routeName,
    resultStatus: input.resultStatus,
    responseType: input.responseType,
    failureReason: input.failureReason ?? null,
    payloadSummary: input.payloadSummary,
    timestamp: new Date().toISOString(),
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: input.safePublicIds ?? [createPublicId("cevonne-public")],
  };

  store.auditLogs = trimRecords([log, ...store.auditLogs], 300);
  return clone(log);
};

export const recordCevonneWorkflowExecution = (input: {
  workflowGroup: CevonneWorkflowGroup;
  routeName: string;
  status: CevonneWorkflowStatus;
  responseType: string;
  summary: string;
  failureReason?: string | null;
  actor: "website" | "admin";
  adminUserId?: string | null;
  adminEmail?: string | null;
  requestId?: string;
  dryRun?: boolean;
  notExecuted?: boolean;
  safePublicIds?: string[];
}) => {
  const execution = recordExecution(input);
  if (!execution) {
    return null;
  }

  recordCevonneAdminAuditLog({
    workflowGroup: input.workflowGroup,
    actionType: input.actor === "admin" ? "VIEW_WORKFLOW_DETAIL" : "VIEW_EXECUTIONS",
    routeName: input.routeName,
    resultStatus: input.status,
    responseType: input.responseType,
    failureReason: input.failureReason ?? null,
    payloadSummary: input.summary,
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    safePublicIds: execution.safePublicIds,
  });

  return execution;
};

export const recordCevonneAdminApproval = (input: {
  approvalId: string;
  decision: CevonneApprovalDecision;
  adminUserId?: string | null;
  adminEmail?: string | null;
  notes?: string | null;
  ipUserAgentHash?: string | null;
}) => {
  const store = getStore();
  const approval = store.approvals.find((record) => record.approvalId === input.approvalId);
  if (!approval) {
    return null;
  }

  if (approval.status !== "PENDING") {
    return null;
  }

  if (input.decision === "APPROVE") {
    approval.status = "APPROVED";
    approval.reviewerAction = "Approved by admin";
  } else if (input.decision === "REJECT") {
    approval.status = "REJECTED";
    approval.reviewerAction = "Rejected by admin";
  } else {
    approval.status = "CHANGES_REQUESTED";
    approval.reviewerAction = "Changes requested by admin";
  }

  approval.adminUserId = input.adminUserId ?? null;
  approval.adminEmail = input.adminEmail ?? null;

  const workflow = store.workflows.find((record) => record.group === approval.workflowGroup);
  if (workflow) {
    workflow.pendingApprovalsCount = Math.max(0, workflow.pendingApprovalsCount - 1);
    const preserveWorkflowStatus =
      workflow.status === "DRY_RUN" || workflow.status === "NOT_BUILT" || workflow.status === "RECOMMENDATION_ONLY";

    if (!preserveWorkflowStatus) {
      if (approval.status === "APPROVED") {
        workflow.status = "PASS";
      } else if (approval.status === "REJECTED") {
        workflow.status = "BLOCK";
      } else {
        workflow.status = "MANUAL_ONLY";
      }
    }
    workflow.lastRunAt = new Date().toISOString();
    workflow.lastResponseType = `APPROVAL_${approval.status}`;
  }

  const log = recordCevonneAdminAuditLog({
    workflowGroup: approval.workflowGroup,
    actionType: "APPROVAL_DECISION",
    routeName: "/api/cevonne/admin/approval-decision",
    resultStatus: approval.status === "APPROVED" ? "PASS" : approval.status === "REJECTED" ? "BLOCK" : "MANUAL_ONLY",
    responseType: `APPROVAL_${approval.status}`,
    payloadSummary: safeJoin([
      `approval_id=${approval.approvalId}`,
      `decision=${input.decision}`,
      `notes=${input.notes ?? approval.summary}`,
    ]),
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: [approval.publicId],
  });

  return {
    approval: clone(approval),
    log,
  };
};

export const recordCevonneAdminG2Update = (input: {
  healthStatus: CevonneHealthStatus;
  notes?: string | null;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
}) => {
  const workflowGroup: CevonneWorkflowGroup = "G2";
  const workflow = updateWorkflow(workflowGroup, (record) => {
    if (input.healthStatus === "OK") {
      record.status = "PASS";
      record.latestFailureReason = null;
      record.lastResponseType = "G2_ACCOUNT_HEALTH_OK";
    } else if (input.healthStatus === "WARNING") {
      record.status = "MANUAL_ONLY";
      record.latestFailureReason = input.notes || "Policy/account health warning.";
      record.lastResponseType = "G2_ACCOUNT_HEALTH_WARNING";
    } else {
      record.status = "BLOCK";
      record.latestFailureReason = input.notes || "Account health blocked.";
      record.lastResponseType = "G2_ACCOUNT_HEALTH_BLOCKED";
    }

    record.lastRunAt = new Date().toISOString();
    record.latestExecutionLifecycle = input.healthStatus === "OK" ? "COMPLETE" : "REVIEW";
    record.pendingApprovalsCount = input.healthStatus === "OK" ? 0 : Math.max(1, record.pendingApprovalsCount);
  });

  if (!workflow) {
    return null;
  }

  const status: CevonneWorkflowStatus = input.healthStatus === "OK" ? "PASS" : input.healthStatus === "WARNING" ? "MANUAL_ONLY" : "BLOCK";
  const responseType =
    input.healthStatus === "OK"
      ? "G2_ACCOUNT_HEALTH_UPDATED"
      : input.healthStatus === "WARNING"
        ? "G2_ACCOUNT_HEALTH_REVIEW_REQUIRED"
        : "G2_ACCOUNT_HEALTH_BLOCKED";

  const execution = recordExecution({
    workflowGroup,
    routeName: "/api/cevonne/admin/g2-account-health-update",
    status,
    responseType,
    summary: safeJoin([`health_status=${input.healthStatus}`, `notes=${input.notes ?? "none"}`]),
    failureReason: input.healthStatus === "OK" ? null : input.notes || null,
    actor: "admin",
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    dryRun: false,
    notExecuted: input.healthStatus !== "OK",
  });

  const log = recordCevonneAdminAuditLog({
    workflowGroup,
    actionType: "G2_ACCOUNT_HEALTH_UPDATE",
    routeName: "/api/cevonne/admin/g2-account-health-update",
    resultStatus: status,
    responseType,
    payloadSummary: safeJoin([`health_status=${input.healthStatus}`, `notes=${input.notes ?? "none"}`]),
    failureReason: input.healthStatus === "OK" ? null : input.notes || null,
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: execution ? execution.safePublicIds : [createPublicId("cevonne-public")],
  });

  return {
    workflow: clone(getStore().workflows.find((record) => record.group === workflowGroup)!),
    execution,
    log,
  };
};

export const recordCevonneAdminSafeTest = (input: {
  workflowGroup: CevonneWorkflowGroup;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
}) => {
  const workflow = getStore().workflows.find((record) => record.group === input.workflowGroup);
  if (!workflow) {
    return null;
  }

  const responseType = "WORKFLOW_SAFE_TEST_COMPLETED";
  const execution = recordExecution({
    workflowGroup: input.workflowGroup,
    routeName: "/api/cevonne/admin/safe-test",
    status: "PASS",
    responseType,
    summary: "Dry-run safe test executed without external writes.",
    actor: "admin",
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    dryRun: true,
    notExecuted: true,
    safePublicIds: [createPublicId("cevonne-safe-test")],
  });

  const log = recordCevonneAdminAuditLog({
    workflowGroup: input.workflowGroup,
    actionType: "WORKFLOW_SAFE_TEST",
    routeName: "/api/cevonne/admin/safe-test",
    resultStatus: "PASS",
    responseType,
    payloadSummary: "Dry-run safe test executed without external writes.",
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: execution ? execution.safePublicIds : [createPublicId("cevonne-safe-test")],
  });

  return {
    workflow: clone(getStore().workflows.find((record) => record.group === input.workflowGroup)!),
    execution,
    log,
  };
};

export const recordCevonneAdminManualReview = (input: {
  workflowGroup: CevonneWorkflowGroup;
  reason?: string | null;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
}) => {
  const workflow = getStore().workflows.find((record) => record.group === input.workflowGroup);
  if (!workflow) {
    return null;
  }

  const responseType = "WORKFLOW_MANUAL_REVIEW_RECORDED";
  const summary = safeJoin([`reason=${input.reason ?? "manual review requested"}`]);
  const execution = recordExecution({
    workflowGroup: input.workflowGroup,
    routeName: "/api/cevonne/admin/manual-review",
    status: "MANUAL_ONLY",
    responseType,
    summary,
    failureReason: input.reason ?? "Manual review requested.",
    actor: "admin",
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    dryRun: true,
    notExecuted: true,
    safePublicIds: [createPublicId("cevonne-manual-review")],
  });

  const log = recordCevonneAdminAuditLog({
    workflowGroup: input.workflowGroup,
    actionType: "MANUAL_REVIEW",
    routeName: "/api/cevonne/admin/manual-review",
    resultStatus: "MANUAL_ONLY",
    responseType,
    payloadSummary: summary,
    failureReason: input.reason ?? "Manual review requested.",
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: execution ? execution.safePublicIds : [createPublicId("cevonne-manual-review")],
  });

  return {
    workflow: clone(getStore().workflows.find((record) => record.group === input.workflowGroup)!),
    execution,
    log,
  };
};

export const recordCevonneAdminRouteView = (input: {
  workflowGroup?: CevonneWorkflowGroup | "GLOBAL";
  actionType: CevonneAdminActionType;
  routeName: string;
  resultStatus: CevonneWorkflowStatus;
  responseType: string;
  payloadSummary: string;
  failureReason?: string | null;
  adminUserId?: string | null;
  adminEmail?: string | null;
  ipUserAgentHash?: string | null;
}) => {
  return recordCevonneAdminAuditLog({
    workflowGroup: input.workflowGroup,
    actionType: input.actionType,
    routeName: input.routeName,
    resultStatus: input.resultStatus,
    responseType: input.responseType,
    payloadSummary: input.payloadSummary,
    failureReason: input.failureReason ?? null,
    adminUserId: input.adminUserId ?? null,
    adminEmail: input.adminEmail ?? null,
    ipUserAgentHash: input.ipUserAgentHash ?? null,
    safePublicIds: [createPublicId("cevonne-view")],
  });
};

export const getCevonneAdminWorkflowCounts = () => {
  const store = getStore();
  const latestExecution = [...store.executions].sort(executionSort)[0];
  return {
    total_workflows: store.workflows.length,
    active_workflows: store.workflows.filter((workflow) => workflow.status === "ACTIVE").length,
    manual_only_workflows: store.workflows.filter((workflow) => workflow.status === "MANUAL_ONLY").length,
    blocked_error_workflows: store.workflows.filter((workflow) => workflow.status === "BLOCK" || workflow.status === "ERROR").length,
    pending_approvals: store.approvals.filter((approval) => approval.status === "PENDING").length,
    latest_execution_status: latestExecution?.status ?? "PENDING",
    latest_execution_response_type: latestExecution?.responseType ?? null,
    latest_execution_at: latestExecution?.executedAt ?? null,
  };
};
