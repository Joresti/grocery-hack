import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../schemas/users.js';
import * as authService from '../services/auth.js';
import { userToSnakeCase } from '../services/auth.js';

const router = Router();

// GET /users/me
router.get(
  '/me',
  requireAuth,
  async (req, res, next) => {
    try {
      const user = await authService.getProfile(req.user!.userId);
      res.status(200).json(userToSnakeCase(user));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /users/me
router.patch(
  '/me',
  requireAuth,
  validate({ body: updateUserSchema }),
  async (req, res, next) => {
    try {
      const user = await authService.updateProfile(req.user!.userId, req.body);
      res.status(200).json(userToSnakeCase(user));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
