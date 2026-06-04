export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchUploadsRoute } from "@/server/next/api/uploads";

export async function DELETE(
  request: Request,
  context: { params?: Promise<{ filename?: string }> }
) {
  const resolved = await Promise.resolve(context?.params);
  return dispatchUploadsRoute(request, resolved?.filename ? [resolved.filename] : []);
}
