export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
    this.name = 'AppError';
  }
}

export function toSafeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(
    'internal_error',
    'Something went wrong. Please ask an operator for help.',
    false,
    {
      cause: error,
    },
  );
}
