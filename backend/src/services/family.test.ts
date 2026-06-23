import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────
// Mock dependencies
// ────────────────────────────────────────────────────────────

vi.mock('../db/queries/family.js', () => ({
  getFamilyMemberLink: vi.fn(),
  createMealSuggestion: vi.fn(),
  getMySuggestionsForPlan: vi.fn(),
  getPendingSuggestionForMeal: vi.fn(),
}));

vi.mock('../db/queries/landing.js', () => ({
  getCurrentPlan: vi.fn(),
  getSavingsThisWeek: vi.fn(),
}));

vi.mock('../db/queries/meals.js', () => ({
  findMealById: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import { suggestMeal, getFamilyPlan } from './family.js';
import * as familyQueries from '../db/queries/family.js';
import * as landingQueries from '../db/queries/landing.js';
import * as mealQueries from '../db/queries/meals.js';

const SAM_ID = '550e8400-e29b-41d4-a716-446655440000';
const JESSICA_ID = '11111111-1111-1111-1111-111111111111';
const PLAN_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_MEAL_ID = '33333333-3333-3333-3333-333333333333';
const REPLACEMENT_MEAL_ID = '44444444-4444-4444-4444-444444444444';

function planWithTargetIn(rep: 'one' | 'two'): Record<string, unknown> {
  const stopWithTarget = {
    storeBrandName: 'Walmart',
    storeLocationId: 'loc-1',
    meals: [
      { mealId: TARGET_MEAL_ID, name: 'Beef Taco Bowl', costPerServing: 1.5, totalCost: 6, savings: 2 },
    ],
    items: [],
    subtotal: 6,
  };
  const emptyStop = {
    storeBrandName: 'No Frills',
    storeLocationId: 'loc-2',
    meals: [
      { mealId: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'Other Meal', costPerServing: 1, totalCost: 4, savings: 1 },
    ],
    items: [],
    subtotal: 4,
  };
  return {
    id: PLAN_ID,
    token: 'tok',
    week_of: '2026-06-15',
    one_store_optimized: {
      stops: [rep === 'one' ? stopWithTarget : emptyStop],
      total: 6,
      budgetRemaining: 94,
      estimatedSavings: 2,
    },
    two_store_optimized:
      rep === 'two'
        ? { stops: [stopWithTarget], total: 6, budgetRemaining: 94, estimatedSavings: 2 }
        : null,
    watchlist_alerts: [],
    recipe_alerts: [],
    created_at: '2026-06-15T00:00:00.000Z',
  };
}

const CREATED_SUGGESTION = {
  id: 'sug-1',
  suggester_id: SAM_ID,
  account_holder_id: JESSICA_ID,
  weekly_plan_id: PLAN_ID,
  target_meal_id: TARGET_MEAL_ID,
  replacement_meal_id: REPLACEMENT_MEAL_ID,
  status: 'pending',
  created_at: '2026-06-17T00:00:00.000Z',
  replacement_meal_name: 'Creamy Mushroom Pasta',
  target_meal_name: 'Beef Taco Bowl',
};

describe('suggestMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('one'));
    vi.mocked(mealQueries.findMealById).mockResolvedValue({ id: REPLACEMENT_MEAL_ID, name: 'Creamy Mushroom Pasta' });
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);
    vi.mocked(familyQueries.createMealSuggestion).mockResolvedValue(CREATED_SUGGESTION);
  });

  it('creates a pending suggestion on the happy path', async () => {
    const result = await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    expect(result).toEqual(CREATED_SUGGESTION);
    expect(familyQueries.createMealSuggestion).toHaveBeenCalledWith({
      suggesterId: SAM_ID,
      accountHolderId: JESSICA_ID,
      weeklyPlanId: PLAN_ID,
      targetMealId: TARGET_MEAL_ID,
      replacementMealId: REPLACEMENT_MEAL_ID,
    });
  });

  it('accepts a target meal that only appears in the two-store representation', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('two'));
    const result = await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);
    expect(result).toEqual(CREATED_SUGGESTION);
  });

  it('throws NOT_A_FAMILY_MEMBER (403) when the caller is not linked to a holder', async () => {
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NOT_A_FAMILY_MEMBER',
      status: 403,
    });
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws NO_PLAN (404) when the holder has no current plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(null);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NO_PLAN',
      status: 404,
    });
  });

  it('throws MEAL_NOT_IN_PLAN (400) when the target meal is not in the plan', async () => {
    await expect(
      suggestMeal(SAM_ID, 'ffffffff-ffff-ffff-ffff-ffffffffffff', REPLACEMENT_MEAL_ID),
    ).rejects.toMatchObject({ code: 'MEAL_NOT_IN_PLAN', status: 400 });
    expect(mealQueries.findMealById).not.toHaveBeenCalled();
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws INVALID_MEAL (400) when the replacement meal does not exist', async () => {
    vi.mocked(mealQueries.findMealById).mockResolvedValue(null);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'INVALID_MEAL',
      status: 400,
    });
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws DUPLICATE_SUGGESTION (409) and skips the insert when a pending suggestion already exists', async () => {
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(CREATED_SUGGESTION);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'DUPLICATE_SUGGESTION',
      status: 409,
    });
    expect(familyQueries.getPendingSuggestionForMeal).toHaveBeenCalledWith(SAM_ID, PLAN_ID, TARGET_MEAL_ID);
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('proceeds to createMealSuggestion when no pending suggestion exists for the meal', async () => {
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);

    await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    expect(familyQueries.createMealSuggestion).toHaveBeenCalledTimes(1);
  });

  it('maps a unique-violation race (pg 23505) from the insert to 409 DUPLICATE_SUGGESTION', async () => {
    // Pre-check passes, but a concurrent submit wins the partial-unique index.
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);
    vi.mocked(familyQueries.createMealSuggestion).mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'DUPLICATE_SUGGESTION',
      status: 409,
    });
  });
});

describe('getFamilyPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('one'));
    vi.mocked(landingQueries.getSavingsThisWeek).mockResolvedValue(23.34);
    vi.mocked(familyQueries.getMySuggestionsForPlan).mockResolvedValue([CREATED_SUGGESTION]);
  });

  it('includes the caller\'s pending suggestions for the holder plan', async () => {
    const result = await getFamilyPlan(SAM_ID);

    expect(result.holder_display_name).toBe('Jessica M');
    expect(result.holder_savings_this_week).toBe(23.34);
    expect(result.pending_suggestions).toEqual([CREATED_SUGGESTION]);
    expect(familyQueries.getMySuggestionsForPlan).toHaveBeenCalledWith(SAM_ID, PLAN_ID);
  });

  it('throws NOT_A_FAMILY_MEMBER (403) for a non-member', async () => {
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });

    await expect(getFamilyPlan(JESSICA_ID)).rejects.toMatchObject({
      code: 'NOT_A_FAMILY_MEMBER',
      status: 403,
    });
  });
});
