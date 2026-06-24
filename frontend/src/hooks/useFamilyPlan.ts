import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { FamilyPlanResponse, MealSuggestion } from '@groceryhack/shared/types';

export function useFamilyPlan() {
  return useQuery<FamilyPlanResponse>({
    queryKey: ['familyPlan'],
    queryFn: () => api.get<FamilyPlanResponse>('/family/plan'),
  });
}

/**
 * Submit a meal-replacement suggestion (POST /api/v1/family/plan/suggestions).
 * YUM in SuggestSwapModal calls this. On success we invalidate the family plan
 * so the "Suggestion pending" markers refresh from the server.
 */
export function useSuggestMeal() {
  const queryClient = useQueryClient();
  return useMutation<MealSuggestion, Error, { targetMealId: string; replacementMealId: string }>({
    mutationFn: ({ targetMealId, replacementMealId }) =>
      api.post<MealSuggestion>('/family/plan/suggestions', {
        target_meal_id: targetMealId,
        replacement_meal_id: replacementMealId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['familyPlan'] });
      // Refresh "My Suggestions" so a just-submitted pending suggestion appears next open.
      queryClient.invalidateQueries({ queryKey: ['mySuggestions'] });
    },
  });
}
