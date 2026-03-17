import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mapper
// ────────────────────────────────────────────────────────────

function mapDealRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    store_brand_id: row.store_brand_id as string,
    store_brand_name: row.store_brand_name as string,
    store_location_id: (row.store_location_id as string) ?? null,
    item_name: row.item_name as string,
    category: (row.category as string) ?? null,
    sale_price: Number(row.sale_price),
    regular_price: row.regular_price ? Number(row.regular_price) : null,
    unit: row.unit as string,
    deal_conditions: (row.deal_conditions as string) ?? null,
    percent_off: row.percent_off ? Number(row.percent_off) : null,
    valid_from: (row.valid_from as Date).toISOString().split('T')[0]!,
    valid_to: (row.valid_to as Date).toISOString().split('T')[0]!,
    source: row.source as string,
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

export interface DealFilters {
  storeBrandId?: string;
  category?: string;
  search?: string;
}

/**
 * Find active deals (valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE).
 * Optionally filter by store_brand_id, category, and ILIKE search on item_name.
 * JOINs store_brands for brand name. Calculates percent_off.
 * Returns snake_case objects ordered by percent_off DESC.
 */
export async function findActiveDeals(
  filters: DealFilters,
): Promise<Record<string, unknown>[]> {
  const conditions: string[] = [
    'd.valid_from <= CURRENT_DATE',
    'd.valid_to >= CURRENT_DATE',
  ];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.storeBrandId) {
    conditions.push(`d.store_brand_id = $${paramIndex++}`);
    values.push(filters.storeBrandId);
  }

  if (filters.category) {
    conditions.push(`d.category = $${paramIndex++}`);
    values.push(filters.category);
  }

  if (filters.search) {
    conditions.push(`d.item_name ILIKE $${paramIndex++}`);
    values.push(`%${filters.search}%`);
  }

  const whereClause = conditions.join(' AND ');

  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.store_location_id,
       d.item_name,
       d.category,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.deal_conditions,
       d.valid_from,
       d.valid_to,
       d.source,
       CASE WHEN d.regular_price > 0
         THEN ROUND((1 - d.sale_price / d.regular_price) * 100)::integer
         ELSE NULL
       END AS percent_off
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE ${whereClause}
     ORDER BY percent_off DESC NULLS LAST`,
    values,
  );

  return (rows as Record<string, unknown>[]).map(mapDealRow);
}

/**
 * Find the top N deals by discount percentage.
 * Only includes deals that have a regular_price set.
 * Returns snake_case objects ordered by percent_off DESC.
 */
export async function findNotableDeals(
  limit: number,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.store_location_id,
       d.item_name,
       d.category,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.deal_conditions,
       d.valid_from,
       d.valid_to,
       d.source,
       ROUND((1 - d.sale_price / d.regular_price) * 100)::integer AS percent_off
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.valid_from <= CURRENT_DATE
       AND d.valid_to >= CURRENT_DATE
       AND d.regular_price > 0
     ORDER BY percent_off DESC
     LIMIT $1`,
    [limit],
  );

  return (rows as Record<string, unknown>[]).map(mapDealRow);
}

/**
 * Check whether a store brand exists by ID.
 */
export async function storeBrandExists(storeBrandId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM store_brands WHERE id = $1`,
    [storeBrandId],
  );
  return rows.length > 0;
}
