export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly publicMessage: string;

  constructor(opts: {
    code: string;
    status?: number;
    publicMessage: string;
    cause?: unknown;
  }) {
    super(opts.publicMessage);
    this.code = opts.code;
    this.status = opts.status ?? 500;
    this.publicMessage = opts.publicMessage;
    if (opts.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = opts.cause;
    }
  }

  toJSON() {
    return { ok: false, code: this.code, message: this.publicMessage };
  }
}

export function isAppError(x: unknown): x is AppError {
  return x instanceof AppError;
}
