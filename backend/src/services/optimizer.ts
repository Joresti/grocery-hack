import crypto from 'node:crypto';
import type { MaxStores, GroceryPlan, PlanStop, PlanMeal, PlanShoppingItem } from '@groceryhack/shared/types.js';
import * as optimizerQueries from '../db/queries/optimizer.js';
import { geocode } from '../lib/geocode.js';
import { throwNotFound, throwBadRequest } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

// ────────────────────────────────────────────────────────────
// Internal interfaces
// ────────────────────────────────────────────────────────────

interface ScoredMeal {
  id: string;
  name: string;
  ingredientKeywords: string[];
  ingredients: { name: string; quantity: string; unit: string }[];
  servings: number;
}

interface DealInfo {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  category: string | null;
}

interface LocationInfo {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface ImportantItemInfo {
  id: string;
  name: string;
  quantity: string | null;
}

interface BrandCostResult {
  brandId: string;
  brandName: string;
  totalCost: number;
  totalRegularCost: number;
  itemAssignments: Map<string, { deal: DealInfo | null; cost: number; regularCost: number; forMeal: string | null }>;
}

interface OptimizeOverrides {
  postalCode?: string;
  lat?: number;
  lng?: number;
  storeLocationIds?: string[];
  maxStores?: MaxStores;
}

// ────────────────────────────────────────────────────────────
// Exported pure-ish helpers (for testing)
// ────────────────────────────────────────────────────────────

/**
 * Build a map: storeBrandId → DealInfo[] grouped by brand.
 */
export function buildDealsByBrand(deals: DealInfo[]): Map<string, DealInfo[]> {
  const map = new Map<string, DealInfo[]>();
  for (const deal of deals) {
    const existing = map.get(deal.storeBrandId);
    if (existing) {
      existing.push(deal);
    } else {
      map.set(deal.storeBrandId, [deal]);
    }
  }
  return map;
}

/**
 * For a list of needed keywords, find the cheapest deal matching each keyword per brand.
 * Returns: Map<storeBrandId, Map<keyword, cheapestDeal>>
 */
export function buildCheapestDealMap(
  dealsByBrand: Map<string, DealInfo[]>,
): Map<string, Map<string, DealInfo>> {
  const result = new Map<string, Map<string, DealInfo>>();

  for (const [brandId, deals] of dealsByBrand) {
    const keywordMap = new Map<string, DealInfo>();
    for (const deal of deals) {
      const itemLower = deal.itemName.toLowerCase();
      // Check if this deal matches any keyword; we index by the deal's item name
      // The matching will be done during cost calculation
      const existing = keywordMap.get(itemLower);
      if (!existing || deal.salePrice < existing.salePrice) {
        keywordMap.set(itemLower, deal);
      }
    }
    result.set(brandId, keywordMap);
  }

  return result;
}

/**
 * Find the best deal matching a keyword from a brand's deals.
 * Uses ILIKE-style matching (keyword substring of deal item name).
 */
export function findBestDealForKeyword(
  brandDeals: DealInfo[],
  keyword: string,
): DealInfo | null {
  const kwLower = keyword.toLowerCase();
  let best: DealInfo | null = null;

  for (const deal of brandDeals) {
    const nameLower = deal.itemName.toLowerCase();
    if (nameLower.includes(kwLower)) {
      if (!best || deal.salePrice < best.salePrice) {
        best = deal;
      }
    }
  }

  return best;
}

/**
 * Get average deal price across all brands for fallback estimation.
 */
export function getAverageDealPrice(deals: DealInfo[]): number {
  if (deals.length === 0) return 3.0; // sensible default
  const sum = deals.reduce((acc, d) => acc + d.salePrice, 0);
  return sum / deals.length;
}

/**
 * Calculate the total cost for a brand to cover all needed items.
 * Items with no matching deal are estimated at 1.5x the average deal price.
 */
export function calculateBrandCost(
  brandId: string,
  brandName: string,
  brandDeals: DealInfo[],
  neededKeywords: { keyword: string; forMeal: string | null }[],
  fallbackPrice: number,
): BrandCostResult {
  let totalCost = 0;
  let totalRegularCost = 0;
  const itemAssignments = new Map<string, { deal: DealInfo | null; cost: number; regularCost: number; forMeal: string | null }>();

  for (const { keyword, forMeal } of neededKeywords) {
    // Skip duplicates — if we already assigned this keyword, keep the first assignment
    if (itemAssignments.has(keyword)) continue;

    const bestDeal = findBestDealForKeyword(brandDeals, keyword);

    if (bestDeal) {
      const cost = bestDeal.salePrice;
      const regularCost = bestDeal.regularPrice ?? bestDeal.salePrice;
      totalCost += cost;
      totalRegularCost += regularCost;
      itemAssignments.set(keyword, { deal: bestDeal, cost, regularCost, forMeal });
    } else {
      // No deal found — estimate at 1.5x average deal price
      const estimatedCost = Math.round(fallbackPrice * 1.5 * 100) / 100;
      totalCost += estimatedCost;
      totalRegularCost += estimatedCost;
      itemAssignments.set(keyword, { deal: null, cost: estimatedCost, regularCost: estimatedCost, forMeal });
    }
  }

  return { brandId, brandName, totalCost, totalRegularCost, itemAssignments };
}

/**
 * Build the list of needed keywords from liked meals and important items.
 */
export function buildNeededKeywords(
  meals: ScoredMeal[],
  importantItems: ImportantItemInfo[],
): { keyword: string; forMeal: string | null }[] {
  const keywords: { keyword: string; forMeal: string | null }[] = [];
  const seen = new Set<string>();

  // Meal ingredient keywords
  for (const meal of meals) {
    for (const kw of meal.ingredientKeywords) {
      const lower = kw.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        keywords.push({ keyword: kw, forMeal: meal.name });
      }
    }
  }

