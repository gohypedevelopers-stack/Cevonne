import { getWorkflowDetailHref, normalizeWorkflowId } from "@/lib/admin/workflows";
import { normalizeG1AuditRows, type G1DecisionLabel, type G1DecisionSource } from "@/lib/g1-compliance-guard";

export type G1ComplianceGuardStatus =
  | "PASS"
  | "BLOCK"
  | "MANUAL_ONLY"
  | "PENDING_APPROVAL"
  | "NEEDS_EVIDENCE"
  | "ERROR";

export type G1OutcomeView = {
  time: string | null;
  handledAt: string | null;
  result: G1ComplianceGuardStatus;
  checked: string;
  requestedByWorkflow: string;
  requestedByWorkflowGroup: string | null;
  actionTypeLabel: string;
  platformLabel: string;
  workflowDetailHref: string | null;
  technicalReason: string | null;
  whatHappened: string;
  actionNeeded: string;
  whyItBlocked: string | null;
  insight: string | null;
};

export type G1RemediationAction = {
  label: string;
  helperText: string;
  href: string | null;
  disabled: boolean;
};

export type G1ComplianceGuardSnapshot = {
  workflowGroup: "G1";
  title: string;
  purpose: string;
  status: G1ComplianceGuardStatus;
  lastRunAt: string | null;
  latestOutcome: G1OutcomeView;
  recentOutcomes: G1OutcomeView[];
};

const G1_TITLE = "G1 — Compliance Guard";
const G1_PURPOSE = "Checks whether risky workflow actions are safe before they run.";
const G1_RECENT_LIMIT = 8;

type OutcomeMessages = {
  whatHappened: string;
  actionNeeded: string;
  whyItBlocked: string | null;
  insight: string | null;
};

const DEFAULT_MESSAGES: Record<G1ComplianceGuardStatus, OutcomeMessages> = {
  PASS: {
    whatHappened: "Workflow ran successfully.",
    actionNeeded: "No action needed.",
    whyItBlocked: null,
    insight: null,
  },
  BLOCK: {
    whatHappened: "Workflow safely stopped the action.",
    actionNeeded: "Fix the missing workflow packet fields.",
    whyItBlocked: "The safety check stopped the action to keep it safe.",
    insight: "The action was stopped for safety.",
  },
  MANUAL_ONLY: {
    whatHappened: "Human review is needed before this can continue.",
    actionNeeded: "Request human review.",
    whyItBlocked: null,
    insight: "A human needs to review this item.",
  },
  PENDING_APPROVAL: {
    whatHappened: "This is waiting for approval.",
    actionNeeded: "Approve the publishing action first.",
    whyItBlocked: null,
    insight: "Approval is still pending.",
  },
  NEEDS_EVIDENCE: {
    whatHappened: "Human review is needed before this can continue.",
    actionNeeded: "Add supporting evidence before continuing.",
    whyItBlocked: null,
    insight: "More proof is needed before this can continue.",
  },
  ERROR: {
    whatHappened: "Workflow safely stopped the action.",
    actionNeeded: "Check the safety check setup and retry.",
    whyItBlocked: null,
    insight: "The safety check could not finish.",
  },
};

