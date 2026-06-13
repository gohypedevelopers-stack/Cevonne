export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

import { jsonResponse, methodNotAllowed } from "@/server/next/route-utils";
import { createR2PresignedUpload, PRODUCT_MEDIA_ALLOWED_MIME_TYPES, PRODUCT_MEDIA_MAX_BYTES } from "@/server/services/r2";

const requestSchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase())
    .refine((value) => PRODUCT_MEDIA_ALLOWED_MIME_TYPES.has(value), {
      message: "Unsupported file type",
    }),
  size: z
    .number()
    .int()
    .positive()
    .max(PRODUCT_MEDIA_MAX_BYTES),
  productId: z
    .union([z.string().trim().min(1), z.null(), z.undefined()])
    .optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Invalid JSON payload" }, 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ message: parsed.error.issues[0]?.message || "Invalid upload request" }, 400);
  }

  try {
    const upload = await createR2PresignedUpload(parsed.data);
    return jsonResponse(
      {
        uploadUrl: upload.uploadUrl,
        key: upload.key,
        publicUrl: upload.publicUrl,
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare upload";
    const status = message.includes("not configured") ? 503 : 400;
    return jsonResponse({ message }, status);
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
