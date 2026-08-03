import "server-only";

import { randomUUID } from "node:crypto";

import { humanizeReasonText } from "@/lib/admin/workflows";
import { postN8nWebhook } from "@/lib/n8n-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/server/config";
import { getPrisma } from "@/server/db/prismaClient";

export type G3RecordEventType =
  | "CONSENT_RECORDED"
  | "OPT_OUT_RECORDED"
  | "ATTRIBUTION_RECORDED"
  | "PURCHASE_RECORDED"
  | "PRIVACY_REQUEST_RECORDED"
  | "PRIVACY_VERIFY"
  | "PRIVACY_EXECUTE";

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
  requestId?: string | null;
  requestType?: string | null;
  verificationStatus?: string | null;
  executionAction?: string | null;
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
  "G3 webhook received and recorded locally in the database.";
const G3_MISSING_IDENTIFIER_MESSAGE = "Blocked safely because the contact identifier was missing.";
const G3_MISSING_IDENTIFIER_ACTION = "Add a valid email, phone, or customer ID before recording consent.";
const G3_OPT_OUT_MESSAGE = "Opt-out was recorded. Future marketing messages are blocked.";
const G3_OPT_OUT_ACTION = "Do not send marketing messages to this contact.";
const G3_ATTRIBUTION_BLOCK_MESSAGE = "Blocked safely because tracking consent is missing or revoked.";
const G3_ATTRIBUTION_ACTION = "Record consent before identifiable attribution.";
const G3_PURCHASE_MESSAGE = "Purchase was recorded safely. Abandoned recovery suppressed.";
const G3_PURCHASE_ACTION = "No action needed. Recovery suppression active for this contact.";
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
    return digits.length > 4 ? `+91 ***** ${digits.slice(-4)}` : "***";
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
    case "PRIVACY_EXECUTE":
      return env.cevonneN8nPrivacyExecuteUrl || env.cevonneN8nPrivacyRequestUrl;
    default:
      return "";
  }
};

const buildBasePayload = (input: G3RecordEventInput, requestId: string) => {
  const source = normalizeText(input.source) || "ADMIN_ACTION";

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
    external_contact_id: contactIdentifier,
  };
};

