export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminG2AccountHealthUpdateRoute } from "@/server/next/api/cevonne-admin";

export async function POST(request: Request) {
  return dispatchCevonneAdminG2AccountHealthUpdateRoute(request);
}

