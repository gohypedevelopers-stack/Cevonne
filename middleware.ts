import { NextResponse, type NextRequest } from "next/server";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const isTrustedBrowserOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Requests without an Origin header are server-to-server or same-origin legacy
    // requests. Cookie sessions still use SameSite=Lax and route authorization.
    return request.headers.get("sec-fetch-site") !== "cross-site";
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
};

export function middleware(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method) || isTrustedBrowserOrigin(request)) {
    return NextResponse.next();
  }

  return NextResponse.json({ message: "Cross-site request blocked." }, { status: 403 });
}

export const config = {
  matcher: "/api/:path*",
};
