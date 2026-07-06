export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadG5SelectedG4Content } from "@/server/next/api/g5-asset-approval";
import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewId = url.searchParams.get("reviewId") || url.searchParams.get("review_id") || url.searchParams.get("id") || "";
  const assetId = url.searchParams.get("assetId") || url.searchParams.get("asset_id") || null;
  const approvalId = url.searchParams.get("approvalId") || url.searchParams.get("approval_id") || null;
  const response = await loadG5SelectedG4Content(reviewId, assetId, approvalId, {
    title: url.searchParams.get("title") || url.searchParams.get("caption_title") || null,
    caption: url.searchParams.get("caption") || url.searchParams.get("content") || null,
    hook: url.searchParams.get("hook") || url.searchParams.get("hook_angle") || null,
    platform: url.searchParams.get("platform") || url.searchParams.get("sourcePlatform") || null,
    sourceUrl: url.searchParams.get("sourceUrl") || url.searchParams.get("source_url") || null,
  });
  return jsonResponse(response, response.status === "ERROR" ? 503 : 200);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
