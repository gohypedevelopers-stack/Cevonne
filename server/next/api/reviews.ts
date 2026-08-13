import reviewController from "@/server/controllers/review.controller";

import { getAuthUser, jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

export const dispatchReviewsRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, reviewController.listReviews, { user: await getAuthUser(request) });
    }

    if (request.method === "POST") {
      const user = await getAuthUser(request);
      if (!user) return jsonResponse({ message: "Unauthorized" }, 401);
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, reviewController.createReview, { body, user });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (request.method === "GET") {
    return runController(request, reviewController.getReview, {
      params: { id: first },
      user: await getAuthUser(request),
    });
  }

  if (request.method === "PUT") {
    const user = await getAuthUser(request);
    if (!user) return jsonResponse({ message: "Unauthorized" }, 401);
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, reviewController.updateReview, {
      body,
      user,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    const user = await getAuthUser(request);
    if (!user) return jsonResponse({ message: "Unauthorized" }, 401);
    return runController(request, reviewController.deleteReview, {
      user,
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
