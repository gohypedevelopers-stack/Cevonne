export const G9_DATE_RANGES = ["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS"] as const;
export type G9DateRange = (typeof G9_DATE_RANGES)[number];

export const G9_RECOMMENDATION_FILTERS = [
  "ALL",
  "INCREASE_BUDGET",
  "PAUSE",
  "TEST",
  "FIX_FIRST",
  "NO_ACTION",
  "DO_NOT_SCALE",
] as const;
export type G9RecommendationFilter = (typeof G9_RECOMMENDATION_FILTERS)[number];

export const G9_STATUS_FILTERS = [
  "ALL",
  "OPEN",
  "NEEDS_ATTENTION",
  "NO_ACTION",
  "READY",
  "PENDING_APPROVAL",
  "APPROVED_FOR_DRY_RUN",
  "NEEDS_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "BLOCKED",
  "DRY_RUN_COMPLETE",
  "CONNECTION_ISSUE",
] as const;
export type G9StatusFilter = (typeof G9_STATUS_FILTERS)[number];

export type G9RecommendationKind = Exclude<G9RecommendationFilter, "ALL">;
export type G9RecommendationStatus = Exclude<G9StatusFilter, "ALL" | "OPEN" | "NEEDS_ATTENTION">;
export type G9ConnectionState = "CONNECTED" | "READY" | "UNAVAILABLE";
export type G9SafetyState = "PASSED" | "NEEDS_ATTENTION" | "NOT_AVAILABLE";

export type G9Metrics = {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number | null;
  purchaseValue: number | null;
  roas: number | null;
  currentDailyBudget: number | null;
  suggestedDailyBudget: number | null;
  currency: string;
};

export type G9SafetyCheck = {
  label: string;
  state: G9SafetyState;
  detail: string;
};

export type G9Recommendation = {
  key: string;
  reference: string;
  kind: G9RecommendationKind;
  kindLabel: string;
  subjectLabel: string;
  mainReason: string;
  reasons: string[];
  status: G9RecommendationStatus;
  statusLabel: string;
  performanceLabel: string;
  createdAt: string;
  requiresApproval: boolean;
  canReview: boolean;
  canDryRun: boolean;
  metrics: G9Metrics;
  safetyChecks: G9SafetyCheck[];
};

export type G9Overview = {
  counts: {
    openRecommendations: number;
    pendingApproval: number;
    needsAttention: number;
    dryRunsCompleted: number;
  };
  connection: {
    metaAds: G9ConnectionState;
    aiAnalysis: G9ConnectionState;
    executionMode: "SAFE_DRY_RUN";
    accountLabel: "Cevonne ad account";
  };
  lastUpdatedAt: string | null;
};

export type G9ActivityItem = {
  key: string;
  recommendationKey: string | null;
  action: "VIEW" | "REVIEW" | "DRY_RUN" | null;
  title: string;
  description: string;
  statusLabel: string;
  occurredAt: string;
};

export type G9Activity = {
  items: G9ActivityItem[];
  hasMore: boolean;
};

export const G9_RECOMMENDATION_LABELS: Record<G9RecommendationKind, string> = {
  INCREASE_BUDGET: "Increase budget carefully",
  PAUSE: "Consider pausing this ad",
  TEST: "Test another approach",
  FIX_FIRST: "Fix an issue first",
  NO_ACTION: "No change recommended",
  DO_NOT_SCALE: "Do not increase budget",
};

export const G9_STATUS_LABELS: Record<G9RecommendationStatus, string> = {
  NO_ACTION: "No action needed",
  READY: "Ready",
  PENDING_APPROVAL: "Pending approval",
  APPROVED_FOR_DRY_RUN: "Approved for dry run",
  NEEDS_REVIEW: "Needs review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  BLOCKED: "Blocked",
  DRY_RUN_COMPLETE: "Dry run complete",
  CONNECTION_ISSUE: "Connection issue",
};

