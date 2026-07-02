export type G7RawDashboardProof = {
  sku?: string | null;
  result?: string | null;
  created_at?: string | null;
  product_name?: string | null;
  urgency_claim?: string | null;
  discount_code?: string | null;
  discount_status?: string | null;
  stock_available?: number | string | null;
  second_stock_available?: number | string | null;
  action_needed?: string | null;
  client_summary?: string | null;
  fail_reason?: string | null;
  failure_reasons?: string[] | null;
  discount_ends_at?: string | null;
  expires_at?: string | null;
  requested_by_workflow?: string | null;
};

export type G7RawDashboardSummary = {
  status?: string | null;
  response_type?: string | null;
  workflow_group?: string | null;
  workflow_name?: string | null;
  latest_offer_proof?: G7RawDashboardProof | null;
  recent_offer_checks?: G7RawDashboardProof[] | null;
  counts?: {
    pass?: number | string | null;
    block?: number | string | null;
    total?: number | string | null;
    expired?: number | string | null;
    invalidated?: number | string | null;
    latest_checked_at?: string | null;
  } | null;
  action_needed?: string | null;
  ui_empty_state?: string | null;
  checked_at?: string | null;
};

export type G7DashboardCounts = {
  pass: number;
  block: number;
  total: number;
  expired: number;
  invalidated: number;
  latestCheckedAt: string | null;
};

export type G7ProofResultBadge = "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "NOT_RUN";

export type G7ProofView = {
  checkedAt: string | null;
  rawResult: "PASS" | "BLOCK" | "NEEDS_EVIDENCE" | "NOT_RUN";
  displayResult: G7ProofResultBadge;
  productName: string | null;
  sku: string | null;
  urgencyClaim: string | null;
  stockAvailable: string | null;
  secondStockProof: string | null;
  discountCode: string | null;
  discountStatus: string | null;
  actionNeeded: string;
  clientSummary: string;
  otherProofIssues: string[];
  failureReasons: string[];
};

export type G7DashboardSummary = {
  workflowName: string;
  latestOfferProof: G7ProofView | null;
  recentOfferChecks: G7ProofView[];
  counts: G7DashboardCounts;
  actionNeeded: string;
  emptyStateCopy: string;
  checkedAt: string | null;
};

export type G7OfferProofSubmissionInput = {
  sku: string;
  urgency_claim?: string | null;
  discount_code?: string | null;
  intended_use?: string | null;
  requested_by_workflow?: string | null;
  actor?: string | null;
};

const EMPTY_STATE_COPY =
  "G7 is ready, but no offer checks have been run yet. Click Check Offer Proof to verify a stock, discount, or urgency claim.";

const EVIDENCE_MISSING_REASONS = new Set([
  "SECOND_STOCK_SOURCE_REQUIRED_FOR_URGENCY",
  "SECOND_STOCK_SOURCE_NAME_REQUIRED_FOR_URGENCY",
  "SECOND_STOCK_EVIDENCE_URL_REQUIRED_FOR_URGENCY",
  "SECOND_STOCK_CHECKED_AT_REQUIRED_FOR_URGENCY",
]);

const REASON_MESSAGES: Array<[RegExp, string]> = [
  [/^SECOND_STOCK_SOURCE_REQUIRED_FOR_URGENCY$/i, "Add second stock proof before using urgency wording."],
  [/^SECOND_STOCK_SOURCE_NAME_REQUIRED_FOR_URGENCY$/i, "Add the second stock source name before using urgency wording."],
  [/^SECOND_STOCK_EVIDENCE_URL_REQUIRED_FOR_URGENCY$/i, "Add stock evidence before using urgency wording."],
  [/^SECOND_STOCK_CHECKED_AT_REQUIRED_FOR_URGENCY$/i, "Refresh second stock proof before using urgency wording."],
  [/^STOCK_MISMATCH(?:_.+)?$/i, "Update the claim or refresh inventory before using this offer."],
  [/^DISCOUNT_EXPIRED(?:_.+)?$/i, "Do not use this discount. Add an active discount or remove the offer claim."],
  [/^DISCOUNT_CODE_NOT_FOUND_IN_NEON$/i, "Check the discount code in the store database."],
  [/^PRODUCT_OR_VARIANT_NOT_FOUND_IN_NEON$/i, "Check the SKU in the store inventory database."],
  [/^OFFER_URL_MISMATCH_PRODUCT_URL$/i, "Check the offer URL before using this claim."],
  [/^DISCOUNT_NOT_ACTIVE(?:_.+)?$/i, "Use an active discount or remove the discount claim."],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (text.startsWith("{") || text.startsWith("[") || text.includes('"')) {
    return null;
  }

  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "");
  const collapsed = withoutUrls.replace(/\s+/g, " ").trim();
  return collapsed || null;
};

