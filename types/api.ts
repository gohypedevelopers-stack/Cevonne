export interface ApiMessage {
  message: string;
}

export interface ApiSuccess<T = unknown> {
  success?: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, string>;
}

export interface ControllerResult<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
