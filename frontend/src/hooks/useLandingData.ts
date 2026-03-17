import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { LandingPage } from '@groceryhack/shared/types';

export function useLandingData() {
  return useQuery<LandingPage>({
    queryKey: ['landing'],
    queryFn: () => api.get<LandingPage>('/landing'),
  });
}
