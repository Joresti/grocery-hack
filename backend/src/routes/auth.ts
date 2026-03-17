import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.js';
import * as authService from '../services/auth.js';
import { userToSnakeCase } from '../services/auth.js';

const router = Router();

// POST /auth/register
router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        user: userToSnakeCase(result.user),
        token: result.token,
        refresh_token: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/login
router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        user: userToSnakeCase(result.user),
        token: result.token,
        refresh_token: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/refresh
router.post(
  '/refresh',
  validate({ body: refreshSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.refreshToken(req.body);
      res.status(200).json({
        token: result.token,
        refresh_token: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/forgot-password
router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.forgotPassword(req.body.email);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/reset-password
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  async (req, res, next) => {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.newPassword);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
