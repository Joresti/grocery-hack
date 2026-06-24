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

// POST /family/suggestions/:id/accept — the account holder accepts a pending suggestion.
export const acceptSuggestionParams = z.object({
  id: z.string().uuid(),
});

export type AcceptSuggestionParams = z.output<typeof acceptSuggestionParams>;
