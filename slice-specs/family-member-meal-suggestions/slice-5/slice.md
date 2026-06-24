# Slice 5: Account holder accepts a suggestion → plan updated

> **Status:** APPROVED — 2026-06-23

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
On the holder's existing **Pending Suggestions** review surface (the Slice-4
`ReviewSuggestionsModal`, opened from the landing page), each pending suggestion now has
an **Accept** action. Accepting the account holder (Jessica) **swaps the target meal out
of her current-week plan for the suggested replacement**: the replacement meal's
ingredient keywords are re-matched against the deals already available at the plan's
selected store(s), the new meal's on-sale groceries appear on the shopping list, and the
stop subtotals, plan total, and `estimatedSavings` are recomputed — **without re-picking
stores or re-running the full optimizer**. The suggestion is marked `accepted`. After
accepting, the landing-page plan re-renders showing the new meal in place of the old one,
and the "Suggestions (N)" badge drops by one. This is the first time a family member's
input can actually change the plan — and the only way it ever can.

## Gherkin coverage

**Scenario: Account holder accepts a suggestion** — *full for the plan-mutation, partial
for the family-member-visibility Then*:
- ✅ "When I accept that suggestion / Then the meal plan is updated to use the suggested
  replacement" — the swap service replaces the target `PlanMeal` with the replacement and
  refreshes the matched deals / costs / savings on the plan JSONB.
- ✅ "And the suggestion is marked as accepted" — `meal_suggestions.status` → `'accepted'`,
  so it leaves the holder's pending list and the `pending_suggestion_count`.
