// Schema barrel file — re-export all schemas as they're created
export { uuid, email, postalCode, maxStores, difficulty, priceTier, ingredientSchema, nutritionSchema } from './primitives.js';
export { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.js';
export { updateUserSchema } from './users.js';
export { nearbyStoresQuery } from './stores.js';
export type { NearbyStoresQuery } from './stores.js';
export { dealsQuery } from './deals.js';
export type { DealsQuery } from './deals.js';
export { mealsQuery, mealIdParam, swipeSchema } from './meals.js';
export type { MealsQuery, MealIdParam, SwipeInput } from './meals.js';
