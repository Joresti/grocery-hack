import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { shareMealBody, shareRespondParams, shareRespondQuery, sharePlanBody } from '../schemas/sharing.js';
import type { ShareMealInput, ShareRespondParams, ShareRespondQuery, SharePlanInput } from '../schemas/sharing.js';
import * as sharingService from '../services/sharing.js';

const router = Router();

// POST /meal — share a meal (cook for me / make for you)
router.post('/meal',
  requireAuth,
  validate({ body: shareMealBody }),
  async (req, res, next) => {
    try {
      const data = req.body as ShareMealInput;
      const result = await sharingService.shareMeal(req.user!.userId, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:token/respond — accept or decline a share (unauthenticated)
router.get('/:token/respond',
  validate({ params: shareRespondParams, query: shareRespondQuery }),
  async (req, res, next) => {
    try {
      const { token } = req.params as unknown as ShareRespondParams;
      const { action } = req.query as unknown as ShareRespondQuery;
      const result = await sharingService.respondToShare(token, action);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /plan — share a weekly plan
router.post('/plan',
  requireAuth,
  validate({ body: sharePlanBody }),
  async (req, res, next) => {
    try {
      const data = req.body as SharePlanInput;
      const result = await sharingService.sharePlan(req.user!.userId, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
