import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as adminService from '../services/admin.js';

const router = Router();

// GET /trial-metrics — aggregated trial analytics dashboard
// For trial mode, all authenticated users can access (admin check deferred to post-trial)
router.get('/trial-metrics',
  requireAuth,
  async (_req, res, next) => {
    try {
      const metrics = await adminService.getTrialMetrics();
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
