import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPrisma } from "@/server/db/prismaClient";

type JsonRecord = Record<string, unknown>;

export type G3WorkflowStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "NOT_RUN_YET" | "ERROR";

export type G3EventType =
  | "CONSENT_RECORDED"
  | "OPT_OUT_RECORDED"
  | "ATTRIBUTION_RECORDED"
  | "PURCHASE_RECORDED"
  | "RECOVERY_SUPPRESSED"
  | "PRIVACY_REQUEST_RECORDED"
  | "BLOCKED_NO_CONSENT"
  | "BLOCKED_STOP_OPT_OUT"
  | "MANUAL_ONLY_PRIVACY_REVIEW";

export type G3EventDetails = {
  contactIdentifierMasked: string | null;
  channel: string | null;
  sourcePlatform: string | null;
  sourceEvent: string | null;
  requestType: string | null;
  consentStatus: string | null;
  orderIdMasked: string | null;
  purchaseValue: string | null;
  attributionEvent: string | null;
  verificationStatus: string | null;
  executionStatus: string | null;
  suppressionReason: string | null;
  source: string | null;
};

export type G3WorkflowOutcome = {
  time: string | null;
  result: G3WorkflowStatus;
  eventType: G3EventType;
  summary: string;
  whatHappened: string;
  actionNeeded: string;
  handledAt: string | null;
  sourceLabel: string;
  detailsLabel: "View";
  details: G3EventDetails;
};

export type G3ConsentRecord = {
  id: string;
  contactIdentifierMasked: string | null;
  channel: string;
  consentStatus: string;
  sourcePlatform: string | null;
  sourceEvent: string | null;
  consentText: string | null;
  syncedAt: string | null;
  payloadSummary: string | null;
};

export type G3OptOutRecord = {
  id: string;
  contactIdentifierMasked: string | null;
  channel: string;
  keyword: string | null;
  reason: string | null;
  sourcePlatform: string | null;
  sourceEvent: string | null;
  syncedAt: string | null;
};

export type G3PurchaseRecord = {
  id: string;
  orderId: string;
  contactIdentifierMasked: string | null;
  amount: string | null;
  currency: string;
  purchasedAt: string | null;
  sourcePlatform: string | null;
  recoverySuppressed: boolean;
  suppressionReason: string | null;
  attribution: {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    metaEventId: string | null;
    gclid: string | null;
  } | null;
};

