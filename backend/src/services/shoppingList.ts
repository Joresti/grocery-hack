import type { MaxStores, CookingStyle } from '@groceryhack/shared/types.js';
import * as shoppingListQueries from '../db/queries/shoppingList.js';
import type { DealRow, RecipeRow } from '../db/queries/shoppingList.js';
import { geocode } from '../lib/geocode.js';
import { throwNotFound } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ShoppingListParams {
  postalCode: string;
  dietaryFilters: string[];
  cookingStyle: CookingStyle;
  maxStores: MaxStores;
  radiusKm: number;
  page: number;
  perPage: number;
}

interface MatchedDeal {
  dealId: string;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  percentOff: number | null;
  storeBrandId: string;
  storeBrandName: string;
  matchedIngredient: string;
}

interface StoreMatches {
  brandId: string;
  brandName: string;
  keywords: Map<string, DealRow>;
}

interface ScoredRecipe {
  recipe: RecipeRow;
  ingredientsOnSale: string[];
  matchingDeals: MatchedDeal[];
  storesUsed: { storeBrandId: string; storeBrandName: string }[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getCookingStyleMaxMinutes(style: CookingStyle): number | null {
  switch (style) {
    case 'quick': return 30;
    case 'balanced': return 60;
    case 'best': return null;
    default: return 60;
  }
}

/**
 * For a single recipe, build per-store keyword→deal maps showing which
 * ingredients have a matching deal at each store brand.
 */
function matchRecipeToDeals(
  recipe: RecipeRow,
  dealsByBrand: Map<string, DealRow[]>,
): StoreMatches[] {
  const storeMap = new Map<string, StoreMatches>();

  for (const keyword of recipe.ingredientKeywords) {
    const kwLower = keyword.toLowerCase();

    for (const [brandId, brandDeals] of dealsByBrand) {
      let bestDeal: DealRow | null = null;
      for (const deal of brandDeals) {
        // Match against product_type (what the product IS), falling back
        // to item_name only for deals scraped before product_type existed.
        const matchTarget = deal.productType
          ? deal.productType.toLowerCase()
          : deal.itemName.toLowerCase();
        if (matchTarget.includes(kwLower)) {
          if (!bestDeal || deal.salePrice < bestDeal.salePrice) {
            bestDeal = deal;
          }
        }
      }

      if (bestDeal) {
        let store = storeMap.get(brandId);
        if (!store) {
          store = { brandId, brandName: bestDeal.storeBrandName, keywords: new Map() };
          storeMap.set(brandId, store);
        }
        const existing = store.keywords.get(keyword);
        if (!existing || bestDeal.salePrice < existing.salePrice) {
          store.keywords.set(keyword, bestDeal);
        }
      }
    }
  }

  return [...storeMap.values()];
}

/**
 * Pick the best store(s) to maximize unique ingredient matches.
 * For maxStores=1: the single store with the most matches.
 * For maxStores=2: greedy — pick the best store, then the store
 * that adds the most new ingredient matches.
 */
function selectBestStores(
  storeMatches: StoreMatches[],
  maxStores: MaxStores,
): StoreMatches[] {
  if (storeMatches.length === 0) return [];

  const sorted = [...storeMatches].sort((a, b) => b.keywords.size - a.keywords.size);

  if (maxStores === 1 || sorted.length === 1) {
    return [sorted[0]!];
  }

  // Greedy: first store = most matches, second = most new matches
  const first = sorted[0]!;
  const firstKeywords = new Set(first.keywords.keys());

  let bestSecond = sorted[1]!;
  let bestNewCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const candidate = sorted[i]!;
    let newCount = 0;
    for (const kw of candidate.keywords.keys()) {
      if (!firstKeywords.has(kw)) newCount++;
    }
    if (newCount > bestNewCount) {
      bestNewCount = newCount;
      bestSecond = candidate;
    }
  }

  return [first, bestSecond];
}

/**
 * Build the scored recipe from selected stores — collects unique matched
 * ingredients, deals, and store info.
 */
function buildScoredRecipe(
  recipe: RecipeRow,
  selectedStores: StoreMatches[],
): ScoredRecipe | null {
  const ingredientsOnSaleSet = new Set<string>();
  const matchingDeals: MatchedDeal[] = [];
  const storesUsed: { storeBrandId: string; storeBrandName: string }[] = [];

  for (const store of selectedStores) {
    let contributed = false;

    for (const [keyword, deal] of store.keywords) {
      if (!ingredientsOnSaleSet.has(keyword)) {
        ingredientsOnSaleSet.add(keyword);
        const percentOff = deal.regularPrice && deal.regularPrice > 0
          ? Math.round((1 - deal.salePrice / deal.regularPrice) * 100)
          : null;

        matchingDeals.push({
          dealId: deal.id,
          itemName: deal.itemName,
          salePrice: deal.salePrice,
          regularPrice: deal.regularPrice,
          percentOff,
          storeBrandId: store.brandId,
          storeBrandName: store.brandName,
          matchedIngredient: keyword,
        });
        contributed = true;
      }
    }

    if (contributed) {
      storesUsed.push({
        storeBrandId: store.brandId,
        storeBrandName: store.brandName,
      });
    }
  }

  if (ingredientsOnSaleSet.size === 0) return null;

  return {
    recipe,
    ingredientsOnSale: [...ingredientsOnSaleSet],
    matchingDeals,
    storesUsed,
  };
}

// ────────────────────────────────────────────────────────────
// Main service function
// ────────────────────────────────────────────────────────────

export async function getShoppingList(
  params: ShoppingListParams,
): Promise<Record<string, unknown>> {
  // 1. Geocode postal code → lat/lng
  const { lat, lng } = await geocode(params.postalCode);

  // 2. Find nearby store brand IDs
  const brandIds = await shoppingListQueries.findNearbyStoreBrandIds(
    lat, lng, params.radiusKm,
  );

  if (brandIds.length === 0) {
    throwNotFound('NO_NEARBY_STORES', 'No stores found near your location.');
  }

  // 3. Fetch active deals for those brands
  const deals = await shoppingListQueries.findActiveDealsByBrands(brandIds);

  if (deals.length === 0) {
    throwNotFound('NO_ACTIVE_DEALS', 'No active deals found this week.');
  }

  // 4. Group deals by store brand for efficient matching
  const dealsByBrand = new Map<string, DealRow[]>();
  for (const deal of deals) {
    const existing = dealsByBrand.get(deal.storeBrandId);
    if (existing) {
      existing.push(deal);
    } else {
      dealsByBrand.set(deal.storeBrandId, [deal]);
    }
  }

  // 5. Fetch meals + public recipes filtered by dietary restrictions and cooking time
  const maxMinutes = getCookingStyleMaxMinutes(params.cookingStyle);
  const recipes = await shoppingListQueries.findFilteredRecipes(
    params.dietaryFilters,
    maxMinutes,
  );

  if (recipes.length === 0) {
    throwNotFound('NO_MATCHING_RECIPES', 'No recipes found matching your filters.');
  }

  // 6. For each recipe, match ingredients against deals and score
  //    Dietary filtering of deals happens implicitly: a vegetarian recipe
  //    won't have meat ingredient_keywords, so meat deals won't match.
  const scoredRecipes: ScoredRecipe[] = [];

  for (const recipe of recipes) {
    if (recipe.ingredientKeywords.length === 0) continue;

    const storeMatches = matchRecipeToDeals(recipe, dealsByBrand);
    const selectedStores = selectBestStores(storeMatches, params.maxStores);
    const scored = buildScoredRecipe(recipe, selectedStores);

    if (scored) {
      scoredRecipes.push(scored);
    }
  }

  // 7. Sort by most ingredients on sale DESC, then by ratio (on-sale / total)
  scoredRecipes.sort((a, b) => {
    const diff = b.ingredientsOnSale.length - a.ingredientsOnSale.length;
    if (diff !== 0) return diff;
    const ratioA = a.ingredientsOnSale.length / a.recipe.ingredientKeywords.length;
    const ratioB = b.ingredientsOnSale.length / b.recipe.ingredientKeywords.length;
    return ratioB - ratioA;
  });

  // 8. Paginate
  const total = scoredRecipes.length;
  const totalPages = Math.ceil(total / params.perPage);
  const startIdx = (params.page - 1) * params.perPage;
  const pageRecipes = scoredRecipes.slice(startIdx, startIdx + params.perPage);

  // 9. Build snake_case API response
  return {
    recipes: pageRecipes.map(sr => ({
      id: sr.recipe.id,
      name: sr.recipe.name,
      source: sr.recipe.source,
      tagline: sr.recipe.tagline,
      description: sr.recipe.description,
      ingredients: sr.recipe.ingredients,
      steps: sr.recipe.steps,
      prep_time_minutes: sr.recipe.prepTimeMinutes,
      cook_time_minutes: sr.recipe.cookTimeMinutes,
      servings: sr.recipe.servings,
      difficulty: sr.recipe.difficulty,
      filter_tags: sr.recipe.filterTags,
      tips: sr.recipe.tips,
      ingredients_on_sale_count: sr.ingredientsOnSale.length,
      total_ingredients: sr.recipe.ingredientKeywords.length,
      ingredients_on_sale: sr.ingredientsOnSale,
      matching_deals: sr.matchingDeals.map(d => ({
        deal_id: d.dealId,
        item_name: d.itemName,
        sale_price: d.salePrice,
        regular_price: d.regularPrice,
        percent_off: d.percentOff,
        store_brand_id: d.storeBrandId,
        store_brand_name: d.storeBrandName,
        matched_ingredient: d.matchedIngredient,
      })),
      stores_used: sr.storesUsed.map(s => ({
        store_brand_id: s.storeBrandId,
        store_brand_name: s.storeBrandName,
      })),
    })),
    pagination: {
      page: params.page,
      per_page: params.perPage,
      total,
      total_pages: totalPages,
    },
  };
}
