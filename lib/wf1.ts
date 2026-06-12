export const WF1_WORKFLOW_ID = "wf1-instagram-scheduler" as const;
export const WF1_WORKFLOW_TITLE = "Instagram Scheduler" as const;
export const WF1_WORKFLOW_ROUTE = `/dashboard/n8n-automations/${WF1_WORKFLOW_ID}` as const;

export type Wf1TechnicalStatus =
  | "PASS"
  | "BLOCK"
  | "MANUAL_ONLY"
  | "PENDING_APPROVAL"
  | "DRY_RUN"
  | "NEEDS_EVIDENCE"
  | "FAILED"
  | "ERROR";

export type Wf1PublicStatus =
  | "Working"
  | "Needs review"
  | "Waiting"
  | "Blocked"
  | "Dry run ready"
  | "Manual only"
  | "Passed"
  | "Approved"
  | "Safe"
  | "Failed"
  | "System error"
  | "Cancelled";

export type Wf1ChecklistStatus = "Done" | "Waiting" | "Blocked" | "Not started";

export type Wf1ApprovalStatus = "Waiting for approval" | "Approved" | "Rejected" | "Changes requested";

export type Wf1DryRunStatus = "Not executed" | "Ready" | "Completed" | "Failed";

export type Wf1BufferHealthState = "Healthy" | "Needs content" | "Attention needed" | "Unknown";

export type Wf1LogSeverity = "success" | "warning" | "blocked" | "info" | "error";

export type Wf1TechnicalDetails = {
  assetId: string;
  approvalId: string;
  g4ReviewId: string;
  complianceRunId: string;
  complianceToken: string;
  accountId: string;
  webhookPath?: string | null;
  requestId?: string | null;
  n8nResponseType?: string | null;
};

export type Wf1QueueItem = {
  id: string;
  captionPreview: string;
  fullCaption: string;
  mediaType: "Image" | "Carousel" | "Reel";
  mediaUrl: string;
  mediaPreviewUrl?: string | null;
  scheduledAt: string;
  contentReviewStatus: Wf1ChecklistStatus;
  approvalStatus: Wf1ApprovalStatus;
  safetyCheckStatus: Wf1ChecklistStatus;
  dryRunStatus: Wf1DryRunStatus;
  status: Wf1PublicStatus;
  bufferState: Wf1BufferHealthState;
  lastActivity: string;
  lastRunAt?: string | null;
  nextStep: string;
  humanReason?: string | null;
  fallback: boolean;
  reviewer?: string | null;
  riskSummary?: string | null;
  technical: Wf1TechnicalDetails;
};

export type Wf1ApprovalItem = {
  approvalId: string;
  queueId: string;
  captionPreview: string;
  mediaPreviewUrl?: string | null;
  createdAt: string;
  reviewer: string;
  riskSummary: string;
  status: Wf1ApprovalStatus;
  humanReason?: string | null;
  queueStatus: Wf1PublicStatus;
  technical: Wf1TechnicalDetails;
};

export type Wf1DryRunRecord = {
  dryRunId: string;
  queueId: string;
  captionPreview: string;
  scheduledAt: string;
  safetyStatus: Wf1ChecklistStatus;
  dryRunStatus: Wf1DryRunStatus;
  notExecuted: boolean;
  lastRunAt: string;
  result: string;
  humanReason?: string | null;
  technical: Wf1TechnicalDetails;
};

export type Wf1LogRecord = {
  logId: string;
  time: string;
  event: string;
  status: Wf1PublicStatus | Wf1ChecklistStatus | Wf1DryRunStatus | Wf1ApprovalStatus | "Passed" | "Safe" | "Failed" | "System error";
  message: string;
  actor: "admin" | "system" | "website";
  queueId?: string | null;
  approvalId?: string | null;
  dryRunId?: string | null;
  severity: Wf1LogSeverity;
  technical: Wf1TechnicalDetails;
};

