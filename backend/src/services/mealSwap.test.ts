import { describe, it, expect } from 'vitest';
import type { GroceryPlan } from '@groceryhack/shared/types.js';
import { buildDealsByBrand, type DealInfo } from './optimizer.js';
import { swapMealInPlan, type MatchableMeal } from './mealSwap.js';

// ────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────

function makeDeal(o: Partial<DealInfo> = {}): DealInfo {
  return {
    id: o.id ?? 'deal',
    storeBrandId: o.storeBrandId ?? 'brand-a',
    storeBrandName: o.storeBrandName ?? 'No Frills',
    itemName: o.itemName ?? 'Item',
    salePrice: o.salePrice ?? 1,
    regularPrice: o.regularPrice === undefined ? null : o.regularPrice,
    unit: o.unit ?? 'ea',
    category: o.category ?? null,
  };
}

const REMAINING_MEAL: MatchableMeal = {
  id: 'rem-1',
  name: 'Chicken Stir Fry',
  ingredientKeywords: ['chicken', 'rice'],
  servings: 4,
};

// Replacement shares 'rice' with the remaining meal (drop-safety / no-duplicate case).
const REPLACEMENT: MatchableMeal = {
  id: 'repl-1',
  name: 'Tofu Bowl',
  ingredientKeywords: ['tofu', 'rice'],
  servings: 4,
};

const remainingMeals = new Map<string, MatchableMeal>([['rem-1', REMAINING_MEAL]]);

/** A one-store plan whose stop holds the target meal, a remaining meal, and a staple. */
function oneStorePlan(): GroceryPlan {
  return {
    stops: [
      {
        storeBrandName: 'No Frills',
        storeLocationId: 'loc-a',
        storeAddress: '1 Main St',
        storeBrandId: 'brand-a',
        meals: [
          { mealId: 'target', name: 'Beef Stew', costPerServing: 2, totalCost: 8, savings: 1 },
          { mealId: 'rem-1', name: 'Chicken Stir Fry', costPerServing: 2.12, totalCost: 8.48, savings: 4.5 },
        ],
        items: [
          { name: 'Stewing Beef', quantity: '1', salePrice: 8, regularPrice: 9, isOnSale: true, dealNote: null, forMeal: 'Beef Stew' },
          { name: 'Chicken Breast', quantity: '1', salePrice: 5.99, regularPrice: 8.99, isOnSale: true, dealNote: null, forMeal: 'Chicken Stir Fry' },
          { name: 'White Rice', quantity: '1', salePrice: 2.49, regularPrice: 3.99, isOnSale: true, dealNote: null, forMeal: 'Chicken Stir Fry' },
          { name: 'Whole Milk', quantity: '1', salePrice: 3.29, regularPrice: 4.29, isOnSale: true, dealNote: null, forMeal: null },
        ],
        subtotal: 19.77,
      },
    ],
    total: 19.77,
    budgetRemaining: 80.23,
    estimatedSavings: 7.5,
  };
}

