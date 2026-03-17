import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validate.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('validate', () => {
  describe('body validation', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    }).transform(d => ({
      name: d.name,
      age: d.age,
    }));

    it('passes valid body and replaces req.body with parsed value', () => {
      const req = mockReq({ body: { name: 'Alice', age: 30 } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice', age: 30 });
    });

    it('calls next with VALIDATION_ERROR for invalid body', () => {
      const req = mockReq({ body: { name: '', age: 30 } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err).toBeDefined();
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.status).toBe(400);
    });

    it('calls next with error when required field is missing', () => {
      const req = mockReq({ body: { age: 30 } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as { code: string; status: number };
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      meal_id: z.string().uuid(),
    }).transform(d => ({
      mealId: d.meal_id,
    }));

    it('passes valid params and replaces req.params with parsed value', () => {
      const req = mockReq({ params: { meal_id: '550e8400-e29b-41d4-a716-446655440000' } as Record<string, string> });
      const res = mockRes();
      const next = vi.fn();

      validate({ params: paramsSchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
      expect(req.params).toEqual({ mealId: '550e8400-e29b-41d4-a716-446655440000' });
    });

    it('calls next with INVALID_MEAL_ID for invalid meal_id param', () => {
      const req = mockReq({ params: { meal_id: 'not-a-uuid' } as Record<string, string> });
      const res = mockRes();
      const next = vi.fn();

      validate({ params: paramsSchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err).toBeDefined();
      expect(err.code).toBe('INVALID_MEAL_ID');
      expect(err.status).toBe(400);
      expect(err.message).toBe('Invalid meal ID.');
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).transform(d => ({
      limit: d.limit,
    }));

    it('passes valid query and replaces req.query with parsed value', () => {
      const req = mockReq({ query: { limit: '10' } as Record<string, string> });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
      expect(req.query).toEqual({ limit: 10 });
    });

    it('applies defaults when query is empty', () => {
      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
      expect(req.query).toEqual({ limit: 20 });
    });

    it('calls next with error for invalid query', () => {
      const req = mockReq({ query: { limit: '999' } as Record<string, string> });
      const res = mockRes();
      const next = vi.fn();

      validate({ query: querySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as { code: string; status: number };
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
    });
  });

  describe('field-specific error codes', () => {
    it('returns WEAK_PASSWORD for password validation failure', () => {
      const schema = z.object({
        password: z.string().min(8),
      });
      const req = mockReq({ body: { password: 'short' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next as NextFunction);

      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err.code).toBe('WEAK_PASSWORD');
      expect(err.message).toBe('Password must be at least 8 characters.');
    });

    it('returns WEAK_PASSWORD for new_password validation failure', () => {
      const schema = z.object({
        new_password: z.string().min(8),
      });
      const req = mockReq({ body: { new_password: 'short' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next as NextFunction);

      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err.code).toBe('WEAK_PASSWORD');
      expect(err.message).toBe('Password must be at least 8 characters.');
    });

    it('returns INVALID_EMAIL for email validation failure', () => {
      const schema = z.object({
        email: z.string().email(),
      });
      const req = mockReq({ body: { email: 'not-valid' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next as NextFunction);

      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err.code).toBe('INVALID_EMAIL');
      expect(err.message).toBe('Please enter a valid email address.');
    });

    it('returns INVALID_POSTAL_CODE for postal_code validation failure', () => {
      const schema = z.object({
        postal_code: z.string().min(3),
      });
      const req = mockReq({ body: { postal_code: 'AB' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next as NextFunction);

      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err.code).toBe('INVALID_POSTAL_CODE');
      expect(err.message).toBe('Please enter a valid postal code or zip code.');
    });

    it('returns generic VALIDATION_ERROR for unmapped fields', () => {
      const schema = z.object({
        username: z.string().min(3),
      });
      const req = mockReq({ body: { username: 'ab' } });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: schema })(req, res, next as NextFunction);

      const err = next.mock.calls[0]?.[0] as { code: string; status: number; message: string };
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.status).toBe(400);
      expect(err.message).toContain('username');
    });
  });

  describe('multiple schemas', () => {
    it('validates body, params, and query together', () => {
      const bodySchema = z.object({ name: z.string() });
      const paramsSchema = z.object({ id: z.string() });
      const querySchema = z.object({ page: z.coerce.number().default(1) });

      const req = mockReq({
        body: { name: 'Test' },
        params: { id: 'abc' } as Record<string, string>,
        query: { page: '2' } as Record<string, string>,
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema, params: paramsSchema, query: querySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Test' });
      expect(req.params).toEqual({ id: 'abc' });
      expect(req.query).toEqual({ page: 2 });
    });

    it('fails on first invalid schema (body checked first)', () => {
      const bodySchema = z.object({ name: z.string().min(1) });
      const querySchema = z.object({ page: z.coerce.number().default(1) });

      const req = mockReq({
        body: { name: '' },
        query: { page: '1' } as Record<string, string>,
      });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: bodySchema, query: querySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as { code: string; status: number };
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
    });
  });

  describe('no schemas', () => {
    it('calls next() when no schemas are provided', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      validate({})(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('non-Zod errors', () => {
    it('passes through non-ZodError exceptions via next()', () => {
      // Use a schema whose parse will throw a non-Zod error
      const faultySchema = {
        parse: () => { throw new Error('unexpected'); },
      } as unknown as z.ZodSchema;

      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = vi.fn();

      validate({ body: faultySchema })(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0]?.[0] as Error;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('unexpected');
    });
  });
});
