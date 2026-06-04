import { STATUS_CODES } from "./statusCodes";

type HttpErrorOptions = {
  expose?: boolean;
  cause?: unknown;
};

export class HttpError extends Error {
  statusCode: number;
  expose: boolean;
  override cause?: unknown;

  constructor(message: string, statusCode: number = STATUS_CODES.INTERNAL_SERVER_ERROR, options: HttpErrorOptions = {}) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.expose = options.expose ?? statusCode < STATUS_CODES.INTERNAL_SERVER_ERROR;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export const createHttpError = (statusCode: number, message: string, options: HttpErrorOptions = {}) =>
  new HttpError(message, statusCode, options);

export const badRequest = (message = "Bad request", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.BAD_REQUEST, message, options);

export const unauthorized = (message = "Unauthorized", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.UNAUTHORIZED, message, options);

export const forbidden = (message = "Forbidden", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.FORBIDDEN, message, options);

export const notFound = (message = "Not found", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.NOT_FOUND, message, options);

export const conflict = (message = "Conflict", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.CONFLICT, message, options);

export const notImplemented = (message = "Not implemented", options: HttpErrorOptions = {}) =>
  createHttpError(STATUS_CODES.NOT_IMPLEMENTED, message, options);

export const isHttpError = (error: unknown) =>
  Boolean(error) &&
  (error instanceof HttpError ||
    (typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") ||
    (typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"));
