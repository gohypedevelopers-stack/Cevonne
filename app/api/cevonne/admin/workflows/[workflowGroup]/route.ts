export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchCevonneAdminWorkflowDetailRoute } from "@/server/next/api/cevonne-admin";

type RouteContext = {
  params: Promise<{ workflowGroup: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { workflowGroup } = await context.params;
  return dispatchCevonneAdminWorkflowDetailRoute(request, workflowGroup);
}

