import { describe, it, expect } from 'vitest';
import { mealsQuery, mealIdParam, swipeSchema } from './meals.js';

describe('mealsQuery', () => {
  it('defaults limit to 20', () => {
    const result = mealsQuery.parse({});
    expect(result.limit).toBe(20);
  });

  it('accepts valid limit', () => {
    const result = mealsQuery.parse({ limit: '10' });
    expect(result.limit).toBe(10);
  });

  it('coerces string to number', () => {
    const result = mealsQuery.parse({ limit: '25' });
    expect(result.limit).toBe(25);
    expect(typeof result.limit).toBe('number');
  });

  it('accepts limit of 1', () => {
    const result = mealsQuery.parse({ limit: '1' });
    expect(result.limit).toBe(1);
  });

  it('accepts limit of 50', () => {
    const result = mealsQuery.parse({ limit: '50' });
    expect(result.limit).toBe(50);
  });

  it('rejects limit above 50', () => {
    expect(() => mealsQuery.parse({ limit: '51' })).toThrow();
  });

  it('rejects limit below 1', () => {
    expect(() => mealsQuery.parse({ limit: '0' })).toThrow();
  });

  it('rejects negative limit', () => {
    expect(() => mealsQuery.parse({ limit: '-1' })).toThrow();
  });

  it('rejects non-integer limit', () => {
    expect(() => mealsQuery.parse({ limit: '10.5' })).toThrow();
  });
});

describe('mealIdParam', () => {
  it('accepts valid UUID and transforms to camelCase', () => {
    const result = mealIdParam.parse({ meal_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.mealId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect((result as Record<string, unknown>).meal_id).toBeUndefined();
  });

  it('rejects non-UUID string', () => {
    expect(() => mealIdParam.parse({ meal_id: 'not-a-uuid' })).toThrow();
  });

  it('rejects missing meal_id', () => {
    expect(() => mealIdParam.parse({})).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => mealIdParam.parse({ meal_id: '' })).toThrow();
  });

  it('rejects numeric value', () => {
    expect(() => mealIdParam.parse({ meal_id: 12345 })).toThrow();
  });

  it('accepts lowercase UUID', () => {
    const result = mealIdParam.parse({ meal_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(result.mealId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });
});

describe('swipeSchema', () => {
  it('accepts liked: true', () => {
    const result = swipeSchema.parse({ liked: true });
    expect(result.liked).toBe(true);
  });

  it('accepts liked: false', () => {
    const result = swipeSchema.parse({ liked: false });
    expect(result.liked).toBe(false);
  });

  it('rejects non-boolean liked', () => {
    expect(() => swipeSchema.parse({ liked: 'yes' })).toThrow();
  });

  it('rejects numeric liked', () => {
    expect(() => swipeSchema.parse({ liked: 1 })).toThrow();
  });

  it('rejects missing liked', () => {
    expect(() => swipeSchema.parse({})).toThrow();
  });

  it('rejects null liked', () => {
    expect(() => swipeSchema.parse({ liked: null })).toThrow();
  });

  it('transforms output correctly', () => {
    const result = swipeSchema.parse({ liked: true });
    expect(result).toEqual({ liked: true });
  });
});
