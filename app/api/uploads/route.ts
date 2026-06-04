export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchUploadsRoute } from "@/server/next/api/uploads";

export async function POST(request: Request) {
  return dispatchUploadsRoute(request, []);
}
