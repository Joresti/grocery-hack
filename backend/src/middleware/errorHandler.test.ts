import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, createAppError, throwNotFound, throwBadRequest, throwConflict, throwForbidden, throwUnauthorized } from './errorHandler.js';
import type { AppError } from './errorHandler.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    ...overrides,
  } as Request;
}

function mockRes(): Response & { _status: number; _json: Record<string, unknown> | null } {
  const res = {
    _status: 0,
    _json: null as Record<string, unknown> | null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: Record<string, unknown>) {
      res._json = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: Record<string, unknown> | null };
}

describe('createAppError', () => {
  it('creates an error with code, status, and message', () => {
    const err = createAppError('NOT_FOUND', 404, 'Resource not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Resource not found');
  });
});

describe('throwNotFound', () => {
  it('throws an AppError with status 404', () => {
    try {
      throwNotFound('MEAL_NOT_FOUND', 'Meal not found');
      expect.fail('should have thrown');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(404);
      expect(appErr.code).toBe('MEAL_NOT_FOUND');
      expect(appErr.message).toBe('Meal not found');
    }
  });
});

describe('throwBadRequest', () => {
  it('throws an AppError with status 400', () => {
    try {
      throwBadRequest('BAD_INPUT', 'Invalid input');
      expect.fail('should have thrown');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(400);
      expect(appErr.code).toBe('BAD_INPUT');
    }
  });
});

describe('throwConflict', () => {
  it('throws an AppError with status 409', () => {
    try {
      throwConflict('EMAIL_EXISTS', 'Email already registered');
      expect.fail('should have thrown');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(409);
      expect(appErr.code).toBe('EMAIL_EXISTS');
    }
  });
});

describe('throwForbidden', () => {
  it('throws an AppError with status 403', () => {
    try {
      throwForbidden('FORBIDDEN', 'Access denied');
      expect.fail('should have thrown');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(403);
      expect(appErr.code).toBe('FORBIDDEN');
    }
  });
});

describe('throwUnauthorized', () => {
  it('throws an AppError with status 401', () => {
    try {
      throwUnauthorized('UNAUTHORIZED', 'Not authenticated');
      expect.fail('should have thrown');
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(401);
      expect(appErr.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('errorHandler', () => {
  it('returns correct JSON shape for AppError', () => {
    const err = createAppError('MEAL_NOT_FOUND', 404, 'Meal not found');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({
      error: true,
      code: 'MEAL_NOT_FOUND',
      message: 'Meal not found',
    });
  });

  it('returns correct shape for 400 error', () => {
    const err = createAppError('VALIDATION_ERROR', 400, 'Invalid email');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(err, req, res, next);

    expect(res._status).toBe(400);
    expect(res._json).toEqual({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Invalid email',
    });
  });

  it('returns generic message for 500 errors', () => {
    const err = createAppError('DB_ERROR', 500, 'Connection pool exhausted');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    // Suppress console.error during this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({
      error: true,
      code: 'DB_ERROR',
      message: 'Something went wrong. Please try again.',
    });
    // Original error message should NOT be exposed
    expect(res._json?.message).not.toBe('Connection pool exhausted');

    consoleSpy.mockRestore();
  });

  it('defaults to 500 and INTERNAL_ERROR for unknown errors', () => {
    const err = new Error('unexpected crash');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({
      error: true,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    });

    consoleSpy.mockRestore();
  });

  it('always includes error: true in response', () => {
    const cases: Array<AppError | Error> = [
      createAppError('NOT_FOUND', 404, 'Not found'),
      createAppError('BAD_REQUEST', 400, 'Bad request'),
      createAppError('INTERNAL', 500, 'Internal'),
      new Error('generic error'),
    ];

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (const err of cases) {
      const res = mockRes();
      errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);
      expect(res._json?.error).toBe(true);
    }

    consoleSpy.mockRestore();
  });

  it('logs to console.error for 500 status errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const err = createAppError('SERVER_ERROR', 500, 'Something broke');
    errorHandler(err, mockReq(), mockRes(), vi.fn() as unknown as NextFunction);

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('does not log to console.error for non-500 errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const err = createAppError('NOT_FOUND', 404, 'Not found');
    errorHandler(err, mockReq(), mockRes(), vi.fn() as unknown as NextFunction);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('returns 401 status for unauthorized errors', () => {
    const err = createAppError('TOKEN_EXPIRED', 401, 'Token expired');
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);

    expect(res._status).toBe(401);
    expect(res._json).toEqual({
      error: true,
      code: 'TOKEN_EXPIRED',
      message: 'Token expired',
    });
  });

  it('returns 409 status for conflict errors', () => {
    const err = createAppError('EMAIL_EXISTS', 409, 'Email already exists');
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn() as unknown as NextFunction);

    expect(res._status).toBe(409);
    expect(res._json).toEqual({
      error: true,
      code: 'EMAIL_EXISTS',
      message: 'Email already exists',
    });
  });
});