export type Wf1ChecklistItem = {
  label: string;
  status: Wf1ChecklistStatus;
  detail: string;
};

export type Wf1BufferHealth = {
  approvedBufferDays: number;
  evergreenFallbackCount: number;
  tokenExpiresAt: string | null;
  accountHealth: "Clean" | "Attention needed" | "Unknown";
  missingContentWarnings: string[];
  urgentAction: string;
  recentDryRunCompletedAt: string | null;
  checklist: Wf1ChecklistItem[];
};

export type Wf1Settings = {
  instagramAccountId: string;
  postingTimezone: string;
  defaultPostingTimes: string[];
  minimumBufferDays: number;
  minimumFallbackPosts: number;
  dryRunModeEnabled: boolean;
  livePublishingEnabled: boolean;
  tokenExpiresAt: string | null;
  alertRecipients: string[];
  rollbackActionAvailable: boolean;
};

export type Wf1TimelineStep = {
  label: string;
  status: Wf1ChecklistStatus;
  detail: string;
};

export type Wf1SummaryCard = {
  workflowId: typeof WF1_WORKFLOW_ID;
  title: typeof WF1_WORKFLOW_TITLE;
  subtitle: string;
  status: Wf1PublicStatus;
  attentionMessage: string;
  lastActivity: string;
  nextScheduledPost: string;
  bufferHealth: Wf1BufferHealthState;
  approvalStatus: Wf1ApprovalStatus;
  lastSafetyCheck: string;
  livePublishing: "Disabled" | "Enabled";
  queueCount: number;
  approvalQueueCount: number;
  dryRunCount: number;
  detailsPath: typeof WF1_WORKFLOW_ROUTE;
};

export type Wf1DetailResponse = {
  status?: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message?: string;
  workflow: Wf1SummaryCard;
  timeline: Wf1TimelineStep[];
  queue: Wf1QueueItem[];
  approvals: Wf1ApprovalItem[];
  dryRuns: Wf1DryRunRecord[];
  bufferHealth: Wf1BufferHealth;
  logs: Wf1LogRecord[];
  settings: Wf1Settings;
  developerNotes: {
    webhookPaths: {
      intake: string;
      dryRun: string;
      publishResult: string;
      bufferHealth: string;
      approvalDecision: string;
    };
  };
};

export type Wf1QueuedActionResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message: string;
  workflow: Wf1SummaryCard;
  queueItem?: Wf1QueueItem | null;
  approval?: Wf1ApprovalItem | null;
  dryRun?: Wf1DryRunRecord | null;
  log?: Wf1LogRecord | null;
  bufferHealth?: Wf1BufferHealth | null;
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const FALLBACK_TONE_CLASS = "bg-slate-100 text-slate-700 border-slate-200";

export const WF1_PUBLIC_STATUS_TONES: Record<string, string> = {
  Working: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Passed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Safe: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Needs review": "bg-amber-100 text-amber-800 border-amber-200",
  Waiting: "bg-sky-100 text-sky-800 border-sky-200",
  "Waiting for approval": "bg-sky-100 text-sky-800 border-sky-200",
  Blocked: "bg-rose-100 text-rose-800 border-rose-200",
  Failed: "bg-rose-100 text-rose-800 border-rose-200",
  "System error": "bg-rose-100 text-rose-800 border-rose-200",
  "Dry run ready": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Manual only": "bg-violet-100 text-violet-800 border-violet-200",
  Cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  Done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Not started": "bg-slate-100 text-slate-700 border-slate-200",
  Ready: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Changes requested": "bg-amber-100 text-amber-800 border-amber-200",
  Rejected: "bg-rose-100 text-rose-800 border-rose-200",
  "Not executed": "bg-slate-100 text-slate-700 border-slate-200",
  Healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Attention needed": "bg-amber-100 text-amber-800 border-amber-200",
  "Needs content": "bg-amber-100 text-amber-800 border-amber-200",
  Unknown: "bg-slate-100 text-slate-700 border-slate-200",
};

