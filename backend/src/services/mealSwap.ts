import type { GroceryPlan, PlanStop, PlanShoppingItem } from '@groceryhack/shared/types.js';
import {
  type DealInfo,
  type LocationInfo,
  type ScoredMeal,
  type BrandCostResult,
  buildNeededKeywords,
  calculateBrandCost,
  findBestDealForKeyword,
  buildPlanStop,
} from './optimizer.js';

// ────────────────────────────────────────────────────────────
// Meal-swap service
//
// Pure, testable re-match of one meal in an already-built plan. When the account
// holder accepts a family member's suggestion (services/family.ts), the target meal
// is replaced by the suggested meal and the plan's shopping list / costs / savings
// are recomputed against the deals ALREADY available at the plan's selected store(s)
// — without re-picking stores or re-running the full optimizer.
//
// Design (resolved in slice-5/slice-abstract.md §Questions):
//   Q1 — the plan JSONB stores no ingredient keywords and `forMeal` is first-meal-only,
//        so the drop/keep rule can't be evaluated from the plan alone. Resolution:
//        receive every remaining stop-meal's keywords and REBUILD each affected stop
//        from its post-swap meal set, reusing the optimizer's own dedup. `forMeal=null`
//        staple (important-item) lines are preserved verbatim.
//   Q2 — in two-store every meal is in every stop. Resolution: mirror the optimizer's
//        single-brand assignment — assign each keyword to the cheaper of the plan's
//        EXISTING brands (no store re-pick), so a deal is never double-counted across
//        both stops; keywords neither brand carries fall to `unmatchedItems`.
// ────────────────────────────────────────────────────────────

