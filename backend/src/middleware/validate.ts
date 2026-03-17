import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        if (!firstIssue) {
          next({ code: 'VALIDATION_ERROR', status: 400, message: 'Invalid request.' });
          return;
        }

        const path = firstIssue.path.join('.');

        // Map specific fields to spec-required error codes
        const fieldErrorMap: Record<string, { code: string; message: string }> = {
          'password': { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' },
          'new_password': { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' },
          'email': { code: 'INVALID_EMAIL', message: 'Please enter a valid email address.' },
          'postal_code': { code: 'INVALID_POSTAL_CODE', message: 'Please enter a valid postal code or zip code.' },
          'meal_id': { code: 'INVALID_MEAL_ID', message: 'Invalid meal ID.' },
        };

        const mapped = fieldErrorMap[path];
        if (mapped) {
          next({ code: mapped.code, status: 400, message: mapped.message });
        } else {
          next({
            code: 'VALIDATION_ERROR',
            status: 400,
            message: `Invalid request: ${firstIssue.path.join('.')} ${firstIssue.message}`,
          });
        }
      } else {
        next(err);
      }
    }
  };
}
