import { z } from 'zod';

// POST /family/plan/suggestions — a family member suggests a replacement meal.
export const suggestMealBody = z.object({
  target_meal_id: z.string().uuid(),
  replacement_meal_id: z.string().uuid(),
}).transform(d => ({
  targetMealId: d.target_meal_id,
  replacementMealId: d.replacement_meal_id,
}));

export type SuggestMealInput = z.output<typeof suggestMealBody>;

// Path params shared by the account-holder review actions
// (POST /family/suggestions/:id/accept and POST /family/suggestions/:id/dismiss):
// both take exactly the suggestion id.
export const suggestionIdParams = z.object({
  id: z.string().uuid(),
});

export type SuggestionIdParams = z.output<typeof suggestionIdParams>;
