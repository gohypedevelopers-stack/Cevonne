export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonnePurchaseRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonnePurchaseRoute(request);
}
