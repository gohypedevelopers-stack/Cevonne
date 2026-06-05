import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  CEVONNE_MANUAL_REVIEW_MESSAGE,
  CEVONNE_SAFE_RESPONSE_MESSAGE,
  CEVONNE_TEMPORARY_FAILURE_MESSAGE,
  handleCevonneN8nResponse,
  type CevonneResponse,
} from "@/lib/cevonne/response";
import {
  type CevonneAdminActionType,
  type CevonneWorkflowStatus,
} from "@/lib/cevonne/admin-model";
import { env } from "@/server/config";
import { getAuthUser, jsonResponse, readJsonBody } from "@/server/next/route-utils";
import { postN8nWebhook } from "@/lib/cevonne/n8nClient";
import {
  recordCevonneAdminAuditLog,
  recordCevonneWorkflowExecution,
} from "@/server/next/api/cevonne-admin-store";

const workflowGroup = "G3";
const baseSource = (env.cevonneSiteSource || "website").trim();
const sourcePlatform = baseSource.toUpperCase();
const actor = baseSource.toLowerCase();
const PUBLIC_ROUTE_RATE_LIMIT_WINDOW_MS = 60_000;
const PUBLIC_ROUTE_RATE_LIMIT_MAX_REQUESTS = 20;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const publicRouteRateLimits = new Map<string, RateLimitBucket>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeMetaValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeMetaValue(item)).join(",");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return "";
};

const normalizeRouteSlug = (routePath: string) =>
  routePath
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cevonne";

const createRouteRequestId = (routePath: string) => `cevonne-${normalizeRouteSlug(routePath)}-${randomUUID()}`;

const buildStableEventId = (routePath: string, parts: Array<unknown>) => {
  const signature = parts.map((part) => normalizeMetaValue(part)).join("|");
  const hash = createHash("sha256").update(signature).digest("hex").slice(0, 24);
  return `cevonne-${normalizeRouteSlug(routePath)}-${hash}`;
};

const buildRouteEnvelope = (routePath: string, requestId: string, eventId: string) => ({
  event_id: eventId,
  request_id: requestId,
  received_at: new Date().toISOString(),
  source_route: routePath,
  actor,
});

const EMAIL_LOG_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_LOG_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/g;

const maskEmailAddress = (email: string) => {
  const [localPart, domainPart = ""] = email.split("@");
  if (!domainPart) {
    return "[email masked]";
  }

  const visibleLocal = localPart.slice(0, 2);
  const hiddenLocalLength = Math.max(1, localPart.length - visibleLocal.length);
  return `${visibleLocal}${"*".repeat(hiddenLocalLength)}@${domainPart}`;
};

const maskPhoneNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return "[phone masked]";
  }

  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const sanitizeLogText = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .replace(EMAIL_LOG_PATTERN, (match) => maskEmailAddress(match))
    .replace(PHONE_LOG_PATTERN, (match) => maskPhoneNumber(match));
};

type CevonneRouteLog = {
  requestId: string;
  routePath: string;
  n8nResponseStatus: string;
  n8nResponseType?: string | null;
  failReason?: string | null;
};

const logCevonneRouteOutcome = ({ requestId, routePath, n8nResponseStatus, n8nResponseType, failReason }: CevonneRouteLog) => {
  const entry: Record<string, unknown> = {
    request_id: requestId,
    route_name: routePath,
    timestamp: new Date().toISOString(),
    n8n_response_status: n8nResponseStatus,
    n8n_response_type: n8nResponseType ?? null,
  };

  const sanitizedFailReason = sanitizeLogText(failReason);
  if (sanitizedFailReason) {
    entry.fail_reason = sanitizedFailReason;
  }

  try {
    console.info("[Cevonne]", entry);
  } catch {
    // Logging must never break the route.
  }
};

