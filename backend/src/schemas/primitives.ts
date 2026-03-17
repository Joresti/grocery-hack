import { z } from 'zod';

export const uuid = z.string().uuid();
export const email = z.string().email();
export const postalCode = z.string().min(3).max(10);
export const maxStores = z.union([z.literal(1), z.literal(2)]);
export const difficulty = z.enum(['easy', 'medium']);
export const priceTier = z.enum(['staple', 'premium', 'luxury']);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string(),
  unit: z.string(),
});

export const nutritionSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  sodium_mg: z.number(),
  per_serving: z.boolean().default(true),
}).transform(d => ({
  calories: d.calories,
  proteinG: d.protein_g,
  carbsG: d.carbs_g,
  fatG: d.fat_g,
  fiberG: d.fiber_g,
  sodiumMg: d.sodium_mg,
  perServing: d.per_serving,
}));
