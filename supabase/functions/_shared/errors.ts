export type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'internal_error';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(status: number, code: ErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(500, 'internal_error', 'The service could not complete this request.', true);
}
