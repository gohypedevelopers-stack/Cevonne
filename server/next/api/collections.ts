import collectionController from "@/server/controllers/collection.controller";

import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const requireAdmin = async (request: Request) => {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "ADMIN") return forbiddenResponse();
  return null;
};

export const dispatchCollectionsRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, collectionController.listCollections);
    }

    if (request.method === "POST") {
      const authFailure = await requireAdmin(request);
      if (authFailure) return authFailure;
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
    const authFailure = await requireAdmin(request);
    if (authFailure) return authFailure;
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, collectionController.updateCollection, {
      body,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    const authFailure = await requireAdmin(request);
    if (authFailure) return authFailure;
    return runController(request, collectionController.deleteCollection, {
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
