import { humanizeReasonText, sanitizeDisplayText } from "@/lib/admin/workflows";

export type G4ClientStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "PENDING_APPROVAL" | "NEEDS_EVIDENCE" | "ERROR";

export type G4ContentReviewRecord = {
  created_at?: string | null;
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
  risk_flags?: unknown;
  safe_summary?: string | null;
  ai_used?: boolean | null;
  ai_risk_summary?: string | null;
  ai_safe_rewrite?: string | null;
  ai_caption_suggestions?: unknown;
  ai_hook_suggestions?: unknown;
  ai_claim_notes?: unknown;
  ai_human_review_recommendation?: string | null;
  claim_ids_checked?: unknown;
  landing_page_match_status?: string | null;
  requires_human_approval?: boolean | null;
  raw_payload?: unknown;
  source_platform?: string | null;
  source_event?: string | null;
  actor?: string | null;
};

export type G4ContentPreview = {
  headline: string | null;
  contentText: string | null;
  ctaText: string | null;
  landingPageUrl: string | null;
  pageText: string | null;
  productName: string | null;
};

export type G4LatestOutcome = {
  result: G4ClientStatus;
  reviewId: string | null;
  assetId: string | null;
  platform: string | null;
  approvalState: string | null;
  summary: string;
  riskSummary: string | null;
  failureReasons: string[];
  landingPageStatus: string | null;
  handledAt: string | null;
};

export type G4RecentOutcome = {
  time: string;
  result: G4ClientStatus;
  reviewId: string | null;
  assetId: string | null;
  platform: string | null;
  approvalState: string | null;
  whatHappened: string;
  actionNeeded: string;
};

export type G4CleanAiOutput = {
  riskSummary: string | null;
  safeRewrite: string | null;
  captionSuggestions: string[];
  hookSuggestions: string[];
  claimNotes: string[];
  humanReviewRecommendation: string | null;
  aiIsFinalApproval: false;
};

export type G4WorkflowDetail = {
  workflowGroup: "G4";
  title: "G4 Content / Landing / Claim Check";
  purpose: string;
  status: G4ClientStatus;
  lastRunAt: string | null;
  latestOutcome: G4LatestOutcome | null;
  contentPreview: G4ContentPreview;
  actionNeeded: string;
  cleanAiOutput: G4CleanAiOutput | null;
  recentOutcomes: G4RecentOutcome[];
};

const G4_FAILURE_REASON_COPY: Record<string, string> = {
  UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM: "unsupported beauty or health claim",
  PERSONAL_ATTRIBUTE_OR_SHAMING_LANGUAGE: "personal-attribute or shaming wording",
  LANDING_PAGE_PROMISE_MISMATCH: "a promise that did not match the landing page",
};

const normalizePrimitiveText = (value: unknown) => {
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

const readObjectLabel = (value: Record<string, unknown>) =>
  normalizePrimitiveText(value.name) ??
  normalizePrimitiveText(value.label) ??
  normalizePrimitiveText(value.value) ??
  normalizePrimitiveText(value.text) ??
  normalizePrimitiveText(value.title);

export const normalizeG4StringArray = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  const entries = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];

  for (const entry of entries) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          normalized.push(...normalizeG4StringArray(parsed));
          continue;
        }

        if (parsed && typeof parsed === "object") {
          const label = readObjectLabel(parsed as Record<string, unknown>);
          if (label) {
            normalized.push(label);
            continue;
          }
        }
      } catch {
        // Keep plain text as-is.
      }

      normalized.push(trimmed);
      continue;
    }

    const primitive = normalizePrimitiveText(entry);
    if (primitive) {
      normalized.push(primitive);
      continue;
    }

    if (entry && typeof entry === "object") {
      const label = readObjectLabel(entry as Record<string, unknown>);
      if (label) {
        normalized.push(label);
      }
    }
  }

  return [...new Set(normalized)].filter(Boolean);
};

export const normalizeG4Text = (value: unknown): string | null => {
  const primitive = normalizePrimitiveText(value);
  if (!primitive) {
    return null;
  }

  const sanitized = sanitizeDisplayText(primitive);
  if (sanitized) {
    return sanitized;
  }

  return humanizeReasonText(primitive);
};

