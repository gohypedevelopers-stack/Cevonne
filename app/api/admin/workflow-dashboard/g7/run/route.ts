export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { runG7OfferProof } from "@/server/next/api/g7-offer-safety-adapter";
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

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

  const productOrSku = pickText(body?.product_or_sku);
  const offerCode = pickText(body?.offer_code);
  const offerUrl = pickText(body?.offer_url);
  const urgencyClaimText = pickText(body?.urgency_claim_text);
  const actor = pickText(body?.actor);

  if (!productOrSku || !offerCode || !offerUrl || !urgencyClaimText || !actor) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Please fill in every required field before checking offer proof.",
      },
      400,
    );
  }

  if (!isValidHttpUrl(offerUrl)) {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Please enter a valid offer URL.",
      },
      400,
    );
  }

  try {
    const result = await runG7OfferProof({
      product_or_sku: productOrSku,
      offer_code: offerCode,
      offer_url: offerUrl,
      urgency_claim_text: urgencyClaimText,
      actor,
      requested_by: auth.email ?? auth.name ?? auth.id,
    });

    return jsonResponse(
      {
        status: result.status,
        message: result.message,
        handled_at: result.handled_at,
        detail: result.detail,
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unable to check offer proof right now.",
      },
      500,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
