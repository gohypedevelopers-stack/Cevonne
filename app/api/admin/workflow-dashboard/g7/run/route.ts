export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { buildG7OfferProofPayload, buildG7SubmissionMessage } from "@/lib/admin/g7-dashboard-summary";
import { postN8nWebhook } from "@/lib/n8n-client";
import { env } from "@/server/config";
import { getAuthUser, invalidJsonResponse, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pickText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text ? text : null;
};

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

  if (body !== undefined && !isRecord(body)) {
    return invalidJsonResponse();
  }

  const sku = pickText(body?.sku);
  const urgencyClaim = pickText(body?.urgency_claim);
  const discountCode = pickText(body?.discount_code);
  const intendedUse = pickText(body?.intended_use) ?? "ORGANIC_POST";
  const requestedByWorkflow = pickText(body?.requested_by_workflow) ?? "G4";
  const actor = pickText(body?.actor) ?? "admin_ui";

  if (!sku) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Please add a SKU before checking offer proof.",
      },
      400,
    );
  }

  try {
    const result = await postN8nWebhook({
      url: env.n8nG7OfferProofUrl || undefined,
      payload: buildG7OfferProofPayload({
        sku,
        urgency_claim: urgencyClaim,
        discount_code: discountCode,
        intended_use: intendedUse,
        requested_by_workflow: requestedByWorkflow,
        actor,
      }),
    });

    const status = result.status === "PASS" || result.status === "BLOCK" || result.status === "NEEDS_EVIDENCE" ? result.status : "ERROR";
    if (status === "ERROR") {
      return jsonResponse(
        {
          status: "ERROR",
          message: "Offer proof check failed. No claim was approved.",
        },
        502,
      );
    }

    return jsonResponse(
      {
        status,
        message: buildG7SubmissionMessage({
          status,
          failReason: result.fail_reason,
          failureReasons: result.failure_reasons,
          message: result.message,
        }),
        handled_at: result.handled_at ?? new Date().toISOString(),
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Offer proof check failed. No claim was approved.",
      },
      502,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
