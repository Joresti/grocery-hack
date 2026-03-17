import { describe, it, expect } from 'vitest';
import { dealsQuery } from './deals.js';

describe('dealsQuery', () => {
  it('accepts empty query with defaults', () => {
    const result = dealsQuery.parse({});
    expect(result.storeBrandId).toBeUndefined();
    expect(result.category).toBeUndefined();
    expect(result.search).toBeUndefined();
  });

  it('accepts valid UUID for store_brand_id', () => {
    const result = dealsQuery.parse({ store_brand_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.storeBrandId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects invalid UUID for store_brand_id', () => {
    expect(() => dealsQuery.parse({ store_brand_id: 'not-uuid' })).toThrow();
  });

  it('rejects empty string for store_brand_id', () => {
    expect(() => dealsQuery.parse({ store_brand_id: '' })).toThrow();
  });

  it('transforms to camelCase', () => {
    const result = dealsQuery.parse({
      store_brand_id: '550e8400-e29b-41d4-a716-446655440000',
      category: 'Produce',
      search: 'chicken',
    });
    expect(result.storeBrandId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.category).toBe('Produce');
    expect(result.search).toBe('chicken');
    expect((result as Record<string, unknown>).store_brand_id).toBeUndefined();
  });

  it('accepts category alone', () => {
    const result = dealsQuery.parse({ category: 'Dairy' });
    expect(result.category).toBe('Dairy');
    expect(result.storeBrandId).toBeUndefined();
    expect(result.search).toBeUndefined();
  });

  it('accepts search alone', () => {
    const result = dealsQuery.parse({ search: 'milk' });
    expect(result.search).toBe('milk');
    expect(result.storeBrandId).toBeUndefined();
    expect(result.category).toBeUndefined();
  });

  it('accepts all fields together', () => {
    const result = dealsQuery.parse({
      store_brand_id: '550e8400-e29b-41d4-a716-446655440000',
      category: 'Meat',
      search: 'beef',
    });
    expect(result.storeBrandId).toBeDefined();
    expect(result.category).toBe('Meat');
    expect(result.search).toBe('beef');
  });

  it('accepts empty string for category', () => {
    const result = dealsQuery.parse({ category: '' });
    expect(result.category).toBe('');
  });

  it('accepts empty string for search', () => {
    const result = dealsQuery.parse({ search: '' });
    expect(result.search).toBe('');
  });
});
