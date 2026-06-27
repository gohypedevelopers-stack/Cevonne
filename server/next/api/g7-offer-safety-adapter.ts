import "server-only";

import { postN8nWebhook } from "@/lib/n8n-client";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import {
  G7_EMPTY_STATE_COPY,
  G7_WORKFLOW_PURPOSE,
  G7_WORKFLOW_TITLE,
  type G7DiscountStatus,
  type G7OfferProofRecord,
  type G7OfferProofSubmission,
  type G7StockStatus,
  type G7WorkflowDetail,
} from "@/lib/admin/g7-offer-safety";
import {
  getWorkflowActionNeeded,
  getWorkflowStatusMessage,
  humanizeReasonText,
  normalizeWorkflowUiStatus,
  type WorkflowDetailView,
  type WorkflowOutcomeSummary,
  type WorkflowUiStatus,
} from "@/lib/admin/workflows";
import { env } from "@/server/config";

type JsonRecord = Record<string, unknown>;

const OFFER_CHANGE_LOG_TABLE = "g7_offer_change_log";
const INVENTORY_SNAPSHOTS_TABLE = "g7_inventory_snapshots";
const DISCOUNTS_TABLE = "g7_discounts";
const DISCOUNT_TARGETS_TABLE = "g7_discount_targets";

const DEFAULT_ORDER_KEYS = [
  "processed_at",
  "checked_at",
  "captured_at",
  "completed_at",
  "created_at",
  "updated_at",
  "time",
] as const;

const URGENCY_PATTERN = /\b(today only|only\s+\d+\s+left|hurry|last chance|limited time|ends? tonight|ends? today|while supplies last|act now)\b/i;

const STOCK_STATUS_ALIASES: Record<string, G7StockStatus> = {
  PASS: "In stock",
  ACTIVE: "In stock",
  READY: "In stock",
  AVAILABLE: "In stock",
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  LIMITED: "Low stock",
  FEW_LEFT: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  SOLD_OUT: "Out of stock",
  BLOCK: "Out of stock",
  NEEDS_EVIDENCE: "Needs proof",
  NEEDS_PROOF: "Needs proof",
  UNKNOWN: "Unknown",
};

const DISCOUNT_STATUS_ALIASES: Record<string, G7DiscountStatus> = {
  PASS: "Active",
  ACTIVE: "Active",
  LIVE: "Active",
  VALID: "Active",
  EXPIRED: "Expired",
  ENDED: "Expired",
  INACTIVE: "Inactive",
  DISABLED: "Inactive",
  DRAFT: "Inactive",
  SCHEDULED: "Scheduled",
  PENDING: "Scheduled",
  QUEUED: "Scheduled",
  NEEDS_EVIDENCE: "Needs proof",
  NEEDS_PROOF: "Needs proof",
  UNKNOWN: "Unknown",
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord | null => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const flattenCandidates = (row: JsonRecord) => [
  row,
  asRecord(row.payload),
  asRecord(row.data),
  asRecord(row.details),
  asRecord(row.metadata),
  asRecord(row.summary),
  asRecord(row.response),
  asRecord(row.new_payload),
  asRecord(row.old_payload),
  asRecord(row.newPayload),
  asRecord(row.oldPayload),
];

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

const cleanUrl = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  try {
    const url = new URL(text.replace(/^["']|["']$/g, ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const pickString = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        const cleaned = cleanText(value);
        if (cleaned) {
          return cleaned;
        }
      }
    }
  }

  return null;
};

const pickUrl = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const key of keys) {
      const value = cleanUrl(candidate[key]);
      if (value) {
        return value;
      }
    }
  }

  return null;
};

const pickNumber = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "bigint") {
        return Number(value);
      }

      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return null;
};

const pickDate = (candidates: Array<JsonRecord | null>, keys: string[]) => {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const key of keys) {
      const value = candidate[key];
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }

      if (typeof value === "string" && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }
  }

  return null;
};

const normalizeComparableUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
};

