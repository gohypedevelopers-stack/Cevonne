export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchInventoryRoute } from "@/server/next/api/inventory";

export async function GET(request: Request) {
  return dispatchInventoryRoute(request, []);
}
