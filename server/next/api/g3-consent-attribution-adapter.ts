import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

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

const G3_TITLE = "CRM + Consent + Attribution";
const G3_PURPOSE = "Manages consent, opt-outs, attribution, purchases, recovery suppression, and privacy requests.";
const G3_DETAIL_HREF = "/dashboard/n8n-automations/g3";
const G3_EMPTY_COPY =
  "No consent, opt-out, purchase, attribution, or privacy events have been recorded yet.";
const G3_EMPTY_ACTION = "Record the first consent event or connect the G3 event source.";
const G3_ERROR_COPY = "G3 event data could not be loaded right now.";

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

const humanizeLabel = (value: string | null | undefined) => {
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

const cleanFreeText = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) return null;

  if (text.startsWith("{") || text.startsWith("[") || text.includes('"')) {
    return null;
  }

  const withoutUrls = text.replace(/https?:\/\/\S+/gi, "");
  const collapsed = withoutUrls.replace(/\s+/g, " ").trim();
  return collapsed || null;
};

const parseJsonRecord = (value: unknown) => {
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
  const text = readRecordText(record, keys);
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeContactIdentifier = (value: string | null) => {
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
    const prefix = trimmed.startsWith("+") ? trimmed.slice(0, Math.max(0, trimmed.indexOf(digits[0] ?? ""))) : "";
    const visiblePrefix = prefix ? `${prefix} ` : "";
    return `${visiblePrefix}${"*".repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}`;
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
  const channel = humanizeLabel(readRecordText(record, ["channel"]) ?? readRecordText(payload, ["channel"]) ?? null);
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
  const sourceEvent = upperText(readRecordText(row, ["source_event"]) ?? readRecordText(payload, ["source_event", "event_type", "source"]) ?? null);
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
        source: common.sourcePlatform ?? null,
      },
    });
  }

  const optOutLike = Boolean(sourceEvent && /(OPT OUT|OPT-OUT|STOP|UNSUBSCRIBE|DECLINE|REVOKE)/i.test(sourceEvent));
  const deniedLike = Boolean(consentStatus && /(NO|DENIED|DECLINED|REVOKED|BLOCKED|STOP)/i.test(consentStatus));
  const reviewLike = Boolean(consentStatus && /(REVIEW|PENDING|UNKNOWN|MANUAL)/i.test(consentStatus));

  if (optOutLike || deniedLike) {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: optOutLike ? "BLOCKED_STOP_OPT_OUT" : "BLOCKED_NO_CONSENT",
      summary: "Opt-out was recorded. Future marketing messages are blocked.",
      whatHappened: "Opt-out was recorded. Future marketing messages are blocked.",
      actionNeeded: "Do not send marketing messages to this contact.",
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
        suppressionReason: null,
        source: common.sourcePlatform ?? null,
      },
    });
  }

  if (reviewLike) {
    return makeOutcome({
      time,
      result: "MANUAL_ONLY",
      eventType: "CONSENT_RECORDED",
      summary: "Consent needs manual review.",
      whatHappened: "Consent needs manual review.",
      actionNeeded: "Review the consent record before using it.",
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
        suppressionReason: null,
        source: common.sourcePlatform ?? null,
      },
    });
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "CONSENT_RECORDED",
    summary: `Consent was recorded safely${channel ? ` for ${channel}` : ""}.`,
    whatHappened: `Consent was recorded safely${channel ? ` for ${channel}` : ""}.`,
    actionNeeded: "No action needed. This contact can be used only within the allowed consent rules.",
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
      suppressionReason: null,
      source: common.sourcePlatform ?? null,
    },
  });
};

const buildOptOutOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["synced_at", "updated_at", "created_at"]);
  const sourceEvent = upperText(readRecordText(row, ["source_event"]) ?? readRecordText(payload, ["source_event", "event_type", "source"]) ?? null);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const sourceLabel = "Opt-out sync";

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "BLOCK",
    eventType: sourceEvent && /(STOP|UNSUBSCRIBE|OPT OUT|OPT-OUT)/i.test(sourceEvent) ? "BLOCKED_STOP_OPT_OUT" : "OPT_OUT_RECORDED",
    summary: "Opt-out was recorded. Future marketing messages are blocked.",
    whatHappened: "Opt-out was recorded. Future marketing messages are blocked.",
    actionNeeded: "Do not send marketing messages to this contact.",
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
      suppressionReason: readRecordText(row, ["opt_out_keyword"]) ?? readRecordText(payload, ["opt_out_reason", "opt_out_keyword"]) ?? null,
      source: humanizeLabel(readRecordText(row, ["source"]) ?? readRecordText(payload, ["source"]) ?? null),
    },
  });
};

const buildAttributionOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["synced_at", "created_at", "updated_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const sourceLabel = "Attribution signal";
  const trackingConsent = upperText(
    readRecordText(payload, ["tracking_consent_status", "consent_status"]) ?? readRecordText(row, ["tracking_consent_status", "consent_status"]) ?? null,
  );
  const attributionEvent = humanizeLabel(readRecordText(payload, ["event_name", "attribution_event"]) ?? readRecordText(row, ["event_name", "attribution_event"]) ?? null);

  if (!time) {
    return null;
  }

  const consentMissing = Boolean(trackingConsent && /(NO|REVOKED|DECLINED|BLOCKED|UNKNOWN)/i.test(trackingConsent)) || !trackingConsent;
  const optedOut = Boolean(common.sourceEvent && /(OPT OUT|OPT-OUT|STOP)/i.test(common.sourceEvent ?? ""));

  if (consentMissing || optedOut) {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: optedOut ? "BLOCKED_STOP_OPT_OUT" : "BLOCKED_NO_CONSENT",
      summary: "Attribution was blocked because tracking consent is missing or revoked.",
      whatHappened: "Attribution was blocked because tracking consent is missing or revoked.",
      actionNeeded: "Record consent before identifiable attribution.",
      sourceLabel,
      details: {
        contactIdentifierMasked: contactMasked,
        channel: common.channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType: null,
        consentStatus: trackingConsent,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent,
        verificationStatus: null,
        executionStatus: null,
        suppressionReason: null,
        source: common.sourcePlatform ?? null,
      },
    });
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "ATTRIBUTION_RECORDED",
    summary: "Attribution was recorded safely.",
    whatHappened: "Attribution was recorded safely.",
    actionNeeded: "No action needed. Attribution is only used when tracking consent is allowed.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: trackingConsent,
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: null,
      source: common.sourcePlatform ?? null,
    },
  });
};

const buildPurchaseOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at", "purchased_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const orderIdMasked = normalizeContactIdentifier(common.orderId);
  const sourceLabel = "Purchase event";
  const purchaseValue = normalizeMoney(readRecordText(row, ["purchase_value"]) ?? readRecordText(payload, ["purchase_value"]) ?? null);

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "PURCHASE_RECORDED",
    summary: "Purchase was recorded safely.",
    whatHappened: "Purchase was recorded safely.",
    actionNeeded: "No action needed. Recovery suppression can continue for this order or contact.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: null,
      consentStatus: null,
      orderIdMasked,
      purchaseValue,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus: null,
      suppressionReason: null,
      source: common.sourcePlatform ?? null,
    },
  });
};

const buildRecoveryOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at", "synced_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const sourceLabel = "Recovery suppression";
  const suppressionReason = cleanFreeText(readRecordText(row, ["suppression_reason"]) ?? readRecordText(payload, ["suppression_reason"]) ?? null);

  if (!time) {
    return null;
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "RECOVERY_SUPPRESSED",
    summary: "Recovery suppression was applied safely.",
    whatHappened: "Recovery suppression was applied safely.",
    actionNeeded: "No action needed. Future recovery prompts stay blocked where applicable.",
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
      source: humanizeLabel(readRecordText(row, ["source"]) ?? readRecordText(payload, ["source"]) ?? null),
    },
  });
};

const buildPrivacyRequestOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at", "updated_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const sourceLabel = "Privacy request";
  const requestType = humanizeLabel(readRecordText(row, ["request_type"]) ?? readRecordText(payload, ["request_type"]) ?? null);
  const verificationStatus = upperText(readRecordText(row, ["verification_status"]) ?? readRecordText(payload, ["verification_status"]) ?? null);
  const executionStatus = upperText(readRecordText(row, ["execution_status"]) ?? readRecordText(payload, ["execution_status"]) ?? null);
  const pendingLike = Boolean(verificationStatus && /(PENDING|REVIEW|UNKNOWN|MANUAL)/i.test(verificationStatus)) || Boolean(executionStatus && /(PENDING|REVIEW|QUEUED|IN_PROGRESS|MANUAL)/i.test(executionStatus));
  const blockedLike = Boolean(executionStatus && /(BLOCKED|DENIED|REJECTED|FAILED)/i.test(executionStatus));
  const payloadSource = humanizeLabel(readRecordText(row, ["source_platform"]) ?? readRecordText(payload, ["source_platform"]) ?? null);

  if (!time) {
    return null;
  }

  if (pendingLike) {
    return makeOutcome({
      time,
      result: "MANUAL_ONLY",
      eventType: "MANUAL_ONLY_PRIVACY_REVIEW",
      summary: "Privacy request needs manual review.",
      whatHappened: "Privacy request needs manual review.",
      actionNeeded: "Review the request before any destructive handling.",
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
        source: payloadSource,
      },
    });
  }

  if (blockedLike) {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: "MANUAL_ONLY_PRIVACY_REVIEW",
      summary: "Privacy request was blocked safely.",
      whatHappened: "Privacy request was blocked safely.",
      actionNeeded: "Review the request and confirm the approved privacy path.",
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
        source: payloadSource,
      },
    });
  }

  return makeOutcome({
    time,
    result: "PASS",
    eventType: "PRIVACY_REQUEST_RECORDED",
    summary: "Privacy request was recorded safely.",
    whatHappened: "Privacy request was recorded safely.",
    actionNeeded: "No action needed. Continue through the approved privacy workflow.",
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
      source: payloadSource,
    },
  });
};

const buildPrivacyExecutionOutcome = (row: JsonRecord): G3WorkflowOutcome | null => {
  const payload = readPayload(row);
  const time = readRecordDate(row, ["created_at"]);
  const common = readCommonFields(row, payload);
  const contactMasked = normalizeContactIdentifier(common.contactIdentifier);
  const sourceLabel = "Privacy execution";
  const executionAction = humanizeLabel(readRecordText(row, ["execution_action"]) ?? readRecordText(payload, ["execution_action"]) ?? null);
  const executionStatus = upperText(readRecordText(row, ["execution_status"]) ?? readRecordText(payload, ["execution_status"]) ?? null);
  const blockedLike = Boolean(executionStatus && /(BLOCKED|DENIED|REJECTED|FAILED)/i.test(executionStatus));

  if (!time) {
    return null;
  }

  if (blockedLike) {
    return makeOutcome({
      time,
      result: "BLOCK",
      eventType: "MANUAL_ONLY_PRIVACY_REVIEW",
      summary: "Privacy execution was blocked safely.",
      whatHappened: "Privacy execution was blocked safely.",
      actionNeeded: "Review the request before any destructive handling.",
      sourceLabel,
      details: {
        contactIdentifierMasked: contactMasked,
        channel: common.channel,
        sourcePlatform: common.sourcePlatform,
        sourceEvent: common.sourceEvent,
        requestType: executionAction,
        consentStatus: null,
        orderIdMasked: null,
        purchaseValue: null,
        attributionEvent: null,
        verificationStatus: null,
        executionStatus,
        suppressionReason: null,
        source: humanizeLabel(readRecordText(row, ["source"]) ?? readRecordText(payload, ["source"]) ?? null),
      },
    });
  }

  return makeOutcome({
    time,
    result: "MANUAL_ONLY",
    eventType: "MANUAL_ONLY_PRIVACY_REVIEW",
    summary: "Privacy execution needs manual review.",
    whatHappened: "Privacy execution needs manual review.",
    actionNeeded: "Review the request before any destructive handling.",
    sourceLabel,
    details: {
      contactIdentifierMasked: contactMasked,
      channel: common.channel,
      sourcePlatform: common.sourcePlatform,
      sourceEvent: common.sourceEvent,
      requestType: executionAction,
      consentStatus: null,
      orderIdMasked: null,
      purchaseValue: null,
      attributionEvent: null,
      verificationStatus: null,
      executionStatus,
      suppressionReason: null,
      source: humanizeLabel(readRecordText(row, ["source"]) ?? readRecordText(payload, ["source"]) ?? null),
    },
  });
};