const normalizeStockStatus = (explicitStatus: string | null, quantity: number | null) => {
  const normalized = explicitStatus?.trim().toUpperCase() ?? "";
  if (normalized && STOCK_STATUS_ALIASES[normalized]) {
    return STOCK_STATUS_ALIASES[normalized];
  }

  if (typeof quantity === "number") {
    if (quantity <= 0) {
      return "Out of stock";
    }

    if (quantity <= 3) {
      return "Low stock";
    }

    return "In stock";
  }

  return "Needs proof";
};

const normalizeDiscountStatus = (explicitStatus: string | null, startsAt: string | null, endsAt: string | null, now = new Date()) => {
  const normalized = explicitStatus?.trim().toUpperCase() ?? "";
  if (normalized && DISCOUNT_STATUS_ALIASES[normalized]) {
    const mapped = DISCOUNT_STATUS_ALIASES[normalized];
    if (mapped === "Active" && endsAt) {
      const ends = new Date(endsAt);
      if (!Number.isNaN(ends.getTime()) && ends.getTime() < now.getTime()) {
        return "Expired";
      }
    }

    if (mapped === "Active" && startsAt) {
      const starts = new Date(startsAt);
      if (!Number.isNaN(starts.getTime()) && starts.getTime() > now.getTime()) {
        return "Scheduled";
      }
    }

    return mapped;
  }

  if (startsAt) {
    const starts = new Date(startsAt);
    if (!Number.isNaN(starts.getTime()) && starts.getTime() > now.getTime()) {
      return "Scheduled";
    }
  }

  if (endsAt) {
    const ends = new Date(endsAt);
    if (!Number.isNaN(ends.getTime()) && ends.getTime() < now.getTime()) {
      return "Expired";
    }
  }

  return explicitStatus ? "Inactive" : "Needs proof";
};

const isUrgentClaim = (value: string | null) => Boolean(value && URGENCY_PATTERN.test(value));

const queryTableRows = async (supabase: NonNullable<ReturnType<typeof getN8nSupabaseAdmin>>, table: string, orderKeys: string[] = [...DEFAULT_ORDER_KEYS]) => {
  for (const orderKey of orderKeys) {
    const { data, error } = await supabase.from(table).select("*").order(orderKey, { ascending: false, nullsFirst: false }).limit(50);

    if (!error && Array.isArray(data)) {
      return data as JsonRecord[];
    }
  }

  const { data, error } = await supabase.from(table).select("*").limit(50);
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as JsonRecord[];
};

const normalizeInventoryRow = (row: JsonRecord) => {
  const candidates = flattenCandidates(row);
  const sku = pickString(candidates, ["sku"]);
  if (!sku) {
    return null;
  }

  return {
    sku,
    productId: pickString(candidates, ["product_id", "productId"]),
    quantity: pickNumber(candidates, ["quantity"]),
    evidenceUrl: pickUrl(candidates, ["evidence_url", "evidenceUrl"]),
    notes: pickString(candidates, ["notes", "note", "summary", "description"]),
    sourceName: pickString(candidates, ["source_name", "sourceName"]),
    sourceType: pickString(candidates, ["source_type", "sourceType"]),
    capturedBy: pickString(candidates, ["captured_by", "capturedBy"]),
    capturedAt: pickDate(candidates, ["captured_at", "capturedAt", "created_at", "createdAt", "updated_at", "updatedAt"]),
    expiresAt: pickDate(candidates, ["expires_at", "expiresAt"]),
  };
};

const normalizeDiscountRow = (row: JsonRecord) => {
  const candidates = flattenCandidates(row);
  const code = pickString(candidates, ["code"]);
  if (!code) {
    return null;
  }

  return {
    id: pickString(candidates, ["id"]),
    code,
    status: pickString(candidates, ["status"]),
    offerUrl: pickUrl(candidates, ["offer_url", "offerUrl"]),
    startsAt: pickDate(candidates, ["starts_at", "startsAt"]),
    endsAt: pickDate(candidates, ["ends_at", "endsAt"]),
    productId: pickString(candidates, ["product_id", "productId"]),
    sku: pickString(candidates, ["sku"]),
    createdAt: pickDate(candidates, ["created_at", "createdAt"]),
    updatedAt: pickDate(candidates, ["updated_at", "updatedAt"]),
  };
};

