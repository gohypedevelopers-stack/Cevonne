export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { dispatchShadesRoute } from "@/server/next/api/shades";

const resolveSegments = async (params: unknown) => {
  const resolved = await Promise.resolve(params as { path?: string[] } | undefined);
  return resolved?.path ?? [];
};

export async function GET(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchShadesRoute(request, await resolveSegments(context?.params));
}

export async function POST(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchShadesRoute(request, await resolveSegments(context?.params));
}

export async function PUT(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchShadesRoute(request, await resolveSegments(context?.params));
}

export async function DELETE(request: Request, context: { params?: Promise<{ path?: string[] }> }) {
  return dispatchShadesRoute(request, await resolveSegments(context?.params));
}
