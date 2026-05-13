import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from './useAuth';
import type {
  ShoppingListResponse,
  CookingEffort,
} from '@groceryhack/shared/types';

function formatDietaryFilter(d: string): string {
  return d.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

function mapEffortToStyle(effort: CookingEffort): string {
  switch (effort) {
    case 'quick': return 'quick';
    case 'moderate': return 'balanced';
    case 'ambitious': return 'best';
    default: return 'balanced';
  }
}

export function useShoppingList() {
  const { user } = useAuth();

  const postalCode = user?.postalCode ?? '';
  const dietaryFilters = (user?.dietaryRestrictions ?? []).map(formatDietaryFilter).join(',');
  const cookingStyle = mapEffortToStyle(user?.cookingEffort ?? 'moderate');
  const maxStores = String(user?.maxStores ?? 1);

  return useQuery<ShoppingListResponse>({
    queryKey: ['shoppingList', postalCode, dietaryFilters, cookingStyle, maxStores],
    queryFn: () => {
      const params = new URLSearchParams({
        postal_code: postalCode,
        cooking_style: cookingStyle,
        max_stores: maxStores,
        per_page: '5',
      });
      // Dietary filters are only sent if the user has set them
      // If filters exclude all recipes, the API returns 404 and we gracefully show nothing
      if (dietaryFilters) {
        params.set('dietary_filters', dietaryFilters);
      }
      return api.get<ShoppingListResponse>(`/shopping-list?${params.toString()}`);
    },
    enabled: !!postalCode,
  });
}
