import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { FamilyPlanResponse } from '@groceryhack/shared/types';

export function useFamilyPlan() {
  return useQuery<FamilyPlanResponse>({
    queryKey: ['familyPlan'],
    queryFn: () => api.get<FamilyPlanResponse>('/family/plan'),
  });
}
