# Implement: User Recipe Upload Feature

You are implementing the **user recipe upload** feature for GroceryHack, a deal-first meal planning app. The feature lets users save their own recipes, import from URLs, and see when their recipe ingredients go on sale.

## Your Goal

Implement the frontend components and backend wiring so that **all E2E tests in `e2e/recipe-*.spec.ts` pass**. There are 7 test files — they are your acceptance criteria. Do NOT modify the test files.

Before writing any code, read:
1. `specs/recipe-upload-frontend.md` — the full frontend UX spec (your blueprint)
2. `specs/recipe-upload.md` — the behavioral spec
3. All 7 test files in `e2e/recipe-*.spec.ts` — your acceptance criteria
4. `CLAUDE.md` — project rules you must follow

## What to Build

### 1. New Components

**`frontend/src/components/MyRecipes.tsx`** — Landing page section
- Appears directly below `<DreamMealMatching>` and above `<StoreMealDealList>`
- Only visible to authenticated users
- Horizontal-scroll cards showing user's saved recipes (same scroll pattern as `LikedMealsPreview.tsx`)
- Each card shows: recipe name, ingredient count, deal badge if matched
- Empty state with icon + message + "Add a Recipe" CTA button
- Section header: "My Recipes" with count badge and "+ Add" button
- CSS class names must match the E2E selectors (see CSS Classes section below)

**`frontend/src/modals/RecipeFormModal.tsx`** — Create/edit recipe form
- Uses `ModalOverlay` component with `title="New Recipe"` (create) or `title="Edit Recipe"` (edit)
- Sections in order: URL Import → Recipe Name → Ingredients → Steps → Details Grid → Dietary Tags → Notes → Share Toggle → Action Buttons
- URL Import: input + "Import" button, only in create mode
- Ingredients: dynamic rows (name/qty/unit) with add/remove, starts with 1 empty row
- Steps: dynamic numbered rows with add/remove, starts empty with hint text
- Details: 3-column grid (prep time, cook time, servings) — number inputs
- Dietary Tags: pill toggles (Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Low-Carb, High-Protein, Quick)
- Notes: textarea
- Share toggle: checkbox switch, defaults off, only for authenticated users
- Sticky action bar: "Save Recipe" (create) or "Delete Recipe" + "Save Changes" (edit)
- Validation: name required + at least 1 ingredient with name. Errors only show after first save attempt.

**`frontend/src/modals/RecipeDetailModal.tsx`** — Deal-enriched recipe viewer
- Opens when tapping a recipe card (from My Recipes or Recipes on Sale)
- Shows: recipe name, "Your Recipe" badge, ingredient list with deal highlighting
- Ingredients on sale: primaryLight background, deal price, regular price strikethrough, store name
- Ingredients not on sale: "pantry" label
- Savings summary row at bottom
- Steps section, detail pills, notes block
- "Edit Recipe" button at bottom → opens RecipeFormModal in edit mode

### 2. New Hooks

**`frontend/src/hooks/useUserRecipes.ts`**
- `useUserRecipes()` — fetches `GET /recipes`, returns `{ data: UserRecipe[], isLoading, error }`
- `useCreateRecipe()` — mutation for `POST /recipes`
- `useUpdateRecipe()` — mutation for `PATCH /recipes/{id}`
- `useDeleteRecipe()` — mutation for `DELETE /recipes/{id}`
- All mutations should invalidate both `['recipes']` and `['landing']` query keys on success
- Use TanStack React Query (`useQuery`, `useMutation`) — same pattern as `useLandingData.ts`

### 3. Modified Files

**`frontend/src/pages/LandingPage.tsx`**
- Import and render `<MyRecipes>` between `<DreamMealMatching>` and the shopping plan section
- Add modal state for `RecipeFormModal` and `RecipeDetailModal`
- Pass callbacks: `onAddRecipe`, `onRecipeTap`, `onEditRecipe`
- Pass `userRecipes` data from either landing response or a separate `useUserRecipes` hook

**`frontend/src/components/MealCard.tsx`** (if not already present)
- Add attribution line for community recipes: initials circle + "Shared by {name}"
- Only render when `meal.sharedByName` is not null (from `SwipeableMeal` type which extends `Meal & MealAttribution`)

**`frontend/src/components/RecipesOnSale.tsx`**
- Update `onRecipeTap` to pass the full recipe alert object (not just recipe ID) so `RecipeDetailModal` can open

### 4. Toast Component

If a toast component doesn't exist yet, create a simple one:
**`frontend/src/components/shared/Toast.tsx`**
- Fixed position bottom-center, fade in + slide up, auto-dismiss after 1.5s
- CSS class: `.gh-toast`

## CSS Class Name Contract

The E2E tests select elements by CSS class. You MUST use these exact class names:

