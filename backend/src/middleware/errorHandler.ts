import type { Request, Response, NextFunction } from 'express';

export interface AppError {
  code: string;
  status: number;
  message: string;
}

export function createAppError(code: string, status: number, message: string): AppError {
  return { code, status, message };
}

export function throwNotFound(code: string, message: string): never {
  throw createAppError(code, 404, message);
}

export function throwBadRequest(code: string, message: string): never {
  throw createAppError(code, 400, message);
}

export function throwConflict(code: string, message: string): never {
  throw createAppError(code, 409, message);
}

export function throwForbidden(code: string, message: string): never {
  throw createAppError(code, 403, message);
}

export function throwUnauthorized(code: string, message: string): never {
  throw createAppError(code, 401, message);
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const appErr = err as AppError;
  const status = appErr.status ?? 500;
  const code = appErr.code ?? 'INTERNAL_ERROR';
  const message = status === 500
    ? 'Something went wrong. Please try again.'
    : appErr.message ?? 'Something went wrong. Please try again.';

  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      err: { message: err.message, stack: (err as Error).stack },
      req: { method: req.method, path: req.path },
    }));
  }

  res.status(status).json({ error: true, code, message });
}
