export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneG11ActionDraftRoute } from "@/server/next/api/cevonne";

export async function POST(request: Request) {
  return dispatchCevonneG11ActionDraftRoute(request);
}
