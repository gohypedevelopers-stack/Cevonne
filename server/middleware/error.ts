import type { NextFunction, Request, Response } from "express";

import { isHttpError } from "../http/errors";
import { serializeError } from "../http/responses";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err && String(err.message || "").startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }

  if (isHttpError(err)) {
    const result = serializeError(err);
    return res.status(result.status).json(result.data);
  }

  const result = serializeError(err);
  if (result.status >= 500) {
    console.error("[API Error]", err);
  }

  return res.status(result.status).json(result.data);
};
