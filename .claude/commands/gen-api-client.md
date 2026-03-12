# Generate API Client

Generate or update the typed frontend API client from api-contract.yaml so the frontend stays in sync with the backend.

## Input

$ARGUMENTS — Optional. A tag name (e.g. "auth", "meals", "deals") to regenerate just that section. If omitted, regenerates the entire client.

## Instructions

### 1. Read the sources of truth

- `api-contract.yaml` — every endpoint's method, path, request body, query params, path params, and response shapes
- `packages/shared/types.ts` — response type interfaces the client should return
- `docs/architecture/zod-strategy.md` — understand the snake_case API ↔ camelCase TypeScript mapping

### 2. Check existing client

Read `frontend/src/services/api.ts` if it exists. Understand the base client pattern (fetch wrapper, auth header injection, error handling).

### 3. Generate the API client

The client should follow this pattern:

#### Base client (`frontend/src/services/api.ts`)

```typescript
// Base URL from environment
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// Typed fetch wrapper that:
// 1. Adds Authorization: Bearer {token} header when authenticated
// 2. Sends request body as snake_case JSON
// 3. Parses response JSON and maps snake_case → camelCase
// 4. Throws typed errors matching the API error shape: {error, code, message}
```

#### Endpoint functions

For each endpoint in api-contract.yaml, generate a typed function:

```typescript
// Example: POST /auth/register
export async function register(input: RegisterRequest): Promise<AuthResponse> {
  return post('/auth/register', input);
}

// Example: GET /meals?limit=20
export async function getMeals(query?: MealsQuery): Promise<MealsResponse> {
  return get('/meals', query);
}

// Example: POST /meals/{meal_id}/swipe
export async function swipeMeal(mealId: string, input: SwipeInput): Promise<void> {
  return post(`/meals/${mealId}/swipe`, input);
}

// Example: DELETE /watchlist/{id}
export async function removeFromWatchlist(id: string): Promise<void> {
  return del(`/watchlist/${id}`);
}
```

#### Key requirements

- **Types from shared**: Import request/response types from `@groceryhack/shared`
- **Case conversion at boundary**: Functions accept camelCase params and convert to snake_case before sending. Responses come back as snake_case JSON and get mapped to camelCase before returning.
- **Auth token management**: Read JWT from localStorage or auth context. Attach to every request except public endpoints (POST /events/public, GET /plans/{token}, GET /share/{token}/respond).
- **Error handling**: Parse error responses into typed `ApiError` objects with `code` and `message` fields. Never swallow errors silently.
- **No external HTTP libraries**: Use native `fetch`. Keep the bundle small.

### 4. Generate TanStack React Query hooks

For each API function, generate the corresponding React Query hook in `frontend/src/hooks/`:

```typescript
// hooks/useLandingData.ts
export function useLandingData() {
  return useQuery({
    queryKey: ['landing'],
    queryFn: () => api.getLanding(),
  });
}

// hooks/useSwipe.ts
export function useSwipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, liked }: { mealId: string; liked: boolean }) =>
      api.swipeMeal(mealId, { liked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing'] });
    },
  });
}
```

Hook patterns:
- **GET endpoints** → `useQuery` with descriptive query keys
- **POST/PATCH/DELETE endpoints** → `useMutation` with appropriate `onSuccess` invalidation
- Mutations that change landing page data should invalidate `['landing']`
- Mutations for lists (recipes, watchlist, important items) should invalidate their respective query keys
- Follow the hook names from `docs/design/component-tree.md` (useLandingData, useAuth, useSwipe, useOptimize, useRecipes, useRecipeStats, useImportantItems, useLikedMeals, useLikedDeals, useShare, useGeolocation, useTrack)

### 5. Verify completeness

After generating:
- Count endpoints in api-contract.yaml vs functions in api.ts — they should match
- Verify every response type referenced exists in shared/types.ts
- Verify every hook listed in component-tree.md has a corresponding file

### 6. If regenerating a single tag

When `$ARGUMENTS` specifies a tag name, only update the functions for that tag's endpoints. Don't touch other functions or hooks.

## Output

List:
- All API client functions generated (endpoint → function name)
- All hooks generated or updated
- Any endpoints in the spec that couldn't be mapped (missing types, unclear shapes)
- Any hooks from component-tree.md that weren't generated (and why)
