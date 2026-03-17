import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { dealsQuery } from '../schemas/deals.js';
import * as dealsService from '../services/deals.js';

const router = Router();

router.get('/',
  validate({ query: dealsQuery }),
  async (req, res, next) => {
    try {
      const deals = await dealsService.getActiveDeals(
        req.query as unknown as { storeBrandId?: string; category?: string; search?: string },
      );
      res.json({ deals });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/notable',
  async (_req, res, next) => {
    try {
      const deals = await dealsService.getNotableDeals();
      res.json({ deals });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
