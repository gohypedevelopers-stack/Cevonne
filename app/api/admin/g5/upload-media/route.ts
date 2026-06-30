export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { uploadG5Media } from "@/server/next/api/g5-asset-approval";
import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawFile = formData.get("file") || formData.get("image") || formData.get("media") || formData.get("asset");

    if (!(rawFile instanceof File)) {
      return jsonResponse({ message: "No file uploaded" }, 400);
    }

    const response = await uploadG5Media(rawFile);
    return jsonResponse(response, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload media";
    const status = message.includes("not configured") ? 503 : 400;
    return jsonResponse({ message }, status);
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
