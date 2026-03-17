import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as landingService from '../services/landing.js';

const router = Router();

// GET /api/v1/landing — single endpoint for the entire landing page
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await landingService.getLandingPage(req.user!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
