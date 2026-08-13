import inventoryController from "@/server/controllers/inventory.controller";

import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const requireAdmin = async (request: Request) => {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "ADMIN") return forbiddenResponse();
  return null;
};

export const dispatchInventoryRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, inventoryController.listInventory);
    }
    return methodNotAllowed(["GET"]);
  }

  if (first === "low" && request.method === "GET") {
    return runController(request, inventoryController.listLowStock);
  }

  if (request.method === "PUT") {
    const authFailure = await requireAdmin(request);
    if (authFailure) return authFailure;
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, inventoryController.updateInventory, {
      body,
      params: { shadeId: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
