import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { GroceryPlan } from '@groceryhack/shared/types';

/** The updated plan representations returned by POST /family/plan/edit (camelCased). */
interface DirectEditResult {
  oneStoreOptimized: GroceryPlan;
  twoStoreOptimized: GroceryPlan | null;
}

/**
 * Account holder changes a meal in their OWN current-week plan directly
 * (POST /api/v1/family/plan/edit). No suggestion is created. On success, invalidate the
 * landing data so the plan section re-renders with the swapped-in meal and recomputed
 * savings / shopping list (mirrors useAcceptSuggestion's ['landing'] invalidation). It does
 * NOT touch ['holderSuggestions'] / ['mySuggestions'] — no suggestion is involved.
 */
export function useDirectEditMeal() {
  const queryClient = useQueryClient();
  return useMutation<DirectEditResult, Error, { targetMealId: string; replacementMealId: string }>({
    mutationFn: ({ targetMealId, replacementMealId }) =>
      api.post<DirectEditResult>('/family/plan/edit', {
        target_meal_id: targetMealId,
        replacement_meal_id: replacementMealId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
