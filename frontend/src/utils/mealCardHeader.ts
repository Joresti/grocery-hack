// Deterministic gradient picker for meal-card headers.

/** Preset gradient palette — pairs of [startColor, endColor]. */
const GRADIENT_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#FF6B6B', '#FFE66D'], // coral to gold
  ['#4ECDC4', '#556270'], // teal to slate
  ['#F7971E', '#FFD200'], // orange to yellow
  ['#6B48FF', '#E96BFF'], // purple to pink
  ['#00B4DB', '#0083B0'], // sky to ocean
  ['#F2994A', '#F2C94C'], // warm orange to soft gold
  ['#56CCF2', '#2F80ED'], // light blue to blue
  ['#11998E', '#38EF7D'], // dark teal to green
  ['#FC5C7D', '#6A82FB'], // pink to periwinkle
  ['#ED4264', '#FFEDBC'], // rose to cream
  ['#7F7FD5', '#86A8E7'], // lavender to sky
  ['#43C6AC', '#F8FFAE'], // mint to lime
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

export function getGradientForMeal(name: string): { start: string; end: string } {
  const idx = hashString(name) % GRADIENT_PALETTE.length;
  const pair = GRADIENT_PALETTE[idx];
  if (!pair) {
    return { start: '#4ECDC4', end: '#556270' };
  }
  return { start: pair[0], end: pair[1] };
}

export function getMealHeaderGradient(name: string): string {
  const { start, end } = getGradientForMeal(name);
  return `linear-gradient(135deg, ${start}, ${end})`;
}
