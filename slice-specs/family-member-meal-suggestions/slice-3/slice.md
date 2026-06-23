# Slice 3: One pending suggestion per meal + view existing

> **Status:** APPROVED — 2026-06-23
> _(developer confirmed approval; the abstract beside this slice was approved 2026-06-22)_

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
Close the duplicate-suggestion rule end-to-end and let the family member see what
they already proposed. After Slice 2 a meal with a pending suggestion hides its
"Suggest a swap" button — but the rule lives only in the UI, and the family member
can't see *what* they suggested. This slice (1) enforces "one pending suggestion per
meal per family member" at the **data layer** (a partial-unique index) and the **API**
(`409 DUPLICATE_SUGGESTION`), so a second submission is impossible even outside the
happy-path UI; and (2) makes the **"Suggestion pending" marker reveal the existing
suggestion's replacement meal** when tapped, so the family member can see their
existing pending suggestion for that meal. This fully completes the third "creating a
suggestion" scenario.

## Gherkin coverage

**Scenario: Family member cannot suggest a replacement for a meal that already has a
pending suggestion from them** — *full*:
- ✅ "Then I cannot submit another suggestion for the same meal" — enforced at three
  layers: the partial-unique index (DB), the `suggestMeal` pre-check returning
  `409 DUPLICATE_SUGGESTION` (API), and the already-hidden button (UI, from Slice 2).
- ✅ "And I can see my existing pending suggestion for that meal" — tapping the
  "Suggestion pending" marker on that meal reveals a read-only detail naming the
  replacement meal I suggested and its `Pending` status.

**Scenario: Family member views the current meal plan** — already completed across
Slices 1–2; this slice deepens the "pending" marker from an opaque label into a
detail the member can open.

No other scenario is advanced by this slice. The account-holder side
(review / accept / dismiss) and the family member's full "My Suggestions" status view
remain in Slices 4–7.

## Dependencies
Slices 1 and 2 — the `/family` route, `GET /api/v1/family/plan` (returning
`pending_suggestions`), the `POST /api/v1/family/plan/suggestions` endpoint, the
`meal_suggestions` table (migration 007), `suggestMeal` service, `SuggestSwapModal`,
and the "Suggestion pending" markers in `StoreMealDealList` must all exist.

## Scope

### In scope

**Data model — `backend/src/db/migrations/008_unique_pending_suggestion.sql`**
(mirrored into `schema.sql`):
```sql
-- One *pending* suggestion per (family member, plan, target meal). Accepted/dismissed
-- rows don't block a re-suggestion, so the uniqueness is partial on status = 'pending'.
CREATE UNIQUE INDEX idx_meal_suggestions_one_pending_per_meal
    ON meal_suggestions (suggester_id, weekly_plan_id, target_meal_id)
    WHERE status = 'pending';
```
This is the index Slice 2 explicitly deferred. (Grain confirmed against
Approach note #3 in `slices.md`: "one pending suggestion per meal per family member.")

**Backend — query** (`backend/src/db/queries/family.ts`):
- `getPendingSuggestionForMeal(suggesterId, weeklyPlanId, targetMealId)` →
  the existing pending suggestion row (snake_case, via `mapSuggestionRow`) or `null`.
  `SELECT … WHERE suggester_id = $1 AND weekly_plan_id = $2 AND target_meal_id = $3
  AND status = 'pending'`.

**Backend — service** (`backend/src/services/family.ts`):
- In `suggestMeal`, after resolving the plan and validating the target/replacement
  meals, **pre-check** `getPendingSuggestionForMeal`; if a row exists →
  `throwConflict('DUPLICATE_SUGGESTION', "You already have a pending suggestion for this meal.")`.
- Defensively map a Postgres unique-violation (`error.code === '23505'`) from
  `createMealSuggestion` to the same `409 DUPLICATE_SUGGESTION`, so a race between two
  concurrent submits can't create two pending rows.

**Backend — docs** (`docs/architecture/error-codes.md`):
- Add the `DUPLICATE_SUGGESTION | 409 | POST /family/plan/suggestions` row, matching
  the existing family-code rows added in Slice 2 and the `DUPLICATE_*` naming used by
  `DUPLICATE_ITEM` / `DUPLICATE_FLYER_REQUEST`.

**API contract** (`api-contract.yaml`) — deferred from Slices 1–2, landed here:
- Add a `Family` tag and the two paths `GET /family/plan` and
  `POST /family/plan/suggestions`, including the `409 DUPLICATE_SUGGESTION` response
  (alongside `400 MEAL_NOT_IN_PLAN` / `400 INVALID_MEAL` / `403 NOT_A_FAMILY_MEMBER` /
  `404 NO_PLAN`) and the `MealSuggestion` / `FamilyPlanResponse` schemas (snake_case).

**Frontend — surface the existing suggestion** so the "Suggestion pending" marker is
no longer opaque. The data is already on the client (`data.pendingSuggestions`, each
with `replacementMealName` / `targetMealName`) — no new endpoint:
- `frontend/src/components/StoreMealDealList.tsx`: add one optional prop
  `onViewPendingSuggestion?: (meal: PlanMeal) => void` (drilled through `StoreSection`,
  symmetric to the existing `onSuggestSwap`). Render the two existing "Suggestion
  pending" pills (the view-all meal row at ~L621 and the by-meal action panel at ~L829)
  as **buttons** that call `onViewPendingSuggestion(meal)`. The by-meal pill-tab gold
  dot stays a non-interactive marker (selecting the tab routes to the action-panel pill).
- `frontend/src/pages/FamilyPlanPage.tsx`: build a `Map<string, MealSuggestion>` keyed
  by `targetMealId` from `data.pendingSuggestions`; hold `viewingSuggestion:
  MealSuggestion | null`; pass `onViewPendingSuggestion={(meal) =>
  setViewingSuggestion(byMealId.get(meal.mealId) ?? null)}`; render the read-only detail
  when set.
- **Read-only detail** (recommended: new `frontend/src/modals/PendingSuggestionModal.tsx`,
  a small centered dialog reusing the modal/`Toast` patterns already in the page —
  *not* the full-screen swipe `SuggestSwapModal`). Shows: "You suggested
  **{replacementMealName}** to replace **{targetMealName ?? meal.name}**", a `Pending`
  status chip (amber `#FBEEDB`/`#9A6A12`, matching the Slice-2 pill / mockup
  `.st-pending`), and the line "Only {holderName} can accept or dismiss this." Close
  button only — no resubmit, no accept/dismiss controls.
- **Duplicate-race feedback**: `SuggestSwapModal` already shows an error toast on
  mutation failure; on a `409 DUPLICATE_SUGGESTION` it should show a specific message
  ("You already have a pending suggestion for this meal.") rather than the generic one.

**Tests** (`backend/src/services/family.test.ts`, extending the Slice-2 file):
- Add `getPendingSuggestionForMeal` to the mocked `../db/queries/family.js`.
- New case: when `getPendingSuggestionForMeal` resolves to an existing row,
  `suggestMeal` throws the `409 DUPLICATE_SUGGESTION` AppError and **does not** call
  `createMealSuggestion`.
- New case: when it resolves `null`, `suggestMeal` proceeds to `createMealSuggestion`
  (guards the happy path against regression).

- New types/migration follow CLAUDE.md conventions; all domain types come from
  `packages/shared/types.ts` (`MealSuggestion` already exists — no new shared type is
  required this slice). Validate in Chrome before marking complete (CLAUDE.md rule).

### Out of scope (deferred)
- Account-holder review / accept / dismiss UI and endpoints → **Slices 4–6**. (Accept
  is what first moves a suggestion out of `pending`, which is what later *frees* the
  partial-unique index for a re-suggestion; this slice only proves the index blocks
  while `pending`.)
- The family member's full **"My Suggestions"** status list (all statuses, across
  meals) → **Slice 7**. This slice only reveals the single pending suggestion attached
  to a meal in the plan view.
