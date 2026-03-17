import { z } from 'zod';

export const optimizeBody = z.object({
  postal_code: z.string().min(3).max(10).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  store_location_ids: z.array(z.string().uuid()).optional(),
  max_stores: z.union([z.literal(1), z.literal(2)]).optional(),
}).transform(d => ({
  postalCode: d.postal_code,
  lat: d.lat,
  lng: d.lng,
  storeLocationIds: d.store_location_ids,
  maxStores: d.max_stores,
}));

export type OptimizeBody = z.output<typeof optimizeBody>;
