// Utility for generating deterministic gradient+emoji card headers for meals.

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

/** Emoji keyword rules — checked in order, first match wins. */
const EMOJI_RULES: ReadonlyArray<{ keywords: ReadonlyArray<string>; emoji: string }> = [
  { keywords: ['chicken', 'poultry', 'wing', 'thigh', 'drumstick'], emoji: '\u{1F357}' },
  { keywords: ['beef', 'steak', 'brisket', 'ground beef'], emoji: '\u{1F969}' },
  { keywords: ['pork', 'bacon', 'ham', 'sausage'], emoji: '\u{1F437}' },
  { keywords: ['fish', 'shrimp', 'seafood', 'salmon', 'tuna', 'cod', 'prawn', 'tilapia'], emoji: '\u{1F41F}' },
  { keywords: ['pasta', 'noodle', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni'], emoji: '\u{1F35D}' },
  { keywords: ['rice', 'risotto', 'fried rice', 'biryani'], emoji: '\u{1F35A}' },
  { keywords: ['taco', 'burrito', 'mexican', 'enchilada', 'quesadilla', 'fajita'], emoji: '\u{1F32E}' },
  { keywords: ['salad', 'vegetable', 'veggie', 'vegan', 'greens', 'kale'], emoji: '\u{1F957}' },
  { keywords: ['soup', 'stew', 'chili', 'chowder', 'bisque', 'broth'], emoji: '\u{1F372}' },
  { keywords: ['pizza'], emoji: '\u{1F355}' },
  { keywords: ['sandwich', 'burger', 'wrap'], emoji: '\u{1F354}' },
  { keywords: ['curry', 'indian', 'tikka', 'masala'], emoji: '\u{1F35B}' },
  { keywords: ['cake', 'dessert', 'brownie', 'cookie', 'sweet'], emoji: '\u{1F370}' },
  { keywords: ['bread', 'toast', 'baguette'], emoji: '\u{1F35E}' },
] as const;

const DEFAULT_EMOJI = '\u{1F37D}\u{FE0F}'; // plate with cutlery

/**
 * Simple deterministic hash from a string to a non-negative integer.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

/**
 * Pick a gradient pair deterministically from the meal name.
 */
export function getGradientForMeal(name: string): { start: string; end: string } {
  const idx = hashString(name) % GRADIENT_PALETTE.length;
  const pair = GRADIENT_PALETTE[idx];
  if (!pair) {
    return { start: '#4ECDC4', end: '#556270' };
  }
  return { start: pair[0], end: pair[1] };
}

/**
 * Pick an emoji based on the meal name and filterTags.
 * Checks filterTags first, then the meal name, returning the first match.
 */
export function getEmojiForMeal(name: string, filterTags: string[]): string {
  const searchText = [...filterTags, name].join(' ').toLowerCase();

  for (const rule of EMOJI_RULES) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword)) {
        return rule.emoji;
      }
    }
  }

  return DEFAULT_EMOJI;
}

/**
 * Builds a CSS linear-gradient string for the card header background.
 */
export function getMealHeaderGradient(name: string): string {
  const { start, end } = getGradientForMeal(name);
  return `linear-gradient(135deg, ${start}, ${end})`;
}
