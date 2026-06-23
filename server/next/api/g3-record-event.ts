import "server-only";

import { randomUUID } from "node:crypto";

import { humanizeReasonText } from "@/lib/admin/workflows";
import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config";

export type G3RecordEventType =
  | "CONSENT_RECORDED"
  | "OPT_OUT_RECORDED"
  | "ATTRIBUTION_RECORDED"
  | "PURCHASE_RECORDED"
  | "PRIVACY_REQUEST_RECORDED";

export type G3RecordEventInput = {
  eventType: G3RecordEventType;
  contactIdentifier: string;
  channel?: string | null;
  consentStatus?: string | null;
  source?: string | null;
  consentText?: string | null;
  workflowGroup?: string | null;
  workflowId?: string | null;
  optOutReason?: string | null;
  orderId?: string | null;
  purchaseValue?: number | null;
  currency?: string | null;
  requestType?: string | null;
  attributionEvent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  metaEventId?: string | null;
};

export type G3RecordEventResponse = {
  status: "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";
  message: string;
  action_needed: string;
  handled_at: string;
  request_id: string;
  event_type: G3RecordEventType;
  summary: string;
  contact_identifier_masked: string | null;
};

export type G3RecordEventResult = {
  httpStatus: number;
  body: G3RecordEventResponse;
};

const G3_CONNECTED_MESSAGE =
  "G3 consent logging is not connected yet. Connect the G3 endpoint or check the server logs.";
const G3_CONNECTED_ACTION = "Connect the G3 endpoint.";
const G3_MISSING_IDENTIFIER_MESSAGE = "Blocked safely because the contact identifier was missing.";
const G3_MISSING_IDENTIFIER_ACTION = "Add a valid email, phone, or customer ID before recording consent.";
const G3_OPT_OUT_MESSAGE = "Opt-out was recorded. Future marketing messages are blocked.";
const G3_OPT_OUT_ACTION = "Do not send marketing messages to this contact.";
const G3_ATTRIBUTION_BLOCK_MESSAGE = "Blocked safely because tracking consent is missing or revoked.";
const G3_ATTRIBUTION_ACTION = "Record consent before identifiable attribution.";
const G3_PURCHASE_MESSAGE = "Purchase was recorded safely.";
const G3_PURCHASE_ACTION = "No action needed. Recovery suppression can continue for this order or contact.";
const G3_PRIVACY_MESSAGE = "Privacy request recorded for manual review.";
const G3_PRIVACY_ACTION = "Review the request before any destructive handling.";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const upperText = (value: unknown) => normalizeText(value)?.toUpperCase() ?? null;

const humanizeLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const maskContactIdentifier = (value: string | null) => {
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

    return `${localPart.slice(0, 2)}***@${domainPart}`;
  }

  if (/^\+?\d[\d\s()-]{5,}$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length > 4 ? `${"*".repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}` : "***";
  }

  if (/^cus_[a-z0-9]+$/i.test(trimmed)) {
    return `cus_***${trimmed.slice(-3)}`;
  }

  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 1)}***`;
  }

  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
};

const buildTargetUrl = (eventType: G3RecordEventType) => {
  switch (eventType) {
    case "CONSENT_RECORDED":
      return env.cevonneN8nConsentIngestUrl;
    case "OPT_OUT_RECORDED":
      return env.cevonneN8nOptOutUrl;
    case "ATTRIBUTION_RECORDED":
      return env.cevonneN8nAttributionEventUrl;
    case "PURCHASE_RECORDED":
      return env.cevonneN8nPurchaseEventUrl;
    case "PRIVACY_REQUEST_RECORDED":
      return env.cevonneN8nPrivacyRequestUrl;
    default:
      return "";
  }
};

const buildBasePayload = (input: G3RecordEventInput, requestId: string) => {
  const source = normalizeText(input.source) || "ADMIN_TEST";

  return {
    workflow_group: input.workflowGroup || "G3",
    workflow_id: input.workflowId || "G3",
    event_type: input.eventType,
    source_platform: "ADMIN",
    source_event: source,
    source,
    actor: "admin",
    requested_by: "admin",
    request_id: requestId,
    dry_run: env.cevonneN8nDryRun,
    contact_id: input.contactIdentifier,
    channel: normalizeText(input.channel),
  };
};

const buildContactFields = (contactIdentifier: string) => {
  if (contactIdentifier.includes("@")) {
    return {
      contact_id: contactIdentifier,
      email: contactIdentifier,
      phone: null,
      external_contact_id: null,
    };
  }

  if (/^\+?\d[\d\s()-]{5,}$/.test(contactIdentifier)) {
    return {
      contact_id: contactIdentifier,
      email: null,
      phone: contactIdentifier,
      external_contact_id: null,
    };
  }

  return {
    contact_id: contactIdentifier,
    email: null,
    phone: null,
    external_contact_id: null,
  };
};

const buildErrorResponse = (status: number, message: string, actionNeeded: string, eventType: G3RecordEventType) => ({
  httpStatus: status,
  body: {
    status: "ERROR" as const,
    message,
    action_needed: actionNeeded,
    handled_at: new Date().toISOString(),
    request_id: randomUUID(),
    event_type: eventType,
    summary: message,
    contact_identifier_masked: null,
  },
});

const buildBlockResponse = (message: string, actionNeeded: string, eventType: G3RecordEventType, contactIdentifier: string) => ({
  httpStatus: 200,
  body: {
    status: "BLOCK" as const,
    message,
    action_needed: actionNeeded,
    handled_at: new Date().toISOString(),
    request_id: randomUUID(),
    event_type: eventType,
    summary: message,
    contact_identifier_masked: maskContactIdentifier(contactIdentifier),
  },
});

const buildManualResponse = (message: string, actionNeeded: string, eventType: G3RecordEventType, contactIdentifier: string) => ({
  httpStatus: 200,
  body: {
    status: "MANUAL_ONLY" as const,
    message,
    action_needed: actionNeeded,
    handled_at: new Date().toISOString(),
    request_id: randomUUID(),
    event_type: eventType,
    summary: message,
    contact_identifier_masked: maskContactIdentifier(contactIdentifier),
  },
});

const buildPassResponse = (message: string, actionNeeded: string, eventType: G3RecordEventType, contactIdentifier: string, requestId: string, handledAt: string) => ({
  httpStatus: 200,
  body: {
    status: "PASS" as const,
    message,
    action_needed: actionNeeded,
    handled_at: handledAt,
    request_id: requestId,
    event_type: eventType,
    summary: message,
    contact_identifier_masked: maskContactIdentifier(contactIdentifier),
  },
});

const getFailureReason = (webhookResponse: Awaited<ReturnType<typeof postN8nWebhook>>) => {
  const candidates = [webhookResponse.fail_reason, ...(Array.isArray(webhookResponse.failure_reasons) ? webhookResponse.failure_reasons : []), webhookResponse.message];

  for (const candidate of candidates) {
    const reason = humanizeReasonText(candidate);
    if (reason) {
      return reason;
    }
  }

  return null;
};

const isConnectedIssue = (webhookResponse: Awaited<ReturnType<typeof postN8nWebhook>>) => {
  const responseText = [
    webhookResponse.message,
    webhookResponse.response_text,
    typeof webhookResponse.http_status === "number" ? String(webhookResponse.http_status) : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    webhookResponse.http_status === 404 ||
    webhookResponse.http_status === 410 ||
    responseText.includes("not registered") ||
    responseText.includes("missing n8n webhook configuration") ||
    responseText.includes("invalid n8n webhook url") ||
    responseText.includes("webhook is not registered") ||
    responseText.includes("webhook not registered")
  );
};

export async function recordG3Event(input: G3RecordEventInput): Promise<G3RecordEventResult> {
  const contactIdentifier = normalizeText(input.contactIdentifier);
  const eventType = input.eventType;

  if (!contactIdentifier) {
    return buildBlockResponse(G3_MISSING_IDENTIFIER_MESSAGE, G3_MISSING_IDENTIFIER_ACTION, eventType, "");
  }

  const channel = normalizeText(input.channel);
  const consentStatus = upperText(input.consentStatus);
  const requestType = upperText(input.requestType);
  const orderId = normalizeText(input.orderId);
  const attributionEvent = normalizeText(input.attributionEvent);
  const utmSource = normalizeText(input.utmSource);
  const utmMedium = normalizeText(input.utmMedium);
  const utmCampaign = normalizeText(input.utmCampaign);
  const gclid = normalizeText(input.gclid);
  const fbclid = normalizeText(input.fbclid);
  const metaEventId = normalizeText(input.metaEventId);

  if ((eventType === "CONSENT_RECORDED" || eventType === "OPT_OUT_RECORDED" || eventType === "ATTRIBUTION_RECORDED") && !channel) {
    return buildBlockResponse("Select a channel before recording this event.", "Choose a channel and try again.", eventType, contactIdentifier);
  }

  if (eventType === "CONSENT_RECORDED") {
    if (consentStatus && consentStatus !== "YES" && !/(REVIEW|PENDING|UNKNOWN|MANUAL)/i.test(consentStatus)) {
      return buildBlockResponse("Use Record Opt-Out for no-consent or stop requests.", G3_OPT_OUT_ACTION, eventType, contactIdentifier);
    }
  }

  if (eventType === "ATTRIBUTION_RECORDED") {
    const hasAttributionSignal = Boolean(attributionEvent || utmSource || utmMedium || utmCampaign || gclid || fbclid || metaEventId);
    if (consentStatus !== "YES") {
      return buildBlockResponse(G3_ATTRIBUTION_BLOCK_MESSAGE, G3_ATTRIBUTION_ACTION, eventType, contactIdentifier);
    }

    if (!hasAttributionSignal) {
      return buildBlockResponse("Add an attribution source before submitting.", "Include a campaign, UTM, or click identifier.", eventType, contactIdentifier);
    }
  }

  if (eventType === "PURCHASE_RECORDED" && !orderId) {
    return buildBlockResponse("Add an order ID before recording a purchase.", "Include an order ID and try again.", eventType, contactIdentifier);
  }

  if (eventType === "PRIVACY_REQUEST_RECORDED" && !requestType) {
    return buildBlockResponse("Choose a privacy request type before submitting.", "Select ACCESS, DELETE, CORRECTION, or EXPORT.", eventType, contactIdentifier);
  }

  const targetUrl = buildTargetUrl(eventType);
  if (!targetUrl) {
    return buildErrorResponse(503, G3_CONNECTED_MESSAGE, G3_CONNECTED_ACTION, eventType);
  }

  const requestId = randomUUID();
  const sentAt = new Date().toISOString();
  const payload = {
    ...buildBasePayload(input, requestId),
    ...buildContactFields(contactIdentifier),
  };

  const webhookPayload =
    eventType === "CONSENT_RECORDED"
      ? {
          ...payload,
          event_type: "CONSENT_INGEST",
          consent_status: consentStatus || "YES",
          explicit_consent: consentStatus ? consentStatus === "YES" : true,
          consent_text: normalizeText(input.consentText),
          privacy_policy_version: env.cevonnePrivacyPolicyVersion,
        }
      : eventType === "OPT_OUT_RECORDED"
        ? {
            ...payload,
            event_type: "OPT_OUT",
            opt_out_reason: normalizeText(input.optOutReason) || "admin_request",
          }
        : eventType === "ATTRIBUTION_RECORDED"
          ? {
              ...payload,
              event_type: "ATTRIBUTION_EVENT",
              event_name: attributionEvent || "ADMIN_TEST",
              tracking_consent_status: "YES",
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              gclid,
              fbclid,
              meta_event_id: metaEventId,
            }
          : eventType === "PURCHASE_RECORDED"
            ? {
                ...payload,
                event_type: "PURCHASE_EVENT",
                order_id: orderId,
                purchase_value: input.purchaseValue ?? null,
                currency: normalizeText(input.currency)?.toUpperCase() || "INR",
                items: [],
                recovery_suppressed: true,
                source_platform: "ADMIN",
              }
            : {
                ...payload,
                event_type: "PRIVACY_REQUEST",
                request_type: requestType,
                verification_status: "PENDING",
                privacy_policy_version: env.cevonnePrivacyPolicyVersion,
              };

  const webhookResponse = await postN8nWebhook({
    url: targetUrl,
    payload: webhookPayload,
    requestId,
    dryRun: env.cevonneN8nDryRun,
  });

  if (webhookResponse.status === "ERROR") {
    if (isConnectedIssue(webhookResponse)) {
      return buildErrorResponse(503, G3_CONNECTED_MESSAGE, G3_CONNECTED_ACTION, eventType);
    }

    return buildErrorResponse(503, G3_CONNECTED_MESSAGE, G3_CONNECTED_ACTION, eventType);
  }

  const handledAt = webhookResponse.handled_at || sentAt;
  const friendlyReason = getFailureReason(webhookResponse);

  if (eventType === "CONSENT_RECORDED") {
    if (webhookResponse.status === "MANUAL_ONLY") {
      return buildManualResponse("Consent needs manual review.", "Review the consent record before using it.", eventType, contactIdentifier);
    }

    if (webhookResponse.status === "BLOCK") {
      return buildBlockResponse(friendlyReason || "Consent was blocked safely.", friendlyReason || "Review the consent record before using it.", eventType, contactIdentifier);
    }

    return buildPassResponse(
      `Consent was recorded safely${channel ? ` for ${humanizeLabel(channel)}` : ""}.`,
      "No action needed. This contact can be used only within the allowed consent rules.",
      eventType,
      contactIdentifier,
      requestId,
      handledAt,
    );
  }

  if (eventType === "OPT_OUT_RECORDED") {
    return buildBlockResponse(G3_OPT_OUT_MESSAGE, G3_OPT_OUT_ACTION, eventType, contactIdentifier);
  }

  if (eventType === "ATTRIBUTION_RECORDED") {
    if (webhookResponse.status === "MANUAL_ONLY") {
      return buildManualResponse("Attribution needs manual review.", G3_ATTRIBUTION_ACTION, eventType, contactIdentifier);
    }

    if (webhookResponse.status === "BLOCK") {
      return buildBlockResponse(friendlyReason || G3_ATTRIBUTION_BLOCK_MESSAGE, G3_ATTRIBUTION_ACTION, eventType, contactIdentifier);
    }

    return buildPassResponse("Attribution was recorded safely.", "No action needed. Attribution is only used when tracking consent is allowed.", eventType, contactIdentifier, requestId, handledAt);
  }

  if (eventType === "PURCHASE_RECORDED") {
    if (webhookResponse.status === "MANUAL_ONLY") {
      return buildManualResponse("Purchase needs manual review.", G3_PURCHASE_ACTION, eventType, contactIdentifier);
    }

    if (webhookResponse.status === "BLOCK") {
      return buildBlockResponse(friendlyReason || "Purchase was blocked safely.", G3_PURCHASE_ACTION, eventType, contactIdentifier);
    }

    return buildPassResponse(G3_PURCHASE_MESSAGE, G3_PURCHASE_ACTION, eventType, contactIdentifier, requestId, handledAt);
  }

  if (webhookResponse.status === "BLOCK") {
    return buildBlockResponse(friendlyReason || G3_PRIVACY_MESSAGE, G3_PRIVACY_ACTION, eventType, contactIdentifier);
  }

  return buildManualResponse(G3_PRIVACY_MESSAGE, G3_PRIVACY_ACTION, eventType, contactIdentifier);
}
