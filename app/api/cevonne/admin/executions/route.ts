export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminExecutionsRoute } from "@/server/next/api/cevonne-admin";

export async function GET(request: Request) {
  return dispatchCevonneAdminExecutionsRoute(request);
}