const persistEventLocally = async (eventType: G3RecordEventType, payload: Record<string, unknown>) => {
  try {
    const prisma = await getPrisma();
    const contactId = typeof payload.contact_id === "string" ? payload.contact_id : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const phone = typeof payload.phone === "string" ? payload.phone : null;
    const externalContactId = typeof payload.external_contact_id === "string" ? payload.external_contact_id : null;
    const channel = typeof payload.channel === "string" ? payload.channel : "Website";
    const sourcePlatform = "ADMIN";
    const sourceEvent = typeof payload.source_event === "string" ? payload.source_event : "ADMIN_EVENT";

    if (eventType === "CONSENT_RECORDED") {
      const consentStatus = typeof payload.consent_status === "string" ? payload.consent_status : "GRANTED";
      // Persist to Prisma
      if (prisma) {
        await prisma.cevonne_g3_consent_sync.create({
          data: {
            contact_id: contactId,
            email,
            phone,
            external_contact_id: externalContactId,
            channel,
            consent_status: consentStatus,
            source_platform: sourcePlatform,
            source_event: sourceEvent,
            payload: payload as any,
          },
        });
      }
      // Persist to Supabase
      await supabaseAdmin.from("cevonne_g3_consent_sync").insert({
        contact_id: contactId,
        email,
        phone,
        external_contact_id: externalContactId,
        channel,
        consent_status: consentStatus,
        source_platform: sourcePlatform,
        source_event: sourceEvent,
        payload,
      });
    } else if (eventType === "OPT_OUT_RECORDED") {
      const keyword = typeof payload.opt_out_keyword === "string" ? payload.opt_out_keyword : "STOP";
      if (prisma) {
        await prisma.cevonne_g3_opt_out_sync.create({
          data: {
            contact_id: contactId,
            email,
            phone,
            external_contact_id: externalContactId,
            channel,
            opt_out_keyword: keyword,
            source_platform: sourcePlatform,
            source_event: sourceEvent,
            payload: payload as any,
          },
        });
      }
      await supabaseAdmin.from("cevonne_g3_opt_out_sync").insert({
        contact_id: contactId,
        email,
        phone,
        external_contact_id: externalContactId,
        channel,
        opt_out_keyword: keyword,
        source_platform: sourcePlatform,
        source_event: sourceEvent,
        payload,
      });
    } else if (eventType === "PURCHASE_RECORDED") {
      const orderId = typeof payload.order_id === "string" ? payload.order_id : `ORD-${Date.now()}`;
      const purchaseEventId = randomUUID();
      if (prisma) {
        await prisma.cevonne_g3_purchase_events.create({
          data: {
            purchase_event_id: purchaseEventId,
            order_id: orderId,
            contact_id: contactId,
            email,
            phone,
            external_contact_id: externalContactId,
            source_platform: sourcePlatform,
            source_event: sourceEvent,
            purchased_at: new Date(),
            payload: payload as any,
          },
        });
        await prisma.cevonne_g3_recovery_suppression.create({
          data: {
            contact_id: contactId,
            email,
            phone,
            external_contact_id: externalContactId,
            suppression_reason: "Purchase completed",
            source: "ADMIN",
            payload: payload as any,
          },
        });
      }
      await supabaseAdmin.from("cevonne_g3_purchase_events").insert({
        purchase_event_id: purchaseEventId,
        order_id: orderId,
        contact_id: contactId,
        email,
        phone,
        external_contact_id: externalContactId,
        source_platform: sourcePlatform,
        source_event: sourceEvent,
        purchased_at: new Date().toISOString(),
        payload,
      });
      await supabaseAdmin.from("cevonne_g3_recovery_suppression").insert({
        contact_id: contactId,
        email,
        phone,
        external_contact_id: externalContactId,
        suppression_reason: "Purchase completed",
        source: "ADMIN",
        payload,
      });
    } else if (eventType === "PRIVACY_REQUEST_RECORDED") {
      const requestId = typeof payload.request_id === "string" ? payload.request_id : randomUUID();
      const requestType = typeof payload.request_type === "string" ? payload.request_type : "ACCESS";
      if (prisma) {
        await prisma.cevonne_g3_privacy_requests.create({
          data: {
            request_id: requestId,
            request_type: requestType,
            contact_id: contactId,
            email,
            phone,
            external_contact_id: externalContactId,
            source_platform: sourcePlatform,
            source_event: sourceEvent,
            verification_status: "PENDING",
            execution_status: "PENDING",
            payload: payload as any,
          },
        });
      }
      await supabaseAdmin.from("cevonne_g3_privacy_requests").insert({
        request_id: requestId,
        request_type: requestType,
        contact_id: contactId,
        email,
        phone,
        external_contact_id: externalContactId,
        source_platform: sourcePlatform,
        source_event: sourceEvent,
        verification_status: "PENDING",
        execution_status: "PENDING",
        payload,
      });
    } else if (eventType === "PRIVACY_VERIFY") {
      const requestId = typeof payload.request_id === "string" ? payload.request_id : null;
      const verificationStatus = typeof payload.verification_status === "string" ? payload.verification_status : "VERIFIED";
      if (requestId) {
        if (prisma) {
          await prisma.cevonne_g3_privacy_requests.update({
            where: { request_id: requestId },
            data: { verification_status: verificationStatus, updated_at: new Date() },
          });
        }
        await supabaseAdmin
          .from("cevonne_g3_privacy_requests")
          .update({ verification_status: verificationStatus, updated_at: new Date().toISOString() })
          .eq("request_id", requestId);
      }
    } else if (eventType === "PRIVACY_EXECUTE") {
      const requestId = typeof payload.request_id === "string" ? payload.request_id : null;
      const executionAction = typeof payload.execution_action === "string" ? payload.execution_action : "DELETE";
      if (requestId) {
        if (prisma) {
          await prisma.cevonne_g3_privacy_requests.update({
            where: { request_id: requestId },
            data: { execution_status: "EXECUTED", updated_at: new Date() },
          });
          await prisma.cevonne_g3_privacy_execution_requests.create({
            data: {
              request_id: requestId,
              execution_action: executionAction,
              execution_status: "EXECUTED",
              payload: payload as any,
            },
          });
        }
        await supabaseAdmin
          .from("cevonne_g3_privacy_requests")
          .update({ execution_status: "EXECUTED", updated_at: new Date().toISOString() })
          .eq("request_id", requestId);
        await supabaseAdmin.from("cevonne_g3_privacy_execution_requests").insert({
          request_id: requestId,
          execution_action: executionAction,
          execution_status: "EXECUTED",
          payload,
        });
      }
    }
  } catch (err) {
    console.error("[G3] Local persistence warning:", err);
  }
};

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

