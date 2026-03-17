import { z } from 'zod';

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string(),
  unit: z.string(),
});

const nutritionSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  sodium_mg: z.number(),
  per_serving: z.boolean(),
}).transform(n => ({
  calories: n.calories,
  proteinG: n.protein_g,
  carbsG: n.carbs_g,
  fatG: n.fat_g,
  fiberG: n.fiber_g,
  sodiumMg: n.sodium_mg,
  perServing: n.per_serving,
}));

export const createRecipeBody = z.object({
  name: z.string().min(1, 'Recipe name is required.'),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required.'),
  tagline: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  steps: z.array(z.string()).optional(),
  prep_time_minutes: z.number().int().positive().optional(),
  cook_time_minutes: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium']).optional(),
  dietary_tags: z.array(z.string()).optional(),
  tips: z.string().optional(),
  nutrition: nutritionSchema.optional(),
  is_public: z.boolean().optional().default(false),
}).transform(d => ({
  name: d.name,
  ingredients: d.ingredients,
  tagline: d.tagline,
  description: d.description,
  instructions: d.instructions,
  steps: d.steps,
  prepTimeMinutes: d.prep_time_minutes,
  cookTimeMinutes: d.cook_time_minutes,
  servings: d.servings,
  difficulty: d.difficulty,
  dietaryTags: d.dietary_tags,
  tips: d.tips,
  nutrition: d.nutrition,
  isPublic: d.is_public,
}));

export type CreateRecipeInput = z.output<typeof createRecipeBody>;

export const updateRecipeBody = z.object({
  name: z.string().min(1).optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  steps: z.array(z.string()).optional(),
  prep_time_minutes: z.number().int().positive().optional(),
  cook_time_minutes: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium']).optional(),
  dietary_tags: z.array(z.string()).optional(),
  tips: z.string().optional(),
  nutrition: nutritionSchema.optional(),
  is_public: z.boolean().optional(),
}).transform(d => ({
  name: d.name,
  ingredients: d.ingredients,
  tagline: d.tagline,
  description: d.description,
  instructions: d.instructions,
  steps: d.steps,
  prepTimeMinutes: d.prep_time_minutes,
  cookTimeMinutes: d.cook_time_minutes,
  servings: d.servings,
  difficulty: d.difficulty,
  dietaryTags: d.dietary_tags,
  tips: d.tips,
  nutrition: d.nutrition,
  isPublic: d.is_public,
}));

export type UpdateRecipeInput = z.output<typeof updateRecipeBody>;

export const recipeIdParam = z.object({
  recipe_id: z.string().uuid(),
}).transform(d => ({
  recipeId: d.recipe_id,
}));

export type RecipeIdParam = z.output<typeof recipeIdParam>;

export const publishBody = z.object({
  is_public: z.boolean(),
}).transform(d => ({
  isPublic: d.is_public,
}));

export type PublishInput = z.output<typeof publishBody>;
