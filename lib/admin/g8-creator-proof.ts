export const G8_QUEUE_FILTERS = [
  "ALL",
  "NEEDS_ACTION",
  "AWAITING_PERMISSION",
  "NEEDS_SAFETY",
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
  | "Ready for G4"
  | "Ready for Approval"
  | "Sent to Content Review"
  | "Ready"
  | "Blocked"
  | "Needs Review"
  | "Could Not Complete";

export type G8StepState = "COMPLETE" | "CURRENT" | "BLOCKED" | "NOT_STARTED";

export type G8WorkflowStep = {
  label: string;
  state: G8StepState;
};

export type G8ActivityItem = {
  label: string;
  occurredAt: string;
};

export type G8UgcItem = {
  itemKey: string;
  creatorUsername: string;
  creatorDisplayName: string | null;
  caption: string;
  mediaUrl: string | null;
  sourceUrl: string | null;
  mediaType: string;
  contentType: "Story" | "Post" | "Reel";
  sourceType: string;
  isStoryMention: boolean;
  isAutomaticPermissionFlow: boolean;
  requiresManualPermission: boolean;
  permissionRequestSent: boolean;
  isReadyForG4: boolean;
  isActuallySentToG4: boolean;
  receivedAt: string;
  currentStatus: G8FriendlyStatus;
  nextAction: string;
  nextActionKind: G8NextActionKind;
  needsMediaAttachment: boolean;
  permissionLabel: string;
  rightsLabel: string;
  rightsStartedAt: string | null;
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
  safetyEvidenceUrl: string | null;
  disclosureEvidenceUrl: string | null;
  progress: G8WorkflowStep[];
  activity: G8ActivityItem[];
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
  newUgc: number;
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

export type G8LifecycleInput = {
  permission: string;
  rights: string;
  safety: string;
  disclosure: string;
  overall: string;
  asset: string;
  handoffStatus: string;
  g4Status: string;
  g5Status: string;
  expiresAt: string | null;
  isAutomaticPermissionFlow: boolean;
  permissionRequestSent: boolean;
  organicSocialAllowed: boolean;
  isActuallySentToG4: boolean;
  hasReviewMedia?: boolean;
  now?: number;
};

export type G8Lifecycle = {
  currentStatus: G8FriendlyStatus;
  nextAction: string;
  nextActionKind: G8NextActionKind;
  granted: boolean;
  pendingApproval: boolean;
  ready: boolean;
  isReadyForG4: boolean;
  isActuallySentToG4: boolean;
  terminalBlock: boolean;
  expired: boolean;
  declined: boolean;
  safetyBlock: boolean;
  approvalBlock: boolean;
};

export type G8NextActionKind =
  | "WAITING_FOR_CREATOR"
  | "REQUEST_PERMISSION"
  | "ADD_STORY_MEDIA"
  | "REVIEW_SAFETY"
  | "REVIEW_DISCLOSURE"
  | "SEND_TO_G4"
  | "SENT_TO_G4"
  | "VIEW_REASON"
  | "NONE";

const normalizeLifecycleStatus = (value: string) => value.trim().toUpperCase();
const lifecycleStatusIsBlocked = (value: string) => ["BLOCK", "BLOCKED", "DECLINED", "DENIED", "REJECTED", "REVOKED"].includes(value);

export const deriveG8Lifecycle = (input: G8LifecycleInput): G8Lifecycle => {
  const permission = normalizeLifecycleStatus(input.permission);
  const rights = normalizeLifecycleStatus(input.rights);
  const safety = normalizeLifecycleStatus(input.safety);
  const disclosure = normalizeLifecycleStatus(input.disclosure);
  const overall = normalizeLifecycleStatus(input.overall);
  const asset = normalizeLifecycleStatus(input.asset);
  const handoffStatus = normalizeLifecycleStatus(input.handoffStatus);
  const g4Status = normalizeLifecycleStatus(input.g4Status);
  const g5Status = normalizeLifecycleStatus(input.g5Status);
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  const expired = rights === "EXPIRED" || (Number.isFinite(expiresAt) && expiresAt <= (input.now ?? Date.now()));
  const revoked = rights === "REVOKED";
  const declined = ["DECLINED", "DENIED", "NO", "REJECTED"].includes(permission);
  const granted = ["APPROVED", "GRANTED", "YES", "PASS"].includes(permission) && rights === "ACTIVE" && !expired && !revoked;
  const safetyPassed = safety === "PASS";
  const disclosurePassed = ["PASS", "NOT_REQUIRED"].includes(disclosure);
  const safetyBlock = lifecycleStatusIsBlocked(safety);
  const approvalBlock = [handoffStatus, g4Status, g5Status, asset].some(lifecycleStatusIsBlocked);
  const terminalBlock = declined || revoked || expired || safetyBlock || approvalBlock || overall === "BLOCK";
  // A generic PENDING_APPROVAL status is not proof of a G4 handoff. This value
  // comes from the persisted handoff record and an acknowledged G4 PASS only.
  const isActuallySentToG4 = input.isActuallySentToG4;
  const pendingApproval = isActuallySentToG4 && !["APPROVED", "READY"].includes(g5Status);
  const ready = isActuallySentToG4 && ["APPROVED", "READY"].includes(g5Status);
  const isReadyForG4 = granted && safetyPassed && disclosurePassed && input.organicSocialAllowed && !terminalBlock && !isActuallySentToG4;

  const state = { granted, pendingApproval, ready, isReadyForG4, isActuallySentToG4, terminalBlock, expired, declined, safetyBlock, approvalBlock };
  if (revoked) return { currentStatus: "Blocked", nextAction: "Blocked", nextActionKind: "VIEW_REASON", ...state };
  if (declined) return { currentStatus: "Blocked", nextAction: "Blocked", nextActionKind: "VIEW_REASON", ...state };
  if (expired) return { currentStatus: "Blocked", nextAction: "Blocked", nextActionKind: "VIEW_REASON", ...state };
  if (safetyBlock) return { currentStatus: "Blocked", nextAction: "Blocked", nextActionKind: "VIEW_REASON", ...state };
  if (approvalBlock || overall === "BLOCK") return { currentStatus: "Blocked", nextAction: "View reason", nextActionKind: "VIEW_REASON", ...state };
  if (!granted) {
    return {
      currentStatus: input.isAutomaticPermissionFlow ? "Awaiting Permission" : "Permission Required",
      nextAction: input.isAutomaticPermissionFlow ? "Waiting for creator" : "Request permission",
      nextActionKind: input.isAutomaticPermissionFlow ? "WAITING_FOR_CREATOR" : "REQUEST_PERMISSION",
      ...state,
    };
  }
  if (!safetyPassed) {
    const needsMediaAttachment = input.hasReviewMedia === false;
    return { currentStatus: "Safety Review Needed", nextAction: needsMediaAttachment ? "Add Story Media" : "Review safety", nextActionKind: needsMediaAttachment ? "ADD_STORY_MEDIA" : "REVIEW_SAFETY", ...state };
  }
  if (!disclosurePassed) return { currentStatus: "Disclosure Review Needed", nextAction: "Review disclosure", nextActionKind: "REVIEW_DISCLOSURE", ...state };
  if (!input.organicSocialAllowed) return { currentStatus: "Needs Review", nextAction: "View reason", nextActionKind: "VIEW_REASON", ...state };
  if (ready) return { currentStatus: "Ready", nextAction: "Ready for reuse", nextActionKind: "NONE", ...state };
  if (isActuallySentToG4) return { currentStatus: "Sent to Content Review", nextAction: "Sent to G4", nextActionKind: "SENT_TO_G4", ...state };
  if (overall === "ERROR" || overall === "NEEDS_EVIDENCE") return { currentStatus: overall === "ERROR" ? "Could Not Complete" : "Needs Review", nextAction: "View reason", nextActionKind: "VIEW_REASON", ...state };
  return { currentStatus: "Ready for G4", nextAction: "Send to G4", nextActionKind: "SEND_TO_G4", ...state };
};

// The dashboard, summary cards, filters and action buttons all derive from this
// same state machine so a record cannot appear in competing queues.
export const getG8DisplayState = deriveG8Lifecycle;

export const deduplicateG8Records = <T>(records: T[], getIdentity: (record: T) => string) => {
  const uniqueRecords = new Map<string, T>();
  records.forEach((record) => {
    const identity = getIdentity(record);
    if (!uniqueRecords.has(identity)) uniqueRecords.set(identity, record);
  });
  return Array.from(uniqueRecords.values());
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
  NEEDS_ACTION: "Needs Action",
  AWAITING_PERMISSION: "Permission",
  NEEDS_SAFETY: "Review",
  APPROVED: "Ready",
  DECLINED_OR_BLOCKED: "Blocked",
};
