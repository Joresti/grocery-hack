import { z } from 'zod';

export const mealsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).transform(d => ({
  limit: d.limit,
}));

export type MealsQuery = z.output<typeof mealsQuery>;

export const mealIdParam = z.object({
  meal_id: z.string().uuid(),
}).transform(d => ({
  mealId: d.meal_id,
}));

export type MealIdParam = z.output<typeof mealIdParam>;

export const swipeSchema = z.object({
  liked: z.boolean(),
}).transform(d => ({
  liked: d.liked,
}));

export type SwipeInput = z.output<typeof swipeSchema>;
