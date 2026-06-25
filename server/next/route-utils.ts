import { serializeError } from "@/server/http/responses";
import { getPrisma } from "@/server/db/prismaClient";
import { verifyToken } from "@/server/utils/jwt";

type PrimitiveHeaders = Record<string, string>;
type AuthUser = { id: string; email: string | null; role: string; name: string | null };
type JwtAuthClaims = { id?: string; role?: string; email?: string | null; name?: string | null };

type ControllerRequest = {
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  headers: PrimitiveHeaders;
  protocol: string;
  user?: unknown;
  file?: unknown;
  get: (name: string) => string | undefined;
};

type ControllerResponse = {
  statusCode: number;
  headers: PrimitiveHeaders;
  headersSent: boolean;
  body: unknown;
  status: (code: number) => ControllerResponse;
  json: (data: unknown) => ControllerResponse;
  send: (data?: unknown) => ControllerResponse;
  setHeader: (name: string, value: string) => ControllerResponse;
};

const buildHeadersObject = (request: Request): PrimitiveHeaders =>
  Object.fromEntries(
    Array.from(request.headers.entries()).map(([key, value]) => [key.toLowerCase(), value])
  );

export const jsonResponse = (data: unknown, status = 200, headers: PrimitiveHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });

export const methodNotAllowed = (allowed: string[]) =>
  jsonResponse(
    { message: "Method Not Allowed" },
    405,
    {
      Allow: allowed.join(", "),
    }
  );

export const notFoundResponse = (message = "Not Found") => jsonResponse({ message }, 404);

export const invalidJsonResponse = () => jsonResponse({ message: "Invalid JSON payload" }, 400);

export const readJsonBody = async (request: Request) => {
  try {
    if (!request.body) {
      return undefined;
    }
    return await request.json();
  } catch {
    return invalidJsonResponse();
  }
};

const canFallbackToTokenClaims = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : String(error ?? "");

  return code === "P1001" || /can't reach database server|databasenotreachable/i.test(message);
};

const buildTokenAuthUser = (decoded: JwtAuthClaims): AuthUser | null => {
  if (typeof decoded.id !== "string" || !decoded.id.trim()) {
    return null;
  }

  if (typeof decoded.role !== "string" || !decoded.role.trim()) {
    return null;
  }

  return {
    id: decoded.id.trim(),
    email: typeof decoded.email === "string" && decoded.email.trim() ? decoded.email.trim() : null,
    role: decoded.role.trim(),
    name: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : null,
  };
};

const toResponse = (controllerResponse: ControllerResponse) => {
  const headers = new Headers();
  Object.entries(controllerResponse.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (controllerResponse.statusCode === 204) {
    return new Response(null, { status: 204, headers });
  }

  if (controllerResponse.body === undefined) {
    return new Response(null, { status: controllerResponse.statusCode, headers });
  }

  const contentType = headers.get("content-type") || "";
  const body = controllerResponse.body;

  if (typeof body === "string") {
    if (!contentType) {
      headers.set("content-type", "text/plain; charset=utf-8");
    }
    return new Response(body, { status: controllerResponse.statusCode, headers });
  }

  if (body instanceof ArrayBuffer) {
    return new Response(Buffer.from(body), { status: controllerResponse.statusCode, headers });
  }

  if (body instanceof Uint8Array) {
    return new Response(Buffer.from(body), { status: controllerResponse.statusCode, headers });
  }

  if (!contentType) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), {
    status: controllerResponse.statusCode,
    headers,
  });
};

const createControllerResponse = (): ControllerResponse => {
  const response: ControllerResponse = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    body: undefined,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(data) {
      response.body = data;
      response.headersSent = true;
      response.headers["content-type"] = "application/json; charset=utf-8";
      return response;
    },
    send(data) {
      response.body = data;
      response.headersSent = true;
      return response;
    },
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = value;
      return response;
    },
  };

  return response;
};

const createControllerRequest = (
  request: Request,
  options: {
    body?: unknown;
    params?: Record<string, string>;
    user?: unknown;
    file?: unknown;
  } = {}
): ControllerRequest => {
  const url = new URL(request.url);
  const headers = buildHeadersObject(request);

  return {
    body: options.body,
    params: options.params ?? {},
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    protocol: url.protocol.replace(":", ""),
    user: options.user,
    file: options.file,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
};

export const runController = async (
  request: Request,
  controller: any,
  options: {
    body?: unknown;
    params?: Record<string, string>;
    user?: unknown;
    file?: unknown;
  } = {}
) => {
  const req = createControllerRequest(request, options);
  const res = createControllerResponse();
  let nextError: unknown;
  const next = (error?: unknown) => {
    if (error !== undefined) {
      nextError = error;
    }
  };

  try {
    await controller(req, res, next);

    if (nextError !== undefined && !res.headersSent) {
      console.error("API controller error:", nextError);
      const result = serializeError(nextError);
      return jsonResponse(result.data, result.status, result.headers);
    }

    return toResponse(res);
  } catch (error) {
    console.error("API controller error:", error);
    if (res.headersSent) {
      return toResponse(res);
    }
    const result = serializeError(error);
    return jsonResponse(result.data, result.status, result.headers);
  }
};

export const getAuthUser = async (request: Request) => {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  try {
    const decoded = verifyToken(token) as JwtAuthClaims;
    const fallbackUser = buildTokenAuthUser(decoded);
    if (!fallbackUser) {
      return null;
    }

    try {
      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: { id: fallbackUser.id },
        select: { id: true, email: true, role: true, name: true },
      });

      return user ?? null;
    } catch (error) {
      if (!canFallbackToTokenClaims(error)) {
        throw error;
      }

      console.warn("getAuthUser: falling back to JWT claims because the database is unreachable.");
      return fallbackUser;
    }
  } catch {
    return null;
  }
};
