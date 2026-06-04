import reviewController from "@/server/controllers/review.controller";

import { jsonResponse, methodNotAllowed, readJsonBody, runController } from "../route-utils";

export const dispatchReviewsRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, reviewController.listReviews);
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, reviewController.createReview, { body });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (request.method === "GET") {
    return runController(request, reviewController.getReview, { params: { id: first } });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, reviewController.updateReview, {
      body,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    return runController(request, reviewController.deleteReview, {
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
