import { serializeError } from "@/server/http/responses";
import { getPrisma } from "@/server/db/prismaClient";
import { verifyToken } from "@/server/utils/jwt";

type PrimitiveHeaders = Record<string, string>;

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
      const result = serializeError(nextError);
      return jsonResponse(result.data, result.status, result.headers);
    }

    return toResponse(res);
  } catch (error) {
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
    const decoded = verifyToken(token) as { id?: string };
    if (!decoded?.id) {
      return null;
    }

    const prisma = await getPrisma();
    return prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, name: true },
    });
  } catch {
    return null;
  }
};
