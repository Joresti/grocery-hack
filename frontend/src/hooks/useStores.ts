import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { StoreLocation, StoreBrand } from '@groceryhack/shared/types';

export function useNearbyStores(postalCode: string, radiusKm = 15) {
  return useQuery<StoreLocation[]>({
    queryKey: ['stores', 'nearby', postalCode, radiusKm],
    queryFn: () =>
      api.get<StoreLocation[]>(
        `/stores/nearby?postal_code=${encodeURIComponent(postalCode)}&radius_km=${radiusKm}`
      ),
    enabled: postalCode.length >= 3,
  });
}

export function useStoreBrands() {
  return useQuery<StoreBrand[]>({
    queryKey: ['stores', 'brands'],
    queryFn: () => api.get<StoreBrand[]>('/stores/brands'),
  });
}
