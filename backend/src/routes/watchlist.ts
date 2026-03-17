import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { heartDealBody, watchlistIdParam } from '../schemas/watchlist.js';
import type { HeartDealInput, WatchlistIdParam } from '../schemas/watchlist.js';
import * as watchlistService from '../services/watchlist.js';

const router = Router();

// GET /watchlist — get user's watchlist
router.get('/',
  requireAuth,
  async (req, res, next) => {
    try {
      const items = await watchlistService.getWatchlist(req.user!.userId);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// POST /watchlist — heart a deal (add to watchlist)
router.post('/',
  requireAuth,
  validate({ body: heartDealBody }),
  async (req, res, next) => {
    try {
      const { dealId } = req.body as HeartDealInput;
      const item = await watchlistService.heartDeal(req.user!.userId, dealId);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /watchlist/:watchlist_id — unheart a deal (remove from watchlist)
router.delete('/:watchlist_id',
  requireAuth,
  validate({ params: watchlistIdParam }),
  async (req, res, next) => {
    try {
      const { watchlistId } = req.params as unknown as WatchlistIdParam;
      await watchlistService.unheartDeal(req.user!.userId, watchlistId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
