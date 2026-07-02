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
  captionPreview: string | null;
  ctaText: string | null;
  landingPageUrl: string | null;
  pageText: string | null;
  productName: string | null;
  profileUsername: string | null;
  audioSound: string | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  trendStrength: string | null;
  brandFitScore: string | null;
  riskScore: string | null;
  cleanSummary: string | null;
  contentRecommendation: string | null;
  hookAngle: string | null;
  sourceUrl: string | null;
};

export type G4LatestOutcome = {
  result: G4ClientStatus;
  reviewId: string | null;
  assetId: string | null;
  sourceId: string | null;
  sourcePlatform: string | null;
  sourceEvent: string | null;
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
  sourceId: string | null;
  sourcePlatform: string | null;
  sourceEvent: string | null;
  platform: string | null;
  approvalState: string | null;
  contentPreview: G4ContentPreview;
  whatHappened: string;
  actionNeeded: string;
  cleanAiOutput: G4CleanAiOutput | null;
  approvalRequest: G4ApprovalRequest | null;
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

export type G4ApprovalRequest = {
  approvalId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  createdAt: string;
  requestedBy: string;
  reviewerAction: string | null;
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
  approvalRequest: G4ApprovalRequest | null;
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readRecordText = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = normalizePrimitiveText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readRecordTextFromRecords = (records: Array<Record<string, unknown> | null | undefined>, keys: string[]) => {
  for (const record of records) {
    const value = readRecordText(record, keys);
    if (value) {
      return value;
    }
  }

  return null;
};

const normalizeBlobKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const parseKeyValueBlob = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const entries = new Map<string, string>();
  let activeKey: string | null = null;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match = line.match(/^([^:]{1,80}):\s*(.*)$/);
    if (match) {
      activeKey = normalizeBlobKey(match[1]);
      entries.set(activeKey, match[2].trim());
      continue;
    }

    if (activeKey) {
      entries.set(activeKey, `${entries.get(activeKey) ?? ""} ${line}`.trim());
    }
  }

  return entries.size ? entries : null;
};

const readBlobField = (blob: Map<string, string> | null, keys: string[]) => {
  if (!blob) {
    return null;
  }

  for (const key of keys) {
    const value = blob.get(normalizeBlobKey(key));
    if (value) {
      return value;
    }
  }

  return null;
};

const readRawPayloadText = (row: unknown, keys: string[]) => {
  const source = asRecord(row);
  const payload = asRecord(source?.raw_payload);
  const nestedPayload = asRecord(payload?.raw_payload);
  return readRecordTextFromRecords([source, payload, nestedPayload], keys);
};

export const getG4ReviewSourceIds = (
  row?: Pick<G4ContentReviewRecord, "raw_payload" | "asset_id" | "review_id" | "content_review_id"> | null,
) => {
  const sourceIds = [
    readRawPayloadText(row, ["source_trend_id", "sourceTrendId"]),
    readRawPayloadText(row, ["idempotency_key", "idempotencyKey"]),
    readRawPayloadText(row, ["insight_id", "insightId", "source_insight_id", "sourceInsightId"]),
    readRawPayloadText(row, ["fetch_run_id", "fetchRunId"]),
    readRawPayloadText(row, ["asset_id", "assetId"]),
    normalizePrimitiveText(row?.asset_id),
    normalizePrimitiveText(row?.review_id),
    normalizePrimitiveText(row?.content_review_id),
  ];

  return [...new Set(sourceIds.filter((value): value is string => Boolean(value && value.trim())))];
};

export const getG4ReviewSourceId = (
  row?: Pick<G4ContentReviewRecord, "raw_payload" | "asset_id" | "review_id" | "content_review_id"> | null,
) => getG4ReviewSourceIds(row)[0] ?? null;

const normalizeStatusValue = (value: unknown) => {
  const primitive = normalizePrimitiveText(value);
  return primitive ? primitive.toUpperCase() : "";
};

