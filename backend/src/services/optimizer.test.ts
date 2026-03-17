import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDealsByBrand,
  findBestDealForKeyword,
  getAverageDealPrice,
  calculateBrandCost,
  buildNeededKeywords,
  buildOneStorePlan,
  buildTwoStorePlan,
  getWeekOfMonday,
} from './optimizer.js';

// ────────────────────────────────────────────────────────────
// Mock DB queries and external dependencies
// ────────────────────────────────────────────────────────────

vi.mock('../db/queries/optimizer.js', () => ({
  findUserById: vi.fn(),
  findNearbyLocations: vi.fn(),
  findActiveDealsByBrands: vi.fn(),
  findLikedMealsFull: vi.fn(),
  findActiveImportantItems: vi.fn(),
  saveWeeklyPlan: vi.fn(),
}));

vi.mock('../lib/geocode.js', () => ({
  geocode: vi.fn().mockResolvedValue({ lat: 43.2557, lng: -79.8711 }),
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ────────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────────

function makeDeal(overrides: Partial<{
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  storeLocationId: string | null;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  category: string | null;
}> = {}): {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  storeLocationId: string | null;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  category: string | null;
} {
  return {
    id: overrides.id ?? 'deal-1',
    storeBrandId: overrides.storeBrandId ?? 'brand-a',
    storeBrandName: overrides.storeBrandName ?? 'No Frills',
    storeLocationId: overrides.storeLocationId ?? null,
    itemName: overrides.itemName ?? 'Chicken Breast',
    salePrice: overrides.salePrice ?? 5.99,
    regularPrice: overrides.regularPrice === undefined ? 8.99 : overrides.regularPrice,
    unit: overrides.unit ?? 'per kg',
    category: overrides.category ?? 'meat',
  };
}

function makeLocation(overrides: Partial<{
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}> = {}): {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
} {
  return {
    id: overrides.id ?? 'loc-1',
    storeBrandId: overrides.storeBrandId ?? 'brand-a',
    brandName: overrides.brandName ?? 'No Frills',
    address: overrides.address ?? '123 Main St',
    lat: overrides.lat ?? 43.25,
    lng: overrides.lng ?? -79.87,
    distanceKm: overrides.distanceKm ?? 2.5,
  };
}

function makeMeal(overrides: Partial<{
  id: string;
  name: string;
  ingredientKeywords: string[];
  ingredients: { name: string; quantity: string; unit: string }[];
  servings: number;
}> = {}): {
  id: string;
  name: string;
  ingredientKeywords: string[];
  ingredients: { name: string; quantity: string; unit: string }[];
  servings: number;
} {
  return {
    id: overrides.id ?? 'meal-1',
    name: overrides.name ?? 'Chicken Stir Fry',
    ingredientKeywords: overrides.ingredientKeywords ?? ['chicken', 'rice', 'broccoli'],
    ingredients: overrides.ingredients ?? [
      { name: 'Chicken Breast', quantity: '500', unit: 'g' },
      { name: 'Rice', quantity: '2', unit: 'cups' },
      { name: 'Broccoli', quantity: '1', unit: 'head' },
    ],
    servings: overrides.servings ?? 4,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('buildDealsByBrand', () => {
  it('groups deals by store brand ID', () => {
    const deals = [
      makeDeal({ id: 'd1', storeBrandId: 'brand-a', storeBrandName: 'No Frills' }),
      makeDeal({ id: 'd2', storeBrandId: 'brand-b', storeBrandName: 'FreshCo' }),
      makeDeal({ id: 'd3', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'Rice' }),
    ];

    const result = buildDealsByBrand(deals);

    expect(result.size).toBe(2);
    expect(result.get('brand-a')!.length).toBe(2);
    expect(result.get('brand-b')!.length).toBe(1);
  });

  it('returns empty map for empty deals', () => {
    const result = buildDealsByBrand([]);
    expect(result.size).toBe(0);
  });
});

describe('findBestDealForKeyword', () => {
  it('finds cheapest deal matching keyword', () => {
    const deals = [
      makeDeal({ id: 'd1', itemName: 'Chicken Breast', salePrice: 5.99 }),
      makeDeal({ id: 'd2', itemName: 'Chicken Thighs', salePrice: 3.99 }),
      makeDeal({ id: 'd3', itemName: 'Beef Steak', salePrice: 12.99 }),
    ];

    const result = findBestDealForKeyword(deals, 'chicken');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('d2');
    expect(result!.salePrice).toBe(3.99);
  });

  it('returns null when no deals match keyword', () => {
    const deals = [
      makeDeal({ itemName: 'Beef Steak', salePrice: 12.99 }),
    ];

    const result = findBestDealForKeyword(deals, 'chicken');
    expect(result).toBeNull();
  });

  it('performs case-insensitive matching', () => {
    const deals = [
      makeDeal({ itemName: 'CHICKEN BREAST', salePrice: 5.99 }),
    ];

    const result = findBestDealForKeyword(deals, 'chicken');
    expect(result).not.toBeNull();
  });
});

describe('getAverageDealPrice', () => {
  it('calculates average sale price', () => {
    const deals = [
      makeDeal({ salePrice: 4.0 }),
      makeDeal({ salePrice: 6.0 }),
      makeDeal({ salePrice: 8.0 }),
    ];

    expect(getAverageDealPrice(deals)).toBe(6.0);
  });

  it('returns 3.0 for empty deals', () => {
    expect(getAverageDealPrice([])).toBe(3.0);
  });
});

describe('calculateBrandCost', () => {
  it('calculates total cost using deal prices for matching keywords', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
      makeDeal({ itemName: 'White Rice', salePrice: 2.49, regularPrice: 3.99 }),
    ];

    const neededKeywords = [
      { keyword: 'chicken', forMeal: 'Stir Fry' },
      { keyword: 'rice', forMeal: 'Stir Fry' },
    ];

    const result = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, 5.0);

    expect(result.brandId).toBe('brand-a');
    expect(result.totalCost).toBeCloseTo(5.99 + 2.49, 2);
    expect(result.totalRegularCost).toBeCloseTo(8.99 + 3.99, 2);
  });

  it('uses fallback price for unmatched keywords', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99 }),
    ];

    const neededKeywords = [
      { keyword: 'chicken', forMeal: 'Stir Fry' },
      { keyword: 'tofu', forMeal: 'Tofu Bowl' },
    ];

    const fallbackPrice = 4.0;
    const result = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, fallbackPrice);

    // tofu should be estimated at 1.5 * 4.0 = 6.0
    expect(result.totalCost).toBeCloseTo(5.99 + 6.0, 2);
  });

  it('skips duplicate keywords', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99 }),
    ];

    const neededKeywords = [
      { keyword: 'chicken', forMeal: 'Stir Fry' },
      { keyword: 'chicken', forMeal: 'Chicken Soup' },
    ];

    const result = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, 5.0);

    // Should only count chicken once
    expect(result.totalCost).toBeCloseTo(5.99, 2);
    expect(result.itemAssignments.size).toBe(1);
  });
});