  // Important items
  for (const item of importantItems) {
    const lower = item.name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      keywords.push({ keyword: item.name, forMeal: null });
    }
  }

  return keywords;
}

/**
 * Build a PlanStop from brand cost result and location.
 */
export function buildPlanStop(
  brandCost: BrandCostResult,
  location: LocationInfo,
  meals: ScoredMeal[],
): PlanStop {
  const planMeals: PlanMeal[] = meals.map(meal => {
    let mealCost = 0;
    let mealSavings = 0;

    for (const kw of meal.ingredientKeywords) {
      const assignment = brandCost.itemAssignments.get(kw);
      if (assignment) {
        mealCost += assignment.cost;
        mealSavings += assignment.regularCost - assignment.cost;
      }
    }

    return {
      mealId: meal.id,
      name: meal.name,
      costPerServing: Math.round((mealCost / meal.servings) * 100) / 100,
      totalCost: Math.round(mealCost * 100) / 100,
      savings: Math.round(mealSavings * 100) / 100,
    };
  });

  const items: PlanShoppingItem[] = [];
  for (const [keyword, assignment] of brandCost.itemAssignments) {
    items.push({
      name: assignment.deal?.itemName ?? keyword,
      quantity: '1',
      salePrice: assignment.deal ? assignment.cost : null,
      regularPrice: assignment.deal?.regularPrice ?? null,
      isOnSale: assignment.deal !== null,
      dealNote: assignment.deal?.unit ?? null,
      forMeal: assignment.forMeal,
    });
  }

  return {
    storeBrandName: brandCost.brandName,
    storeLocationId: location.id,
    storeAddress: location.address,
    storeBrandId: brandCost.brandId,
    meals: planMeals,
    items,
    subtotal: Math.round(brandCost.totalCost * 100) / 100,
  };
}

/**
 * Build a one-store plan: pick the brand with the lowest total cost.
 */
export function buildOneStorePlan(
  brandCosts: BrandCostResult[],
  locations: LocationInfo[],
  meals: ScoredMeal[],
  budget: number | null,
): GroceryPlan {
  // Sort by total cost ascending
  const sorted = [...brandCosts].sort((a, b) => a.totalCost - b.totalCost);
  const cheapest = sorted[0]!;

  // Find nearest location for this brand
  const location = locations.find(l => l.storeBrandId === cheapest.brandId);
  if (!location) {
    // Fallback: just use the first location
    const fallbackLocation = locations[0]!;
    const stop = buildPlanStop(cheapest, fallbackLocation, meals);
    return {
      stops: [stop],
      total: stop.subtotal,
      budgetRemaining: budget ? Math.round((budget - stop.subtotal) * 100) / 100 : 0,
      estimatedSavings: Math.round((cheapest.totalRegularCost - cheapest.totalCost) * 100) / 100,
    };
  }

  const stop = buildPlanStop(cheapest, location, meals);
  return {
    stops: [stop],
    total: stop.subtotal,
    budgetRemaining: budget ? Math.round((budget - stop.subtotal) * 100) / 100 : 0,
    estimatedSavings: Math.round((cheapest.totalRegularCost - cheapest.totalCost) * 100) / 100,
  };
}