const cleanDate = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const cleanNumberText = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return String(parsed);
    }

    return cleanText(trimmed);
  }

  return cleanText(value);
};

const cleanNumber = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const cleanStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => cleanText(entry)).filter((entry): entry is string => Boolean(entry));
};

const normalizeResult = (value: unknown): G7ProofView["rawResult"] => {
  const text = cleanText(value)?.toUpperCase();
  if (text === "PASS" || text === "BLOCK" || text === "NEEDS_EVIDENCE") {
    return text;
  }

  return "NOT_RUN";
};

const mapReasonToMessage = (value: string | null | undefined) => {
  const reason = cleanText(value);
  if (!reason) {
    return null;
  }

  for (const [pattern, message] of REASON_MESSAGES) {
    if (pattern.test(reason)) {
      return message;
    }
  }

  return "Review this proof before using the offer.";
};

const getProofDisplayResult = (rawResult: G7ProofView["rawResult"], failureReasons: string[]) => {
  if (rawResult === "BLOCK" && failureReasons.some((reason) => EVIDENCE_MISSING_REASONS.has(reason.toUpperCase()))) {
    return "NEEDS_EVIDENCE";
  }

  return rawResult;
};

const getClientSummary = (proof: {
  rawResult: G7ProofView["rawResult"];
  displayResult: G7ProofView["displayResult"];
  urgencyClaim: string | null;
}) => {
  if (proof.rawResult === "PASS") {
    return "G7 verified this offer and it can be used safely before expiry.";
  }

  if (proof.displayResult === "NEEDS_EVIDENCE" && proof.urgencyClaim) {
    return `G7 blocked the '${proof.urgencyClaim}' claim because second stock proof is missing.`;
  }

  if (proof.rawResult === "BLOCK") {
    return "G7 blocked this offer claim until proof is fixed.";
  }

  return "G7 is ready, but no offer checks have been run yet.";
};

const normalizeProof = (value: unknown): G7ProofView | null => {
  if (!isRecord(value)) {
    return null;
  }

  const checkedAt = cleanDate(value.created_at);
  const rawResult = normalizeResult(value.result);
  const failureReasons = cleanStringArray(value.failure_reasons);
  const primaryReason = failureReasons[0] ?? cleanText(value.fail_reason);
  const displayResult = getProofDisplayResult(rawResult, failureReasons);
  const actionNeeded =
    rawResult === "PASS"
      ? "No action needed. Offer proof is safe to use until expiry."
      : mapReasonToMessage(primaryReason) ?? "Offer proof needs attention.";
  const otherProofIssues = failureReasons.slice(1).map((reason) => mapReasonToMessage(reason) ?? "Review this proof before using the offer.").filter(Boolean);
  const urgencyClaim = cleanText(value.urgency_claim);
  const clientSummary = getClientSummary({ rawResult, displayResult, urgencyClaim });

  return {
    checkedAt,
    rawResult,
    displayResult,
    productName: cleanText(value.product_name),
    sku: cleanText(value.sku),
    urgencyClaim,
    stockAvailable: cleanNumberText(value.stock_available),
    secondStockProof: cleanNumberText(value.second_stock_available),
    discountCode: cleanText(value.discount_code),
    discountStatus: cleanText(value.discount_status),
    actionNeeded,
    clientSummary,
    otherProofIssues: [...new Set(otherProofIssues)].filter((entry) => Boolean(entry)),
    failureReasons,
  };
};

const normalizeCounts = (value: unknown): G7DashboardCounts => {
  const counts = isRecord(value) ? value : {};

  return {
    pass: cleanNumber(counts.pass) ?? 0,
    block: cleanNumber(counts.block) ?? 0,
    total: cleanNumber(counts.total) ?? 0,
    expired: cleanNumber(counts.expired) ?? 0,
    invalidated: cleanNumber(counts.invalidated) ?? 0,
    latestCheckedAt: cleanDate(counts.latest_checked_at),
  };
};

export const mapG7ReasonToFriendlyMessage = (value: string | null | undefined) => mapReasonToMessage(value);