describe('buildNeededKeywords', () => {
  it('collects keywords from meals and important items', () => {
    const meals = [
      makeMeal({ ingredientKeywords: ['chicken', 'rice'] }),
    ];
    const importantItems = [
      { id: 'ii-1', name: 'Milk', quantity: '2L' },
      { id: 'ii-2', name: 'Eggs', quantity: '1 dozen' },
    ];

    const result = buildNeededKeywords(meals, importantItems);

    expect(result.length).toBe(4);
    expect(result.map(r => r.keyword)).toEqual(['chicken', 'rice', 'Milk', 'Eggs']);
  });

  it('deduplicates keywords (case insensitive)', () => {
    const meals = [
      makeMeal({ ingredientKeywords: ['chicken', 'Rice'] }),
    ];
    const importantItems = [
      { id: 'ii-1', name: 'rice', quantity: null },
    ];

    const result = buildNeededKeywords(meals, importantItems);

    // 'Rice' and 'rice' should be deduped
    expect(result.length).toBe(2);
  });

  it('marks meal keywords with forMeal and important items with null', () => {
    const meals = [
      makeMeal({ name: 'Stir Fry', ingredientKeywords: ['chicken'] }),
    ];
    const importantItems = [
      { id: 'ii-1', name: 'Bread', quantity: null },
    ];

    const result = buildNeededKeywords(meals, importantItems);

    expect(result[0]!.forMeal).toBe('Stir Fry');
    expect(result[1]!.forMeal).toBeNull();
  });
});

