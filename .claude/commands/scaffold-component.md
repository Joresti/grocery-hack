# Scaffold Component

Generate an Ionic React component that matches the GroceryHack design system and component tree specification.

## Input

$ARGUMENTS — A component name from the component tree (e.g. "SwipeMode", "RecipeModal", "MealCard", "HeartButton", "SavingsCounter")

## Instructions

### 1. Read the specs

Before generating any code, read these files:
- `docs/design/component-tree.md` — find the component's section. Understand its hierarchy, props, behavior, and how it connects to other components.
- `docs/design/style-guide.md` — colors, typography, spacing, radii, shadows, animations
- `packages/shared/types.ts` — domain types the component will use
- `api-contract.yaml` — if the component calls an API, verify the endpoint shapes

### 2. Determine the component type

Based on the component tree, figure out where this component lives:

| Type | Directory | Export Style | Examples |
|------|-----------|-------------|----------|
| Page | `frontend/src/pages/` | default export | LandingPage, LoginPage |
| Modal | `frontend/src/modals/` | named export | SwipeMode, RecipeModal, FeelingLuckyModal |
| Shared component | `frontend/src/components/` | named export | MealCard, HeartButton, SavingsCounter |
| Hook | `frontend/src/hooks/` | named export | useLandingData, useSwipe |
| Icon | `frontend/src/theme/icons/` | named export | HeartIcon, ShareIcon |

### 3. Generate the component

Follow these design system rules:

#### Colors and theming
- Import tokens from `frontend/src/theme/tokens.ts`
- Page background: `tokens.bg` (#FAF9F6)
- Card backgrounds: `tokens.white` (#FFFFFF)
- Primary actions: `tokens.primary` (#3D7B7B)
- Sale prices: `tokens.primary`
- Discount badges: `tokens.greenBadgeBg` background, `tokens.greenBadgeText` text
- Errors/danger: `tokens.danger` (#DC2626)
- Gold/special: `tokens.accent` (#C9A84C)
- Muted text: `tokens.textMuted` (#5A5A5A)
- Borders: `tokens.border` (rgba(61,123,123,0.12))

#### Typography
- Headings, prices, badges, logo: font-family `'Sora', sans-serif`
- Body, labels, buttons, inputs: font-family `'Inter', sans-serif`
- Weights: 400 (body), 500 (labels/ingredients), 600 (buttons/prices/badges), 700 (headings/logo/savings)

#### Spacing and layout
- Container max-width: 720px
- Card border-radius: 16px
- Button border-radius: 99px (pill shape)
- Modal border-radius: 20px top corners
- Card padding: 28-40px (responsive)
- Touch target minimum: 44x44px
- Section padding: 32px vertical

#### Animations
- Swipe sway: `gentleSway` keyframe, 4s ease-in-out infinite, pauses on hover
- Swipe gesture: spring physics (cubic-bezier(.175, .885, .32, 1.275))
- Savings counter: ease-out cubic, ~500-900ms
- Confetti: CSS keyframes on savings > $5 per meal match
- Modals: slide up from bottom, 250ms ease-out
- Toasts: fade in/out with Y translation, 1.5s total
- Button hover: translateY(-1px) with shadow intensify, 0.2s ease
- Card hover: shadow intensifies, 0.3s ease
- Use CSS transitions/keyframes or Framer Motion — never setInterval

#### Icons
- Custom SVG components from `frontend/src/theme/icons/`
- 2px stroke weight, rounded line caps and joins
- Active: `tokens.primary`, inactive: `tokens.textMuted`, on buttons: `tokens.white`
- If the component needs an icon that doesn't exist yet, generate it

### 4. Wire up data and interactions

- Use TanStack React Query hooks for data fetching (e.g., `useLandingData`, `useRecipes`)
- If the right hook doesn't exist, generate it in `frontend/src/hooks/`
- Hooks should use the typed API client from `frontend/src/services/api.ts`
- All interactive elements must work with AuthGate:
  - Logged in → perform the action
  - Anonymous → show sign-up prompt
- Wire analytics tracking via `useTrack` hook where the component tree specifies tracking events

### 5. Handle responsive design

- Mobile-first approach
- Use CSS custom properties or media queries for responsive adjustments
- Container padding: 24px desktop, 20px tablet, 16px mobile
- Card padding scales down on mobile
- Touch targets always >= 44x44px

### 6. Check for related components

If this component depends on other components that don't exist yet (e.g., RecipeModal needs IngredientRow), list them and offer to generate them as well. Components from the shared `components/` directory are reusable — check if they already exist before creating duplicates.

## Output

List all files created:
- The component file(s)
- Any new hooks generated
- Any new icon components generated
- Any new types added to `packages/shared/types.ts`

Note any assumptions made where the spec was ambiguous.
