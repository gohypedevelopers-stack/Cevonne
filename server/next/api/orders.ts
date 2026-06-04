import orderController from "@/server/controllers/order.controller";

import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

export const dispatchOrdersRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    const auth = await getAuthUser(request);
    if (!auth) return unauthorizedResponse();

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, orderController.createOrder, { body, user: auth });
    }

    if (request.method === "GET") {
      if (auth.role !== "ADMIN") return forbiddenResponse();
      return runController(request, orderController.listOrders, { user: auth });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (first === "my" && request.method === "GET") {
    const auth = await getAuthUser(request);
    if (!auth) return unauthorizedResponse();
    return runController(request, orderController.getMyOrders, { user: auth });
  }

  if (request.method === "PATCH") {
    const auth = await getAuthUser(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== "ADMIN") return forbiddenResponse();

    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, orderController.updateOrder, {
      body,
      user: auth,
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
