export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchWf1DetailRoute } from "@/server/next/api/wf1";

export async function GET(request: Request) {
  return dispatchWf1DetailRoute(request);
}
