import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { SwipeableMeal } from '@groceryhack/shared/types';

/**
 * Swipeable meals from the shared pool (GET /api/v1/meals).
 * Used as the candidate deck in SuggestSwapModal. Pass `enabled=false` to
 * defer fetching until the consumer is ready (e.g. modal open).
 */
export function useMeals(enabled = true) {
  return useQuery<SwipeableMeal[]>({
    queryKey: ['meals'],
    queryFn: async () => {
      const res = await api.get<{ meals: SwipeableMeal[] }>('/meals');
      return res.meals;
    },
    enabled,
  });
}
