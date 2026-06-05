export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminApprovalDecisionRoute } from "@/server/next/api/cevonne-admin";

export async function POST(request: Request) {
  return dispatchCevonneAdminApprovalDecisionRoute(request);
}

