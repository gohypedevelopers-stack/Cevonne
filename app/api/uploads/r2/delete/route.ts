export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { deleteFileFromR2 } from "@/server/services/r2";

const requestSchema = z.object({
  storageKey: z.string().trim().min(1),
});

const handleDelete = async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Invalid JSON payload" }, 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid storage key" }, 400);
  }

  try {
    await deleteFileFromR2(parsed.data.storageKey);
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete media";
    const status = message.includes("not configured") ? 503 : 400;
    return jsonResponse({ message }, status);
  }
};

export async function POST(request: Request) {
  return handleDelete(request);
}

export async function DELETE(request: Request) {
  return handleDelete(request);
}

export async function GET() {
  return methodNotAllowed(["POST", "DELETE"]);
}
