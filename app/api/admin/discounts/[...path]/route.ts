export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchAdminDiscountsRoute } from "@/server/next/api/admin-discounts";

const resolveSegments = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { path?: string[] } | undefined);
  return resolved?.path ?? [];
};

export async function GET(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchAdminDiscountsRoute(request, await resolveSegments(context?.params));
}

export async function PUT(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchAdminDiscountsRoute(request, await resolveSegments(context?.params));
}

export async function PATCH(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchAdminDiscountsRoute(request, await resolveSegments(context?.params));
}