```
# My Recipes section
.gh-my-recipes                     — section wrapper
.gh-my-recipes-title               — "My Recipes" heading text
.gh-my-recipes-count               — "(X)" count badge
.gh-my-recipes-add-btn             — "+ Add" button in header
.gh-my-recipes-scroll              — horizontal scroll container
.gh-my-recipe-card                 — individual recipe card
.gh-my-recipe-card-name            — recipe name in card
.gh-my-recipe-card-ingredients     — "X ingredients" text
.gh-my-recipe-card-deal-badge      — "X on sale" pill badge
.gh-my-recipes-empty               — empty state container

# RecipeFormModal
.gh-recipe-form-import             — URL import section
.gh-recipe-form-import-error       — import error message
.gh-recipe-form-name               — name field wrapper
.gh-recipe-form-ingredients        — ingredients section wrapper
.gh-recipe-form-ingredients-add    — "+ Add" ingredient button
.gh-ingredient-row                 — single ingredient row
.gh-ingredient-remove              — remove button on ingredient row
.gh-recipe-form-steps              — steps section wrapper
.gh-recipe-form-steps-add          — "+ Add Step" button
.gh-recipe-form-steps-hint         — "Optional" hint text
.gh-step-row                       — single step row
.gh-step-number                    — step number badge (circle)
.gh-step-remove                    — remove button on step row
.gh-recipe-form-details            — details grid section
.gh-recipe-form-tags               — dietary tags section
.gh-dietary-tag                    — individual tag pill (add .active class when selected)
.gh-recipe-form-notes              — notes section
.gh-recipe-form-share              — share toggle section
.gh-toggle-switch                  — the toggle switch element
.gh-recipe-form-error              — validation error message
.gh-confirm-dialog                 — delete confirmation dialog
.gh-spinner                        — loading spinner

# RecipeDetailModal
.gh-recipe-detail-name             — recipe name in detail modal
.gh-recipe-detail-source-badge     — "Your Recipe" pill badge
.gh-recipe-detail-ingredient       — ingredient row (add .on-sale class when matched)
.gh-recipe-detail-ingredient-name  — ingredient name text
.gh-recipe-detail-deal-price       — deal price (on sale items)
.gh-recipe-detail-regular-price    — regular price strikethrough (on sale items)
.gh-recipe-detail-store            — store name (on sale items)
.gh-recipe-detail-pantry-label     — "pantry" label (not on sale items)
.gh-recipe-detail-savings-summary  — savings summary row
.gh-recipe-detail-steps            — steps section
.gh-recipe-detail-step             — individual step row
.gh-recipe-detail-pill             — detail info pill (prep, cook, servings)

# Meal card attribution (community recipes in swipe deck)
.gh-meal-card-attribution          — attribution line wrapper
.gh-meal-card-attribution-initials — initials circle

# Toast
.gh-toast                          — toast notification
```

## Existing Patterns to Follow

### ModalOverlay usage
```tsx
import { ModalOverlay } from './ModalOverlay';

// ModalOverlay handles: backdrop, close on Escape, close on backdrop click,
// slide-up on mobile, center on desktop, body scroll lock, aria attributes
<ModalOverlay isOpen={isOpen} onClose={onClose} title="New Recipe">
  {/* modal body content */}
</ModalOverlay>
```

### Component styling pattern
All components use inline `React.CSSProperties` objects — no CSS modules, no styled-components. Define styles as `const` objects at module level:
```tsx
const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  // ...
};
```

