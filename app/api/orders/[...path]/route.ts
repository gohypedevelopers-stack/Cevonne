export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchOrdersRoute } from "@/server/next/api/orders";

const resolveSegments = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { path?: string[] } | undefined);
  return resolved?.path ?? [];
};

export async function GET(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchOrdersRoute(request, await resolveSegments(context?.params));
}

export async function POST(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchOrdersRoute(request, await resolveSegments(context?.params));
}

export async function PATCH(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchOrdersRoute(request, await resolveSegments(context?.params));
}
