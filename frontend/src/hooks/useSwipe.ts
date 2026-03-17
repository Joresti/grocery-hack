import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useSwipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, liked }: { mealId: string; liked: boolean }) =>
      api.post(`/meals/${mealId}/swipe`, { liked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
