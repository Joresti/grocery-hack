import { describe, it, expect } from 'vitest';
import { suggestMealBody } from './family.js';

const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_B = '11111111-2222-3333-4444-555555555555';

describe('suggestMealBody', () => {
  it('accepts two valid UUIDs', () => {
    const result = suggestMealBody.parse({
      target_meal_id: VALID_UUID_A,
      replacement_meal_id: VALID_UUID_B,
    });
    expect(result.targetMealId).toBe(VALID_UUID_A);
    expect(result.replacementMealId).toBe(VALID_UUID_B);
  });

  it('transforms snake_case input to camelCase output', () => {
    const result = suggestMealBody.parse({
      target_meal_id: VALID_UUID_A,
      replacement_meal_id: VALID_UUID_B,
    });
    expect((result as Record<string, unknown>).target_meal_id).toBeUndefined();
    expect((result as Record<string, unknown>).replacement_meal_id).toBeUndefined();
  });

  it('rejects an invalid target_meal_id', () => {
    expect(() =>
      suggestMealBody.parse({ target_meal_id: 'nope', replacement_meal_id: VALID_UUID_B }),
    ).toThrow();
  });

  it('rejects an invalid replacement_meal_id', () => {
    expect(() =>
      suggestMealBody.parse({ target_meal_id: VALID_UUID_A, replacement_meal_id: '' }),
    ).toThrow();
  });

  it('rejects a missing replacement_meal_id', () => {
    expect(() => suggestMealBody.parse({ target_meal_id: VALID_UUID_A })).toThrow();
  });

  it('rejects a missing target_meal_id', () => {
    expect(() => suggestMealBody.parse({ replacement_meal_id: VALID_UUID_B })).toThrow();
  });
});