describe('buildOneStorePlan', () => {
  it('selects cheapest brand for one-store plan', () => {
    const brandDealsA = [
      makeDeal({ storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
    ];
    const brandDealsB = [
      makeDeal({ storeBrandId: 'brand-b', storeBrandName: 'FreshCo', itemName: 'Chicken Breast', salePrice: 7.99, regularPrice: 9.99 }),
    ];

    const neededKeywords = [{ keyword: 'chicken', forMeal: 'Stir Fry' }];

    const brandCostA = calculateBrandCost('brand-a', 'No Frills', brandDealsA, neededKeywords, 5.0);
    const brandCostB = calculateBrandCost('brand-b', 'FreshCo', brandDealsB, neededKeywords, 5.0);

    const locations = [
      makeLocation({ id: 'loc-a', storeBrandId: 'brand-a', brandName: 'No Frills' }),
      makeLocation({ id: 'loc-b', storeBrandId: 'brand-b', brandName: 'FreshCo' }),
    ];

    const meals = [makeMeal({ ingredientKeywords: ['chicken'] })];

    const plan = buildOneStorePlan([brandCostA, brandCostB], locations, meals, 100);

    expect(plan.stops.length).toBe(1);
    expect(plan.stops[0]!.storeBrandName).toBe('No Frills');
    expect(plan.total).toBeCloseTo(5.99, 2);
  });

  it('calculates budget remaining', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
    ];
    const neededKeywords = [{ keyword: 'chicken', forMeal: 'Stir Fry' }];
    const brandCost = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, 5.0);
    const locations = [makeLocation()];
    const meals = [makeMeal({ ingredientKeywords: ['chicken'] })];

    const plan = buildOneStorePlan([brandCost], locations, meals, 50);

    expect(plan.budgetRemaining).toBeCloseTo(50 - 5.99, 2);
  });

  it('calculates savings correctly', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
      makeDeal({ itemName: 'Rice', salePrice: 2.49, regularPrice: 3.99 }),
    ];
    const neededKeywords = [
      { keyword: 'chicken', forMeal: 'Stir Fry' },
      { keyword: 'rice', forMeal: 'Stir Fry' },
    ];
    const brandCost = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, 5.0);
    const locations = [makeLocation()];
    const meals = [makeMeal({ ingredientKeywords: ['chicken', 'rice'] })];

    const plan = buildOneStorePlan([brandCost], locations, meals, null);

    // Savings = (8.99 + 3.99) - (5.99 + 2.49) = 4.50
    expect(plan.estimatedSavings).toBeCloseTo(4.50, 2);
  });
});