export const extractG4ContentPreview = (row?: unknown): G4ContentPreview => {
  const source = asRecord(row);
  const payload = asRecord(source?.raw_payload);
  const nestedPayload = asRecord(payload?.raw_payload);

  const originalPost = asRecord(source?.original_post) ?? asRecord(source?.originalPost) ?? asRecord(payload?.original_post) ?? asRecord(payload?.originalPost) ?? asRecord(nestedPayload?.original_post) ?? asRecord(nestedPayload?.originalPost);
  const originalPostDataRecord =
    asRecord(source?.original_post_data) ??
    asRecord(source?.originalPostData) ??
    asRecord(payload?.original_post_data) ??
    asRecord(payload?.originalPostData) ??
    asRecord(nestedPayload?.original_post_data) ??
    asRecord(nestedPayload?.originalPostData);
  const originalPostDataText = readRecordTextFromRecords([source, payload, nestedPayload], ["original_post_data", "originalPostData"]);
  const originalPostDataBlob = parseKeyValueBlob(originalPostDataText);

  const readGeneralField = (keys: string[]) =>
    readRecordTextFromRecords([source, payload, nestedPayload], keys) ?? readBlobField(originalPostDataBlob, keys);

  const readOriginalPostField = (keys: string[]) =>
    readRecordTextFromRecords([originalPost, originalPostDataRecord, source, payload, nestedPayload], keys) ??
    readBlobField(originalPostDataBlob, keys);

  return {
    headline: readGeneralField(["headline", "title", "name", "display_title"]),
    contentText:
      readGeneralField(["content_text", "contentText", "content", "body", "message"]) ??
      readOriginalPostField(["caption", "caption_text", "captionText"]),
    captionPreview:
      readOriginalPostField(["caption", "caption_text", "captionText", "caption_preview", "captionPreview"]) ??
      readGeneralField(["caption_preview", "captionPreview", "caption"]),
    ctaText: readGeneralField(["cta_text", "ctaText", "cta", "call_to_action", "callToAction"]),
    landingPageUrl: readGeneralField(["landing_page_url", "landingPageUrl", "landing_url", "landingUrl", "page_url", "pageUrl"]),
    pageText: readGeneralField(["page_text", "pageText", "landing_page_text", "landingPageText"]),
    productName: readGeneralField(["product_name", "productName", "product", "brand_name", "brandName", "brand"]),
    profileUsername: readOriginalPostField(["profile_username", "profileUsername", "username", "handle", "creator_handle", "creatorHandle", "account_name", "accountName"]),
    audioSound: readOriginalPostField(["audio_sound", "audioSound", "sound", "music", "audio"]),
    views: readOriginalPostField(["views"]),
    likes: readOriginalPostField(["likes"]),
    comments: readOriginalPostField(["comments_count", "commentsCount", "comments"]),
    shares: readOriginalPostField(["shares"]),
    trendStrength: readGeneralField(["trend_strength", "trendStrength"]),
    brandFitScore: readGeneralField(["brand_fit_score", "brandFitScore"]),
    riskScore: readGeneralField(["risk_score", "riskScore"]),
    cleanSummary: readGeneralField(["clean_summary", "cleanSummary", "safe_summary", "safeSummary"]),
    contentRecommendation: readGeneralField(["content_recommendation", "contentRecommendation", "ai_insight", "aiInsight", "summary"]),
    hookAngle: readOriginalPostField(["hook_angle", "hookAngle", "hook", "hook_text", "hookText"]) ?? readGeneralField(["hook_angle", "hookAngle", "hook", "hook_text", "hookText"]),
    sourceUrl:
      readOriginalPostField(["source_url", "sourceUrl", "content_url", "contentUrl", "profile_public_link", "profilePublicLink", "url", "post_url", "postUrl", "web_video_url", "webVideoUrl", "permalink"]) ??
      readGeneralField(["source_url", "sourceUrl", "content_url", "contentUrl", "profile_public_link", "profilePublicLink", "url", "post_url", "postUrl", "web_video_url", "webVideoUrl", "permalink"]),
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
    return "Use this content";
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
    return "Content check passed. Ready for G5.";
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
      return "Ready for G5";
    case "BLOCK":
      return "Blocked safely";
    case "MANUAL_ONLY":
      return "Manual review";
    case "PENDING_APPROVAL":
      return "Ready for G5";
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
      return "Ready for G5";
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
