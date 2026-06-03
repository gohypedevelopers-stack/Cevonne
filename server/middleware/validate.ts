import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

const respondInvalid = (res: Response, error: unknown) => {
  const message =
    error && typeof error === "object" && "errors" in error
      ? (error as { errors?: Array<{ message?: string }> }).errors?.[0]?.message
      : "Invalid payload";
  return res.status(400).json({ message });
};

export const validate =
  (schema: ZodTypeAny, source: "body" | "query" | "params" = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const request = req as Request & Record<string, unknown>;
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      return respondInvalid(res, result.error);
    }

    request[source] = result.data;
    return next();
  };