const normalizeDiscountTargetRow = (row: JsonRecord) => {
  const candidates = flattenCandidates(row);
  const discountId = pickString(candidates, ["discount_id", "discountId"]);
  if (!discountId) {
    return null;
  }

  return {
    discountId,
    productId: pickString(candidates, ["product_id", "productId"]),
    sku: pickString(candidates, ["sku"]),
    createdAt: pickDate(candidates, ["created_at", "createdAt"]),
  };
};

const discountMatchesTarget = (discount: ReturnType<typeof normalizeDiscountRow> | null, target: ReturnType<typeof normalizeDiscountTargetRow> | null, productOrSku: string | null) => {
  if (!discount || !target) {
    return false;
  }

  if (discount.id !== target.discountId) {
    return false;
  }

  if (productOrSku) {
    const normalized = productOrSku.trim().toLowerCase();
    return [target.productId, target.sku].some((value) => value?.trim().toLowerCase() === normalized);
  }

  return true;
};

const buildLookupTables = (
  inventoryRows: JsonRecord[],
  discountRows: JsonRecord[],
  discountTargetRows: JsonRecord[],
) => {
  const latestInventoryBySku = new Map<string, ReturnType<typeof normalizeInventoryRow>>();
  const inventoryHistoryBySku = new Map<string, Array<NonNullable<ReturnType<typeof normalizeInventoryRow>>>>();
  for (const row of inventoryRows) {
    const normalized = normalizeInventoryRow(row);
    if (!normalized) {
      continue;
    }

    const key = normalized.sku.trim().toLowerCase();
    const history = inventoryHistoryBySku.get(key) ?? [];
    history.push(normalized);
    inventoryHistoryBySku.set(key, history);

    if (!latestInventoryBySku.has(key)) {
      latestInventoryBySku.set(key, normalized);
    }
  }

  const latestDiscountByCode = new Map<string, ReturnType<typeof normalizeDiscountRow>>();
  const latestDiscountById = new Map<string, ReturnType<typeof normalizeDiscountRow>>();
  for (const row of discountRows) {
    const normalized = normalizeDiscountRow(row);
    if (!normalized) {
      continue;
    }

    const key = normalized.code.trim().toLowerCase();
    if (!latestDiscountByCode.has(key)) {
      latestDiscountByCode.set(key, normalized);
    }

    if (normalized.id && !latestDiscountById.has(normalized.id.trim().toLowerCase())) {
      latestDiscountById.set(normalized.id.trim().toLowerCase(), normalized);
    }
  }

  const targets = discountTargetRows
    .map((row) => normalizeDiscountTargetRow(row))
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizeDiscountTargetRow>> => Boolean(entry));

  return { latestInventoryBySku, inventoryHistoryBySku, latestDiscountByCode, latestDiscountById, discountTargets: targets };
};

const resolveInventorySkuKey = (
  input: {
    productOrSku: string | null;
  },
  lookup: ReturnType<typeof buildLookupTables>,
) => {
  const rawKey = input.productOrSku?.trim().toLowerCase() ?? "";
  if (!rawKey) {
    return null;
  }

  if (lookup.latestInventoryBySku.has(rawKey)) {
    return rawKey;
  }

  const target = lookup.discountTargets.find((entry) => [entry.productId, entry.sku].some((value) => value?.trim().toLowerCase() === rawKey));
  if (target?.sku) {
    return target.sku.trim().toLowerCase();
  }

  return rawKey;
};

const findDiscountForProof = (
  input: {
    productOrSku: string | null;
    discountCode: string | null;
    offerUrl: string | null;
  },
  lookup: ReturnType<typeof buildLookupTables>,
) => {
  const codeKey = input.discountCode?.trim().toLowerCase() ?? "";
  if (codeKey) {
    const byCode = lookup.latestDiscountByCode.get(codeKey);
    if (byCode) {
      return byCode;
    }
  }

  const productOrSku = input.productOrSku?.trim().toLowerCase() ?? "";
  if (productOrSku) {
    const target = lookup.discountTargets.find((entry) => [entry.productId, entry.sku].some((value) => value?.trim().toLowerCase() === productOrSku));
    if (target) {
      return lookup.latestDiscountById.get(target.discountId.trim().toLowerCase()) ?? null;
    }
  }

  const offerUrlKey = normalizeComparableUrl(input.offerUrl);
  if (offerUrlKey) {
    return (
      [...lookup.latestDiscountByCode.values()].find((discount) => {
        if (!discount) {
          return false;
        }

        return normalizeComparableUrl(discount.offerUrl) === offerUrlKey;
      }) ?? null
    );
  }

  return null;
};

