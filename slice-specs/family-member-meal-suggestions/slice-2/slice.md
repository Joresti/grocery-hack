# Slice 2: Family member suggests a meal replacement

> **Status:** DRAFT — awaiting developer approval
> _(changes to `APPROVED — <date>` only after the developer explicitly approves)_

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
A family member on `/family` can tap **"Suggest a swap"** next to any meal, pick a
replacement from the shared meals pool via a swipe-style modal (matching Screen 5 in
the mockup), and submit it. The suggestion is stored as `pending` in a new
`meal_suggestions` table. The meal row that now has a pending suggestion immediately
shows **"Suggestion pending"** instead of the button. The holder's plan data is
unchanged. The holder side (reviewing, accepting, dismissing) is deferred to Slices 4–6.

## Gherkin coverage

**Scenario: Family member suggests a meal replacement** — *full*:
- ✅ "When I select that meal / And I submit a suggested replacement meal"
- ✅ "Then the suggestion is recorded as pending"
- ✅ "And the account holder can see it in their pending suggestions" — verified via
  the API (`GET /api/v1/family/plan` returning `pending_suggestions`); the holder's
  review UI is Slices 4–6 but the data is written here.
- ✅ "And the meal plan itself is unchanged"

**Scenario: Family member views the current meal plan** — *partial completion*:
- ✅ "And I can see which meals already have a pending suggestion from me" — the
  `"Suggestion pending"` pill replaces the button on meals with a pending suggestion.
  _(The full scenario is considered complete between Slices 1–2.)_

**Scenario: Family member cannot suggest a replacement for a meal that already has
a pending suggestion from them** — *groundwork only*: after submitting, the UI shows
"Suggestion pending" and the button disappears, making a second submission impossible
from the UI. The DB partial-unique index enforcing this at the data layer lands in
**Slice 3**.

## Dependencies
Slice 1 — the `/family` route, `GET /api/v1/family/plan` endpoint, `FamilyPlanPage`,
and the `users.account_holder_id` column must all exist.

## Scope

### In scope

**Data model**

- `backend/src/db/migrations/007_add_meal_suggestions.sql` (mirrored into `schema.sql`):
  ```sql
  CREATE TABLE meal_suggestions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suggester_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_holder_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weekly_plan_id      UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
      target_meal_id      UUID NOT NULL,           -- PlanMeal.mealId (meal from the holder's plan)
      replacement_meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'dismissed')),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_meal_suggestions_suggester ON meal_suggestions (suggester_id);
  CREATE INDEX idx_meal_suggestions_holder    ON meal_suggestions (account_holder_id);
  CREATE INDEX idx_meal_suggestions_plan      ON meal_suggestions (weekly_plan_id);
  ```
  _Note: The partial-unique index enforcing "one pending suggestion per meal per member"
  is deferred to Slice 3._

**Shared types** (`packages/shared/types.ts`):
- New `MealSuggestionStatus = 'pending' | 'accepted' | 'dismissed'` type alias.
- New `MealSuggestion` interface (matches all columns: `id`, `suggesterId`,
  `accountHolderId`, `weeklyPlanId`, `targetMealId`, `replacementMealId`, `status`,
  `createdAt`; plus denormalised display fields: `replacementMealName`,
  `targetMealName`).
- New `SuggestMealRequest` interface: `{ target_meal_id: string; replacement_meal_id: string }`.
- Update `FamilyPlanResponse`: add `pending_suggestions: MealSuggestion[]` — the
  caller's own pending suggestions for the holder's current plan (populated on
  `GET /api/v1/family/plan` so the UI can render "Suggestion pending" markers without a
  second request).

**Backend — queries** (`backend/src/db/queries/family.ts`):
- `createMealSuggestion(params)` — `INSERT INTO meal_suggestions … RETURNING *`.
  Joins back `meals.name` for both target and replacement so callers get denormalised
  names without a second query.
- `getMySuggestionsForPlan(suggesterId, weeklyPlanId)` — `SELECT … WHERE suggester_id
  = $1 AND weekly_plan_id = $2 AND status = 'pending'` — used to populate the new
  `pending_suggestions` field on `GET /api/v1/family/plan`.

**Backend — service** (`backend/src/services/family.ts`):
- `suggestMeal(userId, targetMealId, replacementMealId)`:
  1. Resolve `account_holder_id` via `getFamilyMemberLink` (403 if not a member).
  2. Look up the holder's current `weekly_plans` row (404 if none).
  3. Verify `targetMealId` exists in the plan's JSONB
     (`one_store_optimized.stops[].meals[].mealId`); 400 `MEAL_NOT_IN_PLAN` if not.
  4. Verify `replacementMealId` exists in `meals` table; 400 `INVALID_MEAL` if not.
  5. Call `createMealSuggestion` and return the created row.
- Update `getFamilyPlan(userId)` to also call `getMySuggestionsForPlan` and include
  `pending_suggestions` in the response.

**Backend — route** (`backend/src/routes/family.ts`):
- `POST /api/v1/family/plan/suggestions` (`requireAuth` + Zod-validated body):
  parse `target_meal_id` and `replacement_meal_id` (both non-empty UUIDs), call
  `suggestMeal`, return `201` with the created `MealSuggestion`.

**Backend — validation schema** (new file `backend/src/schemas/family.ts` or inline):
- Zod schema for the `POST` body: `target_meal_id` and `replacement_meal_id` as
  `z.string().uuid()`.

