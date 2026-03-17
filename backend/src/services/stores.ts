import * as storeQueries from '../db/queries/stores.js';
import { throwBadRequest, throwNotFound } from '../middleware/errorHandler.js';
import type { NearbyStoresQuery } from '../schemas/stores.js';

// ────────────────────────────────────────────────────────────
// Get Nearby Stores
// ────────────────────────────────────────────────────────────

export async function getNearbyStores(
  query: NearbyStoresQuery,
): Promise<Record<string, unknown>[]> {
  if (query.lat === undefined || query.lng === undefined) {
    throwBadRequest(
      'GEOCODE_FAILED',
      'Latitude and longitude are required to find nearby stores.',
    );
  }

  const stores = await storeQueries.findNearbyStores(
    query.lat,
    query.lng,
    query.radiusKm,
  );

  if (stores.length === 0) {
    throwNotFound(
      'NO_NEARBY_STORES',
      'No stores found within the specified radius.',
    );
  }

  return stores;
}

// ────────────────────────────────────────────────────────────
// Get All Brands
// ────────────────────────────────────────────────────────────

export async function getAllBrands(): Promise<Record<string, unknown>[]> {
  return storeQueries.findAllBrands();
}