export const normalizeG4Timestamp = (value: unknown): string | null => {
  const primitive = normalizePrimitiveText(value);
  if (!primitive) {
    return null;
  }

  const parsed = new Date(primitive);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeStatusValue = (value: unknown) => {
  const primitive = normalizePrimitiveText(value);
  return primitive ? primitive.toUpperCase() : "";
};

const normalizePreviewValue = (value: unknown) => {
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

const asPreviewRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readPreviewField = (payload: Record<string, unknown> | null, nestedPayload: Record<string, unknown> | null, key: string) =>
  normalizePreviewValue(payload?.[key]) ?? normalizePreviewValue(nestedPayload?.[key]) ?? null;

export const extractG4ContentPreview = (row?: Pick<G4ContentReviewRecord, "raw_payload"> | null): G4ContentPreview => {
  const payload = asPreviewRecord(row?.raw_payload);
  const nestedPayload = asPreviewRecord(payload?.raw_payload);

  return {
    headline: readPreviewField(payload, nestedPayload, "headline"),
    contentText: readPreviewField(payload, nestedPayload, "content_text"),
    ctaText: readPreviewField(payload, nestedPayload, "cta_text"),
    landingPageUrl: readPreviewField(payload, nestedPayload, "landing_page_url"),
    pageText: readPreviewField(payload, nestedPayload, "page_text"),
    productName: readPreviewField(payload, nestedPayload, "product_name"),
  };
};

export const mapG4Status = (row?: Pick<G4ContentReviewRecord, "status" | "approval_state"> | null): G4ClientStatus => {
  if (!row) {
    return "ERROR";
  }

  const status = normalizeStatusValue(row.status);
  const approvalState = normalizeStatusValue(row.approval_state);

  if (status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL") {
    return "PENDING_APPROVAL";
  }

  if (status === "PASS") return "PASS";
  if (status === "BLOCK") return "BLOCK";
  if (status === "MANUAL_ONLY") return "MANUAL_ONLY";
  if (status === "NEEDS_EVIDENCE") return "NEEDS_EVIDENCE";

  return "ERROR";
};

export const getG4ActionNeeded = (row?: Pick<G4ContentReviewRecord, "status" | "approval_state"> | null) => {
  if (!row) {
    return "Check content to see the latest result.";
  }

  const status = normalizeStatusValue(row.status);
  const approvalState = normalizeStatusValue(row.approval_state);

  if (status === "BLOCK") {
    return "Fix content";
  }

  if (status === "PASS" && approvalState === "PENDING_HUMAN_APPROVAL") {
    return "Send to approval";
  }

  if (status === "PASS") {
    return "View details";
  }

  if (status === "NEEDS_EVIDENCE") {
    return "Add evidence";
  }

  if (status === "MANUAL_ONLY") {
    return "Manual review";
  }

  return "Check admin review";
};

export const summarizeG4Outcome = (row?: G4ContentReviewRecord | null) => {
  if (!row) {
    return "No content check has been recorded yet.";
  }

  const status = normalizeStatusValue(row.status);
  const failureReasons = normalizeG4StringArray(row.failure_reasons).map((reason) => reason.toUpperCase());

  if (status === "BLOCK") {
    if (failureReasons.includes("UNSUPPORTED_BEAUTY_OR_HEALTH_CLAIM")) {
      return "This content was blocked because it includes an unsupported beauty or health claim.";
    }

    if (failureReasons.includes("PERSONAL_ATTRIBUTE_OR_SHAMING_LANGUAGE")) {
      return "This content was blocked because it uses personal-attribute or shaming language.";
    }

    if (failureReasons.includes("LANDING_PAGE_PROMISE_MISMATCH")) {
      return "This content was blocked because the landing page does not match the promise.";
    }

    for (const reason of failureReasons) {
      const copy = G4_FAILURE_REASON_COPY[reason];
      if (copy) {
        return `This content was blocked because it includes ${copy}.`;
      }
    }

    return "This content was blocked because it needs a wording fix before it can move forward.";
  }

  if (status === "PASS" && normalizeStatusValue(row.approval_state) === "PENDING_HUMAN_APPROVAL") {
    return "Content check passed. Human approval is still required before publishing or ad use.";
  }

  if (status === "PASS") {
    return "This content check passed.";
  }

  if (status === "NEEDS_EVIDENCE") {
    return "This content needs proof before it can continue.";
  }

  if (status === "MANUAL_ONLY") {
    return "This content needs manual review before it can continue.";
  }

  return "This content check needs admin review.";
};

export const formatG4ResultLabel = (status: G4ClientStatus | string) => {
  const normalized = typeof status === "string" ? status.trim().toUpperCase() : status;

  switch (normalized) {
    case "PASS":
      return "Passed";
    case "BLOCK":
      return "Blocked safely";
    case "MANUAL_ONLY":
      return "Manual review";
    case "PENDING_APPROVAL":
      return "Ready for approval";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "ERROR":
    default:
      return "Needs admin review";
  }
};

export const formatG4ApprovalStateLabel = (approvalState: string | null) => {
  if (!approvalState) {
    return "Not available";
  }

  const normalized = approvalState.trim().toUpperCase();
  switch (normalized) {
    case "PENDING_HUMAN_APPROVAL":
      return "Pending human approval";
    case "NOT_APPROVED":
      return "Not approved";
    case "APPROVED":
      return "Approved";
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "MANUAL_ONLY":
      return "Manual review";
    case "NEEDS_EVIDENCE":
      return "Needs evidence";
    case "REJECTED":
      return "Rejected";
    default:
      return humanizeReasonText(approvalState) ?? approvalState;
  }
};

export const formatG4LandingPageStatusLabel = (landingPageStatus: string | null) => {
  if (!landingPageStatus) {
    return "Not available";
  }

  return humanizeReasonText(landingPageStatus) ?? landingPageStatus;
};

export const formatG4StatusTone = (status: G4ClientStatus | string) => {
  const normalized = typeof status === "string" ? status.trim().toUpperCase() : status;

  switch (normalized) {
    case "PASS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "MANUAL_ONLY":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "PENDING_APPROVAL":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ERROR":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};
