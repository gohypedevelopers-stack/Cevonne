export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loadG5ApprovedContent } from "@/server/next/api/g5-asset-approval";
import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function GET() {
  const response = await loadG5ApprovedContent();
  return jsonResponse(response, response.status === "ERROR" ? 503 : 200);
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