/** A meal reduced to the fields the re-match needs (from db `findMealForMatching`). */
export interface MatchableMeal {
  id: string;
  name: string;
  ingredientKeywords: string[];
  servings: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Reconstruct the LocationInfo `buildPlanStop` needs from an existing stop. */
function locationFromStop(stop: PlanStop): LocationInfo {
  return {
    id: stop.storeLocationId,
    storeBrandId: stop.storeBrandId,
    brandName: stop.storeBrandName,
    address: stop.storeAddress,
    lat: 0,
    lng: 0,
    distanceKm: 0,
  };
}

function toScoredMeal(meal: MatchableMeal): ScoredMeal {
  return {
    id: meal.id,
    name: meal.name,
    ingredientKeywords: meal.ingredientKeywords,
    servings: meal.servings,
    ingredients: [], // unused by buildNeededKeywords / calculateBrandCost / buildPlanStop
  };
}

/**
 * Build the post-swap meal set for a representation: every distinct meal currently in
 * its stops, minus the target, plus the replacement. Remaining meals are processed
 * first so a keyword shared with a remaining meal stays tagged to that meal (not the
 * replacement); a keyword only the target owned is re-tagged to the replacement.
 */
function collectPostSwapMeals(
  representation: GroceryPlan,
  targetMealId: string,
  replacement: MatchableMeal,
  remainingMeals: Map<string, MatchableMeal>,
): ScoredMeal[] {
  const seen = new Set<string>();
  const meals: ScoredMeal[] = [];
  for (const stop of representation.stops) {
    for (const planMeal of stop.meals) {
      if (planMeal.mealId === targetMealId || seen.has(planMeal.mealId)) continue;
      seen.add(planMeal.mealId);
      const matchable = remainingMeals.get(planMeal.mealId) ?? {
        // Fallback for a plan meal whose row is unavailable (e.g. removed from the
        // pool): keep it listed with no keywords so its line/cost is simply 0.
        id: planMeal.mealId,
        name: planMeal.name,
        ingredientKeywords: [],
        servings: 1,
      };
      meals.push(toScoredMeal(matchable));
    }
  }
  meals.push(toScoredMeal(replacement));
  return meals;
}

/**
 * Carry the original stop's important-item lines (`forMeal === null`) into the rebuilt
 * stop verbatim. A staple is dropped only if a rebuilt meal line already covers the same
 * product name (a meal now owns it), so no line is duplicated. Returns the merged item
 * list and the staple cost to fold back into the subtotal (sale price, or the optimizer's
 * 1.5×-average estimate when the staple isn't on sale).
 */
function preserveStaples(
  rebuiltItems: PlanShoppingItem[],
  originalItems: PlanShoppingItem[],
  fallbackPrice: number,
): { items: PlanShoppingItem[]; addedCost: number } {
  const rebuiltNames = new Set(rebuiltItems.map((i) => i.name.toLowerCase()));
  const estimate = round2(fallbackPrice * 1.5);
  const items = [...rebuiltItems];
  let addedCost = 0;
  for (const item of originalItems) {
    if (item.forMeal !== null) continue; // only staples are preserved; meal lines are rebuilt
    if (rebuiltNames.has(item.name.toLowerCase())) continue; // a meal now owns this product
    items.push(item);
    addedCost += item.isOnSale && item.salePrice !== null ? item.salePrice : estimate;
  }
  return { items, addedCost };
}

/** Sum on-sale savings across stop shopping lists (regular − sale, ≥ 0). */
function stopSavings(stops: PlanStop[]): number {
  let savings = 0;
  for (const stop of stops) {
    for (const item of stop.items) {
      if (item.isOnSale && item.salePrice !== null && item.regularPrice !== null) {
        savings += Math.max(0, item.regularPrice - item.salePrice);
      }
    }
  }
  return round2(savings);
}

/** Rebuild a single-store representation: every keyword matched at the one brand. */
function rebuildOneStore(
  representation: GroceryPlan,
  postSwapMeals: ScoredMeal[],
  dealsByBrand: Map<string, DealInfo[]>,
  fallbackPrice: number,
  budget: number | null,
): GroceryPlan {
  const stop = representation.stops[0]!;
  const neededKeywords = buildNeededKeywords(postSwapMeals, []);
  const brandDeals = dealsByBrand.get(stop.storeBrandId) ?? [];
  const brandCost = calculateBrandCost(
    stop.storeBrandId,
    stop.storeBrandName,
    brandDeals,
    neededKeywords,
    fallbackPrice,
  );
  const rebuilt = buildPlanStop(brandCost, locationFromStop(stop), postSwapMeals);
  const { items, addedCost } = preserveStaples(rebuilt.items, stop.items, fallbackPrice);
  const newStop: PlanStop = { ...rebuilt, items, subtotal: round2(brandCost.totalCost + addedCost) };

  return {
    stops: [newStop],
    total: newStop.subtotal,
    budgetRemaining: budget !== null ? round2(budget - newStop.subtotal) : 0,
    estimatedSavings: stopSavings([newStop]),
  };
}

/**
 * Rebuild a multi-store representation: assign each keyword to the cheaper of the plan's
 * existing brands (single assignment — no double-count), build each stop from its subset,
 * route keywords no brand carries to `unmatchedItems`. Mirrors `buildTwoStorePlan` but
 * over the plan's already-chosen brands (no store re-pick).
 */
function rebuildMultiStore(
  representation: GroceryPlan,
  postSwapMeals: ScoredMeal[],
  dealsByBrand: Map<string, DealInfo[]>,
  fallbackPrice: number,
  budget: number | null,
): GroceryPlan {
  const stops = representation.stops;
  const neededKeywords = buildNeededKeywords(postSwapMeals, []);

  // Assign each keyword to the cheaper of the plan's brands that carries it.
  type Assignment = { deal: DealInfo | null; cost: number; regularCost: number; forMeal: string | null };
  const perBrand = new Map<string, Map<string, Assignment>>();
  for (const stop of stops) {
    if (!perBrand.has(stop.storeBrandId)) perBrand.set(stop.storeBrandId, new Map());
  }
  const matched = new Set<string>();

  for (const { keyword, forMeal } of neededKeywords) {
    if (matched.has(keyword.toLowerCase())) continue;
    let bestBrandId: string | null = null;
    let bestDeal: DealInfo | null = null;
    for (const stop of stops) {
      const deal = findBestDealForKeyword(dealsByBrand.get(stop.storeBrandId) ?? [], keyword);
      if (deal && (!bestDeal || deal.salePrice < bestDeal.salePrice)) {
        bestDeal = deal;
        bestBrandId = stop.storeBrandId;
      }
    }
    if (bestDeal && bestBrandId) {
      perBrand.get(bestBrandId)!.set(keyword, {
        deal: bestDeal,
        cost: bestDeal.salePrice,
        regularCost: bestDeal.regularPrice ?? bestDeal.salePrice,
        forMeal,
      });
      matched.add(keyword.toLowerCase());
    }
  }

  // Build each stop from its assigned subset (+ preserved staples).
  const newStops: PlanStop[] = stops.map((stop) => {
    const itemAssignments = perBrand.get(stop.storeBrandId)!;
    let brandTotalCost = 0;
    let brandTotalRegularCost = 0;
    for (const a of itemAssignments.values()) {
      brandTotalCost += a.cost;
      brandTotalRegularCost += a.regularCost;
    }
    const brandCost: BrandCostResult = {
      brandId: stop.storeBrandId,
      brandName: stop.storeBrandName,
      totalCost: brandTotalCost,
      totalRegularCost: brandTotalRegularCost,
      itemAssignments,
    };
    const rebuilt = buildPlanStop(brandCost, locationFromStop(stop), postSwapMeals);
    const { items, addedCost } = preserveStaples(rebuilt.items, stop.items, fallbackPrice);
    return { ...rebuilt, items, subtotal: round2(brandTotalCost + addedCost) };
  });

  // Keywords no plan brand carries still belong on the list (estimate-free, like the optimizer).
  const unmatchedItems: PlanShoppingItem[] = [];
  for (const { keyword, forMeal } of neededKeywords) {
    if (matched.has(keyword.toLowerCase())) continue;
    const already = newStops.some((s) =>
      s.items.some((i) => i.name.toLowerCase().includes(keyword.toLowerCase())),
    );
    if (already) continue;
    unmatchedItems.push({
      name: keyword,
      quantity: '1',
      salePrice: null,
      regularPrice: null,
      isOnSale: false,
      dealNote: null,
      forMeal,
    });
  }

  const total = round2(newStops.reduce((sum, s) => sum + s.subtotal, 0));
  return {
    stops: newStops,
    total,
    budgetRemaining: budget !== null ? round2(budget - total) : 0,
    estimatedSavings: stopSavings(newStops),
    unmatchedItems: unmatchedItems.length > 0 ? unmatchedItems : undefined,
  };
}

/**
 * Swap `targetMealId` for `replacement` in ONE plan representation and return the
 * recomputed representation. No-op-safe: if the target meal isn't in any stop, the
 * representation is returned unchanged (e.g. a `two_store_optimized` that doesn't
 * contain it). Call once per representation.
 *
 * @param remainingMeals every distinct non-target plan mealId → its matchable fields.
 * @param dealsByBrand   current deals grouped by the plan's store brands.
 * @param fallbackPrice  average deal price (optimizer's 1.5× estimate base).
 * @param budget         the holder's budget, or null (drives `budgetRemaining`).
 */
export function swapMealInPlan(
  representation: GroceryPlan,
  targetMealId: string,
  replacement: MatchableMeal,
  remainingMeals: Map<string, MatchableMeal>,
  dealsByBrand: Map<string, DealInfo[]>,
  fallbackPrice: number,
  budget: number | null,
): GroceryPlan {
  const containsTarget = representation.stops.some((stop) =>
    stop.meals.some((meal) => meal.mealId === targetMealId),
  );
  if (!containsTarget) return representation;

  const postSwapMeals = collectPostSwapMeals(representation, targetMealId, replacement, remainingMeals);

  return representation.stops.length <= 1
    ? rebuildOneStore(representation, postSwapMeals, dealsByBrand, fallbackPrice, budget)
    : rebuildMultiStore(representation, postSwapMeals, dealsByBrand, fallbackPrice, budget);
}
