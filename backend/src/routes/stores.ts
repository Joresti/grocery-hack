import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { nearbyStoresQuery } from '../schemas/stores.js';
import type { NearbyStoresQuery } from '../schemas/stores.js';
import * as storesService from '../services/stores.js';

const router = Router();

router.get('/nearby',
  optionalAuth,
  validate({ query: nearbyStoresQuery }),
  async (req, res, next) => {
    try {
      const stores = await storesService.getNearbyStores(
        req.query as unknown as NearbyStoresQuery,
      );
      res.json({ stores });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/brands',
  async (_req, res, next) => {
    try {
      const brands = await storesService.getAllBrands();
      res.json({ brands });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