const reasonMessages: Array<{
  matches: (reason: string) => boolean;
  messages: Partial<OutcomeMessages>;
  status?: G1ComplianceGuardStatus;
}> = [
  {
    matches: (reason) => reason === "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
    status: "BLOCK",
    messages: {
      whatHappened: "G1 stopped the publish step.",
      actionNeeded: "Add a rollback plan before publishing.",
      whyItBlocked: "G1 needs a rollback plan before a live change can run.",
      insight: "Prepare a rollback plan so this change can be reversed safely.",
    },
  },
  {
    matches: (reason) => reason === "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
    status: "BLOCK",
    messages: {
      whatHappened: "Workflow safely stopped the action.",
      actionNeeded: "Use approved Google sources only.",
      whyItBlocked: "Google scraping is not allowed for this workflow.",
      insight: "Use Search Console, GA4, or approved exports instead of scraping.",
    },
  },
  {
    matches: (reason) => reason === "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER",
    status: "BLOCK",
    messages: {
      whatHappened: "Workflow safely stopped the action.",
      actionNeeded: "Use the approved DM partner route.",
      whyItBlocked: "Direct Instagram DM sending from n8n is not allowed.",
      insight: "Use the approved DM partner route for Instagram DMs.",
    },
  },
  {
    matches: (reason) => reason === "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
    status: "PENDING_APPROVAL",
    messages: {
      whatHappened: "This is waiting for approval.",
      actionNeeded: "Open approval queue.",
      whyItBlocked: "This action needs human approval before it can run.",
      insight: "Ask a reviewer to approve the request.",
    },
  },
  {
    matches: (reason) => reason === "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
    status: "NEEDS_EVIDENCE",
    messages: {
      whatHappened: "Human review is needed before this can continue.",
      actionNeeded: "Open content review.",
      whyItBlocked: "This item needs a valid G4 content review.",
      insight: "Complete the content review before continuing.",
    },
  },
  {
    matches: (reason) => reason === "MISSING_OR_INVALID_G5_APPROVAL",
    status: "PENDING_APPROVAL",
    messages: {
      whatHappened: "This is waiting for approval.",
      actionNeeded: "Open approval queue.",
      whyItBlocked: "This item needs G5 approval before continuing.",
      insight: "Approve the publishing action before continuing.",
    },
  },
  {
    matches: (reason) => reason === "MISSING_REQUIRED_FIELD",
    status: "BLOCK",
    messages: {
      whatHappened: "Workflow safely stopped the action.",
      actionNeeded: "Fix packet fields.",
      whyItBlocked: "The safety check did not receive all required workflow packet fields.",
      insight: "Required workflow packet fields were missing.",
    },
  },
  {
    matches: (reason) => reason === "ACCOUNT_HEALTH_UNKNOWN" || reason === "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN",
    status: "BLOCK",
    messages: {
      whatHappened: "Workflow safely stopped the action.",
      actionNeeded: "Update account health.",
      whyItBlocked: "The platform account is not confirmed clean.",
      insight: "Confirm account health before continuing.",
    },
  },
];

const toTimeValue = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeReasonKey = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("MISSING_REQUIRED_FIELD")) {
    return "MISSING_REQUIRED_FIELD";
  }

  if (normalized.includes("MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE")) {
    return "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE";
  }

  if (normalized.includes("ACCOUNT_HEALTH_NOT_CLEAN")) {
    return "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN";
  }

  if (normalized.includes("ACCOUNT_HEALTH_UNKNOWN")) {
    return "ACCOUNT_HEALTH_UNKNOWN";
  }

  if (normalized.includes("GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES")) {
    return "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES";
  }

  if (normalized.includes("DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER")) {
    return "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER";
  }

  if (normalized.includes("MISSING_OR_INVALID_G4_CONTENT_REVIEW")) {
    return "MISSING_OR_INVALID_G4_CONTENT_REVIEW";
  }

  if (normalized.includes("MISSING_OR_INVALID_G5_APPROVAL")) {
    return "MISSING_OR_INVALID_G5_APPROVAL";
  }

  return normalized.replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

const normalizePlatformLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Internal system";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "Internal system";
  }

  if (normalized === "google" || normalized === "google search") {
    return "Google Search";
  }

  if (normalized === "internal" || normalized === "internal system") {
    return "Internal system";
  }

  if (normalized === "instagram") {
    return "Instagram";
  }

  if (normalized === "meta") {
    return "Meta";
  }

  if (normalized === "whatsapp") {
    return "WhatsApp";
  }

  if (normalized === "website") {
    return "Website";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
};

const buildCheckedLabel = (source: G1DecisionSource) => {
  const workflow = source.requestedByWorkflow?.trim() || "Unknown workflow";
  const action = source.actionTypeLabel?.trim() || "Workflow action check";
  const platform = normalizePlatformLabel(source.platform);

  return `${workflow} · ${action} · ${platform}`;
};

const resolveWorkflowDetailHref = (source: G1DecisionSource) => {
  const workflowId = normalizeWorkflowId(source.requestedByWorkflowGroup ?? source.workflowId);
  if (!workflowId) {
    return null;
  }

  return getWorkflowDetailHref(workflowId);
};

