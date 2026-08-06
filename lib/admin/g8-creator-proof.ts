export const G8_QUEUE_FILTERS = [
  "ALL",
  "AWAITING_PERMISSION",
  "NEEDS_SAFETY",
  "NEEDS_DISCLOSURE",
  "PENDING_APPROVAL",
  "APPROVED",
  "DECLINED_OR_BLOCKED",
] as const;

export type G8QueueFilter = (typeof G8_QUEUE_FILTERS)[number];

export type G8FriendlyStatus =
  | "Awaiting Permission"
  | "Permission Granted"
  | "Permission Declined"
  | "Permission Required"
  | "Rights Expired"
  | "Rights Revoked"
  | "Safety Review Needed"
  | "Safety Passed"
  | "Safety Blocked"
  | "Disclosure Review Needed"
  | "Disclosure Passed"
  | "Disclosure Not Required"
  | "Waiting for Approval"
  | "Ready"
  | "Blocked"
  | "Needs Review"
  | "Could Not Complete";

export type G8StepState = "COMPLETE" | "CURRENT" | "BLOCKED" | "NOT_STARTED";

export type G8WorkflowStep = {
  label: string;
  state: G8StepState;
};

export type G8UgcItem = {
  itemKey: string;
  creatorUsername: string;
  creatorDisplayName: string | null;
  caption: string;
  mediaUrl: string | null;
  sourceUrl: string | null;
  mediaType: string;
  sourceType: string;
  receivedAt: string;
  currentStatus: G8FriendlyStatus;
  nextAction: string;
  permissionLabel: string;
  rightsLabel: string;
  rightsExpiresAt: string | null;
  safetyLabel: string;
  disclosureLabel: string;
  approvalLabel: string;
  relationshipType: "ORGANIC" | "GIFTED" | "PAID" | "AFFILIATE";
  allowedUses: string[];
  adUsageAllowed: boolean;
  editingAllowed: boolean;
  territory: string | null;
  attributionText: string | null;
  progress: G8WorkflowStep[];
  canRecordPermission: boolean;
  canReviewSafety: boolean;
  canReviewDisclosure: boolean;
  canSendForApproval: boolean;
  canRevokePermission: boolean;
  isTerminallyBlocked: boolean;
  latestMessage: string | null;
};

export type G8DashboardSummary = {
  total: number;
  awaitingPermission: number;
  needsReview: number;
  pendingApproval: number;
  readyApproved: number;
};

export type G8CreatorPerformance = {
  creatorUsername: string;
  clicks: number;
  leads: number;
  purchases: number;
  revenue: number;
  creatorCost: number;
  roi: number | null;
  currency: string;
};

export type G8DashboardData = {
  summary: G8DashboardSummary;
  items: G8UgcItem[];
  performance: G8CreatorPerformance[];
  refreshedAt: string;
};

export type G8ActionName =
  | "INTAKE"
  | "PERMISSION_YES"
  | "PERMISSION_NO"
  | "SAFETY_PASS"
  | "SAFETY_BLOCK"
  | "DISCLOSURE"
  | "SEND_FOR_APPROVAL"
  | "REVOKE_PERMISSION";

export type G8ActionResponse = {
  status: "SUCCESS" | "PENDING" | "BLOCKED";
  message: string;
};

export const G8_FILTER_LABELS: Record<G8QueueFilter, string> = {
  ALL: "All",
  AWAITING_PERMISSION: "Awaiting Permission",
  NEEDS_SAFETY: "Needs Safety Review",
  NEEDS_DISCLOSURE: "Needs Disclosure Review",
  PENDING_APPROVAL: "Pending Content Approval",
  APPROVED: "Approved",
  DECLINED_OR_BLOCKED: "Declined / Blocked",
};