export const getWf1ToneClass = (label?: string | null) => {
  if (!label) {
    return FALLBACK_TONE_CLASS;
  }

  return WF1_PUBLIC_STATUS_TONES[label] || FALLBACK_TONE_CLASS;
};

export const getWf1PublicStatus = (status?: string | null): Wf1PublicStatus => {
  switch (status) {
    case "PASS":
      return "Working";
    case "BLOCK":
      return "Blocked";
    case "MANUAL_ONLY":
      return "Manual only";
    case "PENDING_APPROVAL":
      return "Waiting";
    case "DRY_RUN":
      return "Dry run ready";
    case "NEEDS_EVIDENCE":
      return "Needs review";
    case "FAILED":
      return "Failed";
    case "ERROR":
      return "System error";
    default:
      return "Working";
  }
};

export const WF1_FAILURE_REASON_MAP: Record<string, string> = {
  "ACCOUNT_HEALTH_NOT_CLEAN:UNKNOWN": "Instagram account health is unknown. Update account health before continuing.",
  G5_APPROVAL_ID_REQUIRED: "Human approval is missing. Approve the post before running the dry-run.",
  G4_REVIEW_REQUIRED: "Content review is missing. Send this caption for content review first.",
  G7_OFFER_PROOF_REQUIRED_FOR_URGENCY_OR_DISCOUNT:
    "Offer or urgency claim needs stock or discount proof before use.",
  TOKEN_EXPIRY_NOT_PROVIDED: "Token expiry is missing. Add or refresh Instagram token details.",
  APPROVED_CONTENT_BUFFER_BELOW_3_DAYS: "WF1 needs at least 3 days of approved content.",
  EVERGREEN_FALLBACK_POSTS_BELOW_5: "WF1 needs at least 5 evergreen fallback posts.",
  LIVE_PUBLISHING_DISABLED: "Live publishing is off. WF1 stays in safe dry-run mode.",
  BUFFER_LOW: "Add more approved content or evergreen fallback posts before publishing.",
};

export const WF1_ACTION_GUIDANCE_MAP: Record<string, string> = {
  G4_REVIEW_REQUIRED: "Send the content for review.",
  G5_APPROVAL_ID_REQUIRED: "Approve or reject the post.",
  "ACCOUNT_HEALTH_NOT_CLEAN:UNKNOWN": "Update Instagram account health.",
  G1_BLOCKED: "Fix the safety issue before the next dry-run.",
  DRY_RUN_READY: "The safe dry-run is ready.",
  APPROVED_CONTENT_BUFFER_BELOW_3_DAYS: "Add more approved or fallback content.",
  EVERGREEN_FALLBACK_POSTS_BELOW_5: "Add more approved or fallback content.",
};

export const getWf1FailureReason = (reason?: string | null, fallback = "We need a quick review before continuing.") => {
  if (!reason) {
    return fallback;
  }

  const trimmed = reason.trim();
  return WF1_FAILURE_REASON_MAP[trimmed] || trimmed || fallback;
};

export const getWf1ActionGuidance = (reason?: string | null, fallback = "Review the item and continue when it is ready.") => {
  if (!reason) {
    return fallback;
  }

  const trimmed = reason.trim();
  return WF1_ACTION_GUIDANCE_MAP[trimmed] || fallback;
};

export const formatWf1DateTime = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return DATE_TIME_FORMAT.format(date);
};

export const formatWf1RelativeTime = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

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

  return RELATIVE_TIME_FORMAT.format(valueInUnits, unit);
};

export const formatWf1ClockLabel = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const formatWf1DateLabel = (value?: string | null) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  }).format(date);
};

export const createWf1HumanStatus = (technicalStatus?: string | null) => {
  return getWf1PublicStatus(technicalStatus);
};
