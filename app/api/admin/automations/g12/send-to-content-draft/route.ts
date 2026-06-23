export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sendG12TrendToContentDraft } from "@/server/next/api/g12-send-to-content-draft";
import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const toText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
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

  try {
    const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const result = await sendG12TrendToContentDraft({
      insight_id: toText(record.insight_id) || toText(record.trend_insight_id),
      fetch_run_id: toText(record.fetch_run_id),
    });

    return jsonResponse(result.body, result.httpStatus);
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unable to send the saved insight to G4 right now.",
      },
      500,
    );
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