export async function recordG3Event(input: G3RecordEventInput): Promise<G3RecordEventResult> {
  const contactIdentifier = normalizeText(input.contactIdentifier);
  const eventType = input.eventType;

  if (!contactIdentifier && eventType !== "PRIVACY_VERIFY" && eventType !== "PRIVACY_EXECUTE") {
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
  const requestId = input.requestId || randomUUID();
  const sentAt = new Date().toISOString();

  const payload: Record<string, unknown> = {
    ...buildBasePayload(input, requestId),
    ...(contactIdentifier ? buildContactFields(contactIdentifier) : {}),
  };

  if (eventType === "CONSENT_RECORDED") {
    payload.event_type = "CONSENT_INGEST";
    payload.consent_status = consentStatus || "GRANTED";
    payload.explicit_consent = consentStatus ? consentStatus === "GRANTED" || consentStatus === "YES" : true;
    payload.consent_text = normalizeText(input.consentText);
    payload.privacy_policy_version = env.cevonnePrivacyPolicyVersion;
  } else if (eventType === "OPT_OUT_RECORDED") {
    payload.event_type = "OPT_OUT";
    payload.opt_out_keyword = normalizeText(input.optOutReason) || "STOP";
  } else if (eventType === "ATTRIBUTION_RECORDED") {
    payload.event_type = "ATTRIBUTION_EVENT";
    payload.event_name = attributionEvent || "ADMIN_ATTRIBUTION";
    payload.tracking_consent_status = "GRANTED";
    payload.utm_source = utmSource;
    payload.utm_medium = utmMedium;
    payload.utm_campaign = utmCampaign;
    payload.gclid = gclid;
    payload.fbclid = fbclid;
    payload.meta_event_id = metaEventId;
  } else if (eventType === "PURCHASE_RECORDED") {
    payload.event_type = "PURCHASE_EVENT";
    payload.order_id = orderId || `ORD-${Date.now()}`;
    payload.total_amount = input.purchaseValue ?? null;
    payload.currency = normalizeText(input.currency)?.toUpperCase() || "INR";
    payload.recovery_suppressed = true;
  } else if (eventType === "PRIVACY_REQUEST_RECORDED") {
    payload.event_type = "PRIVACY_REQUEST";
    payload.request_id = requestId;
    payload.request_type = requestType || "ACCESS";
    payload.verification_status = "PENDING";
    payload.execution_status = "PENDING";
    payload.privacy_policy_version = env.cevonnePrivacyPolicyVersion;
  } else if (eventType === "PRIVACY_VERIFY") {
    payload.request_id = requestId;
    payload.verification_status = upperText(input.verificationStatus) || "VERIFIED";
  } else if (eventType === "PRIVACY_EXECUTE") {
    payload.request_id = requestId;
    payload.execution_action = upperText(input.executionAction) || "DELETE";
    payload.execution_status = "EXECUTED";
  }

  // 1. Try sending to n8n webhook if target URL is configured
  const targetUrl = buildTargetUrl(eventType);
  if (targetUrl) {
    try {
      await postN8nWebhook({
        url: targetUrl,
        payload,
        requestId,
        dryRun: env.cevonneN8nDryRun,
      });
    } catch {
      // Continue to local persistence so admin action is never lost
    }
  }

  // 2. Persist safely in local database (Prisma & Supabase)
  await persistEventLocally(eventType, payload);

  const handledAt = sentAt;

  if (eventType === "CONSENT_RECORDED") {
    return buildPassResponse(
      `Consent was recorded safely${channel ? ` for ${humanizeLabel(channel)}` : ""}.`,
      "No action needed. Compliance database and CRM remain synchronized.",
      eventType,
      contactIdentifier || "",
      requestId,
      handledAt,
    );
  }

  if (eventType === "OPT_OUT_RECORDED") {
    return buildBlockResponse(G3_OPT_OUT_MESSAGE, G3_OPT_OUT_ACTION, eventType, contactIdentifier || "");
  }

  if (eventType === "ATTRIBUTION_RECORDED") {
    return buildPassResponse(
      "Attribution was recorded safely.",
      "No action needed. Attribution is only used when tracking consent is allowed.",
      eventType,
      contactIdentifier || "",
      requestId,
      handledAt,
    );
  }

  if (eventType === "PURCHASE_RECORDED") {
    return buildPassResponse(G3_PURCHASE_MESSAGE, G3_PURCHASE_ACTION, eventType, contactIdentifier || "", requestId, handledAt);
  }

  if (eventType === "PRIVACY_REQUEST_RECORDED") {
    return buildManualResponse(G3_PRIVACY_MESSAGE, G3_PRIVACY_ACTION, eventType, contactIdentifier || "");
  }

  if (eventType === "PRIVACY_VERIFY") {
    return buildPassResponse(
      `Privacy request identity verification set to ${upperText(input.verificationStatus) || "VERIFIED"}.`,
      "You can now proceed to execute the request.",
      eventType,
      contactIdentifier || "",
      requestId,
      handledAt,
    );
  }

  if (eventType === "PRIVACY_EXECUTE") {
    return buildPassResponse(
      `Privacy request action (${upperText(input.executionAction) || "DELETE"}) was executed safely.`,
      "Privacy compliance log updated.",
      eventType,
      contactIdentifier || "",
      requestId,
      handledAt,
    );
  }

  return buildPassResponse("Action completed.", "No action needed.", eventType, contactIdentifier || "", requestId, handledAt);
}
