import { z } from 'zod';

export const nearbyStoresQuery = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius_km: z.coerce.number().positive().default(15),
}).transform(d => ({
  lat: d.lat,
  lng: d.lng,
  radiusKm: d.radius_km,
}));

export type NearbyStoresQuery = z.output<typeof nearbyStoresQuery>;
