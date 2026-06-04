import inventoryController from "@/server/controllers/inventory.controller";

import { jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

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
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, inventoryController.updateInventory, {
      body,
      params: { shadeId: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