const queryRows = async (table: string, orderKey: string, limit = 10) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .order(orderKey, { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data as JsonRecord[];
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
    const [consentRows, optOutRows, purchaseRows, privacyRows, privacyExecutionRows, recoveryRows] = await Promise.all([
      queryRows(G3_TABLES.consentSync, "synced_at"),
      queryRows(G3_TABLES.optOutSync, "synced_at"),
      queryRows(G3_TABLES.purchaseEvents, "created_at"),
      queryRows(G3_TABLES.privacyRequests, "created_at"),
      queryRows(G3_TABLES.privacyExecutions, "created_at"),
      queryRows(G3_TABLES.recoverySuppression, "created_at"),
    ]);

    const outcomes = [
      ...consentRows.map((row) => buildConsentOutcome(row)),
      ...optOutRows.map((row) => buildOptOutOutcome(row)),
      ...purchaseRows.map((row) => buildPurchaseOutcome(row)),
      ...privacyRows.map((row) => buildPrivacyRequestOutcome(row)),
      ...privacyExecutionRows.map((row) => buildPrivacyExecutionOutcome(row)),
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

    const recentOutcomes = deduped.slice(0, 10);
    const latestOutcome = recentOutcomes[0] ?? null;
    const counts = {
      totalEvents: recentOutcomes.length,
      consentEvents: recentOutcomes.filter((outcome) => outcome.eventType === "CONSENT_RECORDED" || outcome.eventType === "BLOCKED_NO_CONSENT" || outcome.eventType === "BLOCKED_STOP_OPT_OUT").length,
      optOutEvents: recentOutcomes.filter((outcome) => outcome.eventType === "OPT_OUT_RECORDED" || outcome.eventType === "BLOCKED_STOP_OPT_OUT").length,
      attributionEvents: recentOutcomes.filter((outcome) => outcome.eventType === "ATTRIBUTION_RECORDED" || outcome.eventType === "BLOCKED_NO_CONSENT" || outcome.eventType === "BLOCKED_STOP_OPT_OUT").length,
      purchaseEvents: recentOutcomes.filter((outcome) => outcome.eventType === "PURCHASE_RECORDED").length,
      recoveryEvents: recentOutcomes.filter((outcome) => outcome.eventType === "RECOVERY_SUPPRESSED").length,
      privacyEvents: recentOutcomes.filter((outcome) => outcome.eventType === "PRIVACY_REQUEST_RECORDED" || outcome.eventType === "MANUAL_ONLY_PRIVACY_REVIEW").length,
      blockedEvents: recentOutcomes.filter((outcome) => outcome.result === "BLOCK").length,
      manualReviewEvents: recentOutcomes.filter((outcome) => outcome.result === "MANUAL_ONLY").length,
      passEvents: recentOutcomes.filter((outcome) => outcome.result === "PASS").length,
    };

    const status = latestOutcome?.result ?? "NOT_RUN_YET";
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
      message: latestOutcome ? "G3 event history loaded safely." : G3_EMPTY_COPY,
      counts,
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
