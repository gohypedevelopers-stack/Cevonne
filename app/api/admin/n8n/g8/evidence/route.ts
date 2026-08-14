export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { env } from "@/server/config";
import { getN8nSupabaseAdmin } from "@/lib/n8n-supabase-admin";
import { getAuthUser, jsonResponse, methodNotAllowed } from "@/server/next/route-utils";

const itemKeySchema = z.string().uuid();
const uploadPurposeSchema = z.enum(["STORY_MEDIA", "PERMISSION_REQUEST", "CREATOR_REPLY", "CONVERSATION_PROOF"]);
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const extensionsByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

const isUploadFile = (value: FormDataEntryValue | null): value is File =>
  typeof File !== "undefined" && value instanceof File;

export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return jsonResponse({ message: "Unauthorized" }, 401);
  if (auth.role !== "ADMIN") return jsonResponse({ message: "Forbidden" }, 403);

  const bucket = env.n8nG8EvidenceBucket.trim();
  const client = getN8nSupabaseAdmin();
  if (!bucket || !client) {
    console.error("[g8] evidence upload unavailable", { bucketConfigured: Boolean(bucket), clientConfigured: Boolean(client) });
    return jsonResponse({ message: "Evidence upload is not ready yet. Please contact your workspace administrator." }, 503);
  }

  const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
  const targetBucket = buckets?.find((entry) => entry.id === bucket || entry.name === bucket);
  if (bucketsError || !targetBucket?.public) {
    console.error("[g8] evidence bucket is unavailable or private", { bucket, message: bucketsError?.message || null });
    return jsonResponse({ message: "Evidence upload is not ready yet. Please contact your workspace administrator." }, 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ message: "We couldn't read that evidence file. Try again." }, 400);
  }

  const itemKey = itemKeySchema.safeParse(formData.get("itemKey"));
  const purpose = uploadPurposeSchema.safeParse(formData.get("purpose"));
  const file = formData.get("file");
  if (!itemKey.success || !purpose.success || !isUploadFile(file)) {
    return jsonResponse({ message: "Choose a supported file to attach." }, 422);
  }

  const contentType = file.type.toLowerCase();
  const extension = extensionsByMimeType[contentType];
  if (!extension) return jsonResponse({ message: "Choose a JPG, PNG, WebP, GIF, MP4, WebM, MOV or PDF file." }, 422);
  if (!file.size || file.size > MAX_EVIDENCE_BYTES) return jsonResponse({ message: "Choose a file smaller than 25 MB." }, 422);

  const folder = purpose.data === "STORY_MEDIA" ? "story-media" : purpose.data === "CONVERSATION_PROOF" ? "conversation-proof" : purpose.data === "PERMISSION_REQUEST" ? "permission-request" : "creator-reply";
  const objectPath = `g8/${itemKey.data}/${folder}/${randomUUID()}.${extension}`;
  try {
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(objectPath, await file.arrayBuffer(), { contentType, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(objectPath);
    if (!publicUrlData.publicUrl) throw new Error("Public media URL was unavailable.");

    if (purpose.data === "STORY_MEDIA") {
      const { error: mediaUpdateError } = await client
        .from("g8_v2_ugc_items")
        .update({ media_url: publicUrlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("ugc_id", itemKey.data);
      if (mediaUpdateError) throw mediaUpdateError;
    }

    return jsonResponse({ storedUrl: publicUrlData.publicUrl, fileName: file.name || `Attached proof.${extension}` }, 201);
  } catch (error) {
    console.error("[g8] evidence upload failed", { message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ message: "We couldn't attach that evidence. Try again." }, 502);
  }
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