**Frontend — shared service** (`frontend/src/services/api.ts`):
- `suggestMeal(targetMealId, replacementMealId)` — authenticated `POST` to
  `/api/v1/family/plan/suggestions`.

**Frontend — hook** (`frontend/src/hooks/useFamilyPlan.ts`):
- `useFamilyPlan` already returns the raw API response. Ensure `pendingSuggestions`
  (camelCased from `pending_suggestions`) is surfaced in the returned `data`.

**Frontend — StoreMealDealList** (`frontend/src/components/StoreMealDealList.tsx`):
- Add two optional props to `StoreMealDealListProps`:
  ```ts
  onSuggestSwap?: (meal: PlanMeal) => void;
  pendingSuggestionMealIds?: Set<string>;  // Set of mealId strings
  ```
- In the meal row render (both "view all" mode meal section and "by meal" mode), when
  `onSuggestSwap` is provided:
  - If `pendingSuggestionMealIds?.has(meal.mealId)`: render `"Suggestion pending"` pill
    (matching the `.pill-pending` style in the mockup — teal border, teal text, small,
    rounded).
  - Otherwise: render a small `"Suggest a swap"` button (`.btn-xs` in mockup — outlined
    teal pill, compact).
  - Both appear to the right of the meal name, before the `$x.xx/serving` cost.
- When neither prop is provided the component is unchanged — landing page is unaffected.

**Frontend — modal** (new `frontend/src/modals/SuggestSwapModal.tsx`):
- Props: `isOpen`, `onClose`, `targetMeal: PlanMeal`, `onSubmitted: (suggestion: MealSuggestion) => void`.
- Header context bar (matching Screen 5): `"Finding a replacement for {targetMeal.name}"`.
- Body: a swipe card deck using the same `MealCard` / swipe-gesture patterns as
  `SwipeMode`. Load meals via `GET /api/v1/meals` (reuse the existing
  `useSwipeableMeals` hook or a direct query). "NOPE" (swipe left) skips to next card;
  "YUM" (swipe right) calls `suggestMeal(targetMeal.mealId, card.id)`, shows a brief
  confirmation toast, calls `onSubmitted(suggestion)`, and closes the modal.
- Empty state: if no meals are available, show `"No meals to suggest right now."`.
- Pending/error state: during the `suggestMeal` mutation, disable the swipe actions
  and show a loading indicator; on error, show a toast and re-enable.
- _Does not_ record a swipe preference (`POST /api/v1/meals/:id/swipe`) — YUM here
  means "suggest this meal" not "I like this meal."

**Frontend — FamilyPlanPage** (`frontend/src/pages/FamilyPlanPage.tsx`):
- Maintain local state `suggestingFor: PlanMeal | null`.
- Build `pendingSuggestionMealIds` from `data.pendingSuggestions` (a `Set<string>`).
- Pass `onSuggestSwap={(meal) => setSuggestingFor(meal)}` and `pendingSuggestionMealIds`
  to `StoreMealDealList`.
- Render `<SuggestSwapModal>` when `suggestingFor` is non-null.
- On `onSubmitted`: update the local `pendingSuggestionMealIds` set optimistically (or
  invalidate the `useFamilyPlan` query so the server state is re-fetched).

### Out of scope (deferred)

- DB partial-unique index preventing duplicate pending suggestions → **Slice 3** (the
  index and the app-level check).
- UI: showing the existing pending suggestion when "Suggest a swap" would be blocked →
  **Slice 3**.
- Account-holder review / accept / dismiss UI → **Slices 4–6**.
- "My Suggestions" status page (`/family/suggestions`) → **Slice 7**.
- Explicit family-member 403 enforcement tests → **Slice 8**.
- Adding the new endpoint to `api-contract.yaml` — fine here or alongside Slice 3.

## Acceptance criteria

- [ ] Migration `007` creates the `meal_suggestions` table; `schema.sql` mirrors it;
      `npm run migrate` runs clean; `backend tsc --noEmit` passes.
- [ ] `POST /api/v1/family/plan/suggestions` authenticated as Sam (linked family
      member) with a valid `target_meal_id` from Jessica's plan and any `replacement_meal_id`
      from the `meals` table returns `201` with the created `MealSuggestion` (status
      `pending`). The `weekly_plans` row for Jessica is unchanged.
- [ ] The same endpoint returns `400 MEAL_NOT_IN_PLAN` when `target_meal_id` is not in
      the holder's current plan, and `403 NOT_A_FAMILY_MEMBER` when called by a
      non-linked user (e.g. Jessica).
- [ ] `GET /api/v1/family/plan` authenticated as Sam returns `pending_suggestions`
      containing the just-created suggestion after the `POST`.
- [ ] In Chrome (no console errors): logging in as `sam@test.groceryhack.com`, opening
      `/family`, and tapping **"Suggest a swap"** next to any meal opens the
      `SuggestSwapModal`. Swiping YUM on a card closes the modal and the meal row now
      shows **"Suggestion pending"** in place of the button.
- [ ] Refreshing `/family` after the suggestion persists the **"Suggestion pending"**
      marker (served from `GET /api/v1/family/plan` → `pending_suggestions`).
- [ ] The account holder's plan is unchanged: logging in as `jessica@test.groceryhack.com`
      and viewing the landing page shows the original meals.
- [ ] `frontend tsc --noEmit` passes; all new domain types come from
      `packages/shared/types.ts`.
