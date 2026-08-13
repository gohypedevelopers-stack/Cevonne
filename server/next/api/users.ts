import userController from "@/server/controllers/user.controller";

import {
  clearSessionCookie,
  getAuthUser,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  runController,
} from "../route-utils";
import { consumeRateLimit } from "@/server/security/rate-limit";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const rateLimitedResponse = (retryAfterSeconds: number) =>
  jsonResponse(
    { message: "Too many attempts. Please try again later." },
    429,
    { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
  );

const getEmail = (body: unknown) =>
  typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
    ? body.email
    : "";

const enforceAuthRateLimit = async (
  request: Request,
  action: "signup" | "signin" | "verify-otp" | "forgot-password" | "reset-password",
  body: unknown,
) => {
  const settings =
    action === "forgot-password"
      ? { limit: 3, windowMs: 60 * 60 * 1000 }
      : action === "reset-password"
        ? { limit: 5, windowMs: 60 * 60 * 1000 }
        : { limit: 5, windowMs: 15 * 60 * 1000 };
  return consumeRateLimit(request, `auth:${action}`, {
    ...settings,
    identifier: getEmail(body),
  });
};

const requireAdmin = async (request: Request) => {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "ADMIN") return forbiddenResponse();
  return null;
};

export const dispatchUsersRoute = async (request: Request, segments: string[] = []) => {
  const [first, second] = segments;

  if (!first) {
    if (request.method === "GET") {
      const authFailure = await requireAdmin(request);
      if (authFailure) return authFailure;
      return runController(request, userController.listUsers);
    }
    return methodNotAllowed(["GET"]);
  }

  if (first === "signup" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const rateLimit = await enforceAuthRateLimit(request, "signup", body);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds);
    return runController(request, userController.signup, { body });
  }

  if (first === "signin" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const rateLimit = await enforceAuthRateLimit(request, "signin", body);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds);
    return runController(request, userController.signin, { body });
  }

  if (first === "verify-otp" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const rateLimit = await enforceAuthRateLimit(request, "verify-otp", body);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds);
    return runController(request, userController.verifyOTP, { body });
  }

  if (first === "forgot-password" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const rateLimit = await enforceAuthRateLimit(request, "forgot-password", body);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds);
    return runController(request, userController.forgotPassword, { body });
  }

  if (first === "reset-password" && second && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const rateLimit = await enforceAuthRateLimit(request, "reset-password", body);
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.retryAfterSeconds);
    return runController(request, userController.resetPassword, {
      body,
      params: { token: second },
    });
  }

  if (first === "signout" && request.method === "POST") {
    return jsonResponse(
      { message: "Signed out." },
      200,
      { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" },
    );
  }

  if (first === "me") {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    if (request.method === "GET") {
      return runController(request, userController.getProfile, { user });
    }

    if (request.method === "PATCH") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, userController.updateProfile, { body, user });
    }

    return methodNotAllowed(["GET", "PATCH"]);
  }

  if (segments.length === 2 && second === "role" && request.method === "PATCH") {
    const authFailure = await requireAdmin(request);
    if (authFailure) return authFailure;
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.updateRole, {
      body,
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
