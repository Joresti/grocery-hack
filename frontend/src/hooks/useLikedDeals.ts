import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { WatchlistItem } from '@groceryhack/shared/types';

export function useWatchlist() {
  return useQuery<WatchlistItem[]>({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const res = await api.get<{ items: WatchlistItem[] }>('/watchlist');
      return res.items;
    },
  });
}

export function useHeartDeal() {
  const queryClient = useQueryClient();
  return useMutation<WatchlistItem, Error, string>({
    mutationFn: (dealId: string) =>
      api.post<WatchlistItem>('/watchlist', { deal_id: dealId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}

export function useUnheartDeal() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete<void>(`/watchlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