const getInventoryForProof = (
  input: {
    productOrSku: string | null;
  },
  lookup: ReturnType<typeof buildLookupTables>,
) => {
  const skuKey = resolveInventorySkuKey(input, lookup);
  if (!skuKey) {
    return null;
  }

  return lookup.latestInventoryBySku.get(skuKey) ?? null;
};

const hasSecondaryInventoryEvidence = (
  input: {
    productOrSku: string | null;
  },
  lookup: ReturnType<typeof buildLookupTables>,
) => {
  const skuKey = resolveInventorySkuKey(input, lookup);
  if (!skuKey) {
    return false;
  }

  const history = lookup.inventoryHistoryBySku.get(skuKey) ?? [];
  if (history.length >= 2) {
    return true;
  }

  return history.some((entry) => {
    const sourceText = [entry.sourceType, entry.sourceName, entry.notes].filter(Boolean).join(" ").toLowerCase();
    return /\b(second|secondary|backup|double[- ]?check|double[- ]?proof|follow[- ]?up)\b/i.test(sourceText);
  });
};

const deriveG7Issues = (input: {
  productOrSku: string | null;
  stockStatus: G7StockStatus;
  discountStatus: G7DiscountStatus;
  discountCode: string | null;
  offerUrl: string | null;
  urgencyClaimText: string | null;
  hasInventoryProof: boolean;
  hasDiscountProof: boolean;
  discountOfferUrl: string | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  explicitStockStatus: string | null;
  explicitDiscountStatus: string | null;
  hasSecondStockProof: boolean;
}) => {
  const issues: Array<{ status: WorkflowUiStatus; message: string }> = [];

  if (!input.productOrSku) {
    issues.push({ status: "NEEDS_EVIDENCE", message: "Add a product ID or SKU before checking offer proof." });
  }

  if (!input.discountCode) {
    issues.push({ status: "NEEDS_EVIDENCE", message: "Add a discount code before using the offer." });
  }

  if (!input.offerUrl) {
    issues.push({ status: "NEEDS_EVIDENCE", message: "Add the live offer URL before using the claim." });
  }

  if (input.stockStatus === "Out of stock") {
    issues.push({ status: "BLOCK", message: "Stock proof shows the item is out of stock." });
  }

  if (input.explicitStockStatus && input.stockStatus !== "Unknown") {
    const explicit = normalizeStockStatus(input.explicitStockStatus, null);
    if (explicit !== input.stockStatus) {
      issues.push({ status: "BLOCK", message: "Stock proof does not match the claim." });
    }
  }

  if (input.discountStatus === "Expired") {
    issues.push({ status: "BLOCK", message: "The discount has expired." });
  } else if (input.discountStatus === "Inactive") {
    issues.push({ status: "BLOCK", message: "The discount is not active." });
  } else if (input.discountStatus === "Scheduled") {
    issues.push({ status: "BLOCK", message: "The discount is scheduled but not active yet." });
  }

  if (input.discountOfferUrl && input.offerUrl && normalizeComparableUrl(input.discountOfferUrl) !== normalizeComparableUrl(input.offerUrl)) {
    issues.push({ status: "BLOCK", message: "Offer URL does not match the saved proof." });
  }

  if (input.urgencyClaimText && isUrgentClaim(input.urgencyClaimText) && !input.hasSecondStockProof) {
    issues.push({ status: "BLOCK", message: "Urgency claims require a second stock proof." });
  }

  if (!input.hasInventoryProof) {
    issues.push({ status: "NEEDS_EVIDENCE", message: "Add stock proof before using the claim." });
  }

  if (!input.hasDiscountProof && input.discountCode) {
    issues.push({ status: "NEEDS_EVIDENCE", message: "Add discount proof before using the claim." });
  }

  if (!issues.length) {
    return issues;
  }

  const blockIssue = issues.find((issue) => issue.status === "BLOCK");
  if (blockIssue) {
    return [blockIssue, ...issues.filter((issue) => issue !== blockIssue)];
  }

  return issues;
};