export type G3PrivacyRequestRecord = {
  requestId: string;
  requestType: string;
  contactIdentifierMasked: string | null;
  verificationStatus: string;
  executionStatus: string;
  sourcePlatform: string | null;
  sourceEvent: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type G3ChannelStat = {
  channel: string;
  total: number;
  granted: number;
  optedOut: number;
};

export type G3WorkflowDetail = {
  workflowGroup: "G3";
  title: string;
  purpose: string;
  status: G3WorkflowStatus;
  lastRunAt: string | null;
  latestOutcome: G3WorkflowOutcome | null;
  recentOutcomes: G3WorkflowOutcome[];
  emptyStateCopy: string;
  mainActionNeeded: string;
  message: string;
  counts: {
    totalEvents: number;
    consentEvents: number;
    optOutEvents: number;
    attributionEvents: number;
    purchaseEvents: number;
    recoveryEvents: number;
    privacyEvents: number;
    blockedEvents: number;
    manualReviewEvents: number;
    passEvents: number;
  };
  channelBreakdown: G3ChannelStat[];
  consents: G3ConsentRecord[];
  optOuts: G3OptOutRecord[];
  purchases: G3PurchaseRecord[];
  privacyRequests: G3PrivacyRequestRecord[];
  workflow: {
    workflowId: "G3";
    title: string;
    purpose: string;
    detailHref: string;
    status: G3WorkflowStatus;
    lastRunAt: string | null;
    latestOutcome: G3WorkflowOutcome | null;
    recentOutcomes: G3WorkflowOutcome[];
    emptyStateCopy: string;
    mainActionNeeded: string;
  };
};

export const G3_TITLE = "G3 – Customer Consent & Privacy";
export const G3_PURPOSE =
  "G3 keeps customer permissions, opt-outs, purchases, marketing attribution and privacy requests synchronized safely across the website, compliance database and CRM.";
export const G3_DETAIL_HREF = "/dashboard/n8n-automations/g3";
export const G3_EMPTY_COPY =
  "No consent, opt-out, purchase, attribution, or privacy events have been recorded yet.";
export const G3_EMPTY_ACTION = "Record the first consent event or connect the G3 event source.";
export const G3_ERROR_COPY = "G3 event data could not be loaded right now.";

const G3_TABLES = {
  consentSync: "cevonne_g3_consent_sync",
  optOutSync: "cevonne_g3_opt_out_sync",
  purchaseEvents: "cevonne_g3_purchase_events",
  privacyRequests: "cevonne_g3_privacy_requests",
  privacyExecutions: "cevonne_g3_privacy_execution_requests",
  recoverySuppression: "cevonne_g3_recovery_suppression",
} as const;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeText = (value: unknown) => {
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

const upperText = (value: unknown) => normalizeText(value)?.toUpperCase() ?? null;

export const humanizeLabel = (value: string | null | undefined) => {
  if (!value) return null;

  const normalized = value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const parseJsonRecord = (value: unknown): JsonRecord | null => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
};

const readRecordText = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = normalizeText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readRecordDate = (record: JsonRecord | null | undefined, keys: string[]) => {
  if (!record) return null;

  for (const key of keys) {
    const val = record[key];
    if (val instanceof Date) {
      return val.toISOString();
    }
    const text = normalizeText(val);
    if (text) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return null;
};

export const normalizeContactIdentifier = (value: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    const [localPart, domainPart = ""] = trimmed.split("@");
    if (!domainPart) {
      return `${trimmed.slice(0, 2)}***`;
    }

    const visible = localPart.slice(0, 2);
    return `${visible}***@${domainPart}`;
  }

  if (/^\+?\d[\d\s()-]{5,}$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    const prefix = trimmed.startsWith("+") ? "+91 " : "";
    return `${prefix}***** ${digits.slice(-4)}`;
  }

  if (/^cus_[a-z0-9]+$/i.test(trimmed)) {
    return `cus_***${trimmed.slice(-3)}`;
  }

  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 1)}***`;
  }

  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
};

const normalizeMoney = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(2);
    }
  }

  return null;
};

const readPayload = (record: JsonRecord | null | undefined) => {
  if (!record) {
    return null;
  }

  return parseJsonRecord(record.payload ?? record.raw_payload ?? record.data ?? record.details ?? record.metadata);
};

const readCommonFields = (record: JsonRecord, payload: JsonRecord | null) => {
  const contactIdentifier =
    readRecordText(record, ["contact_id", "external_contact_id", "email", "phone", "user_id"]) ??
    readRecordText(payload, ["contact_id", "external_contact_id", "email", "phone", "user_id"]) ??
    null;

  const orderId = readRecordText(record, ["order_id", "purchase_event_id"]) ?? readRecordText(payload, ["order_id"]) ?? null;
  const channel = humanizeLabel(readRecordText(record, ["channel"]) ?? readRecordText(payload, ["channel"]) ?? null) || "Website";
  const sourcePlatform = humanizeLabel(readRecordText(record, ["source_platform"]) ?? readRecordText(payload, ["source_platform"]) ?? null);
  const sourceEvent = humanizeLabel(readRecordText(record, ["source_event"]) ?? readRecordText(payload, ["source_event", "event_type", "source"]) ?? null);

  return {
    contactIdentifier,
    orderId,
    channel,
    sourcePlatform,
    sourceEvent,
  };
};

const isAttributionLikeRow = (row: JsonRecord) => {
  const payload = readPayload(row);
  const sourceEvent = upperText(readRecordText(row, ["source_event"]) ?? readRecordText(payload, ["source_event", "event_type", "source"]) ?? null);

  if (sourceEvent && /ATTRIBUTION/i.test(sourceEvent)) {
    return true;
  }

  return Boolean(readRecordText(payload, ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid", "meta_event_id"]));
};

const makeOutcome = (input: {
  time: string | null;
  result: G3WorkflowStatus;
  eventType: G3EventType;
  summary: string;
  whatHappened: string;
  actionNeeded: string;
  sourceLabel: string;
  details: G3EventDetails;
}): G3WorkflowOutcome | null => {
  if (!input.time) {
    return null;
  }

  return {
    time: input.time,
    result: input.result,
    eventType: input.eventType,
    summary: input.summary,
    whatHappened: input.whatHappened,
    actionNeeded: input.actionNeeded,
    handledAt: input.time,
    sourceLabel: input.sourceLabel,
    detailsLabel: "View",
    details: input.details,
  };
};

const buildConsentOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["synced_at", "updated_at", "created_at"]);
  const consentStatus = upperText(readRecordText(row, ["consent_status"]) ?? readRecordText(payload, ["consent_status"]) ?? null);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const channel = common.channel;
  const sourceLabel = "Consent sync";

  if (!time) {
    return null;
  }

  if (isAttributionLikeRow(row)) {
    return buildAttributionOutcome(row);
  }

  if (!contactMasked && !common.contactIdentifier) {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: "BLOCKED_NO_CONSENT",
      summary: "Blocked safely because the contact identifier was missing.",
      whatHappened: "Blocked safely because the contact identifier was missing.",
      actionNeeded: "Add a valid email, phone, or customer ID before recording consent.",
      sourceLabel,
      details: {
        contactIdentifierMasked: null,
        channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType: null,
        consentStatus,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent: null,
        verificationStatus: null,
        executionStatus: null,
        suppressionReason: null,
        source: common.sourcePlatform,
      },
    });
  }

  if (consentStatus === "NO" || consentStatus === "OPT_OUT" || consentStatus === "REVOKED" || consentStatus === "BLOCKED") {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: "BLOCKED_STOP_OPT_OUT",
      summary: "Marketing messages are blocked after opt-out was recorded.",
      whatHappened: "Marketing messages are blocked after opt-out was recorded.",
      actionNeeded: "Do not send promotional messages to this customer on this channel.",
      sourceLabel,
      details: {
        contactIdentifierMasked: contactMasked,
        channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType: null,
        consentStatus,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent: null,
        verificationStatus: null,
        executionStatus: null,
        suppressionReason: "Opt-out recorded",
        source: common.sourcePlatform,
      },
    });
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "CONSENT_RECORDED",
    summary: `Consent was recorded safely for ${channel}.`,
    whatHappened: `Consent was recorded safely for ${channel}.`,
    actionNeeded: "No action needed. Compliance database and CRM remain synchronized.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: consentStatus ?? "GRANTED",
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: null,
      source: common.sourcePlatform,
    },
  });
};

const buildOptOutOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["synced_at", "created_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const channel = common.channel;
  const sourceLabel = "Opt-out sync";

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "BLOCK",
    eventType: "OPT_OUT_RECORDED",
    summary: `Opt-out was recorded safely on ${channel}. Marketing stopped.`,
    whatHappened: `Customer sent STOP / opt-out request on ${channel}. Marketing messages blocked.`,
    actionNeeded: "No action needed. Automated suppression is active.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: "OPTED_OUT",
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: readRecordText(row, ["opt_out_keyword"]) ?? "STOP keyword",
      source: common.sourcePlatform,
    },
  });
};

const buildAttributionOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["synced_at", "created_at", "updated_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const utmSource = readRecordText(payload, ["utm_source", "source"]);
  const utmMedium = readRecordText(payload, ["utm_medium", "medium"]);
  const utmCampaign = readRecordText(payload, ["utm_campaign", "campaign"]);
  const sourceLabel = "Attribution sync";

  if (!time) {
    return null;
  }

  const attributionSummary = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(" / ") || "Direct / Website";

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "ATTRIBUTION_RECORDED",
    summary: `Attribution tracked safely: ${attributionSummary}.`,
    whatHappened: `Campaign attribution was attributed safely to contact.`,
    actionNeeded: "No action needed. CRM attribution record is up to date.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: null,
      orderIdMasked: common.orderId ? `ORD-***${common.orderId.slice(-4)}` : null,
      purchaseValue: null,
      attributionEvent: attributionSummary,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: null,
      source: common.sourcePlatform,
    },
  });
};

const buildPurchaseOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["purchased_at", "created_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const orderId = common.orderId ?? readRecordText(row, ["order_id"]) ?? "ORDER";
  const orderIdMasked = orderId.length > 4 ? `ORD-***${orderId.slice(-4)}` : orderId;
  const value = normalizeMoney(readRecordText(payload, ["total_amount", "amount", "value", "price"]));
  const sourceLabel = "Purchase event";

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "PURCHASE_RECORDED",
    summary: `Purchase recorded (${orderIdMasked}). Abandoned cart recovery suppressed.`,
    whatHappened: `Customer completed order ${orderIdMasked}. Recovery prompts suppressed.`,
    actionNeeded: "No action needed. Post-purchase sequence initiated.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: null,
      orderIdMasked,
      purchaseValue: value ? `₹${value}` : null,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: "Purchase completed",
      source: common.sourcePlatform,
    },
  });
};

const buildRecoveryOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const suppressionReason = humanizeLabel(readRecordText(row, ["suppression_reason"]) ?? readRecordText(payload, ["suppression_reason"]) ?? "Active suppression");
  const sourceLabel = "Recovery suppression";

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "RECOVERY_SUPPRESSED",
    summary: `Recovery suppressed: ${suppressionReason}.`,
    whatHappened: `Recovery messaging was suppressed safely for ${contactMasked ?? "contact"}.`,
    actionNeeded: "No action needed. Unwanted promotional messages prevented.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: null,
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason,
      source: common.sourcePlatform,
    },
  });
};

const buildPrivacyRequestOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at", "updated_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const requestType = humanizeLabel(readRecordText(row, ["request_type"]) ?? readRecordText(payload, ["request_type"]) ?? "Access") || "Access";
  const verificationStatus = upperText(readRecordText(row, ["verification_status"]) ?? readRecordText(payload, ["verification_status"]) ?? "PENDING");
  const executionStatus = upperText(readRecordText(row, ["execution_status"]) ?? readRecordText(payload, ["execution_status"]) ?? "PENDING");
  const sourceLabel = "Privacy request";

  if (!time) {
    return null;
  }

  if (executionStatus === "EXECUTED") {
    return makeOutcome({
      time,
      result: "PASS",
      eventType: "PRIVACY_REQUEST_RECORDED",
      summary: `Privacy request (${requestType}) was executed successfully.`,
      whatHappened: `Privacy ${requestType} request for ${contactMasked ?? "contact"} was completed and synchronized.`,
      actionNeeded: "No action needed. Privacy compliance log updated.",
      sourceLabel,
      details: {
        contactIdentifierMasked: contactMasked,
        channel: common.channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType,
        consentStatus: null,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent: null,
        verificationStatus,
        executionStatus,
        suppressionReason: null,
        source: common.sourcePlatform,
      },
    });
  }

  if (verificationStatus === "PENDING" || executionStatus === "PENDING") {
    return makeOutcome({
      time,
      result: "MANUAL_ONLY",
      eventType: "MANUAL_ONLY_PRIVACY_REVIEW",
      summary: `Privacy request (${requestType}) needs manual review / verification.`,
      whatHappened: `A customer requested data ${requestType}. Awaiting identity verification.`,
      actionNeeded: "Verify customer identity before approving or executing request.",
      sourceLabel,
      details: {
        contactIdentifierMasked: contactMasked,
        channel: common.channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType,
        consentStatus: null,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent: null,
        verificationStatus,
        executionStatus,
        suppressionReason: null,
        source: common.sourcePlatform,
      },
    });
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "PRIVACY_REQUEST_RECORDED",
    summary: `Privacy request (${requestType}) recorded safely.`,
    whatHappened: `Privacy request recorded in compliance registry.`,
    actionNeeded: "Review request details.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType,
      consentStatus: null,
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent: null,
      verificationStatus,
      executionStatus,
      suppressionReason: null,
      source: common.sourcePlatform,
    },
  });
};

const querySupabaseRows = async (table: string, orderKey: string, limit = 50): Promise<JsonRecord[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order(orderKey, { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data as JsonRecord[];
  } catch {
    return [];
  }
};

const queryPrismaFallback = async (table: keyof typeof G3_TABLES, limit = 50): Promise<JsonRecord[]> => {
  try {
    const prisma = await getPrisma();
    if (!prisma) return [];

    switch (table) {
      case "consentSync": {
        const rows = await prisma.cevonne_g3_consent_sync.findMany({
          orderBy: { synced_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({ ...r, id: String(r.id), synced_at: r.synced_at.toISOString() }));
      }
      case "optOutSync": {
        const rows = await prisma.cevonne_g3_opt_out_sync.findMany({
          orderBy: { synced_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({ ...r, id: String(r.id), synced_at: r.synced_at.toISOString() }));
      }
      case "purchaseEvents": {
        const rows = await prisma.cevonne_g3_purchase_events.findMany({
          orderBy: { created_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({
          ...r,
          created_at: r.created_at.toISOString(),
          purchased_at: r.purchased_at?.toISOString() ?? null,
        }));
      }
      case "privacyRequests": {
        const rows = await prisma.cevonne_g3_privacy_requests.findMany({
          orderBy: { created_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({
          ...r,
          created_at: r.created_at.toISOString(),
          updated_at: r.updated_at.toISOString(),
        }));
      }
      case "privacyExecutions": {
        const rows = await prisma.cevonne_g3_privacy_execution_requests.findMany({
          orderBy: { created_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({ ...r, id: String(r.id), created_at: r.created_at.toISOString() }));
      }
      case "recoverySuppression": {
        const rows = await prisma.cevonne_g3_recovery_suppression.findMany({
          orderBy: { created_at: "desc" },
          take: limit,
        });
        return rows.map((r) => ({ ...r, id: String(r.id), created_at: r.created_at.toISOString() }));
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
};

const queryRows = async (tableKey: keyof typeof G3_TABLES, orderKey: string, limit = 50): Promise<JsonRecord[]> => {
  const tableName = G3_TABLES[tableKey];
  const supabaseResults = await querySupabaseRows(tableName, orderKey, limit);
  if (supabaseResults.length > 0) {
    return supabaseResults;
  }

  return queryPrismaFallback(tableKey, limit);
};

const buildOutcomeSignature = (outcome: G3WorkflowOutcome) =>
  [
    outcome.time ?? "",
    outcome.result,
    outcome.eventType,
    outcome.summary,
    outcome.details.contactIdentifierMasked ?? "",
    outcome.details.orderIdMasked ?? "",
    outcome.details.attributionEvent ?? "",
    outcome.details.requestType ?? "",
  ].join("|");

export async function getG3WorkflowDetail(): Promise<G3WorkflowDetail> {
  try {
    const [consentRows, optOutRows, purchaseRows, privacyRows, recoveryRows] = await Promise.all([
      queryRows("consentSync", "synced_at", 50),
      queryRows("optOutSync", "synced_at", 50),
      queryRows("purchaseEvents", "created_at", 50),
      queryRows("privacyRequests", "created_at", 50),
      queryRows("recoverySuppression", "created_at", 50),
    ]);

    const outcomes = [
      ...consentRows.map((row) => buildConsentOutcome(row)),
      ...optOutRows.map((row) => buildOptOutOutcome(row)),
      ...purchaseRows.map((row) => buildPurchaseOutcome(row)),
      ...privacyRows.map((row) => buildPrivacyRequestOutcome(row)),
      ...recoveryRows.map((row) => buildRecoveryOutcome(row)),
    ]
      .filter((value): value is G3WorkflowOutcome => Boolean(value))
      .sort((left, right) => {
        const leftTime = left.time ? new Date(left.time).getTime() : 0;
        const rightTime = right.time ? new Date(right.time).getTime() : 0;
        return rightTime - leftTime;
      });

    const deduped: G3WorkflowOutcome[] = [];
    const seen = new Set<string>();

    for (const outcome of outcomes) {
      const signature = buildOutcomeSignature(outcome);
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      deduped.push(outcome);
    }

    const recentOutcomes = deduped.slice(0, 15);
    const latestOutcome = recentOutcomes[0] ?? null;

    // Structured Consents
    const consents: G3ConsentRecord[] = consentRows.map((row) => {
      const payload = readPayload(row);
      const common = readCommonFields(row, payload);
      const id = String(row.id ?? row.consent_id ?? Math.random());
      const syncedAt = readRecordDate(row, ["synced_at", "created_at"]);
      const consentStatus = upperText(readRecordText(row, ["consent_status"]) ?? readRecordText(payload, ["consent_status"]) ?? "GRANTED") ?? "GRANTED";
      const consentText = readRecordText(row, ["consent_text"]) ?? readRecordText(payload, ["consent_text", "proof", "terms"]) ?? null;

      return {
        id,
        contactIdentifierMasked: normalizeContactIdentifier(common.contactIdentifier),
        channel: common.channel,
        consentStatus,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        consentText,
        syncedAt,
        payloadSummary: payload ? JSON.stringify(payload).slice(0, 100) : null,
      };
    });

    // Structured Opt-Outs
    const optOuts: G3OptOutRecord[] = optOutRows.map((row) => {
      const payload = readPayload(row);
      const common = readCommonFields(row, payload);
      const id = String(row.id ?? row.opt_out_id ?? Math.random());
      const syncedAt = readRecordDate(row, ["synced_at", "created_at"]);
      const keyword = readRecordText(row, ["opt_out_keyword"]) ?? readRecordText(payload, ["keyword", "message"]) ?? "STOP";
      const reason = readRecordText(payload, ["reason", "notes"]) ?? "Customer request";

      return {
        id,
        contactIdentifierMasked: normalizeContactIdentifier(common.contactIdentifier),
        channel: common.channel,
        keyword,
        reason,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        syncedAt,
      };
    });

    // Recovery Suppression map for purchases
    const suppressionByContact = new Set<string>();
    for (const rec of recoveryRows) {
      const payload = readPayload(rec);
      const common = readCommonFields(rec, payload);
      if (common.contactIdentifier) {
        suppressionByContact.add(common.contactIdentifier.trim().toLowerCase());
      }
    }

    // Structured Purchases
    const purchases: G3PurchaseRecord[] = purchaseRows.map((row) => {
      const payload = readPayload(row);
      const common = readCommonFields(row, payload);
      const orderId = String(row.order_id ?? row.purchase_event_id ?? "ORDER");
      const purchasedAt = readRecordDate(row, ["purchased_at", "created_at"]);
      const amount = normalizeMoney(readRecordText(payload, ["total_amount", "amount", "value", "price"]));
      const currency = readRecordText(payload, ["currency"]) ?? "INR";
      const contactKey = common.contactIdentifier?.trim().toLowerCase() ?? "";
      const recoverySuppressed = suppressionByContact.has(contactKey) || Boolean(purchasedAt);

      return {
        id: String(row.purchase_event_id ?? orderId),
        orderId: orderId.length > 4 ? `ORD-***${orderId.slice(-4)}` : orderId,
        contactIdentifierMasked: normalizeContactIdentifier(common.contactIdentifier),
        amount: amount ? `₹${amount}` : null,
        currency,
        purchasedAt,
        sourcePlatform: common.sourcePlatform,
        recoverySuppressed,
        suppressionReason: recoverySuppressed ? "Post-purchase suppression active" : null,
        attribution: {
          utmSource: readRecordText(payload, ["utm_source", "source"]),
          utmMedium: readRecordText(payload, ["utm_medium", "medium"]),
          utmCampaign: readRecordText(payload, ["utm_campaign", "campaign"]),
          metaEventId: readRecordText(payload, ["meta_event_id"]),
          gclid: readRecordText(payload, ["gclid"]),
        },
      };
    });

    // Structured Privacy Requests
    const privacyRequests: G3PrivacyRequestRecord[] = privacyRows.map((row) => {
      const payload = readPayload(row);
      const common = readCommonFields(row, payload);
      const requestId = String(row.request_id ?? Math.random());
      const requestType = humanizeLabel(readRecordText(row, ["request_type"]) ?? readRecordText(payload, ["request_type"]) ?? "Access") || "Access";
      const verificationStatus = upperText(readRecordText(row, ["verification_status"]) ?? readRecordText(payload, ["verification_status"]) ?? "PENDING") ?? "PENDING";
      const executionStatus = upperText(readRecordText(row, ["execution_status"]) ?? readRecordText(payload, ["execution_status"]) ?? "PENDING") ?? "PENDING";
      const createdAt = readRecordDate(row, ["created_at"]);
      const updatedAt = readRecordDate(row, ["updated_at"]);

      return {
        requestId,
        requestType,
        contactIdentifierMasked: normalizeContactIdentifier(common.contactIdentifier),
        verificationStatus,
        executionStatus,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        createdAt,
        updatedAt,
      };
    });

    // Channel breakdown
    const channelMap = new Map<string, { total: number; granted: number; optedOut: number }>();
    const defaultChannels = ["WhatsApp", "Email", "SMS", "Instagram", "Website"];
    for (const ch of defaultChannels) {
      channelMap.set(ch, { total: 0, granted: 0, optedOut: 0 });
    }

    for (const c of consents) {
      const ch = humanizeLabel(c.channel) || "Website";
      const current = channelMap.get(ch) || { total: 0, granted: 0, optedOut: 0 };
      current.total += 1;
      if (c.consentStatus === "GRANTED" || c.consentStatus === "YES") {
        current.granted += 1;
      } else {
        current.optedOut += 1;
      }
      channelMap.set(ch, current);
    }

    for (const o of optOuts) {
      const ch = humanizeLabel(o.channel) || "Website";
      const current = channelMap.get(ch) || { total: 0, granted: 0, optedOut: 0 };
      current.total += 1;
      current.optedOut += 1;
      channelMap.set(ch, current);
    }

    const channelBreakdown: G3ChannelStat[] = Array.from(channelMap.entries()).map(([channel, stats]) => ({
      channel,
      total: stats.total,
      granted: stats.granted,
      optedOut: stats.optedOut,
    }));

    const counts = {
      totalEvents: consents.length + optOuts.length + purchases.length + privacyRequests.length,
      consentEvents: consents.filter((c) => c.consentStatus === "GRANTED" || c.consentStatus === "YES").length,
      optOutEvents: optOuts.length + consents.filter((c) => c.consentStatus === "NO" || c.consentStatus === "OPTED_OUT").length,
      attributionEvents: purchases.filter((p) => p.attribution && (p.attribution.utmSource || p.attribution.metaEventId)).length,
      purchaseEvents: purchases.length,
      recoveryEvents: recoveryRows.length + purchases.filter((p) => p.recoverySuppressed).length,
      privacyEvents: privacyRequests.length,
      blockedEvents: deduped.filter((outcome) => outcome.result === "BLOCK").length,
      manualReviewEvents: privacyRequests.filter((p) => p.verificationStatus === "PENDING" || p.executionStatus === "PENDING").length,
      passEvents: deduped.filter((outcome) => outcome.result === "PASS").length,
    };

    let status: G3WorkflowStatus = "NOT_RUN_YET";
    if (latestOutcome) {
      if (counts.manualReviewEvents > 0) {
        status = "MANUAL_ONLY";
      } else if (latestOutcome.result === "BLOCK") {
        status = "BLOCK";
      } else {
        status = "PASS";
      }
    }

    const lastRunAt = latestOutcome?.time ?? null;

    return {
      workflowGroup: "G3",
      title: G3_TITLE,
      purpose: G3_PURPOSE,
      status,
      lastRunAt,
      latestOutcome,
      recentOutcomes,
      emptyStateCopy: G3_EMPTY_COPY,
      mainActionNeeded: latestOutcome?.actionNeeded ?? G3_EMPTY_ACTION,
      message: latestOutcome ? "G3 event history synchronized safely." : G3_EMPTY_COPY,
      counts,
      channelBreakdown,
      consents,
      optOuts,
      purchases,
      privacyRequests,
      workflow: {
        workflowId: "G3",
        title: G3_TITLE,
        purpose: G3_PURPOSE,
        detailHref: G3_DETAIL_HREF,
        status,
        lastRunAt,
        latestOutcome,
        recentOutcomes,
        emptyStateCopy: G3_EMPTY_COPY,
        mainActionNeeded: latestOutcome?.actionNeeded ?? G3_EMPTY_ACTION,
      },
    };
  } catch {
    return {
      workflowGroup: "G3",
      title: G3_TITLE,
      purpose: G3_PURPOSE,
      status: "ERROR",
      lastRunAt: null,
      latestOutcome: null,
      recentOutcomes: [],
      emptyStateCopy: G3_EMPTY_COPY,
      mainActionNeeded: "Check the G3 event source connection.",
      message: G3_ERROR_COPY,
      counts: {
        totalEvents: 0,
        consentEvents: 0,
        optOutEvents: 0,
        attributionEvents: 0,
        purchaseEvents: 0,
        recoveryEvents: 0,
        privacyEvents: 0,
        blockedEvents: 0,
        manualReviewEvents: 0,
        passEvents: 0,
      },
      channelBreakdown: [
        { channel: "WhatsApp", total: 0, granted: 0, optedOut: 0 },
        { channel: "Email", total: 0, granted: 0, optedOut: 0 },
        { channel: "SMS", total: 0, granted: 0, optedOut: 0 },
        { channel: "Instagram", total: 0, granted: 0, optedOut: 0 },
        { channel: "Website", total: 0, granted: 0, optedOut: 0 },
      ],
      consents: [],
      optOuts: [],
      purchases: [],
      privacyRequests: [],
      workflow: {
        workflowId: "G3",
        title: G3_TITLE,
        purpose: G3_PURPOSE,
        detailHref: G3_DETAIL_HREF,
        status: "ERROR",
        lastRunAt: null,
        latestOutcome: null,
        recentOutcomes: [],
        emptyStateCopy: G3_EMPTY_COPY,
        mainActionNeeded: "Check the G3 event source connection.",
      },
    };
  }
}
