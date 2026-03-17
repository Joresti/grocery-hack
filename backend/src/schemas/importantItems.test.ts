import { describe, it, expect } from 'vitest';
import {
  addImportantItemBody,
  updateImportantItemBody,
  importantItemIdParam,
  importantItemsQuery,
} from './importantItems.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('addImportantItemBody', () => {
  it('accepts a valid name', () => {
    const result = addImportantItemBody.parse({ name: 'Milk' });
    expect(result.name).toBe('Milk');
    expect(result.quantity).toBeUndefined();
  });

  it('accepts a name with quantity', () => {
    const result = addImportantItemBody.parse({ name: 'Eggs', quantity: '1 dozen' });
    expect(result.name).toBe('Eggs');
    expect(result.quantity).toBe('1 dozen');
  });

  it('accepts without quantity (optional)', () => {
    const result = addImportantItemBody.parse({ name: 'Bread' });
    expect(result.quantity).toBeUndefined();
  });

  it('rejects empty name', () => {
    expect(() => addImportantItemBody.parse({ name: '' })).toThrow();
  });

  it('rejects missing name', () => {
    expect(() => addImportantItemBody.parse({})).toThrow();
  });

  it('rejects null name', () => {
    expect(() => addImportantItemBody.parse({ name: null })).toThrow();
  });

  it('transforms to camelCase', () => {
    const result = addImportantItemBody.parse({ name: 'Butter', quantity: '500g' });
    expect(result.name).toBe('Butter');
    expect(result.quantity).toBe('500g');
  });
});

describe('updateImportantItemBody', () => {
  it('accepts is_active toggle to false', () => {
    const result = updateImportantItemBody.parse({ is_active: false });
    expect(result.isActive).toBe(false);
  });

  it('accepts is_active toggle to true', () => {
    const result = updateImportantItemBody.parse({ is_active: true });
    expect(result.isActive).toBe(true);
  });

  it('accepts a name update', () => {
    const result = updateImportantItemBody.parse({ name: 'Whole Milk' });
    expect(result.name).toBe('Whole Milk');
    expect(result.isActive).toBeUndefined();
  });

  it('accepts a quantity update', () => {
    const result = updateImportantItemBody.parse({ quantity: '2L' });
    expect(result.quantity).toBe('2L');
  });

  it('accepts empty update (all fields optional)', () => {
    const result = updateImportantItemBody.parse({});
    expect(result.name).toBeUndefined();
    expect(result.quantity).toBeUndefined();
    expect(result.isActive).toBeUndefined();
  });

  it('accepts all fields together', () => {
    const result = updateImportantItemBody.parse({
      name: 'Organic Milk',
      quantity: '2L',
      is_active: true,
    });
    expect(result.name).toBe('Organic Milk');
    expect(result.quantity).toBe('2L');
    expect(result.isActive).toBe(true);
  });

  it('transforms is_active to isActive (camelCase)', () => {
    const result = updateImportantItemBody.parse({ is_active: false });
    expect(result.isActive).toBe(false);
    expect((result as Record<string, unknown>).is_active).toBeUndefined();
  });

  it('rejects empty string for name', () => {
    expect(() => updateImportantItemBody.parse({ name: '' })).toThrow();
  });

  it('rejects non-boolean is_active', () => {
    expect(() => updateImportantItemBody.parse({ is_active: 'yes' })).toThrow();
  });
});

describe('importantItemIdParam', () => {
  it('accepts a valid UUID for item_id', () => {
    const result = importantItemIdParam.parse({ item_id: VALID_UUID });
    expect(result.itemId).toBe(VALID_UUID);
  });

  it('transforms item_id to itemId (camelCase)', () => {
    const result = importantItemIdParam.parse({ item_id: VALID_UUID });
    expect(result.itemId).toBe(VALID_UUID);
    expect((result as Record<string, unknown>).item_id).toBeUndefined();
  });

  it('rejects an invalid UUID', () => {
    expect(() => importantItemIdParam.parse({ item_id: 'bad' })).toThrow();
  });

  it('rejects missing item_id', () => {
    expect(() => importantItemIdParam.parse({})).toThrow();
  });
});

describe('importantItemsQuery', () => {
  it('defaults active_only to true', () => {
    const result = importantItemsQuery.parse({});
    expect(result.activeOnly).toBe(true);
  });

  it('parses explicit active_only=true', () => {
    const result = importantItemsQuery.parse({ active_only: 'true' });
    expect(result.activeOnly).toBe(true);
  });

  it('parses explicit active_only=false', () => {
    const result = importantItemsQuery.parse({ active_only: 'false' });
    expect(result.activeOnly).toBe(false);
  });

  it('transforms active_only to activeOnly (camelCase)', () => {
    const result = importantItemsQuery.parse({ active_only: 'false' });
    expect(result.activeOnly).toBe(false);
    expect((result as Record<string, unknown>).active_only).toBeUndefined();
  });

  it('rejects invalid enum value', () => {
    expect(() => importantItemsQuery.parse({ active_only: 'yes' })).toThrow();
  });
});
