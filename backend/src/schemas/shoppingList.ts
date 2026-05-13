import { z } from 'zod';

const DIETARY_FILTERS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free',
  'Halal', 'Kosher', 'Shellfish-Free', 'Egg-Free', 'Soy-Free', 'Low-Sodium',
] as const;

const COOKING_STYLES = ['quick', 'balanced', 'best'] as const;

export const shoppingListQuery = z.object({
  postal_code: z.string().min(3).max(10),
  dietary_filters: z.string().optional().default(''),
  cooking_style: z.enum(COOKING_STYLES),
  max_stores: z.enum(['1', '2']),
  radius_km: z.string().optional().default('15'),
  page: z.string().optional().default('1'),
  per_page: z.string().optional().default('10'),
}).transform(d => {
  const validFilters = new Set<string>(DIETARY_FILTERS);
  const dietaryFilters = d.dietary_filters
    ? d.dietary_filters.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  for (const f of dietaryFilters) {
    if (!validFilters.has(f)) {
      throw new z.ZodError([{
        code: 'invalid_enum_value',
        options: [...DIETARY_FILTERS],
        received: f,
        path: ['dietary_filters'],
        message: `Invalid dietary filter: ${f}`,
      }]);
    }
  }

  return {
    postalCode: d.postal_code,
    dietaryFilters,
    cookingStyle: d.cooking_style as typeof COOKING_STYLES[number],
    maxStores: Number(d.max_stores) as 1 | 2,
    radiusKm: Math.min(Math.max(Number(d.radius_km), 1), 100),
    page: Math.max(Number(d.page), 1),
    perPage: Math.min(Math.max(Number(d.per_page), 1), 50),
  };
});

export type ShoppingListQuery = z.output<typeof shoppingListQuery>;
