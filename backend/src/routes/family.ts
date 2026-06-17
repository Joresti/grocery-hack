import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getFamilyPlan } from '../services/family.js';

const router = Router();

// GET /api/v1/family/plan — returns the account holder's current-week plan for the authenticated family member
router.get('/plan', requireAuth, async (req, res, next) => {
  try {
    const data = await getFamilyPlan(req.user!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
