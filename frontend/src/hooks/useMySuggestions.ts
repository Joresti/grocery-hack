import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MySuggestionsResponse } from '@groceryhack/shared/types';

/**
 * The authenticated family member's own meal-swap suggestions on the account holder's
 * current-week plan, in every status (GET /api/v1/family/my-suggestions). Backs the
 * read-only MySuggestionsModal. `enabled`-gated so it fetches only while the modal is open.
 * useSuggestMeal invalidates ['mySuggestions'] so a newly-submitted suggestion appears next open.
 */
export function useMySuggestions(enabled: boolean) {
  return useQuery<MySuggestionsResponse>({
    queryKey: ['mySuggestions'],
    queryFn: () => api.get<MySuggestionsResponse>('/family/my-suggestions'),
    enabled,
  });
}
