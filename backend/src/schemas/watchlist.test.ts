import { describe, it, expect } from 'vitest';
import { heartDealBody, watchlistIdParam } from './watchlist.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('heartDealBody', () => {
  it('accepts a valid UUID for deal_id', () => {
    const result = heartDealBody.parse({ deal_id: VALID_UUID });
    expect(result.dealId).toBe(VALID_UUID);
  });

  it('transforms deal_id to dealId (camelCase)', () => {
    const result = heartDealBody.parse({ deal_id: VALID_UUID });
    expect(result.dealId).toBe(VALID_UUID);
    expect((result as Record<string, unknown>).deal_id).toBeUndefined();
  });

  it('rejects an invalid UUID', () => {
    expect(() => heartDealBody.parse({ deal_id: 'not-a-uuid' })).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => heartDealBody.parse({ deal_id: '' })).toThrow();
  });

  it('rejects missing deal_id', () => {
    expect(() => heartDealBody.parse({})).toThrow();
  });

  it('rejects null deal_id', () => {
    expect(() => heartDealBody.parse({ deal_id: null })).toThrow();
  });
});

describe('watchlistIdParam', () => {
  it('accepts a valid UUID for watchlist_id', () => {
    const result = watchlistIdParam.parse({ watchlist_id: VALID_UUID });
    expect(result.watchlistId).toBe(VALID_UUID);
  });

  it('transforms watchlist_id to watchlistId (camelCase)', () => {
    const result = watchlistIdParam.parse({ watchlist_id: VALID_UUID });
    expect(result.watchlistId).toBe(VALID_UUID);
    expect((result as Record<string, unknown>).watchlist_id).toBeUndefined();
  });

  it('rejects an invalid UUID', () => {
    expect(() => watchlistIdParam.parse({ watchlist_id: 'not-valid' })).toThrow();
  });

  it('rejects missing watchlist_id', () => {
    expect(() => watchlistIdParam.parse({})).toThrow();
  });
});
