export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadG5SelectedG4Content } from "@/server/next/api/g5-asset-approval";
import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewId = url.searchParams.get("reviewId") || url.searchParams.get("review_id") || url.searchParams.get("id") || "";
  const response = await loadG5SelectedG4Content(reviewId);
  return jsonResponse(response, response.status === "ERROR" ? 503 : 200);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