const buildG7OfferProofRecord = (
  row: JsonRecord,
  lookup: ReturnType<typeof buildLookupTables>,
): G7OfferProofRecord | null => {
  const candidates = flattenCandidates(row);
  const time =
    pickDate(candidates, [
      "processed_at",
      "processedAt",
      "checked_at",
      "checkedAt",
      "captured_at",
      "capturedAt",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt",
      "handled_at",
      "handledAt",
      "time",
    ]) ?? null;

  if (!time) {
    return null;
  }

  const productId = pickString(candidates, ["product_id", "productId"]);
  const sku = pickString(candidates, ["sku"]);
  const productOrSku = pickString(candidates, ["product_or_sku", "productOrSku"]) ?? productId ?? sku ?? "Unknown product";
  const offerCode = pickString(candidates, ["discount_code", "offer_code", "code", "promo_code", "coupon_code"]);
  const offerUrl = pickUrl(candidates, ["offer_url", "offerUrl", "url", "landing_page_url", "landingPageUrl", "product_url"]);
  const urgencyClaimText = pickString(candidates, ["urgency_claim_text", "urgencyClaimText", "claim_text", "claimText", "urgency", "message"]);
  const actor = pickString(candidates, ["actor", "requested_by", "requestedBy", "created_by", "captured_by"]);
  const explicitStockStatus = pickString(candidates, ["stock_status", "stockStatus", "inventory_status", "inventoryStatus"]);
  const explicitDiscountStatus = pickString(candidates, ["discount_status", "discountStatus"]);
  const stockProofUrl = pickUrl(candidates, ["stock_proof_url", "stockProofUrl", "inventory_evidence_url", "inventoryEvidenceUrl", "secondary_stock_proof_url", "secondaryStockProofUrl", "second_stock_proof_url", "backup_stock_proof_url"]);
  const discountProofUrl = pickUrl(candidates, ["discount_proof_url", "discountProofUrl", "offer_proof_url", "offerProofUrl"]);
  const claimStockStatus = pickString(candidates, ["claim_stock_status", "claimed_stock_status", "stock_claim_status", "expected_stock_status"]);

  const inventory = getInventoryForProof({ productOrSku }, lookup);
  const discount = findDiscountForProof({ productOrSku, discountCode: offerCode, offerUrl }, lookup);
  const inventorySkuKey = resolveInventorySkuKey({ productOrSku }, lookup);
  const inventoryHistory = inventorySkuKey ? lookup.inventoryHistoryBySku.get(inventorySkuKey) ?? [] : [];
  const inventoryQuantity = inventory?.quantity ?? null;
  const stockStatus = normalizeStockStatus(explicitStockStatus ?? claimStockStatus, inventoryQuantity);
  const discountStatus = normalizeDiscountStatus(explicitDiscountStatus ?? discount?.status ?? null, discount?.startsAt ?? null, discount?.endsAt ?? null);
  const expiryDate = discount?.endsAt ?? pickDate(candidates, ["expiry_date", "expiryDate", "expires_at", "expiresAt", "end_date", "endDate"]);
  const hasSecondStockProof = Boolean(
    pickUrl(candidates, [
      "secondary_stock_proof_url",
      "secondaryStockProofUrl",
      "second_stock_proof_url",
      "secondStockProofUrl",
      "backup_stock_proof_url",
      "backupStockProofUrl",
      "secondary_proof_url",
      "secondaryProofUrl",
    ]) || hasSecondaryInventoryEvidence({ productOrSku }, lookup),
  );
  const hasInventoryProof = Boolean(inventory || stockProofUrl || inventoryHistory.length > 0);
  const hasDiscountProof = Boolean(discount || discountProofUrl);
  const resolvedOfferUrl = offerUrl ?? discount?.offerUrl ?? discountProofUrl ?? null;

  const issues = deriveG7Issues({
    productOrSku,
    stockStatus,
    discountStatus,
    discountCode: offerCode,
    offerUrl: resolvedOfferUrl,
    urgencyClaimText,
    hasInventoryProof,
    hasDiscountProof,
    discountOfferUrl: discount?.offerUrl ?? discountProofUrl ?? null,
    discountStartsAt: discount?.startsAt ?? null,
    discountEndsAt: discount?.endsAt ?? null,
    explicitStockStatus,
    explicitDiscountStatus,
    hasSecondStockProof,
  });

  const normalizeG7Result = (value: unknown): WorkflowUiStatus => {
    const normalized = normalizeWorkflowUiStatus(value, "NEEDS_EVIDENCE");
    return normalized === "PASS" || normalized === "BLOCK" || normalized === "NEEDS_EVIDENCE" ? normalized : "NEEDS_EVIDENCE";
  };

  const finalResult: WorkflowUiStatus = issues[0]?.status ?? normalizeG7Result(pickString(candidates, ["status", "result", "decision", "outcome"]) ?? null);
  const primaryIssue = issues[0]?.message ?? null;
  const actionNeeded =
    finalResult === "PASS"
      ? "No action needed. The offer proof can be used."
      : primaryIssue ?? getWorkflowActionNeeded({ workflowId: "G7", status: finalResult, reason: null, rowHints: [productOrSku, offerCode, resolvedOfferUrl].filter(Boolean) as string[] });

  const whatWasChecked = [productOrSku, stockStatus, discountCodeLabel(offerCode), discountStatus, expiryDate ? `Expires ${formatShortDate(expiryDate)}` : null, resolvedOfferUrl ? "Offer URL" : null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  const whatHappened =
    finalResult === "PASS"
      ? "Offer proof was verified safely."
      : finalResult === "BLOCK"
        ? "Offer proof was blocked safely."
        : finalResult === "NEEDS_EVIDENCE"
          ? "More proof is needed before this offer can be used."
          : getWorkflowStatusMessage(finalResult);

  return {
    time,
    result: finalResult,
    productId,
    sku,
    productOrSku,
    stockStatus,
    discountCode: offerCode,
    discountStatus,
    expiryDate,
    offerUrl: resolvedOfferUrl,
    urgencyClaimText,
    whatWasChecked,
    whatHappened,
    actionNeeded,
    whyItBlocked: finalResult === "PASS" ? null : primaryIssue ?? humanizeReasonText(primaryIssue),
    actor,
    sourceLabel: "n8n Supabase",
    checkedAt: time,
  };
};

const discountCodeLabel = (value: string | null) => (value ? `Discount ${value}` : null);

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
};

