import { pool } from '../client.js';
import { toPgVector } from '../../lib/embeddings.js';

// ────────────────────────────────────────────────────────────
// Internal row types
// ────────────────────────────────────────────────────────────

export interface RecipeRow {
  id: string;
  name: string;
  source: 'meal' | 'user_recipe';
  tagline: string | null;
  description: string | null;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  difficulty: string;
  filterTags: string[];
  tips: string | null;
  ingredientKeywords: string[];
}

export interface DealRow {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  itemName: string;
  productType: string | null;
  category: string | null;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  embedding: number[] | null;
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find distinct store brand IDs that have a location within radiusKm.
 */
export async function findNearbyStoreBrandIds(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT sl.store_brand_id
     FROM store_locations sl
     WHERE haversine($1, $2, sl.lat, sl.lng) <= $3`,
    [lat, lng, radiusKm],
  );
  return (rows as Record<string, unknown>[]).map(r => r.store_brand_id as string);
}

/**
 * Find active deals for the given store brand IDs.
 */
export async function findActiveDealsByBrands(brandIds: string[]): Promise<DealRow[]> {
  if (brandIds.length === 0) return [];

  const placeholders = brandIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.item_name,
       d.product_type,
       d.category,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.embedding::text
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.store_brand_id IN (${placeholders})
       AND d.valid_from <= CURRENT_DATE
       AND d.valid_to >= CURRENT_DATE
       AND d.category NOT IN ('household', 'personal_care', 'baby', 'pet')
     ORDER BY d.sale_price ASC`,
    brandIds,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    storeBrandId: row.store_brand_id as string,
    storeBrandName: row.store_brand_name as string,
    itemName: row.item_name as string,
    productType: (row.product_type as string) ?? null,
    category: (row.category as string) ?? null,
    salePrice: Number(row.sale_price),
    regularPrice: row.regular_price ? Number(row.regular_price) : null,
    unit: row.unit as string,
    embedding: parseEmbedding(row.embedding as string | null),
  }));
}

function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  return raw.replace(/[[\]]/g, '').split(',').map(Number);
}

// ────────────────────────────────────────────────────────────
// Combined location + deal query (CTE)
// ────────────────────────────────────────────────────────────

export interface NearbyLocationRow {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  distanceKm: number;
}

export interface LocationsAndDeals {
  locations: NearbyLocationRow[];
  deals: DealRow[];
}

/**
 * Single-query CTE: find nearby store locations, then fetch all active deals
 * for those stores. Eliminates 2 sequential round trips.
 */
