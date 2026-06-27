export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadG7OfferSafetyDetail } from "@/server/next/api/g7-offer-safety-adapter";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== "ADMIN") {
    return forbiddenResponse();
  }

  try {
    const detail = await loadG7OfferSafetyDetail();
    return jsonResponse(detail, 200);
  } catch {
    return jsonResponse(
      {
        status: "ERROR",
        message: "Unable to load offer checks right now.",
      },
      500,
    );
  }
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
