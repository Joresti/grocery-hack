import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRecipeBody, updateRecipeBody, recipeIdParam, publishBody } from '../schemas/recipes.js';
import type { CreateRecipeInput, UpdateRecipeInput, RecipeIdParam, PublishInput } from '../schemas/recipes.js';
import * as recipesService from '../services/recipes.js';

const router = Router();

// GET /recipes — list current user's recipes
router.get('/',
  requireAuth,
  async (req, res, next) => {
    try {
      const recipes = await recipesService.getUserRecipes(req.user!.userId);
      res.json({ recipes });
    } catch (err) {
      next(err);
    }
  },
);

// POST /recipes — create a new recipe
router.post('/',
  requireAuth,
  validate({ body: createRecipeBody }),
  async (req, res, next) => {
    try {
      const data = req.body as CreateRecipeInput;
      const recipe = await recipesService.createRecipe(req.user!.userId, data);
      res.status(201).json(recipe);
    } catch (err) {
      next(err);
    }
  },
);

// GET /recipes/:recipe_id — get a specific recipe
router.get('/:recipe_id',
  requireAuth,
  validate({ params: recipeIdParam }),
  async (req, res, next) => {
    try {
      const { recipeId } = req.params as unknown as RecipeIdParam;
      const recipe = await recipesService.getRecipe(req.user!.userId, recipeId);
      res.json(recipe);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /recipes/:recipe_id — update a recipe
router.patch('/:recipe_id',
  requireAuth,
  validate({ params: recipeIdParam, body: updateRecipeBody }),
  async (req, res, next) => {
    try {
      const { recipeId } = req.params as unknown as RecipeIdParam;
      const data = req.body as UpdateRecipeInput;
      const recipe = await recipesService.updateRecipe(req.user!.userId, recipeId, data);
      res.json(recipe);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /recipes/:recipe_id — delete a recipe
router.delete('/:recipe_id',
  requireAuth,
  validate({ params: recipeIdParam }),
  async (req, res, next) => {
    try {
      const { recipeId } = req.params as unknown as RecipeIdParam;
      await recipesService.deleteRecipe(req.user!.userId, recipeId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// GET /recipes/:recipe_id/stats — get recipe performance stats
router.get('/:recipe_id/stats',
  requireAuth,
  validate({ params: recipeIdParam }),
  async (req, res, next) => {
    try {
      const { recipeId } = req.params as unknown as RecipeIdParam;
      const stats = await recipesService.getRecipeStats(req.user!.userId, recipeId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

// POST /recipes/:recipe_id/publish — toggle public visibility
router.post('/:recipe_id/publish',
  requireAuth,
  validate({ params: recipeIdParam, body: publishBody }),
  async (req, res, next) => {
    try {
      const { recipeId } = req.params as unknown as RecipeIdParam;
      const { isPublic } = req.body as PublishInput;
      const recipe = await recipesService.publishRecipe(req.user!.userId, recipeId, isPublic);
      res.json(recipe);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
