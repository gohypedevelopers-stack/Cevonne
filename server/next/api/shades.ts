import shadeController from "@/server/controllers/shade.controller";

import { jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

export const dispatchShadesRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, shadeController.listShades);
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, shadeController.createShade, { body });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (request.method === "GET") {
    return runController(request, shadeController.getShade, { params: { id: first } });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, shadeController.updateShade, {
      body,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    return runController(request, shadeController.deleteShade, {
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
