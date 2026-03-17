import { z } from 'zod';

export const dealsQuery = z.object({
  store_brand_id: z.string().uuid().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
}).transform(d => ({
  storeBrandId: d.store_brand_id,
  category: d.category,
  search: d.search,
}));

export type DealsQuery = z.output<typeof dealsQuery>;
