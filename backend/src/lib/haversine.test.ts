import { describe, it, expect } from 'vitest';
import { haversineDistance } from './haversine.js';

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(43.25, -79.87, 43.25, -79.87)).toBe(0);
  });

  it('calculates distance between Hamilton and Toronto (~68km)', () => {
    const distance = haversineDistance(43.2557, -79.8711, 43.6532, -79.3832);
    expect(distance).toBeGreaterThan(55);
    expect(distance).toBeLessThan(80);
  });
});