/**
 * Build a two-store plan: for each item, assign to the cheapest brand.
 * Group into top 2 brands by item count.
 */
export function buildTwoStorePlan(
  dealsByBrand: Map<string, DealInfo[]>,
  locations: LocationInfo[],
  meals: ScoredMeal[],
  importantItems: ImportantItemInfo[],
  budget: number | null,
  _fallbackPrice: number,
): GroceryPlan | null {
  const neededKeywords = buildNeededKeywords(meals, importantItems);
  if (neededKeywords.length === 0) return null;

  // For each keyword, find the cheapest deal across all brands
  const bestBrandPerKeyword = new Map<string, { brandId: string; brandName: string; deal: DealInfo; cost: number; regularCost: number; forMeal: string | null }>();

  for (const { keyword, forMeal } of neededKeywords) {
    let bestDeal: DealInfo | null = null;
    let bestBrandId: string | null = null;
    let bestBrandName: string | null = null;

    for (const [brandId, brandDeals] of dealsByBrand) {
      const deal = findBestDealForKeyword(brandDeals, keyword);
      if (deal && (!bestDeal || deal.salePrice < bestDeal.salePrice)) {
        bestDeal = deal;
        bestBrandId = brandId;
        bestBrandName = deal.storeBrandName;
      }
    }

    if (bestDeal && bestBrandId && bestBrandName) {
      bestBrandPerKeyword.set(keyword, {
        brandId: bestBrandId,
        brandName: bestBrandName,
        deal: bestDeal,
        cost: bestDeal.salePrice,
        regularCost: bestDeal.regularPrice ?? bestDeal.salePrice,
        forMeal,
      });
    }
  }

  // Count items per brand
  const brandItemCounts = new Map<string, number>();
  for (const [, assignment] of bestBrandPerKeyword) {
    brandItemCounts.set(assignment.brandId, (brandItemCounts.get(assignment.brandId) ?? 0) + 1);
  }

  // Get top 2 brands by item count
  const sortedBrands = [...brandItemCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topBrandIds = sortedBrands.slice(0, 2).map(([id]) => id);

  if (topBrandIds.length < 2) return null; // Not enough brands for two-store

  // Build stops for each brand
  const stops: PlanStop[] = [];
  let totalCost = 0;
  let totalRegularCost = 0;

  for (const brandId of topBrandIds) {
    const brandLocation = locations.find(l => l.storeBrandId === brandId);
    if (!brandLocation) continue;

    // Collect items assigned to this brand
    const brandAssignments = new Map<string, { deal: DealInfo | null; cost: number; regularCost: number; forMeal: string | null }>();
    let brandTotalCost = 0;
    let brandTotalRegularCost = 0;

    for (const [keyword, assignment] of bestBrandPerKeyword) {
      if (assignment.brandId === brandId) {
        brandAssignments.set(keyword, {
          deal: assignment.deal,
          cost: assignment.cost,
          regularCost: assignment.regularCost,
          forMeal: assignment.forMeal,
        });
        brandTotalCost += assignment.cost;
        brandTotalRegularCost += assignment.regularCost;
      }
    }

    // Unmatched items are collected separately (not assigned to any store)

    const brandCostResult: BrandCostResult = {
      brandId,
      brandName: brandLocation.brandName,
      totalCost: brandTotalCost,
      totalRegularCost: brandTotalRegularCost,
      itemAssignments: brandAssignments,
    };

    const stop = buildPlanStop(brandCostResult, brandLocation, meals);
    stops.push(stop);
    totalCost += brandTotalCost;
    totalRegularCost += brandTotalRegularCost;
  }

  if (stops.length < 2) return null;

  // Collect items not assigned to any top-2 brand store
  const assignedKeywords = new Set<string>();
  for (const stop of stops) {
    for (const item of stop.items) {
      assignedKeywords.add(item.name.toLowerCase());
    }
  }

  const unmatchedItems: PlanShoppingItem[] = [];
  for (const { keyword, forMeal } of neededKeywords) {
    // Check if this keyword was assigned to a stop (by matching item name)
    const isAssigned = stops.some(stop =>
      stop.items.some(item =>
        item.name.toLowerCase() === keyword.toLowerCase() ||
        item.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    if (!isAssigned) {
      const matched = bestBrandPerKeyword.get(keyword);
      unmatchedItems.push({
        name: keyword,
        quantity: '1',
        salePrice: matched ? matched.cost : null,
        regularPrice: matched ? matched.regularCost : null,
        isOnSale: matched !== undefined,
        dealNote: matched ? `at ${matched.brandName}` : null,
        forMeal,
      });
    }
  }

  return {
    stops,
    total: Math.round(totalCost * 100) / 100,
    budgetRemaining: budget ? Math.round((budget - totalCost) * 100) / 100 : 0,
    estimatedSavings: Math.round((totalRegularCost - totalCost) * 100) / 100,
    unmatchedItems: unmatchedItems.length > 0 ? unmatchedItems : undefined,
  };
}

/**
 * Get the Monday of the current week as YYYY-MM-DD.
 */
export function getWeekOfMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ────────────────────────────────────────────────────────────
// Main optimize function
// ────────────────────────────────────────────────────────────

export async function optimize(
  userId: string,
  overrides: OptimizeOverrides,
): Promise<Record<string, unknown>> {
  // 1. Fetch user profile
  const user = await optimizerQueries.findUserById(userId);
  if (!user) {
    throwNotFound('USER_NOT_FOUND', 'User not found.');
  }

  // 2. Determine lat/lng
  let lat = overrides.lat ?? user.lat;
  let lng = overrides.lng ?? user.lng;

  if (lat == null || lng == null) {
    const postalCode = overrides.postalCode ?? user.postalCode;
    const coords = await geocode(postalCode);
    lat = coords.lat;
    lng = coords.lng;
  }

  const maxStores: MaxStores = overrides.maxStores ?? user.maxStores;
  const budget = user.budget;

  // 3. Fetch nearby store locations (radius 25km)
  let locations = await optimizerQueries.findNearbyLocations(lat, lng, 25);

  // 4. If storeLocationIds provided, filter to those locations
  if (overrides.storeLocationIds && overrides.storeLocationIds.length > 0) {
    const allowedIds = new Set(overrides.storeLocationIds);
    locations = locations.filter(l => allowedIds.has(l.id));
  }

  // 5. Validate locations
  if (locations.length === 0) {
    throwNotFound('NO_NEARBY_STORES', 'No stores found near your location.');
  }

  // Get unique brand IDs from locations
  const brandIds = [...new Set(locations.map(l => l.storeBrandId))];

  // 6. Fetch active deals for those store brands
  const deals = await optimizerQueries.findActiveDealsByBrands(brandIds);

  // 7. Validate deals
  if (deals.length === 0) {
    throwNotFound('NO_ACTIVE_DEALS', 'No active deals found this week.');
  }

  // 8. Fetch liked meals
  const likedMeals = await optimizerQueries.findLikedMealsFull(userId);

  // 9. Validate liked meals
  if (likedMeals.length === 0) {
    throwBadRequest('NO_LIKED_MEALS', 'Like some meals first so we can build your plan.');
  }

  // 10. Fetch active important items
  const importantItems = await optimizerQueries.findActiveImportantItems(userId);

  // 11. Build the shopping plan
  const dealsByBrand = buildDealsByBrand(deals);
  const neededKeywords = buildNeededKeywords(likedMeals, importantItems);
  const fallbackPrice = getAverageDealPrice(deals);

  // Calculate cost per brand
  const brandCosts: BrandCostResult[] = [];
  for (const [brandId, brandDeals] of dealsByBrand) {
    const brandName = brandDeals[0]?.storeBrandName ?? 'Unknown';
    const cost = calculateBrandCost(brandId, brandName, brandDeals, neededKeywords, fallbackPrice);
    brandCosts.push(cost);
  }

  // One-store plan
  const oneStorePlan = buildOneStorePlan(brandCosts, locations, likedMeals, budget);

  // Two-store plan (if maxStores >= 2)
  let twoStorePlan: GroceryPlan | null = null;
  if (maxStores >= 2 && brandIds.length >= 2) {
    twoStorePlan = buildTwoStorePlan(
      dealsByBrand,
      locations,
      likedMeals,
      importantItems,
      budget,
      fallbackPrice,
    );
  }

  // 12. Generate token and week_of
  const token = crypto.randomUUID();
  const weekOf = getWeekOfMonday();

  // Save the plan
  const savedPlan = await optimizerQueries.saveWeeklyPlan(
    userId,
    token,
    weekOf,
    oneStorePlan,
    twoStorePlan,
    [], // watchlistAlerts — comes from planner pipeline
    [], // recipeAlerts — comes from planner pipeline
  );

  logger.info('[OPTIMIZER] Plan saved', { userId, token, weekOf });

  // 13. Return the plan in snake_case for API response
  return savedPlan;
}
