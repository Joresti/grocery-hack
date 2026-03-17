import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { mealsQuery, mealIdParam, swipeSchema } from '../schemas/meals.js';
import type { MealsQuery, MealIdParam, SwipeInput } from '../schemas/meals.js';
import * as mealsService from '../services/meals.js';

const router = Router();

// GET /meals — swipeable meals (auth required to exclude already-swiped)
router.get('/',
  requireAuth,
  validate({ query: mealsQuery }),
  async (req, res, next) => {
    try {
      const { limit } = req.query as unknown as MealsQuery;
      const meals = await mealsService.getSwipeableMeals(req.user!.userId, limit);
      res.json({ meals });
    } catch (err) {
      next(err);
    }
  },
);

// GET /meals/liked — must be BEFORE /:meal_id to avoid route conflict
router.get('/liked',
  requireAuth,
  async (req, res, next) => {
    try {
      const meals = await mealsService.getLikedMeals(req.user!.userId);
      res.json({ meals });
    } catch (err) {
      next(err);
    }
  },
);

// GET /meals/:meal_id
router.get('/:meal_id',
  validate({ params: mealIdParam }),
  async (req, res, next) => {
    try {
      const { mealId } = req.params as unknown as MealIdParam;
      const meal = await mealsService.getMealById(mealId);
      res.json(meal);
    } catch (err) {
      next(err);
    }
  },
);

// POST /meals/:meal_id/swipe
router.post('/:meal_id/swipe',
  requireAuth,
  validate({ params: mealIdParam, body: swipeSchema }),
  async (req, res, next) => {
    try {
      const { mealId } = req.params as unknown as MealIdParam;
      const { liked } = req.body as SwipeInput;
      const result = await mealsService.swipeMeal(req.user!.userId, mealId, liked);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
