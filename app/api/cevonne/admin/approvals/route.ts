export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminApprovalsRoute } from "@/server/next/api/cevonne-admin";

export async function GET(request: Request) {
  return dispatchCevonneAdminApprovalsRoute(request);
}

