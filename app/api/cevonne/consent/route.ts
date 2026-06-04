export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneConsentRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonneConsentRoute(request);
}
