import userController from "@/server/controllers/user.controller";

import {
  getAuthUser,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  runController,
} from "../route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);

export const dispatchUsersRoute = async (request: Request, segments: string[] = []) => {
  const [first, second] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, userController.listUsers);
    }
    return methodNotAllowed(["GET"]);
  }

  if (first === "signup" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.signup, { body });
  }

  if (first === "signin" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.signin, { body });
  }

  if (first === "verify-otp" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.verifyOTP, { body });
  }

  if (first === "google" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.googleAuth, { body });
  }

  if (first === "forgot-password" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.forgotPassword, { body });
  }

  if (first === "reset-password" && second && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.resetPassword, {
      body,
      params: { token: second },
    });
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
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, userController.updateRole, {
      body,
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
