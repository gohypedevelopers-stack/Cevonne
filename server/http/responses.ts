import { STATUS_CODES } from "./statusCodes";

type HeadersMap = Record<string, string>;

export const jsonResult = <T>(data: T, status: number = STATUS_CODES.OK, headers: HeadersMap = {}) => ({
  data,
  status,
  headers,
});

export const ok = <T>(data: T, headers: HeadersMap = {}) => jsonResult(data, STATUS_CODES.OK, headers);

export const created = <T>(data: T, headers: HeadersMap = {}) =>
  jsonResult(data, STATUS_CODES.CREATED, headers);

export const noContent = (headers = {}) =>
  jsonResult(null, STATUS_CODES.NO_CONTENT, headers);

export const accepted = <T>(data: T, headers: HeadersMap = {}) =>
  jsonResult(data, 202, headers);

export const errorResult = (message: string, status: number = STATUS_CODES.INTERNAL_SERVER_ERROR, extra: Record<string, unknown> = {}) => ({
  data: {
    success: false,
    message,
    ...extra,
  },
  status,
});

export const serializeError = (error: any, { production = process.env.NODE_ENV === "production" } = {}) => {
  const status = Number(error?.statusCode || error?.status || STATUS_CODES.INTERNAL_SERVER_ERROR);
  const message =
    production && status >= STATUS_CODES.INTERNAL_SERVER_ERROR
      ? "Internal server error"
      : error?.message || "Unexpected error";

  const payload: { success: false; message: string; code?: string } = {
    success: false,
    message,
  };

  if (error?.code) {
    payload.code = error.code;
  }

  return jsonResult(payload, status);
};