const getReasonMessage = (result: G1ComplianceGuardStatus, reasonKey: string | null) => {
  const base = { ...DEFAULT_MESSAGES[result] };
  if (!reasonKey) {
    return base;
  }

  const override = reasonMessages.find((entry) => entry.matches(reasonKey));
  if (override) {
    return {
      ...base,
      ...override.messages,
      whyItBlocked: override.messages.whyItBlocked ?? base.whyItBlocked,
      insight: override.messages.insight ?? base.insight,
    };
  }

  return base;
};

const normalizeUiStatus = (decision: G1DecisionLabel, reasonKey: string | null): G1ComplianceGuardStatus => {
  if (reasonKey === "MISSING_OR_INVALID_G4_CONTENT_REVIEW") {
    return "NEEDS_EVIDENCE";
  }

  if (reasonKey === "MISSING_OR_INVALID_G5_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  if (reasonKey === "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED") {
    return "PENDING_APPROVAL";
  }

  if (
    reasonKey === "MISSING_REQUIRED_FIELD" ||
    reasonKey === "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE" ||
    reasonKey === "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES" ||
    reasonKey === "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER" ||
    reasonKey === "ACCOUNT_HEALTH_UNKNOWN" ||
    reasonKey === "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN"
  ) {
    return "BLOCK";
  }

  switch (decision) {
    case "PASS":
      return "PASS";
    case "BLOCK":
      return "BLOCK";
    case "MANUAL_ONLY":
      return "MANUAL_ONLY";
    case "PENDING_APPROVAL":
      return "PENDING_APPROVAL";
    case "NEEDS_EVIDENCE":
      return "NEEDS_EVIDENCE";
    case "ERROR":
      return "ERROR";
    case "DRY_RUN":
    case "RECOMMENDATION_ONLY":
      return "PENDING_APPROVAL";
    case "DO_NOT_SCALE":
    case "FIX_FIRST":
      return "NEEDS_EVIDENCE";
    default:
      return reasonKey ? "BLOCK" : "ERROR";
  }
};

export const describeG1Outcome = (source: G1DecisionSource): G1OutcomeView => {
  const reasonKey = normalizeReasonKey(source.technicalReason);
  const result = normalizeUiStatus(source.decision, reasonKey);
  const messages = getReasonMessage(result, reasonKey);
  const requestedByWorkflow = source.requestedByWorkflow?.trim() || "Unknown workflow";
  const actionTypeLabel = source.actionTypeLabel?.trim() || "Workflow action check";
  const platformLabel = normalizePlatformLabel(source.platform);

  return {
    time: source.time,
    handledAt: source.time,
    result,
    checked: buildCheckedLabel(source),
    requestedByWorkflow,
    requestedByWorkflowGroup: source.requestedByWorkflowGroup ?? null,
    actionTypeLabel,
    platformLabel,
    workflowDetailHref: resolveWorkflowDetailHref(source),
    technicalReason: reasonKey,
    whatHappened: messages.whatHappened,
    actionNeeded: messages.actionNeeded,
    whyItBlocked: messages.whyItBlocked,
    insight: messages.insight,
  };
};

const buildEmptyOutcome = (): G1OutcomeView => ({
  time: null,
  handledAt: null,
  result: "PENDING_APPROVAL",
  checked: "No workflow actions have been checked yet.",
  requestedByWorkflow: "No workflow actions have been checked yet.",
  requestedByWorkflowGroup: null,
  actionTypeLabel: "Workflow action check",
  platformLabel: "Internal system",
  workflowDetailHref: null,
  technicalReason: null,
  whatHappened: "G1 is waiting for the first workflow check.",
  actionNeeded: "No action needed yet.",
  whyItBlocked: null,
  insight: "G1 is active and waiting for the first workflow check.",
});

const sortByNewest = (left: G1OutcomeView, right: G1OutcomeView) => toTimeValue(right.time) - toTimeValue(left.time);

export const buildG1ComplianceGuardSnapshotFromDecisionSources = (decisionSources: G1DecisionSource[]): G1ComplianceGuardSnapshot => {
  const recentOutcomes = decisionSources.map((source) => describeG1Outcome(source)).sort(sortByNewest).slice(0, G1_RECENT_LIMIT);
  const latestOutcome = recentOutcomes[0] ?? buildEmptyOutcome();

  return {
    workflowGroup: "G1",
    title: G1_TITLE,
    purpose: G1_PURPOSE,
    status: latestOutcome.result,
    lastRunAt: latestOutcome.handledAt,
    latestOutcome,
    recentOutcomes,
  };
};

