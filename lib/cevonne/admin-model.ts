export type CevonneWorkflowGroup =
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G5"
  | "G6"
  | "G7"
  | "G8"
  | "G9"
  | "G10"
  | "G11";

export type CevonneWorkflowStatus =
  | "ACTIVE"
  | "PASS"
  | "BLOCK"
  | "MANUAL_ONLY"
  | "ERROR"
  | "PENDING"
  | "NOT_BUILT"
  | "DRY_RUN"
  | "RECOMMENDATION_ONLY";

export type CevonneWorkflowLifecycleState =
  | "COMPLETE"
  | "REVIEW"
  | "PENDING"
  | "DRY_RUN"
  | "RECOMMENDATION_ONLY"
  | "NOT_BUILT";

export type CevonneWorkflowResponseType = string;

export type CevonneApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type CevonneApprovalDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export type CevonneRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CevonneHealthStatus = "OK" | "WARNING" | "BLOCKED";

export type CevonneAdminActionType =
  | "VIEW_WORKFLOWS"
  | "VIEW_WORKFLOW_DETAIL"
  | "VIEW_EXECUTIONS"
  | "VIEW_AUDIT_LOGS"
  | "VIEW_APPROVALS"
  | "APPROVAL_REQUEST"
  | "APPROVAL_DECISION"
  | "G2_ACCOUNT_HEALTH_UPDATE"
  | "WORKFLOW_SAFE_TEST"
  | "MANUAL_REVIEW"
  | "G11_WEEKLY_DIGEST_REQUEST"
  | "G11_DECISION_RECOMMENDATION_REQUEST"
  | "G11_DRAFT_ACTION_PACKET_REQUEST";

export type CevonneWorkflowDirectoryEntry = {
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
};

