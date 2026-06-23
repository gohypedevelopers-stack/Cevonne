export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { recordG3Event } from "@/server/next/api/g3-record-event";
import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const g3RecordEventSchema = z
  .object({
    event_type: z.enum([
      "CONSENT_RECORDED",
      "OPT_OUT_RECORDED",
      "ATTRIBUTION_RECORDED",
      "PURCHASE_RECORDED",
      "PRIVACY_REQUEST_RECORDED",
    ]),
    contact_identifier: z.string().trim().optional(),
    channel: z.string().trim().optional(),
    consent_status: z.string().trim().optional(),
    source: z.string().trim().optional(),
    consent_text: z.string().trim().optional(),
    workflow_group: z.literal("G3").optional(),
    workflow_id: z.string().trim().optional(),
    opt_out_reason: z.string().trim().optional(),
    order_id: z.string().trim().optional(),
    purchase_value: z.preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") {
          return undefined;
        }

        if (typeof value === "number") {
          return value;
        }

        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : value;
        }

        return value;
      },
      z.number().finite().optional(),
    ),
    currency: z.string().trim().optional(),
    request_type: z.string().trim().optional(),
    attribution_event: z.string().trim().optional(),
    utm_source: z.string().trim().optional(),
    utm_medium: z.string().trim().optional(),
    utm_campaign: z.string().trim().optional(),
    gclid: z.string().trim().optional(),
    fbclid: z.string().trim().optional(),
    meta_event_id: z.string().trim().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(
      {
        status: "BLOCK",
        message: "Invalid payload.",
        action_needed: "Check the form fields and try again.",
      },
      200,
    );
  }

  const parsed = g3RecordEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        status: "BLOCK",
        message: "Invalid payload.",
        action_needed: "Check the form fields and try again.",
      },
      200,
    );
  }

  const result = await recordG3Event({
    eventType: parsed.data.event_type,
    contactIdentifier: parsed.data.contact_identifier || "",
    channel: parsed.data.channel ?? null,
    consentStatus: parsed.data.consent_status ?? null,
    source: parsed.data.source ?? null,
    consentText: parsed.data.consent_text ?? null,
    workflowGroup: parsed.data.workflow_group ?? "G3",
    workflowId: parsed.data.workflow_id ?? "G3",
    optOutReason: parsed.data.opt_out_reason ?? null,
    orderId: parsed.data.order_id ?? null,
    purchaseValue: parsed.data.purchase_value ?? null,
    currency: parsed.data.currency ?? null,
    requestType: parsed.data.request_type ?? null,
    attributionEvent: parsed.data.attribution_event ?? null,
    utmSource: parsed.data.utm_source ?? null,
    utmMedium: parsed.data.utm_medium ?? null,
    utmCampaign: parsed.data.utm_campaign ?? null,
    gclid: parsed.data.gclid ?? null,
    fbclid: parsed.data.fbclid ?? null,
    metaEventId: parsed.data.meta_event_id ?? null,
  });

  try {
    console.info("[G3]", {
      route_name: "/api/admin/automations/g3/record-consent",
      request_id: result.body.request_id,
      event_type: result.body.event_type,
      status: result.body.status,
      handled_at: result.body.handled_at,
      contact_identifier_masked: result.body.contact_identifier_masked,
      message: result.body.message,
    });
  } catch {
    // Logging must never break the admin route.
  }

  return jsonResponse(result.body, result.httpStatus);
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