export const buildG1ComplianceGuardSnapshotFromRows = (rows: unknown[]) =>
  buildG1ComplianceGuardSnapshotFromDecisionSources(normalizeG1AuditRows(rows));

const remediationActions: Array<{
  reasonKey: string;
  label: string;
  helperText: string;
}> = [
  {
    reasonKey: "MISSING_ROLLBACK_PAYLOAD_FOR_LIVE_WRITE",
    label: "Add Rollback Plan",
    helperText: "Add a rollback plan before publishing.",
  },
  {
    reasonKey: "MISSING_OR_INVALID_G4_CONTENT_REVIEW",
    label: "Open Content Review",
    helperText: "Complete the content review before publishing.",
  },
  {
    reasonKey: "MISSING_OR_INVALID_G5_APPROVAL",
    label: "Open Approval Queue",
    helperText: "Approve the publishing action before continuing.",
  },
  {
    reasonKey: "HUMAN_APPROVAL_NOT_FOUND_OR_NOT_APPROVED",
    label: "Open Approval Queue",
    helperText: "Ask a reviewer to approve the request.",
  },
  {
    reasonKey: "GOOGLE_SCRAPING_VIA_APIFY_REMOVED_USE_OFFICIAL_SOURCES",
    label: "Use Approved Google Source",
    helperText: "Use Search Console, GA4, or approved exports instead of scraping.",
  },
  {
    reasonKey: "DIRECT_N8N_IG_DM_REMOVED_USE_APPROVED_PARTNER",
    label: "Open DM Partner Setup",
    helperText: "Use the approved DM partner route for Instagram messages.",
  },
  {
    reasonKey: "MISSING_REQUIRED_FIELD",
    label: "Fix Packet Fields",
    helperText: "The safety check did not receive all required workflow packet fields.",
  },
  {
    reasonKey: "ACCOUNT_HEALTH_UNKNOWN",
    label: "Check Account Health",
    helperText: "Confirm the account health before continuing.",
  },
  {
    reasonKey: "ACCOUNT_HEALTH_NOT_CLEAN_UNKNOWN",
    label: "Update Account Health",
    helperText: "Confirm the account is healthy before continuing.",
  },
  {
    reasonKey: "POLICY_CHANGED_NEEDS_REVIEW",
    label: "Review Policy Update",
    helperText: "Read the updated policy before retrying.",
  },
  {
    reasonKey: "CONSENT_MISSING",
    label: "Add Consent Proof",
    helperText: "Add valid customer consent before continuing.",
  },
  {
    reasonKey: "UGC_RIGHTS_MISSING",
    label: "Add Rights Proof",
    helperText: "Add creator or UGC permission proof before continuing.",
  },
  {
    reasonKey: "CLAIM_EVIDENCE_MISSING",
    label: "Add Claim Proof",
    helperText: "Add supporting proof before continuing.",
  },
];

const getRemediationActionByReason = (reasonKey: string | null) => {
  if (!reasonKey) {
    return null;
  }

  return remediationActions.find((action) => action.reasonKey === reasonKey) ?? null;
};

export const getG1RemediationAction = (
  outcome: Pick<G1OutcomeView, "result" | "technicalReason" | "workflowDetailHref">,
): G1RemediationAction => {
  if (outcome.result === "PASS") {
    return {
      label: "View Safety Checks",
      helperText: "No action needed.",
      href: "#recent-safety-checks",
      disabled: false,
    };
  }

  const matchedAction = getRemediationActionByReason(outcome.technicalReason);
  if (!matchedAction) {
    return {
      label: "Action not connected yet",
      helperText: "No safe automation is connected for this check yet.",
      href: null,
      disabled: true,
    };
  }

  const href = outcome.workflowDetailHref ?? null;
  const disabled = !href;

  return {
    label: matchedAction.label,
    helperText: disabled ? `${matchedAction.helperText} Action not connected yet.` : matchedAction.helperText,
    href,
    disabled,
  };
};
