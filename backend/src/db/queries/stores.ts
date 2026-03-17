import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mappers
// ────────────────────────────────────────────────────────────

function mapStoreLocationRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    store_brand_id: row.store_brand_id,
    brand_name: row.brand_name,
    address: row.address,
    city: row.city,
    region: row.region,
    postal_zip: row.postal_zip,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distance_km: row.distance_km ? Number(Number(row.distance_km).toFixed(1)) : undefined,
  };
}

function mapStoreBrandRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    flyer_url: row.flyer_url ?? null,
    logo_url: row.logo_url ?? null,
    scrape_status: row.scrape_status,
    last_scraped_at: row.last_scraped_at
      ? (row.last_scraped_at as Date).toISOString()
      : null,
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find store locations within a radius (km) of a given lat/lng.
 * Uses the PostgreSQL haversine() function. JOINs store_brands for brand name.
 * Returns snake_case objects sorted by distance.
 */
export async function findNearbyStores(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       sl.id,
       sl.store_brand_id,
       sb.name AS brand_name,
       sl.address,
       sl.city,
       sl.region,
       sl.postal_zip,
       sl.lat,
       sl.lng,
       haversine($1, $2, sl.lat, sl.lng) AS distance_km
     FROM store_locations sl
     JOIN store_brands sb ON sb.id = sl.store_brand_id
     WHERE haversine($1, $2, sl.lat, sl.lng) <= $3
     ORDER BY distance_km`,
    [lat, lng, radiusKm],
  );
  return (rows as Record<string, unknown>[]).map(mapStoreLocationRow);
}

/**
 * Return all store brands ordered by name.
 * Returns snake_case objects.
 */
export async function findAllBrands(): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT id, name, flyer_url, logo_url, scrape_status, last_scraped_at
     FROM store_brands
     ORDER BY name`,
  );
  return (rows as Record<string, unknown>[]).map(mapStoreBrandRow);
}
