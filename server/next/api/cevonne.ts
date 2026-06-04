import "server-only";

import { z } from "zod";

import { env } from "@/server/config";
import { jsonResponse } from "../route-utils";
import { postN8nWebhook } from "@/lib/cevonne/n8nClient";

type CevonneResponseStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";

type CevonneRouteResponse = {
  status: CevonneResponseStatus;
  response_type?: string;
  fail_reason?: string | null;
  failure_reasons?: string[];
  message?: string;
  id?: string;
  recommendation_only?: boolean;
  dry_run?: boolean;
  not_executed?: boolean;
  handled_at?: string;
  [key: string]: unknown;
};

const workflowGroup = "G3";
const baseSource = (env.cevonneSiteSource || "website").trim();
const sourcePlatform = baseSource.toUpperCase();
const actor = baseSource.toLowerCase();
const safeMessage = "We could not complete this automatically. Your request has been received for review or support.";
const manualReviewMessage = "This request requires manual review.";
const temporaryFailureMessage = "We could not complete this automatically right now. Please try again later.";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
};

const requiredString = z.string().trim().min(1);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().trim().email().optional());
const optionalNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    return value;
  },
  z.number().finite().optional(),
);

const yesStatus = z
  .preprocess(emptyToUndefined, z.string().trim().transform((value) => value.toUpperCase()))
  .refine((value) => value === "YES", {
    message: "Value must be YES.",
  });

const consentInputSchema = z
  .object({
    email: optionalEmail,
    phone: optionalString,
    contact_id: optionalString,
    external_contact_id: optionalString,
    user_id: optionalString,
    channel: requiredString.transform((value) => value.toUpperCase()),
    source_event: optionalString,
    explicit_consent: z.literal(true),
    consent_status: z
      .preprocess(emptyToUndefined, z.string().trim().transform((value) => value.toUpperCase()).optional())
      .refine((value) => value === undefined || value === "YES", {
        message: "consent_status must be YES when provided.",
      }),
    utm_source: optionalString,
    utm_medium: optionalString,
    utm_campaign: optionalString,
  })
  .refine(
    (payload) => Boolean(payload.email || payload.phone || payload.contact_id || payload.external_contact_id || payload.user_id),
    {
      message: "At least one identifier is required.",
      path: ["email"],
    },
  );

const optOutInputSchema = z
  .object({
    email: optionalEmail,
    phone: optionalString,
    contact_id: optionalString,
    external_contact_id: optionalString,
    user_id: optionalString,
    channel: requiredString.transform((value) => value.toUpperCase()),
    opt_out_reason: optionalString,
    source_event: optionalString,
  })
  .refine(
    (payload) => Boolean(payload.email || payload.phone || payload.contact_id || payload.external_contact_id || payload.user_id),
    {
      message: "At least one identifier is required.",
      path: ["email"],
    },
  );

const attributionInputSchema = z.object({
  contact_id: optionalString,
  external_contact_id: optionalString,
  user_id: optionalString,
  event_name: requiredString,
  source_event: optionalString,
  tracking_consent_status: yesStatus,
  utm_source: optionalString,
  utm_medium: optionalString,
  utm_campaign: optionalString,
  gclid: optionalString,
  fbclid: optionalString,
  meta_event_id: optionalString,
});

const purchaseItemSchema = z.object({
  sku: optionalString,
  product_id: optionalString,
  quantity: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      if (typeof value === "number") {
        return value;
      }

      return value;
    },
    z.number().int().positive().optional(),
  ),
});

const purchaseInputSchema = z.object({
  order_id: requiredString,
  contact_id: optionalString,
  external_contact_id: optionalString,
  user_id: optionalString,
  email: optionalEmail,
  phone: optionalString,
  purchase_value: optionalNumber,
  currency: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(),
  ),
  items: z.array(purchaseItemSchema).optional(),
  source_event: optionalString,
});

const privacyRequestInputSchema = z
  .object({
    request_type: requiredString.transform((value) => value.toUpperCase()),
    email: optionalEmail,
    phone: optionalString,
    contact_id: optionalString,
    external_contact_id: optionalString,
    user_id: optionalString,
    verification_status: optionalString,
    source_event: optionalString,
  })
  .refine(
    (payload) => Boolean(payload.email || payload.phone || payload.contact_id || payload.external_contact_id || payload.user_id),
    {
      message: "At least one identifier is required.",
      path: ["email"],
    },
  );

const buildBasePayload = () => ({
  workflow_group: workflowGroup,
  source_platform: sourcePlatform,
  actor,
  dry_run: env.cevonneN8nDryRun,
});

const routeResponse = (body: CevonneRouteResponse) => jsonResponse(body, 200);