- Account-holder direct edit; explicit family-member `403` enforcement tests → **Slice 8**.

### Decision to confirm
- **How "see my existing pending suggestion" is surfaced.** Recommended: the
  "Suggestion pending" marker becomes a button that opens a small read-only
  `PendingSuggestionModal` naming the replacement meal (above). _Alternative:_ render the
  replacement inline (e.g. a "→ {replacementMealName}" sub-line under the meal) with no
  modal — simpler, but cramped in the compact pill / by-meal action panel and inconsistent
  with the by-meal gold-dot marker. The recommended click-to-reveal works uniformly across
  both render sites. Confirm the modal approach or pick the inline alternative.

## Acceptance criteria
- [ ] Migration `008` adds the partial-unique index; `schema.sql` mirrors it;
      `npm run migrate` runs clean; backend `tsc --noEmit` passes.
- [ ] `POST /api/v1/family/plan/suggestions` as Sam for a `target_meal_id` that already
      has a pending suggestion from Sam returns **`409 DUPLICATE_SUGGESTION`**
      (`{error:true, code:"DUPLICATE_SUGGESTION", message:…}`), and the
      `meal_suggestions` table still holds exactly one pending row for that meal.
- [ ] A suggestion for a **different** meal in the same plan still returns `201`
      (the guard is per-meal, not per-plan).
- [ ] The DB rejects a duplicate pending row inserted directly (unique-index violation);
      after a row's `status` is moved off `'pending'` (e.g. set via SQL, since
      accept/dismiss is Slices 4–6), a new pending suggestion for the same meal is
      allowed again — confirming the index is correctly partial.
- [ ] In Chrome (no console errors): logged in as `sam@test.groceryhack.com` on
      `/family`, a meal showing **"Suggestion pending"** has no "Suggest a swap" control,
      and **tapping the marker reveals the replacement meal name** Sam suggested plus a
      `Pending` status. This holds in both view-all and by-meal modes.
- [ ] If a duplicate `POST` is forced (e.g. resubmitting via the swipe modal), the UI
      shows a friendly "already have a pending suggestion" message and **no** second
      pending row is created.
- [ ] `api-contract.yaml` documents `GET /family/plan` and
      `POST /family/plan/suggestions` (incl. the `409`); `docs/architecture/error-codes.md`
      lists `DUPLICATE_SUGGESTION`.
- [ ] Backend service tests cover the duplicate-guard (throws 409, skips insert) and the
      non-duplicate happy path; `backend`/`frontend` `tsc --noEmit` pass; all domain types
      come from `packages/shared/types.ts`.
