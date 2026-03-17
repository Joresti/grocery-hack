import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mapper
// ────────────────────────────────────────────────────────────

function mapWatchlistRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    item_keyword: row.item_keyword as string,
    product_name: row.product_name as string,
    category: (row.category as string) ?? null,
    subcategory: (row.subcategory as string) ?? null,
    product_metadata: row.product_metadata ?? {},
    price_tier: row.price_tier as string,
    benchmark_price: Number(row.benchmark_price),
    benchmark_unit: row.benchmark_unit as string,
    store_brand_id: (row.store_brand_id as string) ?? null,
    store_brand_name: (row.store_brand_name as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function mapDealRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    store_brand_id: row.store_brand_id as string,
    store_brand_name: row.store_brand_name as string,
    item_name: row.item_name as string,
    category: (row.category as string) ?? null,
    sale_price: Number(row.sale_price),
    regular_price: row.regular_price ? Number(row.regular_price) : null,
    unit: row.unit as string,
    valid_from: (row.valid_from as Date).toISOString().split('T')[0]!,
    valid_to: (row.valid_to as Date).toISOString().split('T')[0]!,
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find all watchlist items for a user, joined with store_brands for brand name.
 * Returns snake_case objects ordered by created_at DESC.
 */
export async function findUserWatchlist(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       dw.id,
       dw.item_keyword,
       dw.product_name,
       dw.category,
       dw.subcategory,
       dw.product_metadata,
       dw.price_tier,
       dw.benchmark_price,
       dw.benchmark_unit,
       dw.store_brand_id,
       sb.name AS store_brand_name,
       dw.created_at
     FROM deal_watchlist dw
     LEFT JOIN store_brands sb ON sb.id = dw.store_brand_id
     WHERE dw.user_id = $1
     ORDER BY dw.created_at DESC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(mapWatchlistRow);
}

/**
 * Find a deal by ID, joined with store_brands.
 * Returns the full deal info needed for watchlist creation, or null if not found.
 */
export async function findDealById(
  dealId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.item_name,
       d.category,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.valid_from,
       d.valid_to
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.id = $1`,
    [dealId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapDealRow(rows[0] as Record<string, unknown>);
}

/**
 * Create a new watchlist item. Returns the inserted row.
 */
export async function createWatchlistItem(data: {
  userId: string;
  itemKeyword: string;
  productName: string;
  category: string | null;
  subcategory: string | null;
  productMetadata: Record<string, unknown>;
  priceTier: string;
  benchmarkPrice: number;
  benchmarkUnit: string;
  storeBrandId: string | null;
}): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `INSERT INTO deal_watchlist
       (user_id, item_keyword, product_name, category, subcategory,
        product_metadata, price_tier, benchmark_price, benchmark_unit, store_brand_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING
       id, item_keyword, product_name, category, subcategory,
       product_metadata, price_tier, benchmark_price, benchmark_unit,
       store_brand_id, created_at`,
    [
      data.userId,
      data.itemKeyword,
      data.productName,
      data.category,
      data.subcategory,
      JSON.stringify(data.productMetadata),
      data.priceTier,
      data.benchmarkPrice,
      data.benchmarkUnit,
      data.storeBrandId,
    ],
  );

  const row = rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    item_keyword: row.item_keyword as string,
    product_name: row.product_name as string,
    category: (row.category as string) ?? null,
    subcategory: (row.subcategory as string) ?? null,
    product_metadata: row.product_metadata ?? {},
    price_tier: row.price_tier as string,
    benchmark_price: Number(row.benchmark_price),
    benchmark_unit: row.benchmark_unit as string,
    store_brand_id: (row.store_brand_id as string) ?? null,
    store_brand_name: null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

/**
 * Delete a watchlist item by ID and user_id.
 * Returns true if a row was deleted, false otherwise.
 */
export async function deleteWatchlistItem(
  watchlistId: string,
  userId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM deal_watchlist
     WHERE id = $1 AND user_id = $2`,
    [watchlistId, userId],
  );

  return (rowCount ?? 0) > 0;
}
