import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MealSuggestion } from '@groceryhack/shared/types';

/**
 * Account holder accepts a pending meal-swap suggestion
 * (POST /api/v1/family/suggestions/:id/accept). On success, invalidate the holder's
 * suggestion list AND the landing data so the accepted card disappears, the
 * "Suggestions (N)" badge decrements, and the landing plan section re-renders with the
 * swapped-in meal. The variable is the suggestion id.
 */
export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  return useMutation<MealSuggestion, Error, string>({
    mutationFn: (id: string) => api.post<MealSuggestion>(`/family/suggestions/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holderSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
