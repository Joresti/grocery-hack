import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { optimizeBody } from '../schemas/optimize.js';
import * as optimizerService from '../services/optimizer.js';

const router = Router();

router.post('/',
  requireAuth,
  validate({ body: optimizeBody }),
  async (req, res, next) => {
    try {
      const plan = await optimizerService.optimize(
        req.user!.userId,
        req.body,
      );
      res.json(plan);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