const oneStoreDeals = buildDealsByBrand([
  makeDeal({ id: 'd-chicken', itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
  makeDeal({ id: 'd-rice', itemName: 'White Rice', salePrice: 2.49, regularPrice: 3.99 }),
  makeDeal({ id: 'd-tofu', itemName: 'Firm Tofu', salePrice: 3.49, regularPrice: 4.49 }),
]);

// ────────────────────────────────────────────────────────────
// One-store
// ────────────────────────────────────────────────────────────

describe('swapMealInPlan — one-store', () => {
  it('replaces the target meal with the replacement meal', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);

    const mealIds = result.stops[0]!.meals.map((m) => m.mealId);
    expect(mealIds).not.toContain('target');
    expect(mealIds).toContain('repl-1');
    expect(mealIds).toContain('rem-1');
  });

  it("adds the replacement's matched deals as on-sale items tagged forMeal=replacement", () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);

    const tofu = result.stops[0]!.items.find((i) => i.name === 'Firm Tofu');
    expect(tofu).toBeDefined();
    expect(tofu!.isOnSale).toBe(true);
    expect(tofu!.salePrice).toBe(3.49);
    expect(tofu!.forMeal).toBe('Tofu Bowl');
  });

  it('drops the swapped-out meal\'s now-unneeded item line', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);
    expect(result.stops[0]!.items.find((i) => i.name === 'Stewing Beef')).toBeUndefined();
  });

  it('keeps a keyword shared with a remaining meal — single line, tagged to that meal', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);

    const rice = result.stops[0]!.items.filter((i) => i.name === 'White Rice');
    expect(rice).toHaveLength(1); // shared between Chicken Stir Fry and Tofu Bowl, not duplicated
    expect(rice[0]!.forMeal).toBe('Chicken Stir Fry');
  });

  it('preserves a forMeal=null staple line', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);

    const milk = result.stops[0]!.items.find((i) => i.name === 'Whole Milk');
    expect(milk).toBeDefined();
    expect(milk!.forMeal).toBeNull();
  });

  it('recomputes subtotal, total, savings, and budgetRemaining', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);

    // chicken 5.99 + rice 2.49 + tofu 3.49 + milk 3.29 = 15.26
    expect(result.stops[0]!.subtotal).toBeCloseTo(15.26, 2);
    expect(result.total).toBeCloseTo(15.26, 2);
    // (8.99-5.99)+(3.99-2.49)+(4.49-3.49)+(4.29-3.29) = 6.50
    expect(result.estimatedSavings).toBeCloseTo(6.5, 2);
    expect(result.budgetRemaining).toBeCloseTo(84.74, 2);
  });

  it('keeps an on-sale ingredient that exists, and lists a no-deal ingredient at an estimate', () => {
    // Replacement needs 'tofu' (on sale) and 'quinoa' (no deal at this brand).
    const replacement: MatchableMeal = { id: 'repl-2', name: 'Quinoa Tofu Bowl', ingredientKeywords: ['tofu', 'quinoa'], servings: 4 };
    const result = swapMealInPlan(oneStorePlan(), 'target', replacement, remainingMeals, oneStoreDeals, 4.0, 100);

    const tofu = result.stops[0]!.items.find((i) => i.name === 'Firm Tofu');
    expect(tofu!.isOnSale).toBe(true); // never dropped
    const quinoa = result.stops[0]!.items.find((i) => i.name === 'quinoa');
    expect(quinoa).toBeDefined();
    expect(quinoa!.isOnSale).toBe(false); // estimated, still on the list
    expect(quinoa!.salePrice).toBeNull();
  });

  it('leaves a representation that does not contain the target untouched (same reference)', () => {
    const plan = oneStorePlan();
    const result = swapMealInPlan(plan, 'not-in-plan', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, 100);
    expect(result).toBe(plan);
  });

  it('treats a null budget as budgetRemaining 0', () => {
    const result = swapMealInPlan(oneStorePlan(), 'target', REPLACEMENT, remainingMeals, oneStoreDeals, 3.0, null);
    expect(result.budgetRemaining).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// Two-store (Q2 — mirror the optimizer's single-brand assignment)
// ────────────────────────────────────────────────────────────

/** A two-store plan: the target + remaining meal appear in BOTH stops. */
function twoStorePlan(): GroceryPlan {
  const meals = [
    { mealId: 'target', name: 'Beef Stew', costPerServing: 1, totalCost: 4, savings: 1 },
    { mealId: 'rem-1', name: 'Chicken Stir Fry', costPerServing: 1, totalCost: 4, savings: 1 },
  ];
  return {
    stops: [
      {
        storeBrandName: 'No Frills',
        storeLocationId: 'loc-a',
        storeAddress: '1 Main St',
        storeBrandId: 'brand-a',
        meals,
        items: [],
        subtotal: 4,
      },
      {
        storeBrandName: 'FreshCo',
        storeLocationId: 'loc-b',
        storeAddress: '2 King St',
        storeBrandId: 'brand-b',
        meals,
        items: [],
        subtotal: 4,
      },
    ],
    total: 8,
    budgetRemaining: 92,
    estimatedSavings: 2,
  };
}

const twoStoreDeals = buildDealsByBrand([
  // brand-a: cheapest chicken + rice; pricier tofu
  makeDeal({ id: 'a-chicken', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
  makeDeal({ id: 'a-rice', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'White Rice', salePrice: 2.49, regularPrice: 3.99 }),
  makeDeal({ id: 'a-tofu', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'Firm Tofu', salePrice: 3.99, regularPrice: 4.99 }),
  // brand-b: cheapest tofu; pricier rice
  makeDeal({ id: 'b-tofu', storeBrandId: 'brand-b', storeBrandName: 'FreshCo', itemName: 'Silken Tofu', salePrice: 2.99, regularPrice: 4.49 }),
  makeDeal({ id: 'b-rice', storeBrandId: 'brand-b', storeBrandName: 'FreshCo', itemName: 'Jasmine Rice', salePrice: 3.99, regularPrice: 4.99 }),
]);

describe('swapMealInPlan — two-store', () => {
  it('places the replacement meal in both stops but each on-sale item only once (cheaper brand)', () => {
    const result = swapMealInPlan(twoStorePlan(), 'target', REPLACEMENT, remainingMeals, twoStoreDeals, 3.0, 100);

    // The replacement PlanMeal is in BOTH stops (optimizer maps every meal into every stop).
    for (const stop of result.stops) {
      expect(stop.meals.map((m) => m.mealId)).toContain('repl-1');
      expect(stop.meals.map((m) => m.mealId)).not.toContain('target');
    }

    // tofu assigned to the cheaper brand (FreshCo 2.99 < No Frills 3.99) — a single line.
    const tofuLines = result.stops.flatMap((s) => s.items).filter((i) => i.name === 'Silken Tofu');
    expect(tofuLines).toHaveLength(1);
    expect(result.stops.find((s) => s.storeBrandId === 'brand-b')!.items.some((i) => i.name === 'Silken Tofu')).toBe(true);

    // rice assigned to the cheaper brand (No Frills 2.49 < FreshCo 3.99) — a single line.
    const riceLines = result.stops.flatMap((s) => s.items).filter((i) => i.name === 'White Rice');
    expect(riceLines).toHaveLength(1);
  });

  it('keeps total equal to the sum of stop subtotals (no double-count)', () => {
    const result = swapMealInPlan(twoStorePlan(), 'target', REPLACEMENT, remainingMeals, twoStoreDeals, 3.0, 100);
    const sumSubtotals = result.stops.reduce((sum, s) => sum + s.subtotal, 0);
    expect(result.total).toBeCloseTo(sumSubtotals, 2);
    // chicken 5.99 + rice 2.49 (brand-a) + tofu 2.99 (brand-b) = 11.47
    expect(result.total).toBeCloseTo(11.47, 2);
  });

  it('routes a keyword neither brand carries to unmatchedItems', () => {
    const replacement: MatchableMeal = { id: 'repl-3', name: 'Quinoa Bowl', ingredientKeywords: ['quinoa'], servings: 4 };
    const result = swapMealInPlan(twoStorePlan(), 'target', replacement, remainingMeals, twoStoreDeals, 3.0, 100);

    expect(result.unmatchedItems?.some((i) => i.name === 'quinoa')).toBe(true);
    // ...and it is not silently added to a stop.
    expect(result.stops.flatMap((s) => s.items).some((i) => i.name === 'quinoa')).toBe(false);
  });

  it('leaves a two-store representation untouched when it does not contain the target', () => {
    const plan = twoStorePlan();
    const result = swapMealInPlan(plan, 'absent', REPLACEMENT, remainingMeals, twoStoreDeals, 3.0, 100);
    expect(result).toBe(plan);
  });
});