const getRequestFingerprintHash = (request: Request) => {
  const payload = `${getClientIp(request)}|${request.headers.get("user-agent") || ""}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
};

const getClientIp = (request: Request) => {
  const headerValues = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
  ];

  for (const headerValue of headerValues) {
    if (!headerValue) {
      continue;
    }

    const firstIp = headerValue.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return "unknown";
};

const consumePublicRouteQuota = (request: Request, routePath: string) => {
  const key = `${routePath}:${getClientIp(request)}`;
  const now = Date.now();
  const existing = publicRouteRateLimits.get(key);

  if (!existing || existing.resetAt <= now) {
    publicRouteRateLimits.set(key, {
      count: 1,
      resetAt: now + PUBLIC_ROUTE_RATE_LIMIT_WINDOW_MS,
    });

    return { allowed: true as const };
  }

  if (existing.count >= PUBLIC_ROUTE_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true as const };
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
    consent_source: optionalString,
    explicit_consent: z.literal(true),
    consent_status: z
      .preprocess(emptyToUndefined, z.string().trim().transform((value) => value.toUpperCase()).optional())
      .refine((value) => value === undefined || value === "YES", {
        message: "consent_status must be YES when provided.",
      }),
    privacy_policy_version: optionalString,
    utm_source: optionalString,
    utm_medium: optionalString,
    utm_campaign: optionalString,
  })
  .strict()
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
    opt_out_source: optionalString,
  })
  .strict()
  .refine(
    (payload) => Boolean(payload.email || payload.phone || payload.contact_id || payload.external_contact_id || payload.user_id),
    {
      message: "At least one identifier is required.",
      path: ["email"],
    },
  );

const attributionInputSchema = z
  .object({
    contact_id: optionalString,
    external_contact_id: optionalString,
    user_id: optionalString,
    event_type: requiredString.transform((value) => value.toUpperCase()),
    event_name: optionalString,
    source_event: optionalString,
    tracking_consent_status: yesStatus,
    utm_source: optionalString,
    utm_medium: optionalString,
    utm_campaign: optionalString,
    gclid: optionalString,
    fbclid: optionalString,
    meta_event_id: optionalString,
  })
  .strict();

const purchaseItemSchema = z
  .object({
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
  })
  .strict();

const purchaseInputSchema = z
  .object({
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
  })
  .strict();

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
  .strict()
  .refine(
    (payload) => Boolean(payload.email || payload.phone || payload.contact_id || payload.external_contact_id || payload.user_id),
    {
      message: "At least one identifier is required.",
      path: ["email"],
    },
  );

const g11AdminInputSchema = z
  .object({
    scope: optionalString,
    period: optionalString,
    notes: optionalString,
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

type G11AdminInput = z.infer<typeof g11AdminInputSchema>;

const buildBasePayload = (group = workflowGroup) => ({
  workflow_group: group,
  source_platform: sourcePlatform,
  actor,
  dry_run: env.cevonneN8nDryRun,
});

const routeResponse = (body: CevonneResponse) => jsonResponse(body, 200);

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const blockedResponse = (failReason: string, extra: Record<string, unknown> = {}) =>
  routeResponse({
    status: "BLOCK",
    message: CEVONNE_SAFE_RESPONSE_MESSAGE,
    fail_reason: failReason,
    not_executed: true,
    ...extra,
  });

const manualOnlyResponse = (message = CEVONNE_MANUAL_REVIEW_MESSAGE, extra: Record<string, unknown> = {}) =>
  routeResponse({
    status: "MANUAL_ONLY",
    message,
    not_executed: true,
    ...extra,
  });

const errorResponse = (message: string = CEVONNE_TEMPORARY_FAILURE_MESSAGE, extra: Record<string, unknown> = {}) =>
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

const readAdminBody = async (request: Request) => {
  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  return body;
};

const dispatchValidatedRoute = async <T extends Record<string, unknown>>(
  request: Request,
  schema: z.ZodType<T>,
  webhookUrl: string,
  routePath: string,
  buildPayload: (body: T) => Record<string, unknown>,
  buildEventIdParts: (body: T) => Array<unknown>,
  validationErrorMessage = "Invalid payload",
) => {
  const requestId = createRouteRequestId(routePath);

  if (!env.cevonneN8nEnabled) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Automation is temporarily disabled.",
    });
    return manualOnlyResponse("Automation is temporarily disabled.");
  }

  const rateLimit = consumePublicRouteQuota(request, routePath);
  if (!rateLimit.allowed) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Rate limit exceeded.",
    });
    return blockedResponse("Rate limit exceeded.", {
      retry_after_seconds: rateLimit.retryAfterSeconds,
    });
  }

  const body = await readBody(request);
  if (!isRecord(body)) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: validationErrorMessage,
    });
    return blockedResponse(validationErrorMessage);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const { failReason, failureReasons } = parseValidationError(parsed.error);
    const reason = failReason || validationErrorMessage;
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: reason,
    });
    return blockedResponse(reason, {
      failure_reasons: failureReasons,
    });
  }

  const eventId = buildStableEventId(routePath, buildEventIdParts(parsed.data));
  const routeEnvelope = buildRouteEnvelope(routePath, requestId, eventId);
  const n8nResponse = await postN8nWebhook(webhookUrl, {
    ...buildBasePayload(),
    ...buildPayload(parsed.data),
    ...routeEnvelope,
  });

  logCevonneRouteOutcome({
    requestId,
    routePath,
    n8nResponseStatus: n8nResponse.status,
    n8nResponseType: typeof n8nResponse.response_type === "string" ? n8nResponse.response_type : null,
    failReason: typeof n8nResponse.fail_reason === "string" ? n8nResponse.fail_reason : null,
  });

  return routeResponse(
    handleCevonneN8nResponse({
      ...n8nResponse,
      id: n8nResponse.id || eventId,
      event_id: n8nResponse.event_id || eventId,
    }),
  );
};

const dispatchAdminOnlyN8nRoute = async (
  request: Request,
  webhookUrl: string,
  routePath: string,
  eventType: string,
  sourceEvent: string,
  actionType: CevonneAdminActionType,
  schema: typeof g11AdminInputSchema,
  buildPayload: (body: G11AdminInput) => Record<string, unknown>,
) => {
  const requestId = createRouteRequestId(routePath);
  const auth = await getAuthUser(request);
  if (!auth) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Unauthorized",
    });
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Forbidden",
    });
    return forbiddenResponse();
  }

  if (!env.cevonneN8nEnabled) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Automation is temporarily disabled.",
    });
    return manualOnlyResponse("Automation is temporarily disabled.");
  }

  const body = await readAdminBody(request);
  if (body instanceof Response) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Invalid JSON payload",
    });
    return body;
  }

  if (!isRecord(body)) {
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: "Invalid payload",
    });
    return blockedResponse("Invalid payload");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const { failReason, failureReasons } = parseValidationError(parsed.error);
    const reason = failReason || "Invalid payload";
    logCevonneRouteOutcome({
      requestId,
      routePath,
      n8nResponseStatus: "NOT_SENT",
      failReason: reason,
    });
    return blockedResponse(reason, {
      failure_reasons: failureReasons,
    });
  }

  const eventId = buildStableEventId(routePath, [
    auth.id,
    eventType,
    sourceEvent,
    parsed.data.scope,
    parsed.data.period,
    parsed.data.notes,
    parsed.data.context,
  ]);
  const routeEnvelope = buildRouteEnvelope(routePath, requestId, eventId);
  const n8nResponse = await postN8nWebhook(webhookUrl, {
    ...buildBasePayload("G11"),
    event_type: eventType,
    source_event: sourceEvent,
    admin_requester_id: auth.id,
    admin_requester_email: auth.email,
    admin_requester_role: auth.role,
    ...buildPayload(parsed.data),
    ...routeEnvelope,
    recommendation_only: true,
  });

  const normalizedResponse = handleCevonneN8nResponse({
    ...n8nResponse,
    id: n8nResponse.id || eventId,
    event_id: n8nResponse.event_id || eventId,
  });
  const safeExecutionId = (typeof normalizedResponse.id === "string" && normalizedResponse.id.trim()) || eventId;
  const responseType = typeof normalizedResponse.response_type === "string" && normalizedResponse.response_type.trim()
    ? normalizedResponse.response_type.trim()
    : eventType;
  const responseStatus = normalizedResponse.status as CevonneWorkflowStatus;
  const payloadSummary = JSON.stringify({
    event_type: eventType,
    source_event: sourceEvent,
    scope: parsed.data.scope ?? null,
    period: parsed.data.period ?? null,
    has_notes: Boolean(parsed.data.notes),
    has_context: Boolean(parsed.data.context),
  });

  recordCevonneWorkflowExecution({
    workflowGroup: "G11",
    routeName: routePath,
    status: responseStatus,
    responseType,
    summary: typeof normalizedResponse.message === "string" ? normalizedResponse.message : "Recorded.",
    failureReason: typeof normalizedResponse.fail_reason === "string" ? normalizedResponse.fail_reason : null,
    actor: "admin",
    adminUserId: auth.id,
    adminEmail: auth.email,
    requestId,
    dryRun: Boolean(normalizedResponse.dry_run ?? env.cevonneN8nDryRun),
    notExecuted: Boolean(normalizedResponse.not_executed ?? false),
    safePublicIds: [safeExecutionId],
  });

  recordCevonneAdminAuditLog({
    workflowGroup: "G11",
    actionType,
    routeName: routePath,
    resultStatus: responseStatus,
    responseType,
    payloadSummary,
    failureReason: typeof normalizedResponse.fail_reason === "string" ? normalizedResponse.fail_reason : null,
    adminUserId: auth.id,
    adminEmail: auth.email,
    ipUserAgentHash: getRequestFingerprintHash(request),
    safePublicIds: [safeExecutionId],
  });

  logCevonneRouteOutcome({
    requestId,
    routePath,
    n8nResponseStatus: normalizedResponse.status,
    n8nResponseType: responseType,
    failReason: typeof normalizedResponse.fail_reason === "string" ? normalizedResponse.fail_reason : null,
  });

  return routeResponse(normalizedResponse);
};

export const dispatchCevonneConsentRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    consentInputSchema,
    env.cevonneN8nConsentIngestUrl,
    "/api/cevonne/consent",
    (body) => ({
      event_type: "CONSENT_INGEST",
      source_event: body.source_event || body.consent_source || "newsletter_signup",
      consent_source: body.consent_source || body.source_event || "website_form",
      email: body.email ?? null,
      phone: body.phone ?? null,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      channel: body.channel,
      consent_status: "YES",
      explicit_consent: true,
      privacy_policy_version: body.privacy_policy_version || env.cevonnePrivacyPolicyVersion,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
    }),
    (body) => [
      body.email,
      body.phone,
      body.contact_id,
      body.external_contact_id,
      body.user_id,
      body.channel,
      body.consent_status,
      body.consent_source || body.source_event || "website_form",
      body.privacy_policy_version || env.cevonnePrivacyPolicyVersion,
      body.utm_source,
      body.utm_medium,
      body.utm_campaign,
    ],
  );
};

export const dispatchCevonneOptOutRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    optOutInputSchema,
    env.cevonneN8nOptOutUrl,
    "/api/cevonne/opt-out",
    (body) => ({
      event_type: "OPT_OUT",
      source_event: body.source_event || body.opt_out_source || "user_unsubscribe",
      opt_out_source: body.opt_out_source || body.source_event || "website_unsubscribe",
      email: body.email ?? null,
      phone: body.phone ?? null,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      channel: body.channel,
      opt_out_reason: body.opt_out_reason || body.opt_out_source || "user_unsubscribe",
    }),
    (body) => [
      body.email,
      body.phone,
      body.contact_id,
      body.external_contact_id,
      body.user_id,
      body.channel,
      body.opt_out_reason || body.opt_out_source || body.source_event || "user_unsubscribe",
    ],
  );
};

export const dispatchCevonneAttributionRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    attributionInputSchema,
    env.cevonneN8nAttributionEventUrl,
    "/api/cevonne/attribution",
    (body) => ({
      event_type: "ATTRIBUTION_EVENT",
      source_event: body.source_event || body.event_name || body.event_type,
      contact_id: body.contact_id ?? null,
      external_contact_id: body.external_contact_id ?? null,
      user_id: body.user_id ?? null,
      event_name: body.event_name || body.event_type,
      tracking_consent_status: "YES",
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      gclid: body.gclid ?? null,
      fbclid: body.fbclid ?? null,
      meta_event_id: body.meta_event_id ?? null,
    }),
    (body) => [
      body.contact_id,
      body.external_contact_id,
      body.user_id,
      body.event_type,
      body.event_name || body.event_type,
      body.source_event || body.event_name || body.event_type,
      body.utm_source,
      body.utm_medium,
      body.utm_campaign,
      body.gclid,
      body.fbclid,
      body.meta_event_id,
    ],
    "Tracking consent is required.",
  );
};

export const dispatchCevonnePurchaseRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    purchaseInputSchema,
    env.cevonneN8nPurchaseEventUrl,
    "/api/cevonne/purchase",
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
    }),
    (body) => [
      body.order_id,
      body.contact_id,
      body.external_contact_id,
      body.user_id,
      body.email,
      body.phone,
      body.purchase_value,
      body.currency,
      JSON.stringify(body.items ?? []),
      body.source_event || "checkout_success",
    ],
  );
};

export const dispatchCevonnePrivacyRequestRoute = async (request: Request) => {
  return dispatchValidatedRoute(
    request,
    privacyRequestInputSchema,
    env.cevonneN8nPrivacyRequestUrl,
    "/api/cevonne/privacy-request",
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
    (body) => [
      body.request_type,
      body.email,
      body.phone,
      body.contact_id,
      body.external_contact_id,
      body.user_id,
      body.verification_status || "PENDING",
      body.source_event || "privacy_request_form",
    ],
    "A privacy request needs at least one identifier.",
  );
};

export const dispatchCevonneG11DigestRoute = async (request: Request) => {
  return dispatchAdminOnlyN8nRoute(
    request,
    env.cevonneN8nWeeklyDigestUrl,
    "/api/cevonne/admin/g11-digest",
    "G11_WEEKLY_DIGEST_REQUEST",
    "g11_weekly_digest_request",
    "G11_WEEKLY_DIGEST_REQUEST",
    g11AdminInputSchema,
    (body) => ({
      scope: body.scope ?? null,
      period: body.period ?? null,
      notes: body.notes ?? null,
      context: body.context ?? null,
    }),
  );
};

export const dispatchCevonneG11RecommendationRoute = async (request: Request) => {
  return dispatchAdminOnlyN8nRoute(
    request,
    env.cevonneN8nDecisionRecommendationUrl,
    "/api/cevonne/admin/g11-recommendation",
    "G11_DECISION_RECOMMENDATION_REQUEST",
    "g11_decision_recommendation_request",
    "G11_DECISION_RECOMMENDATION_REQUEST",
    g11AdminInputSchema,
    (body) => ({
      scope: body.scope ?? null,
      period: body.period ?? null,
      notes: body.notes ?? null,
      context: body.context ?? null,
    }),
  );
};

export const dispatchCevonneG11ActionDraftRoute = async (request: Request) => {
  return dispatchAdminOnlyN8nRoute(
    request,
    env.cevonneN8nDraftActionPacketUrl,
    "/api/cevonne/admin/g11-action-draft",
    "G11_DRAFT_ACTION_PACKET_REQUEST",
    "g11_draft_action_packet_request",
    "G11_DRAFT_ACTION_PACKET_REQUEST",
    g11AdminInputSchema,
    (body) => ({
      scope: body.scope ?? null,
      period: body.period ?? null,
      notes: body.notes ?? null,
      context: body.context ?? null,
    }),
  );
};

export const dispatchCevonneManualOnlyResponse = manualOnlyResponse;
export const dispatchCevonneBlockedResponse = blockedResponse;
export const dispatchCevonneErrorResponse = errorResponse;
