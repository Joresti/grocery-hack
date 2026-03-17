import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { LikedMeal } from '@groceryhack/shared/types';

export function useLikedMeals() {
  return useQuery<LikedMeal[]>({
    queryKey: ['likedMeals'],
    queryFn: async () => {
      const res = await api.get<{ meals: LikedMeal[] }>('/meals/liked');
      return res.meals;
    },
  });
}