const blockedResponse = (failReason: string, extra: Record<string, unknown> = {}) =>
  routeResponse({
    status: "BLOCK",
    message: safeMessage,
    fail_reason: failReason,
    not_executed: true,
    ...extra,
  });

const manualOnlyResponse = (message = manualReviewMessage, extra: Record<string, unknown> = {}) =>
  routeResponse({
    status: "MANUAL_ONLY",
    message,
    not_executed: true,
    ...extra,
  });

const errorResponse = (message: string, extra: Record<string, unknown> = {}) =>
  routeResponse({
    status: "ERROR",
    message,
    not_executed: true,
    ...extra,
  });

const parseValidationError = (error: z.ZodError) => {
  const issues = error.issues.map((issue) => issue.message);
  return {
    failReason: issues[0] || "Invalid payload",
    failureReasons: issues.length > 1 ? issues : undefined,
  };
};

const readBody = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const dispatchValidatedRoute = async <T extends Record<string, unknown>>(
  request: Request,
  schema: z.ZodType<T>,
  webhookUrl: string,
  buildPayload: (body: T) => Record<string, unknown>,
  validationErrorMessage = "Invalid payload",
) => {
  if (!env.cevonneN8nEnabled) {
    return manualOnlyResponse("Automation is temporarily disabled.");
  }

  const body = await readBody(request);
  if (!isRecord(body)) {
    return blockedResponse(validationErrorMessage);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const { failReason, failureReasons } = parseValidationError(parsed.error);
    return blockedResponse(failReason || validationErrorMessage, {
      failure_reasons: failureReasons,
    });
  }

  const n8nResponse = await postN8nWebhook(webhookUrl, {
    ...buildBasePayload(),
    ...buildPayload(parsed.data),
  });

  if (n8nResponse.status === "ERROR") {
    return routeResponse({
      ...n8nResponse,
      message: n8nResponse.message || temporaryFailureMessage,
    });
  }

  return routeResponse(n8nResponse);
};

export const dispatchCevonneConsentRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    consentInputSchema,
    env.cevonneN8nConsentIngestUrl,
    (body) => ({
      event_type: "CONSENT_INGEST",
      source_event: body.source_event || "newsletter_signup",
      email: body.email ?? null,
      phone: body.phone ?? null,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      channel: body.channel,
      consent_status: "YES",
      explicit_consent: true,
      privacy_policy_version: env.cevonnePrivacyPolicyVersion,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
    }),
  );
};

export const dispatchCevonneOptOutRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    optOutInputSchema,
    env.cevonneN8nOptOutUrl,
    (body) => ({
      event_type: "OPT_OUT",
      source_event: body.source_event || "user_unsubscribe",
      email: body.email ?? null,
      phone: body.phone ?? null,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      channel: body.channel,
      opt_out_reason: body.opt_out_reason || "user_unsubscribe",
    }),
  );
};

export const dispatchCevonneAttributionRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    attributionInputSchema,
    env.cevonneN8nAttributionEventUrl,
    (body) => ({
      event_type: "ATTRIBUTION_EVENT",
      source_event: body.source_event || body.event_name,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      event_name: body.event_name,
      tracking_consent_status: "YES",
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      gclid: body.gclid ?? null,
      fbclid: body.fbclid ?? null,
      meta_event_id: body.meta_event_id ?? null,
    }),
    "Tracking consent is required.",
  );
};

export const dispatchCevonnePurchaseRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    purchaseInputSchema,
    env.cevonneN8nPurchaseEventUrl,
    (body) => ({
      event_type: "PURCHASE_EVENT",
      source_event: body.source_event || "checkout_success",
      order_id: body.order_id,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      purchase_value: body.purchase_value ?? null,
      currency: body.currency ?? null,
      items: body.items ?? [],
      privacy_policy_version: env.cevonnePrivacyPolicyVersion,
      event_id: body.order_id,
    }),
  );
};

export const dispatchCevonnePrivacyRequestRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    privacyRequestInputSchema,
    env.cevonneN8nPrivacyRequestUrl,
    (body) => ({
      event_type: "PRIVACY_REQUEST",
      source_event: body.source_event || "privacy_request_form",
      request_type: body.request_type,
      email: body.email ?? null,
      phone: body.phone ?? null,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      verification_status: body.verification_status || "PENDING",
      privacy_policy_version: env.cevonnePrivacyPolicyVersion,
    }),
    "A privacy request needs at least one identifier.",
  );
};

export const dispatchCevonneManualOnlyResponse = manualOnlyResponse;
export const dispatchCevonneBlockedResponse = blockedResponse;
export const dispatchCevonneErrorResponse = errorResponse;
