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

// POST /family/plan/edit — the account holder changes a meal in their OWN current-week
// plan directly (no suggestion). Same body shape as suggestMealBody; kept as a separate
// schema so the two endpoints can diverge independently.
export const editPlanMealBody = z.object({
  target_meal_id: z.string().uuid(),
  replacement_meal_id: z.string().uuid(),
}).transform(d => ({
  targetMealId: d.target_meal_id,
  replacementMealId: d.replacement_meal_id,
}));

export type EditPlanMealInput = z.output<typeof editPlanMealBody>;

// Path params shared by the account-holder review actions
// (POST /family/suggestions/:id/accept and POST /family/suggestions/:id/dismiss):
// both take exactly the suggestion id.
export const suggestionIdParams = z.object({
  id: z.string().uuid(),
});

export type SuggestionIdParams = z.output<typeof suggestionIdParams>;
