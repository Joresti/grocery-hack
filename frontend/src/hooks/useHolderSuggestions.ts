import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HolderSuggestionsResponse } from '@groceryhack/shared/types';

/**
 * Pending meal-swap suggestions addressed to the authenticated account holder
 * (GET /api/v1/family/suggestions). Backs the read-only ReviewSuggestionsModal.
 * Slices 5/6 will invalidate ['holderSuggestions'] after accept/dismiss.
 */
export function useHolderSuggestions(enabled: boolean) {
  return useQuery<HolderSuggestionsResponse>({
    queryKey: ['holderSuggestions'],
    queryFn: () => api.get<HolderSuggestionsResponse>('/family/suggestions'),
    enabled,
  });
}
