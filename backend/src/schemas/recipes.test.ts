import { describe, it, expect } from 'vitest';
import { createRecipeBody, updateRecipeBody, recipeIdParam, publishBody } from './recipes.js';

// ────────────────────────────────────────────────────────────
// createRecipeBody
// ────────────────────────────────────────────────────────────

describe('createRecipeBody', () => {
  const validInput = {
    name: 'Pasta Carbonara',
    ingredients: [
      { name: 'spaghetti', quantity: '400', unit: 'g' },
      { name: 'pancetta', quantity: '200', unit: 'g' },
    ],
  };

  it('accepts valid input with name and ingredients', () => {
    const result = createRecipeBody.parse(validInput);
    expect(result.name).toBe('Pasta Carbonara');
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients[0]).toEqual({ name: 'spaghetti', quantity: '400', unit: 'g' });
    expect(result.isPublic).toBe(false);
  });

  it('transforms snake_case to camelCase', () => {
    const input = {
      ...validInput,
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      dietary_tags: ['gluten-free'],
      is_public: true,
    };
    const result = createRecipeBody.parse(input);
    expect(result.prepTimeMinutes).toBe(10);
    expect(result.cookTimeMinutes).toBe(20);
    expect(result.dietaryTags).toEqual(['gluten-free']);
    expect(result.isPublic).toBe(true);
    expect((result as Record<string, unknown>).prep_time_minutes).toBeUndefined();
    expect((result as Record<string, unknown>).cook_time_minutes).toBeUndefined();
    expect((result as Record<string, unknown>).dietary_tags).toBeUndefined();
    expect((result as Record<string, unknown>).is_public).toBeUndefined();
  });

  it('rejects missing name', () => {
    expect(() => createRecipeBody.parse({
      ingredients: [{ name: 'flour', quantity: '2', unit: 'cups' }],
    })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => createRecipeBody.parse({
      name: '',
      ingredients: [{ name: 'flour', quantity: '2', unit: 'cups' }],
    })).toThrow();
  });

  it('rejects missing ingredients', () => {
    expect(() => createRecipeBody.parse({ name: 'Test Recipe' })).toThrow();
  });

  it('rejects empty ingredients array', () => {
    expect(() => createRecipeBody.parse({
      name: 'Test Recipe',
      ingredients: [],
    })).toThrow();
  });

  it('defaults is_public to false', () => {
    const result = createRecipeBody.parse(validInput);
    expect(result.isPublic).toBe(false);
  });

  it('accepts all optional fields', () => {
    const input = {
      ...validInput,
      tagline: 'Classic Italian',
      description: 'A rich creamy pasta.',
      instructions: 'Cook pasta, fry pancetta, mix eggs.',
      steps: ['Boil water', 'Cook pasta', 'Fry pancetta', 'Mix eggs', 'Combine'],
      prep_time_minutes: 15,
      cook_time_minutes: 25,
      servings: 4,
      difficulty: 'medium' as const,
      dietary_tags: ['high-protein'],
      tips: 'Use fresh eggs for best results.',
      nutrition: {
        calories: 550,
        protein_g: 25,
        carbs_g: 60,
        fat_g: 22,
        fiber_g: 3,
        sodium_mg: 800,
        per_serving: true,
      },
      is_public: true,
    };
    const result = createRecipeBody.parse(input);
    expect(result.tagline).toBe('Classic Italian');
    expect(result.description).toBe('A rich creamy pasta.');
    expect(result.instructions).toBe('Cook pasta, fry pancetta, mix eggs.');
    expect(result.steps).toHaveLength(5);
    expect(result.prepTimeMinutes).toBe(15);
    expect(result.cookTimeMinutes).toBe(25);
    expect(result.servings).toBe(4);
    expect(result.difficulty).toBe('medium');
    expect(result.dietaryTags).toEqual(['high-protein']);
    expect(result.tips).toBe('Use fresh eggs for best results.');
    expect(result.isPublic).toBe(true);
    expect(result.nutrition).toEqual({
      calories: 550,
      proteinG: 25,
      carbsG: 60,
      fatG: 22,
      fiberG: 3,
      sodiumMg: 800,
      perServing: true,
    });
  });

  it('rejects invalid difficulty', () => {
    expect(() => createRecipeBody.parse({
      ...validInput,
      difficulty: 'hard',
    })).toThrow();
  });

  it('rejects non-integer prep_time_minutes', () => {
    expect(() => createRecipeBody.parse({
      ...validInput,
      prep_time_minutes: 10.5,
    })).toThrow();
  });

  it('rejects negative cook_time_minutes', () => {
    expect(() => createRecipeBody.parse({
      ...validInput,
      cook_time_minutes: -5,
    })).toThrow();
  });

  it('rejects zero servings', () => {
    expect(() => createRecipeBody.parse({
      ...validInput,
      servings: 0,
    })).toThrow();
  });

  it('rejects ingredient with empty name', () => {
    expect(() => createRecipeBody.parse({
      name: 'Test',
      ingredients: [{ name: '', quantity: '1', unit: 'cup' }],
    })).toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// updateRecipeBody
// ────────────────────────────────────────────────────────────

describe('updateRecipeBody', () => {
  it('accepts a name-only update', () => {
    const result = updateRecipeBody.parse({ name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
    expect(result.ingredients).toBeUndefined();
  });

  it('accepts an ingredients-only update', () => {
    const result = updateRecipeBody.parse({
      ingredients: [{ name: 'rice', quantity: '2', unit: 'cups' }],
    });
    expect(result.ingredients).toHaveLength(1);
    expect(result.name).toBeUndefined();
  });

  it('accepts partial fields', () => {
    const result = updateRecipeBody.parse({
      prep_time_minutes: 30,
      difficulty: 'medium',
    });
    expect(result.prepTimeMinutes).toBe(30);
    expect(result.difficulty).toBe('medium');
    expect(result.name).toBeUndefined();
  });

  it('transforms snake_case to camelCase', () => {
    const result = updateRecipeBody.parse({
      cook_time_minutes: 45,
      dietary_tags: ['vegan'],
      is_public: true,
    });
    expect(result.cookTimeMinutes).toBe(45);
    expect(result.dietaryTags).toEqual(['vegan']);
    expect(result.isPublic).toBe(true);
    expect((result as Record<string, unknown>).cook_time_minutes).toBeUndefined();
    expect((result as Record<string, unknown>).dietary_tags).toBeUndefined();
    expect((result as Record<string, unknown>).is_public).toBeUndefined();
  });

  it('accepts empty body (all optional)', () => {
    const result = updateRecipeBody.parse({});
    expect(result.name).toBeUndefined();
    expect(result.ingredients).toBeUndefined();
  });

  it('rejects empty name string when provided', () => {
    expect(() => updateRecipeBody.parse({ name: '' })).toThrow();
  });

  it('rejects empty ingredients array when provided', () => {
    expect(() => updateRecipeBody.parse({ ingredients: [] })).toThrow();
  });

  it('rejects invalid difficulty when provided', () => {
    expect(() => updateRecipeBody.parse({ difficulty: 'expert' })).toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// recipeIdParam
// ────────────────────────────────────────────────────────────

describe('recipeIdParam', () => {
  it('accepts valid UUID and transforms to camelCase', () => {
    const result = recipeIdParam.parse({ recipe_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.recipeId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect((result as Record<string, unknown>).recipe_id).toBeUndefined();
  });

  it('rejects non-UUID string', () => {
    expect(() => recipeIdParam.parse({ recipe_id: 'not-a-uuid' })).toThrow();
  });

  it('rejects missing recipe_id', () => {
    expect(() => recipeIdParam.parse({})).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => recipeIdParam.parse({ recipe_id: '' })).toThrow();
  });

  it('rejects numeric value', () => {
    expect(() => recipeIdParam.parse({ recipe_id: 12345 })).toThrow();
  });

  it('accepts lowercase UUID', () => {
    const result = recipeIdParam.parse({ recipe_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(result.recipeId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });
});

// ────────────────────────────────────────────────────────────
// publishBody
// ────────────────────────────────────────────────────────────

describe('publishBody', () => {
  it('accepts is_public: true', () => {
    const result = publishBody.parse({ is_public: true });
    expect(result.isPublic).toBe(true);
  });

  it('accepts is_public: false', () => {
    const result = publishBody.parse({ is_public: false });
    expect(result.isPublic).toBe(false);
  });

  it('transforms to camelCase', () => {
    const result = publishBody.parse({ is_public: true });
    expect(result.isPublic).toBe(true);
    expect((result as Record<string, unknown>).is_public).toBeUndefined();
  });

  it('rejects missing is_public', () => {
    expect(() => publishBody.parse({})).toThrow();
  });

  it('rejects non-boolean is_public', () => {
    expect(() => publishBody.parse({ is_public: 'yes' })).toThrow();
  });

  it('rejects null is_public', () => {
    expect(() => publishBody.parse({ is_public: null })).toThrow();
  });

  it('rejects numeric is_public', () => {
    expect(() => publishBody.parse({ is_public: 1 })).toThrow();
  });
});
