import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { suggestMealBody, acceptSuggestionParams } from '../schemas/family.js';
import type { SuggestMealInput, AcceptSuggestionParams } from '../schemas/family.js';
import { getFamilyPlan, suggestMeal, getHolderSuggestions, acceptSuggestion } from '../services/family.js';

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

// GET /api/v1/family/suggestions — pending suggestions addressed to the authenticated account holder
router.get('/suggestions', requireAuth, async (req, res, next) => {
  try {
    const data = await getHolderSuggestions(req.user!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/family/suggestions/:id/accept — account holder accepts a pending suggestion
router.post(
  '/suggestions/:id/accept',
  requireAuth,
  validate({ params: acceptSuggestionParams }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as AcceptSuggestionParams;
      const suggestion = await acceptSuggestion(req.user!.userId, id);
      res.json(suggestion);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/family/plan/suggestions — family member suggests a replacement meal
router.post(
  '/plan/suggestions',
  requireAuth,
  validate({ body: suggestMealBody }),
  async (req, res, next) => {
    try {
      const { targetMealId, replacementMealId } = req.body as SuggestMealInput;
      const suggestion = await suggestMeal(req.user!.userId, targetMealId, replacementMealId);
      res.status(201).json(suggestion);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
