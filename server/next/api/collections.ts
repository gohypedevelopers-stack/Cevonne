import collectionController from "@/server/controllers/collection.controller";

import { jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

export const dispatchCollectionsRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, collectionController.listCollections);
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, collectionController.createCollection, { body });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (request.method === "GET") {
    return runController(request, collectionController.getCollection, { params: { id: first } });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, collectionController.updateCollection, {
      body,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    return runController(request, collectionController.deleteCollection, {
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
