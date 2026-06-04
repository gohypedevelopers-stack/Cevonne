import productController from "@/server/controllers/product.controller";

import {
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  runController,
} from "../route-utils";

export const dispatchProductsRoute = async (request: Request, segments: string[] = []) => {
  const [first] = segments;

  if (!first) {
    if (request.method === "GET") {
      return runController(request, productController.listProducts);
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (body instanceof Response) return body;
      return runController(request, productController.createProduct, { body });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (first === "export" && request.method === "GET") {
    return runController(request, productController.exportProducts);
  }

  if (first === "bulk-import" && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, productController.bulkImportProducts, { body });
  }

  if (request.method === "GET") {
    return runController(request, productController.getProduct, { params: { id: first } });
  }

  if (request.method === "PUT") {
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    return runController(request, productController.updateProduct, {
      body,
      params: { id: first },
    });
  }

  if (request.method === "DELETE") {
    return runController(request, productController.deleteProduct, {
      params: { id: first },
    });
  }

  return jsonResponse({ message: "Not Found" }, 404);
};
