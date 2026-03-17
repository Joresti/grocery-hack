export const MAX_NOTABLE_DEALS = 10;
export const MAX_LIKED_MEALS_PREVIEW = 6;
export const MAX_SWIPEABLE_MEALS = 20;
export const MIN_SWIPES_FOR_COLLAB = 5;
export const MIN_SWIPES_FOR_APPROVAL = 5;
export const JACCARD_SIMILARITY_THRESHOLD = 0.8;
export const MIN_NEW_MEALS_PER_RUN = 3;
export const MEALS_PER_PLAN = 8; // 5 primary + 3 alternates

export const CATEGORIES = [
  'Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery',
  'Frozen', 'Pantry', 'Beverages', 'Snacks', 'Deli',
  'Household', 'Baby', 'Pet', 'Health', 'Other',
] as const;

export const DIETARY_TAGS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
  'nut-free', 'halal', 'kosher',
] as const;

export const BUDGET_TIERS = ['value', 'sweet_spot', 'splurge'] as const;