### Design tokens (import from `'../theme/tokens'`)
```tsx
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
```
Key values:
- `colors.primary` (#3D7B7B) — buttons, links, active states
- `colors.primaryLight` (rgba(61,123,123,0.08)) — subtle backgrounds
- `colors.text` (#2D2D2D), `colors.textMuted` (#5A5A5A)
- `colors.danger` (#DC2626), `colors.greenBadgeBg` (#E6F4EA), `colors.greenBadgeText` (#1A7F37)
- `fonts.heading` (Sora), `fonts.body` (Inter)
- `fontWeights.regular` (400), `.medium` (500), `.semibold` (600), `.bold` (700)
- `radii.card` (16px), `.pill` (99px), `.input` (10px), `.modal` (20px)
- `shadows.card`, `shadows.cardHover`, `shadows.button`
- `spacing.touchTargetMin` (44px), `spacing.sectionPadding` (32px)

### Horizontal scroll cards (follow `LikedMealsPreview.tsx`)
```tsx
const scrollContainerStyle: React.CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  gap: '16px',
  scrollSnapType: 'x mandatory',
  paddingBottom: '8px',
  WebkitOverflowScrolling: 'touch',
};
const cardBaseStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: '180px', // or 140px minimum
  scrollSnapAlign: 'start',
  // ...standard card styles
};
```

### API client (import from `'../services/api'`)
```tsx
import { api } from '../services/api';
// api.get<T>(path), api.post<T>(path, body), api.patch<T>(path, body), api.delete<T>(path)
// Handles auth headers, token refresh, snake_case→camelCase transform automatically
```

### TanStack React Query hooks (follow `useLandingData.ts`)
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { UserRecipe, UserRecipeCreate } from '@groceryhack/shared/types';

export function useUserRecipes() {
  return useQuery<{ recipes: UserRecipe[] }>({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes'),
  });
}
```

### Analytics tracking
```tsx
import { useTrack } from '../hooks/useTrack';
const { track } = useTrack();
track('recipe_created', { recipe_id: id, ingredient_count: 3, is_public: false });
```

### Shared types (import from `'@groceryhack/shared/types'`)
Key types for this feature:
```typescript
interface UserRecipe {
  id: string; userId: string; name: string; tagline: string | null;
  description: string | null; instructions: string | null; images: string[];
  ingredients: Ingredient[]; steps: string[];
  prepTimeMinutes: number | null; cookTimeMinutes: number | null;
  servings: number; difficulty: Difficulty; dietaryTags: string[];
  tasteTags: TasteProfile; tips: string | null;
  ingredientKeywords: string[]; costDrivers: string[];
  nutrition: Nutrition | null; isPublic: boolean;
  createdAt: string; updatedAt: string;
}
interface UserRecipeCreate {
  name: string; ingredients: Ingredient[];
  tagline?: string; description?: string; instructions?: string;
  steps?: string[]; prepTimeMinutes?: number; cookTimeMinutes?: number;
  servings?: number; difficulty?: Difficulty; dietaryTags?: string[];
  tips?: string; nutrition?: Nutrition; isPublic?: boolean;
}
interface Ingredient { name: string; quantity: string; unit: string; }
interface RecipeAlert {
  recipeId: string; recipeName: string; ingredientsOnSale: number;
  estimatedCost: number; regularCost: number; savings: number;
}
type SwipeableMeal = Meal & MealAttribution;
interface MealAttribution {
  sharedByName: string | null; sharedByInitials: string | null; weeklyMatchCount: number;
}
```

### LandingPage type already includes recipe data
The `LandingPage` type has `recipeAlerts: RecipeAlert[]` and `swipeableMeals: SwipeableMeal[]` (which includes attribution for community recipes). You may also need to add `userRecipes: UserRecipe[]` to the landing response, or fetch them separately.

## API Endpoints (from api-contract.yaml)

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /recipes | — | `{ recipes: UserRecipe[] }` |
| POST | /recipes | UserRecipeCreate | UserRecipe |
| GET | /recipes/{id} | — | UserRecipe |
| PATCH | /recipes/{id} | UserRecipeCreate | UserRecipe |
| DELETE | /recipes/{id} | — | 204 |
| POST | /recipes/{id}/publish | `{ is_public: boolean }` | UserRecipe |
| GET | /recipes/{id}/stats | — | RecipeStats |

**Note:** There is no URL import endpoint in the contract yet. For now, stub the import with a route that the frontend can call. The E2E import tests use `page.route()` to mock the response, so the actual backend endpoint does not need to work — but the frontend must attempt the call.

## Implementation Order

1. **Read all E2E test files** to understand the exact CSS selectors and interaction flows expected
2. **Create `useUserRecipes.ts` hook** — API integration layer
3. **Create `Toast.tsx`** — needed by save/delete flows
4. **Create `RecipeFormModal.tsx`** — the form (largest component, most tests)
5. **Create `RecipeDetailModal.tsx`** — the deal-enriched viewer
6. **Create `MyRecipes.tsx`** — the landing page section
7. **Update `LandingPage.tsx`** — wire everything together
8. **Update `MealCard.tsx`** — add community recipe attribution
9. **Run E2E tests** to verify: `npx playwright test e2e/recipe-*.spec.ts`
10. **Fix failures** until all tests pass

## Validation

After implementing, validate in this order:
1. `npx playwright test e2e/recipe-my-recipes-section.spec.ts` — section renders
2. `npx playwright test e2e/recipe-form-modal.spec.ts` — form UI works
3. `npx playwright test e2e/recipe-form-validation.spec.ts` — validation + save
4. `npx playwright test e2e/recipe-form-edit.spec.ts` — edit + delete
5. `npx playwright test e2e/recipe-form-import.spec.ts` — URL import UX
6. `npx playwright test e2e/recipe-deal-cards.spec.ts` — deal cards + detail modal
7. `npx playwright test e2e/recipe-community-swipe.spec.ts` — attribution on swipe cards
8. Finally: `npx playwright test e2e/recipe-*.spec.ts` — all at once

## Rules

- TypeScript strict mode, no `any` types
- All components use inline styles via `React.CSSProperties` — no CSS files
- Named exports for components (not default exports)
- Import shared types from `@groceryhack/shared/types`
- Import tokens from `../theme/tokens`
- Custom SVG icons only (no icon libraries) — store in `frontend/src/theme/icons/`
- Minimum 44x44px touch targets on all interactive elements
- `role="dialog"` and `aria-modal="true"` on all modals (handled by ModalOverlay)
- Never store prices on meals — pricing comes from deal matching
- API payloads use snake_case; TypeScript uses camelCase — the `api` client transforms automatically
- After writing frontend code, validate it in Chrome browser (check console for errors, verify rendering)