describe('buildTwoStorePlan', () => {
  it('assigns items to cheapest brand across two stores', () => {
    const dealsByBrand = new Map([
      ['brand-a', [
        makeDeal({ id: 'd1', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
        makeDeal({ id: 'd2', storeBrandId: 'brand-a', storeBrandName: 'No Frills', itemName: 'White Rice', salePrice: 4.99, regularPrice: 5.99 }),
      ]],
      ['brand-b', [
        makeDeal({ id: 'd3', storeBrandId: 'brand-b', storeBrandName: 'FreshCo', itemName: 'Chicken Thighs', salePrice: 3.99, regularPrice: 6.99 }),
        makeDeal({ id: 'd4', storeBrandId: 'brand-b', storeBrandName: 'FreshCo', itemName: 'Jasmine Rice', salePrice: 5.99, regularPrice: 7.99 }),
      ]],
    ]);

    const locations = [
      makeLocation({ id: 'loc-a', storeBrandId: 'brand-a', brandName: 'No Frills' }),
      makeLocation({ id: 'loc-b', storeBrandId: 'brand-b', brandName: 'FreshCo' }),
    ];

    const meals = [makeMeal({ ingredientKeywords: ['chicken', 'rice'] })];
    const importantItems = [{ id: 'ii-1', name: 'Milk', quantity: '2L' }];

    const plan = buildTwoStorePlan(dealsByBrand, locations, meals, importantItems, 100, 5.0);

    expect(plan).not.toBeNull();
    expect(plan!.stops.length).toBe(2);
  });

  it('returns null when fewer than 2 brands available', () => {
    const dealsByBrand = new Map([
      ['brand-a', [
        makeDeal({ storeBrandId: 'brand-a', itemName: 'Chicken', salePrice: 5.99 }),
      ]],
    ]);

    const locations = [makeLocation()];
    const meals = [makeMeal({ ingredientKeywords: ['chicken'] })];

    const plan = buildTwoStorePlan(dealsByBrand, locations, meals, [], 100, 5.0);

    expect(plan).toBeNull();
  });
});

describe('important items included in plan', () => {
  it('includes important items in needed keywords', () => {
    const meals = [makeMeal({ ingredientKeywords: ['chicken'] })];
    const importantItems = [
      { id: 'ii-1', name: 'Milk', quantity: '2L' },
      { id: 'ii-2', name: 'Eggs', quantity: '1 dozen' },
    ];

    const keywords = buildNeededKeywords(meals, importantItems);

    const kwNames = keywords.map(k => k.keyword);
    expect(kwNames).toContain('Milk');
    expect(kwNames).toContain('Eggs');
  });

  it('important items are costed in brand calculation', () => {
    const brandDeals = [
      makeDeal({ itemName: 'Whole Milk', salePrice: 3.49, regularPrice: 4.99 }),
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
    ];

    const neededKeywords = [
      { keyword: 'chicken', forMeal: 'Stir Fry' },
      { keyword: 'milk', forMeal: null }, // important item
    ];

    const result = calculateBrandCost('brand-a', 'No Frills', brandDeals, neededKeywords, 5.0);

    expect(result.totalCost).toBeCloseTo(5.99 + 3.49, 2);
  });
});

describe('getWeekOfMonday', () => {
  it('returns a date string in YYYY-MM-DD format', () => {
    const weekOf = getWeekOfMonday();
    expect(weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a Monday', () => {
    const weekOf = getWeekOfMonday();
    const date = new Date(weekOf + 'T00:00:00');
    // getDay() returns 1 for Monday
    expect(date.getDay()).toBe(1);
  });
});

describe('optimize (integration with mocks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NO_NEARBY_STORES when no locations found', async () => {
    const { optimize } = await import('./optimizer.js');
    const queries = await import('../db/queries/optimizer.js');

    vi.mocked(queries.findUserById).mockResolvedValue({
      id: 'user-1',
      postalCode: 'L8P1A1',
      lat: 43.25,
      lng: -79.87,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(queries.findNearbyLocations).mockResolvedValue([]);

    await expect(optimize('user-1', {})).rejects.toMatchObject({
      code: 'NO_NEARBY_STORES',
      status: 404,
    });
  });

  it('throws NO_ACTIVE_DEALS when no deals found', async () => {
    const { optimize } = await import('./optimizer.js');
    const queries = await import('../db/queries/optimizer.js');

    vi.mocked(queries.findUserById).mockResolvedValue({
      id: 'user-1',
      postalCode: 'L8P1A1',
      lat: 43.25,
      lng: -79.87,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(queries.findNearbyLocations).mockResolvedValue([
      makeLocation(),
    ]);
    vi.mocked(queries.findActiveDealsByBrands).mockResolvedValue([]);

    await expect(optimize('user-1', {})).rejects.toMatchObject({
      code: 'NO_ACTIVE_DEALS',
      status: 404,
    });
  });

  it('throws NO_LIKED_MEALS when user has no liked meals', async () => {
    const { optimize } = await import('./optimizer.js');
    const queries = await import('../db/queries/optimizer.js');

    vi.mocked(queries.findUserById).mockResolvedValue({
      id: 'user-1',
      postalCode: 'L8P1A1',
      lat: 43.25,
      lng: -79.87,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(queries.findNearbyLocations).mockResolvedValue([
      makeLocation(),
    ]);
    vi.mocked(queries.findActiveDealsByBrands).mockResolvedValue([
      makeDeal(),
    ]);
    vi.mocked(queries.findLikedMealsFull).mockResolvedValue([]);

    await expect(optimize('user-1', {})).rejects.toMatchObject({
      code: 'NO_LIKED_MEALS',
      status: 400,
    });
  });

  it('returns a saved plan when all data is available', async () => {
    const { optimize } = await import('./optimizer.js');
    const queries = await import('../db/queries/optimizer.js');

    vi.mocked(queries.findUserById).mockResolvedValue({
      id: 'user-1',
      postalCode: 'L8P1A1',
      lat: 43.25,
      lng: -79.87,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(queries.findNearbyLocations).mockResolvedValue([
      makeLocation(),
    ]);
    vi.mocked(queries.findActiveDealsByBrands).mockResolvedValue([
      makeDeal({ itemName: 'Chicken Breast', salePrice: 5.99, regularPrice: 8.99 }),
    ]);
    vi.mocked(queries.findLikedMealsFull).mockResolvedValue([
      makeMeal({ ingredientKeywords: ['chicken'] }),
    ]);
    vi.mocked(queries.findActiveImportantItems).mockResolvedValue([]);
    vi.mocked(queries.saveWeeklyPlan).mockResolvedValue({
      id: 'plan-1',
      token: 'test-token',
      week_of: '2026-03-09',
      one_store_optimized: { stops: [], total: 5.99, budgetRemaining: 94.01, estimatedSavings: 3.0 },
      two_store_optimized: null,
      watchlist_alerts: [],
      recipe_alerts: [],
      created_at: '2026-03-13T00:00:00.000Z',
    });

    const result = await optimize('user-1', {});

    expect(result).toHaveProperty('id', 'plan-1');
    expect(result).toHaveProperty('token', 'test-token');
    expect(queries.saveWeeklyPlan).toHaveBeenCalledOnce();
  });
});
