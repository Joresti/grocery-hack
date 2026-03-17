import * as dealQueries from '../db/queries/deals.js';
import { throwNotFound } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Get Active Deals
// ────────────────────────────────────────────────────────────

export interface ActiveDealsFilters {
  storeBrandId?: string;
  category?: string;
  search?: string;
}

export async function getActiveDeals(
  filters: ActiveDealsFilters,
): Promise<Record<string, unknown>[]> {
  const deals = await dealQueries.findActiveDeals(filters);

  if (deals.length === 0) {
    // If a specific brand was requested, check whether it exists at all
    if (filters.storeBrandId) {
      const exists = await dealQueries.storeBrandExists(filters.storeBrandId);
      if (!exists) {
        throwNotFound(
          'STORE_BRAND_NOT_FOUND',
          'The specified store brand does not exist.',
        );
      }
    }

    throwNotFound(
      'NO_ACTIVE_DEALS',
      'No active deals found matching your criteria.',
    );
  }

  return deals;
}

// ────────────────────────────────────────────────────────────
// Get Notable Deals
// ────────────────────────────────────────────────────────────

export async function getNotableDeals(): Promise<Record<string, unknown>[]> {
  return dealQueries.findNotableDeals(10);
}
