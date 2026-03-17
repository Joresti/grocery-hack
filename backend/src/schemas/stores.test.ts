import { describe, it, expect } from 'vitest';
import { nearbyStoresQuery } from './stores.js';

describe('nearbyStoresQuery', () => {
  it('transforms to camelCase with defaults', () => {
    const result = nearbyStoresQuery.parse({});
    expect(result.radiusKm).toBe(15);
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
    expect((result as Record<string, unknown>).radius_km).toBeUndefined();
  });

  it('accepts and coerces string numbers', () => {
    const result = nearbyStoresQuery.parse({ lat: '43.25', lng: '-79.87', radius_km: '10' });
    expect(result.lat).toBe(43.25);
    expect(result.lng).toBe(-79.87);
    expect(result.radiusKm).toBe(10);
  });

  it('accepts numeric values directly', () => {
    const result = nearbyStoresQuery.parse({ lat: 43.25, lng: -79.87, radius_km: 10 });
    expect(result.lat).toBe(43.25);
    expect(result.lng).toBe(-79.87);
    expect(result.radiusKm).toBe(10);
  });

  it('rejects negative radius', () => {
    expect(() => nearbyStoresQuery.parse({ radius_km: '-5' })).toThrow();
  });

  it('rejects zero radius', () => {
    expect(() => nearbyStoresQuery.parse({ radius_km: '0' })).toThrow();
  });

  it('accepts fractional radius', () => {
    const result = nearbyStoresQuery.parse({ radius_km: '2.5' });
    expect(result.radiusKm).toBe(2.5);
  });

  it('allows lat without lng', () => {
    const result = nearbyStoresQuery.parse({ lat: '43.25' });
    expect(result.lat).toBe(43.25);
    expect(result.lng).toBeUndefined();
  });

  it('allows lng without lat', () => {
    const result = nearbyStoresQuery.parse({ lng: '-79.87' });
    expect(result.lng).toBe(-79.87);
    expect(result.lat).toBeUndefined();
  });

  it('defaults radius_km to 15 when not provided', () => {
    const result = nearbyStoresQuery.parse({ lat: '43.25', lng: '-79.87' });
    expect(result.radiusKm).toBe(15);
  });

  it('handles negative latitude', () => {
    const result = nearbyStoresQuery.parse({ lat: '-33.87' });
    expect(result.lat).toBe(-33.87);
  });

  it('coerces values to number type', () => {
    const result = nearbyStoresQuery.parse({ lat: '43.25', lng: '-79.87', radius_km: '10' });
    expect(typeof result.lat).toBe('number');
    expect(typeof result.lng).toBe('number');
    expect(typeof result.radiusKm).toBe('number');
  });
});
