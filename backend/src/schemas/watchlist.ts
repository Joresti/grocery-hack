import { z } from 'zod';

export const heartDealBody = z.object({
  deal_id: z.string().uuid(),
}).transform(d => ({
  dealId: d.deal_id,
}));

export type HeartDealInput = z.output<typeof heartDealBody>;

export const watchlistIdParam = z.object({
  watchlist_id: z.string().uuid(),
}).transform(d => ({
  watchlistId: d.watchlist_id,
}));

export type WatchlistIdParam = z.output<typeof watchlistIdParam>;