const toWorkflowOutcome = (proof: G7OfferProofRecord): WorkflowOutcomeSummary => ({
  time: proof.time,
  result: proof.result,
  whatWasChecked: proof.whatWasChecked,
  whatHappened: proof.whatHappened,
  actionNeeded: proof.actionNeeded,
  whyItBlocked: proof.whyItBlocked,
  sourceLabel: proof.sourceLabel,
  handledAt: proof.checkedAt,
  summary: proof.whatHappened,
});

const buildWorkflowViewFromProofs = (proofs: G7OfferProofRecord[]): WorkflowDetailView => {
  const latestProof = proofs[0] ?? null;

  return {
    workflowId: "G7",
    title: G7_WORKFLOW_TITLE,
    purpose: G7_WORKFLOW_PURPOSE,
    detailHref: "/dashboard/n8n-automations/g7",
    status: latestProof?.result ?? "NOT_RUN_YET",
    lastRunAt: latestProof?.checkedAt ?? null,
    latestOutcome: latestProof ? toWorkflowOutcome(latestProof) : null,
    recentOutcomes: proofs.slice(0, 10).map(toWorkflowOutcome),
    runLabel: "Check Offer Proof",
    runEnabled: true,
    runDisabledReason: null,
    emptyStateCopy: G7_EMPTY_STATE_COPY,
    mainActionNeeded: latestProof?.actionNeeded ?? "Click Check Offer Proof to verify a stock, discount, or urgency claim.",
  };
};

const createEmptyDetail = (message = G7_EMPTY_STATE_COPY): G7WorkflowDetail => {
  const workflow = buildWorkflowViewFromProofs([]);

  return {
    workflowGroup: "G7",
    title: G7_WORKFLOW_TITLE,
    purpose: G7_WORKFLOW_PURPOSE,
    status: "EMPTY",
    lastRunAt: null,
    latestProof: null,
    recentChecks: [],
    emptyStateCopy: G7_EMPTY_STATE_COPY,
    mainActionNeeded: workflow.mainActionNeeded,
    message,
    workflow,
  };
};