export const CEVONNE_WORKFLOW_DIRECTORY: CevonneWorkflowDirectoryEntry[] = [
  {
    group: "G1",
    name: "Compliance Guard",
    purpose: "Universal compliance gate and safety validator.",
    description: "Blocks unknown or unsafe actions before they reach any downstream workflow.",
    status: "ACTIVE",
    lifecycleState: "COMPLETE",
    safetyNote: "UNKNOWN = BLOCK. This is the universal compliance gate.",
    routeNames: ["/api/cevonne/admin/safe-test", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["None for reads", "Explicit admin confirmation for any workflow action"],
    requiredComplianceChecks: ["Schema validation", "Consent gate", "Safety policy check"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review"],
  },
  {
    group: "G2",
    name: "Policy + Account Health Monitor",
    purpose: "Tracks account health, policy status, API/tool changes, and manual review needs.",
    description: "Detects warning conditions early and routes them into human review before changes go live.",
    status: "ACTIVE",
    lifecycleState: "COMPLETE",
    safetyNote: "Unknown or warning states trigger MANUAL_ONLY or BLOCK.",
    routeNames: ["/api/cevonne/admin/g2-account-health-update", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Admin review for warnings", "Escalation confirmation for blocked states"],
    requiredComplianceChecks: ["Policy health", "Account integrity", "Escalation audit"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review"],
  },
  {
    group: "G3",
    name: "CRM + Consent + Attribution",
    purpose: "Shared customer and consent source of truth.",
    description: "Records consent, opt-outs, attribution, purchases, and privacy requests through the backend only.",
    status: "ACTIVE",
    lifecycleState: "COMPLETE",
    safetyNote: "The shared CRM backbone. Website events always route here first.",
    routeNames: [
      "/api/cevonne/consent",
      "/api/cevonne/opt-out",
      "/api/cevonne/attribution",
      "/api/cevonne/purchase",
      "/api/cevonne/privacy-request",
    ],
    requiredApprovals: ["Consent validation", "Opt-out confirmation", "Privacy request verification"],
    requiredComplianceChecks: ["Consent state", "Tracking consent", "Purchase suppression"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review"],
  },
  {
    group: "G4",
    name: "Content Intelligence + Approval",
    purpose: "Drafts and reviews content claims before publishing.",
    description: "Keeps claims, copy, and creative in review until approvals are complete.",
    status: "MANUAL_ONLY",
    lifecycleState: "REVIEW",
    safetyNote: "Content and claims only. No direct publishing.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Content approver", "Compliance approver for claims"],
    requiredComplianceChecks: ["Claim validation", "Source citation", "Approval status"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G5",
    name: "Publishing Scheduler",
    purpose: "Schedules approved assets into official publishing flows.",
    description: "Only approved assets should move forward. Pending items stay in review.",
    status: "PENDING",
    lifecycleState: "PENDING",
    safetyNote: "Publishes only approved assets through official routes.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Publishing approval", "Asset approval"],
    requiredComplianceChecks: ["Approval token", "Publish gate", "Asset readiness"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G6",
    name: "Messaging + Quiz + Recovery Router",
    purpose: "Routes messaging and recovery only through approved partner paths.",
    description: "No direct browser or n8n outbound messaging until the partner route is confirmed.",
    status: "NOT_BUILT",
    lifecycleState: "NOT_BUILT",
    safetyNote: "No direct outbound IG DM. Keep this disconnected until the final partner route is confirmed.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Partner route confirmation", "Consent proof", "Recovery approval"],
    requiredComplianceChecks: ["Consent status", "Partner routing", "Recovery gate"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G7",
    name: "Inventory + Offer Safety",
    purpose: "Protects scarcity and offer claims with proof-backed inventory checks.",
    description: "Offer and urgency claims must be backed by inventory or discount proof.",
    status: "ACTIVE",
    lifecycleState: "COMPLETE",
    safetyNote: "Offer and urgency claims require inventory or discount proof.",
    routeNames: ["/api/cevonne/admin/safe-test", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Inventory proof", "Offer proof", "Promo change sign-off"],
    requiredComplianceChecks: ["Stock proof", "Discount proof", "Offer audit"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G8",
    name: "UGC + Creator Proof",
    purpose: "Tracks rights, permissions, and disclosure proof for creator content.",
    description: "UGC stays blocked until rights and creator proof are verified.",
    status: "NOT_BUILT",
    lifecycleState: "NOT_BUILT",
    safetyNote: "UGC requires permission, rights, and disclosure proof.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/manual-review"],
    requiredApprovals: ["Rights approval", "Creator approval", "Disclosure proof"],
    requiredComplianceChecks: ["Rights metadata", "Disclosure copy", "Usage permission"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G9",
    name: "Ads + Retargeting Optimizer",
    purpose: "Recommends ad changes and keeps execution dry-run safe until approved.",
    description: "Ad optimization stays recommendation-only unless explicit production writes are enabled later.",
    status: "DRY_RUN",
    lifecycleState: "DRY_RUN",
    safetyNote: "Human-approved and dry-run safe unless production writes are explicitly enabled later.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/safe-test"],
    requiredApprovals: ["Budget approval", "Creative approval", "Audience approval"],
    requiredComplianceChecks: ["Dry-run mode", "Audience safety", "Budget guard"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G10",
    name: "SEO + CRO",
    purpose: "Keeps search and conversion recommendations safe and traceable.",
    description: "Uses approved sources only and avoids scraping or unmasked recordings.",
    status: "PENDING",
    lifecycleState: "REVIEW",
    safetyNote: "No scraping, no unmasked recordings, no unsafe source usage.",
    routeNames: ["/api/cevonne/admin/approval-decision", "/api/cevonne/admin/safe-test"],
    requiredApprovals: ["Experiment approval", "Copy approval", "Measurement approval"],
    requiredComplianceChecks: ["Source safety", "Experiment tracking", "CRO approval"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
  },
  {
    group: "G11",
    name: "Decision Engine",
    purpose: "Generates recommendations and draft action packets only.",
    description: "Recommendation-only. No write credentials or direct execution are allowed.",
    status: "RECOMMENDATION_ONLY",
    lifecycleState: "RECOMMENDATION_ONLY",
    safetyNote: "Recommendation-only. No write credentials. No external execution.",
    routeNames: [
      "/api/cevonne/admin/g11-digest",
      "/api/cevonne/admin/g11-recommendation",
      "/api/cevonne/admin/g11-action-draft",
    ],
    requiredApprovals: ["Admin review of digest", "Recommendation sign-off"],
    requiredComplianceChecks: ["Recommendation-only mode", "Draft packet review", "No-execution guard"],
    safeActions: ["View details", "View executions", "View audit logs", "Run safe test", "Manual review", "Open approvals"],
    recommendationOnly: true,
  },
];

export const WORKFLOW_GROUP_ORDER = CEVONNE_WORKFLOW_DIRECTORY.map((workflow) => workflow.group);

export const getWorkflowDirectoryEntry = (group: CevonneWorkflowGroup | string) => {
  return CEVONNE_WORKFLOW_DIRECTORY.find((workflow) => workflow.group === group);
};

export const CEVONNE_STATUS_TONES: Record<CevonneWorkflowStatus, "emerald" | "amber" | "rose" | "slate" | "violet" | "cyan" | "blue"> = {
  ACTIVE: "emerald",
  PASS: "emerald",
  BLOCK: "rose",
  MANUAL_ONLY: "amber",
  ERROR: "rose",
  PENDING: "amber",
  NOT_BUILT: "slate",
  DRY_RUN: "cyan",
  RECOMMENDATION_ONLY: "violet",
};
