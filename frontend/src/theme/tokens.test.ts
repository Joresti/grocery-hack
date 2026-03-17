import { describe, it, expect } from 'vitest';
import { colors, fonts } from './tokens';

describe('theme tokens', () => {
  it('has primary color defined', () => {
    expect(colors.primary).toBe('#3D7B7B');
  });

  it('has heading font defined', () => {
    expect(fonts.heading).toContain('Sora');
  });
});
