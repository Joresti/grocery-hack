import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MealSuggestion } from '@groceryhack/shared/types';

/**
 * Account holder dismisses a pending meal-swap suggestion
 * (POST /api/v1/family/suggestions/:id/dismiss). The holder's plan is left unchanged — only
 * the suggestion's status flips to `dismissed`. On success, invalidate the holder's suggestion
 * list AND the landing data so the dismissed card disappears and the "Suggestions (N)" badge
 * decrements (the landing plan section is unaffected). The variable is the suggestion id.
 */
export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  return useMutation<MealSuggestion, Error, string>({
    mutationFn: (id: string) => api.post<MealSuggestion>(`/family/suggestions/${id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holderSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
