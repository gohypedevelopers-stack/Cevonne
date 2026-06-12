export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchWf1ActionRoute } from "@/server/next/api/wf1";

type RouteContext = {
  params: Promise<{ action: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { action } = await context.params;
  return dispatchWf1ActionRoute(request, action);
}

export async function POST(request: Request, context: RouteContext) {
  const { action } = await context.params;
  return dispatchWf1ActionRoute(request, action);
}