- ◐ "And the family member can see that their suggestion was accepted" — the `accepted`
  status is now **persisted and true in the data** (and the suggestion disappears from the
  family member's pending markers on `GET /family/plan`), but the family member's explicit
  **"My Suggestions" status view** that renders the word *accepted* is **Slice 7**. This
  slice makes the fact true; Slice 7 makes it visible to the suggester.

No other scenario is completed here. **Dismiss** (Slice 6) reuses this surface; the meal-swap
service built here is reused by the holder's **direct edit** (Slice 8). The explicit **403**
for a family member attempting to accept is added as a guard here but made *observable and
tested* in **Slice 8**.

## Dependencies
Slices 1–4. Specifically:
- The `meal_suggestions` table + `accepted` status already allowed by its `CHECK`
  constraint (`backend/src/db/migrations/007_add_meal_suggestions.sql`) — **no new
  migration is needed** to mark a suggestion accepted.
- The holder review surface: `ReviewSuggestionsModal`
  (`frontend/src/modals/ReviewSuggestionsModal.tsx`), `useHolderSuggestions`
  (`frontend/src/hooks/useHolderSuggestions.ts`), `GET /family/suggestions`
  (`backend/src/routes/family.ts:21`), and the `pending_suggestion_count` on `/landing`.
- The optimizer's reusable matching helpers — `findBestDealForKeyword`
  (`backend/src/services/optimizer.ts:113`), `calculateBrandCost` (`:145`), and
  `buildPlanStop` (`:216`) — plus `findActiveDealsByBrands`
  (`backend/src/db/queries/optimizer.ts:108`).
- The seeded pending Sam→Jessica suggestion from Slice 4 (`backend/src/db/seedPlans.ts`)
  gives a deterministic row to accept after `npm run seed && npm run seed:plans`.

## Scope

### In scope

**Backend — meal-swap service** (new `backend/src/services/mealSwap.ts`, or a section of
`services/family.ts`): a pure, testable `swapMealInPlan(plan, targetMealId, replacementMeal,
dealsByBrand)` that, for **each representation** (`one_store_optimized` and
`two_store_optimized`) and **each stop** where the target meal appears:
- Re-matches the replacement meal's `ingredientKeywords` against that stop's brand's current
  deals via `findBestDealForKeyword`, building the new meal's `PlanShoppingItem`s tagged
  `forMeal = replacement.name` (on-sale items priced from the deal; ingredients with no deal
  use the optimizer's 1.5×-average estimate and remain on the list — **never silently drop an
  on-sale item that exists at that store**).
- Replaces the target `PlanMeal` with a new `PlanMeal` (`mealId`, `name`, `costPerServing`,
  `totalCost`, `savings`) computed from those matches (reusing `calculateBrandCost` /
  `buildPlanStop` math so costs stay consistent with how the plan was first built).
- **Handles the cross-meal dedup caveat** (Approach-notes #5): items are keyed by ingredient
  keyword and `forMeal` is tagged to the *first* meal needing them. So when removing the old
  meal, only drop items whose keyword is **no longer needed by any remaining meal in that
  stop**; when adding the new meal, **skip keywords already present** (don't duplicate a line
  another meal already owns). Re-tag `forMeal` if the only meal that owned a still-needed item
  was the one being removed.
- Recomputes each affected stop's `subtotal`, then the representation's `total`,
  `budgetRemaining`, and `estimatedSavings`.
- A no-op-safe contract: if the target meal isn't in a representation (e.g. `two_store` is
  `null` or doesn't contain it), that representation is left untouched.

**Backend — service entry** (`backend/src/services/family.ts`):
- `acceptSuggestion(holderId, suggestionId)`:
  1. Load the suggestion (`getSuggestionById`). **404 `SUGGESTION_NOT_FOUND`** if missing.
  2. **Authorization guard:** the suggestion's `account_holder_id` must equal `holderId`,
     else **403 `NOT_SUGGESTION_HOLDER`** (a family member — whose id is never an
     `account_holder_id` — is thereby blocked from accepting; Slice 8 makes this negative
     case observable/tested).
  3. Status must be `'pending'`, else **409 `SUGGESTION_NOT_PENDING`** (already
     accepted/dismissed — keeps accept idempotent and race-safe).
  4. Load the holder's current plan; **404 `NO_PLAN`** if absent. Guard that the
     suggestion's `weekly_plan_id` matches the current plan id (a suggestion against a stale
     week can't mutate this week's plan) → **409 `PLAN_CHANGED`**.
  5. Fetch the replacement meal's matching fields (`ingredientKeywords`, `name`, `servings`)
     and the active deals for the plan's store brands, run `swapMealInPlan`, then **in one
     transaction** persist the updated `one_store_optimized` / `two_store_optimized` JSONB
     and `UPDATE meal_suggestions SET status='accepted' WHERE id=$1 AND status='pending'`.
  6. Return the updated suggestion row (snake_case, `status:"accepted"`).

**Backend — queries** (`backend/src/db/queries/family.ts` + a meal helper):
- `getSuggestionById(id)` → the raw suggestion row (status + account_holder_id +
  weekly_plan_id + target/replacement ids) for the guards above.
- `markSuggestionAccepted(client, id)` → `UPDATE … SET status='accepted' WHERE id=$1 AND
  status='pending' RETURNING …` (run on the transaction client).
- `updatePlanRepresentations(client, planId, oneStore, twoStore)` → persists the swapped
  JSONB on `weekly_plans` (write the camelCase `GroceryPlan` objects, like
  `saveWeeklyPlan` does at `backend/src/db/queries/optimizer.ts:186`).
- New `findMealForMatching(mealId)` (in `db/queries/meals.ts` or `optimizer.ts`) returning
  `{ id, name, ingredientKeywords, servings }` — because the existing `findMealById` /
  `mapMealRow` (`backend/src/db/queries/meals.ts:7`) **does not expose
  `ingredient_keywords`**, which the swap re-match requires. Mirrors the `LikedMealRow`
  shape from `findLikedMealsFull` (`backend/src/db/queries/optimizer.ts:61`).

**Backend — route** (`backend/src/routes/family.ts`):
- `POST /api/v1/family/suggestions/:id/accept` (`requireAuth`, `validate({ params })` with a
  uuid `id`): `res.json(await acceptSuggestion(req.user!.userId, req.params.id))`.
- New Zod params schema in `backend/src/schemas/family.ts` (`acceptSuggestionParams = z.object({
  id: z.string().uuid() })`).

**Shared types** (`packages/shared/types.ts`): no new domain type required — the response is
the existing `MealSuggestion` (now `status:"accepted"`). Add only if the frontend needs a
distinct accept-response shape (it doesn't; it invalidates and refetches).

**Frontend — mutation hook** (new `frontend/src/hooks/useAcceptSuggestion.ts`):
- `useMutation` → `api.post('/family/suggestions/${id}/accept')`; on success
  `invalidateQueries(['holderSuggestions'])` **and** `invalidateQueries(['landing'])` so the
  plan section re-renders with the swapped meal and the "Suggestions (N)" badge decrements.

**Frontend — review modal** (`frontend/src/modals/ReviewSuggestionsModal.tsx`):
- Add an **Accept** button to each `ReviewCard` (primary pill, `theme/tokens` styling,
  matching the mockup's `.review-actions` Accept). Calls `useAcceptSuggestion`; disabled +
  spinner while pending; success toast ("Swapped {replacement} into your plan"); error toast
  on failure. The info banner copy already present ("Accepting swaps the meal in your
  plan…") now describes a live action.
- (Dismiss button is **Slice 6** — Accept ships alone, or with a disabled Dismiss
  placeholder; see "Decision to confirm.")

**API contract** (`api-contract.yaml`): document `POST /family/suggestions/{id}/accept`
under the `Family` tag — `204`/`200` returning the updated `MealSuggestion`, plus the
`403 NOT_SUGGESTION_HOLDER` / `404 SUGGESTION_NOT_FOUND` / `409 SUGGESTION_NOT_PENDING`
error cases.

**Conventions:** snake_case wire ↔ camelCase internal, named exports, explicit return types,
parameterized SQL, the multi-statement write wrapped in a transaction (BEGIN/COMMIT/ROLLBACK
like `recordSwipe` at `backend/src/db/queries/meals.ts:96`), all domain types from
`packages/shared/types.ts`. Validate in Chrome via `backend/scripts/cdp.py` on `:9222`
(WSL — chrome-mcp does not apply) before marking complete.

### Out of scope (deferred)
- **Dismiss** a pending suggestion (mark `dismissed`, plan unchanged) → **Slice 6** (reuses
  this surface and the same guards, minus the swap).
- The family member's **"My Suggestions"** status view that renders *accepted* to the
  suggester → **Slice 7** (this slice only persists the status).
- The account holder's **direct meal edit** (no suggestion) and the **provable/tested
  negative cases** (family member gets 403 on accept; cannot edit) → **Slice 8**. The 403
  guard is *written* here; Slice 8 makes it observable and adds the test.
- **Re-picking stores or re-running the whole optimizer** on accept — the swap only
  re-matches at the plan's already-selected store(s).
- **Cleanup of other now-stale pending suggestions** that targeted the swapped-out meal
  (their `target_meal_id` is no longer in the plan). Left `pending` for MVP; see "Decision
  to confirm."

### Decision to confirm
1. **Endpoint shape.** Recommended: `POST /family/suggestions/:id/accept` (an explicit
   action verb, returning the updated `MealSuggestion`). _Alternative:_ `PATCH
   /family/suggestions/:id` with `{ status: 'accepted' }` (more RESTful but invites
   arbitrary status writes the service would have to reject). Confirm the action-style POST.
2. **Other pending suggestions on the swapped-out meal.** When Jessica accepts Sam's swap,
   any *other* family member's pending suggestion against that same (now-removed) meal
   becomes stale. Recommended for MVP: **leave them pending** (no scenario covers this;
   simplest) and revisit if needed. _Alternative:_ auto-dismiss them on accept. Confirm
   leaving them.
3. **Accept-only vs. Accept + disabled Dismiss.** Recommended: ship **Accept alone** this
   slice (Dismiss lands wired in Slice 6) so nothing on screen is dead. _Alternative:_ show
   a disabled Dismiss placeholder now. Confirm Accept-only.

## Acceptance criteria
- [ ] `POST /api/v1/family/suggestions/:id/accept` authenticated as **Jessica**, for the
      seeded pending Sam→Jessica suggestion, returns the suggestion with `status:"accepted"`
      and flips the row to `accepted` in `meal_suggestions`.
- [ ] After accepting, Jessica's `weekly_plans` row no longer contains the **target** meal
      and **does** contain the **replacement** meal — in **both** `one_store_optimized` and
      (where present) `two_store_optimized`. Every deal that exists for the replacement's
      ingredients **at the plan's existing store(s)** appears as an on-sale
      `PlanShoppingItem` tagged `forMeal` = the replacement; the affected stop `subtotal`,
      plan `total`, and `estimatedSavings` are recomputed; no store is added or removed.
- [ ] Ingredients of the replacement with **no** matching deal at those stores still appear
      on the list (estimated price, `isOnSale:false`) — the swap is allowed even when few/none
      of its ingredients are on sale, and never drops an on-sale item that does exist.
- [ ] Shared-ingredient safety: accepting does **not** remove a shopping-list line still
      needed by another meal remaining in the plan, and does **not** add a duplicate line for
      a keyword another meal already owns.
- [ ] `GET /api/v1/landing` as Jessica afterward shows `pending_suggestion_count` decreased
      by one and the plan section reflecting the swapped meal.
- [ ] Authorization: accepting a suggestion **not** addressed to the caller returns `403
      NOT_SUGGESTION_HOLDER`; accepting a missing id returns `404 SUGGESTION_NOT_FOUND`;
      accepting an already-accepted/dismissed suggestion returns `409
      SUGGESTION_NOT_PENDING`. All errors use the standard `{error,code,message}` shape.
- [ ] In Chrome (no console errors, validated via `cdp.py`): logged in as
      `jessica@test.groceryhack.com`, opening **Pending Suggestions** shows an **Accept**
      button per card; clicking it swaps the meal, the modal/list refreshes (the accepted
      suggestion is gone), the "Suggestions (N)" badge drops, and the landing plan shows the
      new meal in place of the old.
- [ ] `api-contract.yaml` documents the accept endpoint and its error cases; `backend` and
      `frontend` `tsc --noEmit` pass; all domain types come from `packages/shared/types.ts`.
