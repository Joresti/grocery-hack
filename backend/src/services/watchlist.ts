import * as watchlistQueries from '../db/queries/watchlist.js';
import { throwNotFound } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Get Watchlist
// ────────────────────────────────────────────────────────────

export async function getWatchlist(
  userId: string,
): Promise<Record<string, unknown>[]> {
  return watchlistQueries.findUserWatchlist(userId);
}

// ────────────────────────────────────────────────────────────
// Heart Deal (add to watchlist)
// ────────────────────────────────────────────────────────────

/**
 * Classify the price tier based on sale price.
 * - < $5 → "staple"
 * - < $15 → "premium"
 * - >= $15 → "luxury"
 */
function classifyPriceTier(salePrice: number): string {
  if (salePrice < 5) return 'staple';
  if (salePrice < 15) return 'premium';
  return 'luxury';
}

/**
 * Extract the item keyword from the item name.
 * Takes the first word, lowercased.
 */
function extractItemKeyword(itemName: string): string {
  const firstWord = itemName.trim().split(/\s+/)[0];
  return (firstWord ?? itemName).toLowerCase();
}

export async function heartDeal(
  userId: string,
  dealId: string,
): Promise<Record<string, unknown>> {
  const deal = await watchlistQueries.findDealById(dealId);

  if (!deal) {
    throwNotFound('DEAL_NOT_FOUND', 'The specified deal does not exist.');
  }

  const salePrice = deal.sale_price as number;
  const itemName = deal.item_name as string;
  const priceTier = classifyPriceTier(salePrice);

  const item = await watchlistQueries.createWatchlistItem({
    userId,
    itemKeyword: extractItemKeyword(itemName),
    productName: itemName,
    category: (deal.category as string) ?? null,
    subcategory: null,
    productMetadata: {},
    priceTier,
    benchmarkPrice: salePrice,
    benchmarkUnit: deal.unit as string,
    storeBrandId: (deal.store_brand_id as string) ?? null,
  });

  return item;
}

// ────────────────────────────────────────────────────────────
// Unheart Deal (remove from watchlist)
// ────────────────────────────────────────────────────────────

export async function unheartDeal(
  userId: string,
  watchlistId: string,
): Promise<void> {
  const deleted = await watchlistQueries.deleteWatchlistItem(watchlistId, userId);

  if (!deleted) {
    throwNotFound('WATCHLIST_ITEM_NOT_FOUND', 'Watchlist item not found.');
  }
}