export const G9_OPEN_STATUSES: G9RecommendationStatus[] = ["READY", "PENDING_APPROVAL", "APPROVED_FOR_DRY_RUN", "NEEDS_REVIEW", "CHANGES_REQUESTED"];
export const G9_ATTENTION_STATUSES: G9RecommendationStatus[] = ["NEEDS_REVIEW", "CHANGES_REQUESTED", "BLOCKED", "CONNECTION_ISSUE"];

export const G9_STATUS_FILTER_LABELS: Record<Exclude<G9StatusFilter, "ALL">, string> = {
  OPEN: "Open recommendations",
  NEEDS_ATTENTION: "Needs attention",
  ...G9_STATUS_LABELS,
};

export const G9_DATE_RANGE_LABELS: Record<G9DateRange, string> = {
  LAST_7_DAYS: "Last 7 days",
  LAST_30_DAYS: "Last 30 days",
  LAST_90_DAYS: "Last 90 days",
};

const REASON_MESSAGES: Record<string, string> = {
  NO_META_AD_INSIGHTS_DATA: "Meta did not return enough performance data for this ad.",
  ACCOUNT_HEALTH_UNKNOWN: "The ad account health could not be confirmed.",
  POLICY_CHANGED_OR_NOT_ACTIVE: "The latest policy review is not active or has changed.",
  UNKNOWN_POLICY_ROUTE: "The policy route needs a manual review.",
  G7_OFFER_PROOF_REQUIRED_FOR_URGENCY_OR_DISCOUNT: "Offer proof is required before using urgency or discount messaging.",
  AUDIENCE_CONSENT_OR_SOURCE_MISSING: "Audience consent or source information is missing.",
  AD_CREATIVE_NOT_APPROVED_BY_G4_G5: "The ad creative has not completed content and publishing approval.",
  UGC_AD_RIGHTS_MISSING: "Creator advertising rights have not been confirmed.",
  LANDING_PAGE_URL_REQUIRED_FOR_AD_WRITE: "A landing page is required before preparing this change.",
  ROLLBACK_PAYLOAD_REQUIRED_FOR_AD_WRITE_RECOMMENDATION: "A safe rollback plan is required before preparing this change.",
  HUMAN_APPROVAL_REQUIRED: "A person must approve this recommendation before a dry run.",
  RECOMMENDATION_ID_REQUIRED: "The recommendation could not be resolved. Refresh the page and try again.",
  APPROVAL_ID_REQUIRED: "The approval request could not be found. Refresh the recommendation.",
  AI_REVIEW_NOT_FOUND: "The approval request is no longer available.",
  APPROVAL_NOT_FOUND: "The approval request is no longer available.",
  RECOMMENDATION_NOT_APPROVED: "This recommendation must be approved before a dry run.",
  ALREADY_EXECUTED: "A safe dry run has already been completed for this recommendation.",
};

export const getFriendlyG9Reason = (value: unknown): string => {
  const reason = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!reason) return "This recommendation requires technical review.";
  if (REASON_MESSAGES[reason]) return REASON_MESSAGES[reason];
  if (/RECOMMENDATION.*NOT.*APPROVED|NOT.*APPROVED.*RECOMMENDATION/.test(reason)) return "This recommendation must be approved before a dry run.";
  if (/ALREADY.*EXECUT|DRY.*RUN.*COMPLETE/.test(reason)) return "A safe dry run has already been completed for this recommendation.";
  if (reason.startsWith("ACCOUNT_HEALTH_NOT_CLEAN")) return "The ad account needs attention before this recommendation can continue.";
  if (reason.includes("G1") && (reason.includes("BLOCK") || reason.includes("COMPLIANCE"))) {
    return "The compliance guard stopped this recommendation for review.";
  }
  return "This recommendation requires technical review.";
};

export const formatG9Metric = (value: number | null, options?: Intl.NumberFormatOptions) =>
  value === null ? "Not available" : new Intl.NumberFormat("en-IN", options).format(value);