export async function findNearbyDeals(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<LocationsAndDeals> {
  const { rows } = await pool.query(
    `WITH nearby AS (
       SELECT
         sl.id,
         sl.store_brand_id,
         sb.name AS brand_name,
         sl.address,
         haversine($1, $2, sl.lat, sl.lng) AS distance_km
       FROM store_locations sl
       JOIN store_brands sb ON sb.id = sl.store_brand_id
       WHERE haversine($1, $2, sl.lat, sl.lng) <= $3
     ),
     nearby_brands AS (
       SELECT DISTINCT store_brand_id FROM nearby
     )
     SELECT
       'location' AS _type,
       n.id,
       n.store_brand_id,
       n.brand_name AS store_brand_name,
       n.address,
       n.distance_km::text,
       NULL AS item_name,
       NULL AS product_type,
       NULL AS category,
       NULL AS sale_price,
       NULL AS regular_price,
       NULL AS unit,
       NULL AS embedding
     FROM nearby n

     UNION ALL

     SELECT
       'deal' AS _type,
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       NULL AS address,
       NULL AS distance_km,
       d.item_name,
       d.product_type,
       d.category,
       d.sale_price::text,
       d.regular_price::text,
       d.unit,
       d.embedding::text
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.store_brand_id IN (SELECT store_brand_id FROM nearby_brands)
       AND d.valid_from <= CURRENT_DATE
       AND d.valid_to >= CURRENT_DATE
       AND (d.category IS NULL OR d.category NOT IN ('household', 'personal_care', 'baby', 'pet'))`,
    [lat, lng, radiusKm],
  );

  const locations: NearbyLocationRow[] = [];
  const deals: DealRow[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    if (row._type === 'location') {
      locations.push({
        id: row.id as string,
        storeBrandId: row.store_brand_id as string,
        brandName: row.store_brand_name as string,
        address: row.address as string,
        distanceKm: Number(Number(row.distance_km).toFixed(1)),
      });
    } else {
      deals.push({
        id: row.id as string,
        storeBrandId: row.store_brand_id as string,
        storeBrandName: row.store_brand_name as string,
        itemName: row.item_name as string,
        productType: (row.product_type as string) ?? null,
        category: (row.category as string) ?? null,
        salePrice: Number(row.sale_price),
        regularPrice: row.regular_price ? Number(row.regular_price) : null,
        unit: row.unit as string,
        embedding: parseEmbedding(row.embedding as string | null),
      });
    }
  }

  // Sort locations by distance
  locations.sort((a, b) => a.distanceKm - b.distanceKm);

  return { locations, deals };
}

// ────────────────────────────────────────────────────────────
// Semantic keyword-to-deal matching via pgvector CTE
// ────────────────────────────────────────────────────────────

export interface KeywordDealMatch {
  keyword: string;
  dealId: string;
  storeBrandId: string;
  storeBrandName: string;
  itemName: string;
  productType: string | null;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  cosineDistance: number;
}

export interface MatchResult {
  locations: NearbyLocationRow[];
  matches: KeywordDealMatch[];
}

/**
 * Single CTE query that:
 * 1. Finds nearby store brands (haversine)
 * 2. For each keyword embedding, uses HNSW index to find nearest deals
 * 3. Filters by cosine distance < 0.4 (similarity >= 0.6) and nearby brands
 * 4. Picks cheapest deal per keyword per store brand
 *
 * Returns locations + best deal matches in one result set.
 */
export async function findKeywordDealMatches(
  lat: number,
  lng: number,
  radiusKm: number,
  keywordEmbeddings: { keyword: string; vector: number[] }[],
): Promise<MatchResult> {
  if (keywordEmbeddings.length === 0) {
    return { locations: [], matches: [] };
  }

  // Build parameterized VALUES for both keyword_list (FTS) and keyword_vectors (embedding fallback)
  // $1=lat, $2=lng, $3=radius
  // Then keyword strings: $4, $5, ... $N
  // Then keyword+vector pairs for embedding fallback: $(N+1) text, $(N+2) vector, ...
  const params: unknown[] = [lat, lng, radiusKm];

  // Keyword-only params for FTS
  const kwValueRows: string[] = [];
  for (let i = 0; i < keywordEmbeddings.length; i++) {
    const paramIdx = 4 + i;
    params.push(keywordEmbeddings[i]!.keyword);
    kwValueRows.push(`($${paramIdx}::text)`);
  }

  // Keyword+vector params for embedding fallback
  const vecValueRows: string[] = [];
  const vecStartIdx = 4 + keywordEmbeddings.length;
  for (let i = 0; i < keywordEmbeddings.length; i++) {
    const kwParamIdx = vecStartIdx + i * 2;
    const vecParamIdx = vecStartIdx + i * 2 + 1;
    params.push(keywordEmbeddings[i]!.keyword);
    params.push(toPgVector(keywordEmbeddings[i]!.vector));
    vecValueRows.push(`($${kwParamIdx}::text, $${vecParamIdx}::vector(768))`);
  }

  const CATEGORY_FILTER = `(d.category IS NULL OR d.category NOT IN ('beverages', 'snacks', 'household', 'personal_care', 'baby', 'pet'))`;
  const CATEGORY_FILTER_D2 = CATEGORY_FILTER.replace(/d\./g, 'd2.');

  const sql = `
    WITH nearby_brands AS (
      SELECT DISTINCT sl.store_brand_id
      FROM store_locations sl
      WHERE haversine($1, $2, sl.lat, sl.lng) <= $3
    ),
    nearby_locations AS (
      SELECT sl.id, sl.store_brand_id, sb.name AS brand_name, sl.address,
             haversine($1, $2, sl.lat, sl.lng) AS distance_km
      FROM store_locations sl
      JOIN store_brands sb ON sb.id = sl.store_brand_id
      WHERE haversine($1, $2, sl.lat, sl.lng) <= $3
    ),
    keyword_list(keyword) AS (
      VALUES ${kwValueRows.join(',\n             ')}
    ),
    keyword_vectors(keyword, vec) AS (
      VALUES ${vecValueRows.join(',\n             ')}
    ),
    -- Phase 1a: FTS on product_type (most precise — matches product identity)
    fts_pt_candidates AS (
      SELECT
        kl.keyword,
        d.id AS deal_id,
        d.store_brand_id,
        sb.name AS store_brand_name,
        d.item_name,
        d.product_type,
        d.sale_price,
        d.regular_price,
        d.unit,
        0.0::double precision AS cosine_distance
      FROM keyword_list kl
      JOIN deals d ON d.tsv_product_type @@ plainto_tsquery('english', kl.keyword)
      JOIN store_brands sb ON sb.id = d.store_brand_id
      WHERE d.valid_from <= CURRENT_DATE
        AND d.valid_to >= CURRENT_DATE
        AND ${CATEGORY_FILTER}
        AND d.store_brand_id IN (SELECT store_brand_id FROM nearby_brands)
    ),
    fts_pt_best AS (
      SELECT DISTINCT ON (keyword, store_brand_id)
        keyword, deal_id, store_brand_id, store_brand_name,
        item_name, product_type, sale_price, regular_price, unit, cosine_distance
      FROM fts_pt_candidates
      ORDER BY keyword, store_brand_id, sale_price ASC
    ),
    fts_pt_hit_keywords AS (
      SELECT DISTINCT keyword FROM fts_pt_candidates
    ),
    -- Phase 1b: FTS on item_name, only for deals with NULL product_type
    --           and only for keywords that got zero product_type hits
    fts_name_candidates AS (
      SELECT
        kl.keyword,
        d.id AS deal_id,
        d.store_brand_id,
        sb.name AS store_brand_name,
        d.item_name,
        d.product_type,
        d.sale_price,
        d.regular_price,
        d.unit,
        0.0::double precision AS cosine_distance
      FROM keyword_list kl
      JOIN deals d ON d.tsv_item_name @@ plainto_tsquery('english', kl.keyword)
      JOIN store_brands sb ON sb.id = d.store_brand_id
      WHERE kl.keyword NOT IN (SELECT keyword FROM fts_pt_hit_keywords)
        AND d.product_type IS NULL
        AND d.valid_from <= CURRENT_DATE
        AND d.valid_to >= CURRENT_DATE
        AND ${CATEGORY_FILTER}
        AND d.store_brand_id IN (SELECT store_brand_id FROM nearby_brands)
    ),
    fts_name_best AS (
      SELECT DISTINCT ON (keyword, store_brand_id)
        keyword, deal_id, store_brand_id, store_brand_name,
        item_name, product_type, sale_price, regular_price, unit, cosine_distance
      FROM fts_name_candidates
      ORDER BY keyword, store_brand_id, sale_price ASC
    ),
    fts_all_best AS (
      SELECT * FROM fts_pt_best
      UNION ALL
      SELECT * FROM fts_name_best
    ),
    fts_hit_keywords AS (
      SELECT DISTINCT keyword FROM fts_pt_candidates
      UNION
      SELECT DISTINCT keyword FROM fts_name_candidates
    ),
    -- Phase 2: Embedding fallback for keywords with zero FTS hits
    embedding_candidates AS (
      SELECT
        kv.keyword,
        d.id AS deal_id,
        d.store_brand_id,
        sb.name AS store_brand_name,
        d.item_name,
        d.product_type,
        d.sale_price,
        d.regular_price,
        d.unit,
        (d.embedding <=> kv.vec) AS cosine_distance
      FROM keyword_vectors kv
      CROSS JOIN LATERAL (
        SELECT d2.id, d2.store_brand_id, d2.item_name, d2.product_type,
               d2.sale_price, d2.regular_price, d2.unit, d2.embedding
        FROM deals d2
        WHERE d2.valid_from <= CURRENT_DATE
          AND d2.valid_to >= CURRENT_DATE
          AND d2.embedding IS NOT NULL
          AND ${CATEGORY_FILTER_D2}
        ORDER BY d2.embedding <=> kv.vec
        LIMIT 50
      ) d
      JOIN store_brands sb ON sb.id = d.store_brand_id
      WHERE kv.keyword NOT IN (SELECT keyword FROM fts_hit_keywords)
        AND (d.embedding <=> kv.vec) < 0.15
        AND d.store_brand_id IN (SELECT store_brand_id FROM nearby_brands)
    ),
    embedding_best AS (
      SELECT DISTINCT ON (keyword, store_brand_id)
        keyword, deal_id, store_brand_id, store_brand_name,
        item_name, product_type, sale_price, regular_price, unit, cosine_distance
      FROM embedding_candidates
      ORDER BY keyword, store_brand_id, sale_price ASC
    ),
    best_deals AS (
      SELECT * FROM fts_all_best
      UNION ALL
      SELECT * FROM embedding_best
    )

    SELECT 'location' AS _type,
           n.id, n.store_brand_id, n.brand_name AS store_brand_name,
           n.address, n.distance_km::text,
           NULL::text AS keyword, NULL::text AS item_name,
           NULL::text AS product_type,
           NULL::text AS sale_price, NULL::text AS regular_price,
           NULL::text AS unit, NULL::text AS cosine_distance
    FROM nearby_locations n

    UNION ALL

    SELECT 'match' AS _type,
           bd.deal_id AS id, bd.store_brand_id, bd.store_brand_name,
           NULL AS address, NULL AS distance_km,
           bd.keyword, bd.item_name,
           bd.product_type,
           bd.sale_price::text, bd.regular_price::text,
           bd.unit, bd.cosine_distance::text
    FROM best_deals bd`;

  const { rows } = await pool.query(sql, params);

  const locations: NearbyLocationRow[] = [];
  const matches: KeywordDealMatch[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    if (row._type === 'location') {
      locations.push({
        id: row.id as string,
        storeBrandId: row.store_brand_id as string,
        brandName: row.store_brand_name as string,
        address: row.address as string,
        distanceKm: Number(Number(row.distance_km).toFixed(1)),
      });
    } else {
      matches.push({
        keyword: row.keyword as string,
        dealId: row.id as string,
        storeBrandId: row.store_brand_id as string,
        storeBrandName: row.store_brand_name as string,
        itemName: row.item_name as string,
        productType: (row.product_type as string) ?? null,
        salePrice: Number(row.sale_price),
        regularPrice: row.regular_price ? Number(row.regular_price) : null,
        unit: row.unit as string,
        cosineDistance: Number(row.cosine_distance),
      });
    }
  }

  locations.sort((a, b) => a.distanceKm - b.distanceKm);

  return { locations, matches };
}

/**
 * Find all system meals and public user recipes matching dietary filters
 * and cooking time constraints. Returns both in a unified shape.
 */
export async function findFilteredRecipes(
  dietaryFilters: string[],
  maxTotalMinutes: number | null,
): Promise<RecipeRow[]> {
  const results: RecipeRow[] = [];

  // ── System meals ──
  {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dietaryFilters.length > 0) {
      conditions.push(`m.filter_tags @> $${idx++}::text[]`);
      params.push(dietaryFilters);
    }

    if (maxTotalMinutes !== null) {
      conditions.push(
        `(COALESCE(m.prep_time_minutes, 0) + COALESCE(m.cook_time_minutes, 0)) <= $${idx++}`,
      );
      params.push(maxTotalMinutes);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const { rows } = await pool.query(
      `SELECT
         m.id, m.name, m.tagline, m.description,
         m.ingredients, m.steps,
         m.prep_time_minutes, m.cook_time_minutes,
         m.servings, m.difficulty, m.filter_tags,
         m.tips, m.ingredient_keywords
       FROM meals m
       ${whereClause}
       ORDER BY m.approval_score DESC NULLS LAST, m.created_at DESC`,
      params,
    );

    for (const row of rows as Record<string, unknown>[]) {
      results.push({
        id: row.id as string,
        name: row.name as string,
        source: 'meal',
        tagline: (row.tagline as string) ?? null,
        description: (row.description as string) ?? null,
        ingredients: (row.ingredients as { name: string; quantity: string; unit: string }[]) ?? [],
        steps: (row.steps as string[]) ?? [],
        prepTimeMinutes: (row.prep_time_minutes as number) ?? null,
        cookTimeMinutes: (row.cook_time_minutes as number) ?? null,
        servings: (row.servings as number) ?? 4,
        difficulty: (row.difficulty as string) ?? 'easy',
        filterTags: (row.filter_tags as string[]) ?? [],
        tips: (row.tips as string) ?? null,
        ingredientKeywords: (row.ingredient_keywords as string[]) ?? [],
      });
    }
  }

  // ── Public user recipes ──
  {
    const conditions: string[] = ['ur.is_public = true'];
    const params: unknown[] = [];
    let idx = 1;

    if (dietaryFilters.length > 0) {
      conditions.push(`ur.dietary_tags @> $${idx++}::text[]`);
      params.push(dietaryFilters);
    }

    if (maxTotalMinutes !== null) {
      conditions.push(
        `(COALESCE(ur.prep_time_minutes, 0) + COALESCE(ur.cook_time_minutes, 0)) <= $${idx++}`,
      );
      params.push(maxTotalMinutes);
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await pool.query(
      `SELECT
         ur.id, ur.name, ur.tagline, ur.description,
         ur.ingredients, ur.steps,
         ur.prep_time_minutes, ur.cook_time_minutes,
         ur.servings, ur.difficulty,
         ur.dietary_tags AS filter_tags,
         ur.tips, ur.ingredient_keywords
       FROM user_recipes ur
       WHERE ${whereClause}
       ORDER BY ur.created_at DESC`,
      params,
    );

    for (const row of rows as Record<string, unknown>[]) {
      results.push({
        id: row.id as string,
        name: row.name as string,
        source: 'user_recipe',
        tagline: (row.tagline as string) ?? null,
        description: (row.description as string) ?? null,
        ingredients: (row.ingredients as { name: string; quantity: string; unit: string }[]) ?? [],
        steps: (row.steps as string[]) ?? [],
        prepTimeMinutes: (row.prep_time_minutes as number) ?? null,
        cookTimeMinutes: (row.cook_time_minutes as number) ?? null,
        servings: (row.servings as number) ?? 4,
        difficulty: (row.difficulty as string) ?? 'easy',
        filterTags: (row.filter_tags as string[]) ?? [],
        tips: (row.tips as string) ?? null,
        ingredientKeywords: (row.ingredient_keywords as string[]) ?? [],
      });
    }
  }

  return results;
}