export const loadG7OfferSafetyDetail = async (): Promise<G7WorkflowDetail> => {
  const supabase = getN8nSupabaseAdmin();
  if (!supabase) {
    return createEmptyDetail();
  }

  try {
    const [offerRows, inventoryRows, discountRows, discountTargetRows] = await Promise.all([
      queryTableRows(supabase, OFFER_CHANGE_LOG_TABLE, ["processed_at", "checked_at", "created_at", "updated_at"]),
      queryTableRows(supabase, INVENTORY_SNAPSHOTS_TABLE, ["captured_at", "created_at", "updated_at"]),
      queryTableRows(supabase, DISCOUNTS_TABLE, ["updated_at", "created_at", "starts_at", "ends_at"]),
      queryTableRows(supabase, DISCOUNT_TARGETS_TABLE, ["created_at", "updated_at"]),
    ]);

    const lookup = buildLookupTables(inventoryRows, discountRows, discountTargetRows);
    const proofs = offerRows
      .map((row) => buildG7OfferProofRecord(row, lookup))
      .filter((value): value is G7OfferProofRecord => Boolean(value))
      .sort((left, right) => {
        const leftTime = left.time ? new Date(left.time).getTime() : 0;
        const rightTime = right.time ? new Date(right.time).getTime() : 0;
        return rightTime - leftTime;
      });

    const deduped: G7OfferProofRecord[] = [];
    const seen = new Set<string>();
    for (const proof of proofs) {
      const key = [proof.time, proof.productOrSku, proof.discountCode, proof.offerUrl, proof.result].join("|");
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(proof);
    }

    const workflow = buildWorkflowViewFromProofs(deduped);
    const latestProof = deduped[0] ?? null;

    return {
      workflowGroup: "G7",
      title: G7_WORKFLOW_TITLE,
      purpose: G7_WORKFLOW_PURPOSE,
      status: latestProof ? latestProof.result : "EMPTY",
      lastRunAt: latestProof?.checkedAt ?? null,
      latestProof,
      recentChecks: deduped.slice(0, 10),
      emptyStateCopy: G7_EMPTY_STATE_COPY,
      mainActionNeeded: workflow.mainActionNeeded,
      message: latestProof ? "Latest offer checks loaded." : G7_EMPTY_STATE_COPY,
      workflow,
    };
  } catch {
    return createEmptyDetail();
  }
};

export const runG7OfferProof = async (input: G7OfferProofSubmission) => {
  const response = await postN8nWebhook({
    path: env.n8nG7OfferProofPath || undefined,
    url: env.n8nG7OfferProofUrl || undefined,
    dryRun: false,
    payload: {
      workflow_group: "G7",
      workflow_id: "G7",
      source_platform: "WEBSITE",
      requested_by: input.requested_by?.trim() || input.actor.trim() || "admin",
      actor: input.actor.trim(),
      product_or_sku: input.product_or_sku.trim(),
      offer_code: input.offer_code.trim(),
      discount_code: input.offer_code.trim(),
      offer_url: input.offer_url.trim(),
      urgency_claim_text: input.urgency_claim_text.trim(),
      proof_type: "offer",
    },
  });

  const detail = await loadG7OfferSafetyDetail();
  const status =
    response.status === "PASS" || response.status === "BLOCK" || response.status === "NEEDS_EVIDENCE"
      ? response.status
      : response.status === "ERROR"
        ? "ERROR"
        : "NEEDS_EVIDENCE";
  const latestProof = detail.latestProof;
  const message =
    status === "ERROR"
      ? "Unable to check offer proof right now."
      : status === "PASS"
        ? latestProof?.whatHappened ?? "Offer proof checked."
        : latestProof?.actionNeeded ?? latestProof?.whatHappened ?? (status === "BLOCK" ? "Offer proof was blocked." : "More proof is required.");

  return {
    status: status as WorkflowUiStatus,
    message,
    handled_at: response.handled_at ?? new Date().toISOString(),
    outcome: latestProof,
    detail,
  };
};