export const isG7ProofMissingReason = (value: string | null | undefined) => {
  const reason = cleanText(value)?.toUpperCase();
  return Boolean(reason && EVIDENCE_MISSING_REASONS.has(reason));
};

export const getG7ProofResultToneClass = (result: G7ProofResultBadge) => {
  switch (result) {
    case "PASS":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "BLOCK":
      return "border-rose-200 bg-rose-100 text-rose-800";
    case "NEEDS_EVIDENCE":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "NOT_RUN":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

export const getG7ProofResultLabel = (result: G7ProofResultBadge) => result;

export const normalizeG7DashboardSummary = (payload: unknown): G7DashboardSummary | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const recentRows = Array.isArray(payload.recent_offer_checks) ? payload.recent_offer_checks : [];
  const recentOfferChecks = recentRows.map((row) => normalizeProof(row)).filter((row): row is G7ProofView => Boolean(row));
  const latestOfferProof = normalizeProof(payload.latest_offer_proof) ?? recentOfferChecks[0] ?? null;
  const counts = normalizeCounts(payload.counts);
  const topLevelActionNeeded = mapReasonToMessage(payload.action_needed as string | null | undefined);

  return {
    workflowName: cleanText(payload.workflow_name) ?? "Inventory + Offer Safety",
    latestOfferProof,
    recentOfferChecks,
    counts: {
      ...counts,
      latestCheckedAt: counts.latestCheckedAt ?? latestOfferProof?.checkedAt ?? cleanDate(payload.checked_at),
    },
    actionNeeded: latestOfferProof?.actionNeeded ?? topLevelActionNeeded ?? "Offer proof needs attention.",
    emptyStateCopy: EMPTY_STATE_COPY,
    checkedAt: cleanDate(payload.checked_at),
  };
};

export const buildG7OfferProofPayload = (input: G7OfferProofSubmissionInput) => ({
  requested_by_workflow: cleanText(input.requested_by_workflow) || "G4",
  platform: "WEBSITE",
  sku: cleanText(input.sku) || "",
  urgency_claim: cleanText(input.urgency_claim) || null,
  discount_code: cleanText(input.discount_code) || null,
  offer_type: "OFFER_SAFETY_CHECK",
  intended_use: cleanText(input.intended_use) || "ORGANIC_POST",
  source_platform: "CUSTOM_WEBSITE",
  source_event: "WEBSITE_G7_OFFER_PROOF_CHECK",
  actor: cleanText(input.actor) || "admin_ui",
});

export const getG7SubmissionDisplayResult = (status: string | null | undefined, message: string | null | undefined) => {
  const normalizedStatus = cleanText(status)?.toUpperCase() ?? "";
  const normalizedMessage = cleanText(message) ?? "";

  if (normalizedStatus === "PASS") {
    return "PASS" as const;
  }

  if (normalizedStatus === "NEEDS_EVIDENCE") {
    return "NEEDS_EVIDENCE" as const;
  }

  if (normalizedStatus === "BLOCK") {
    return [...REASON_MESSAGES].some(([, value]) => value === normalizedMessage) ? "NEEDS_EVIDENCE" : "BLOCK";
  }

  return normalizedStatus === "ERROR" ? "BLOCK" : "NOT_RUN";
};

export const buildG7SubmissionMessage = (input: {
  status: string | null | undefined;
  failReason?: string | null;
  failureReasons?: string[] | null;
  message?: string | null;
}) => {
  const status = cleanText(input.status)?.toUpperCase() ?? "";
  const reasons = [...new Set((input.failureReasons ?? []).map((reason) => cleanText(reason)).filter((reason): reason is string => Boolean(reason)))];
  const reasonMessages = reasons
    .map((reason) => mapReasonToMessage(reason))
    .filter((message): message is string => Boolean(message));
  const primaryReasonMessage = mapReasonToMessage(input.failReason ?? reasons[0] ?? null);

  if (status === "PASS") {
    return "Offer proof verified.";
  }

  if (status === "BLOCK" || status === "NEEDS_EVIDENCE") {
    if (primaryReasonMessage && primaryReasonMessage !== "Review this proof before using the offer.") {
      return primaryReasonMessage;
    }

    if (reasonMessages.length > 0) {
      return reasonMessages[0];
    }

    return "Offer proof needs attention.";
  }

  if (status === "ERROR") {
    return "Offer proof check failed. No claim was approved.";
  }

  return cleanText(input.message) ?? "Offer proof check failed. No claim was approved.";
};
