export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAttributionRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonneAttributionRoute(request);
}
