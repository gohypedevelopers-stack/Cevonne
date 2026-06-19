export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { jsonResponse, methodNotAllowed, getAuthUser } from "@/server/next/route-utils";
import { getG12TrendFetcherSnapshot } from "@/server/next/api/g12-trend-fetcher";

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

  const snapshot = await getG12TrendFetcherSnapshot();

  return jsonResponse(
    {
      status: "PASS",
      response_type: "G12_TREND_FETCHER_SNAPSHOT_READY",
      message:
        snapshot.source === "fallback"
          ? "G12 trend fetcher legacy fallback snapshot loaded."
          : "G12 trend fetcher Neon snapshot loaded.",
      snapshot,
    },
    200,
  );
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
