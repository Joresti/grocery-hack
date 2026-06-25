# Slice 8: Account holder direct edit + permission hardening

> **Status:** APPROVED — 2026-06-24

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
The account holder can change any meal in their **own** current-week plan **directly** —
pick a meal, pick a replacement from the shared pool, and the swap applies immediately
with **no suggestion in between** — by **reusing Slice 5's swap engine** (`swapMealInPlan`,
`backend/src/services/mealSwap.ts:277`). So the new meal is re-matched against the deals at
the plan's already-selected store(s), and costs / savings / shopping list recompute exactly
as they do on accept (no store re-pick, no full re-optimize). This is the holder's
counterpart to the family member's "Suggest a swap."

It also **hardens and makes observable the permission boundary the whole feature is about**:
a family member is **provably blocked (HTTP 403)** both from editing the plan directly (a new
`NOT_ACCOUNT_HOLDER` guard) and from accepting/dismissing suggestions (the **existing**
`NOT_SUGGESTION_HOLDER` guard, already unit-tested), and the `/family` view exposes **neither**
an edit control **nor** accept/dismiss controls. With this slice the feature is complete: the
only plan mutation a family member can cause is via an **accepted** suggestion.

## Gherkin coverage

**Scenario: Account holder can edit the meal plan directly** — *full*:
- ✅ "When I view the current week's meal plan / Then I can change a meal directly without
  submitting a suggestion" — a new holder-only endpoint `POST /api/v1/family/plan/edit` swaps
  the target meal for the replacement in the holder's own current-week plan and persists it,
  with no `meal_suggestions` row created or touched. Holder UI: a "Change meal" affordance on
  the `LandingPage` plan section opens a replacement picker; confirming applies the swap and the
  plan re-renders.

**Scenario: Family member cannot directly edit the meal plan** — *full*:
- ✅ "Then I cannot change a meal directly" — backend: a family member (non-null
  `users.account_holder_id`) calling `POST /family/plan/edit` gets **403 `NOT_ACCOUNT_HOLDER`**
  (new guard, the inverse of the family-view guard at `backend/src/services/family.ts:76-78`).
  UI: `FamilyPlanPage` (`frontend/src/pages/FamilyPlanPage.tsx`) passes the holder edit callback
  to nobody — `StoreMealDealList` there only gets `onSuggestSwap` (`FamilyPlanPage.tsx:235`), so
  no "Change meal" control ever renders for a family member (observable by absence).
- ✅ "And the only change I can make is to submit a suggestion" — `/family`'s only mutation
  control is "Suggest a swap"; the page banner already states *"only {holderName} can change the
  plan directly"* (`FamilyPlanPage.tsx:222`).

**Scenario: A family member cannot review or act on suggestions** — *completes the "cannot
accept or dismiss" half* (the "can see their status" half was delivered by Slice 7's
My Suggestions view):
- ✅ "But I cannot accept or dismiss any suggestion" — backend: the holder-only guard
  **`NOT_SUGGESTION_HOLDER` (403)** is **already enforced** on accept
  (`backend/src/services/family.ts:256-258`) and dismiss (`family.ts:344-346`) — a family
  member's id is never a suggestion's `account_holder_id`, so they always 403 — and is **already
  unit-tested** (`backend/src/services/family.test.ts:389-396` for accept, `:480-487` for
  dismiss, both using a family member `SAM_ID`). UI: accept/dismiss controls live **only** in
  `ReviewSuggestionsModal`, which is mounted **only** in `LandingPage.tsx:346-350` (the holder
  view), never on `/family`. **This slice does not build that guard — it makes it observable:**
  a live 403 from the running endpoint (logged in as the family member) plus the UI absence.

No other scenario is touched. The eight scenarios already satisfied by Slices 1–7 are unaffected.

## Dependencies
Slices 1–7. Specifically:

**The swap engine and its plumbing (Slice 5), reused verbatim:**
- `swapMealInPlan(representation, targetMealId, replacement, remainingMeals, dealsByBrand,
  fallbackPrice, budget)` (`backend/src/services/mealSwap.ts:277-296`) — pure in / pure out, no
  knowledge of suggestions, holders, the DB, or HTTP. Re-matches at the plan's existing brands,
  rebuilds stops/items/subtotals/total/savings, handles the shared-ingredient `forMeal` dedup
  internally (`collectPostSwapMeals`/`preserveStaples`, `mealSwap.ts:75-125`). **No change.**
- The `acceptSuggestion` gather block (`backend/src/services/family.ts:280-303`): cast
  `one_store_optimized`/`two_store_optimized`, `collectPlanBrandIds` →
  `findActiveDealsByBrands` → `buildDealsByBrand`, `getAverageDealPrice`, holder budget via
  `findUserById`, `loadRemainingMeals`, then `swapMealInPlan` **once per representation**. Copied
  near-verbatim into the new direct-edit service.
- File-private helpers `planContainsMeal` (`family.ts:56-71`), `loadRemainingMeals`
  (`family.ts:211-231`), `collectPlanBrandIds` (`family.ts:197-204`) — **so the new service must
  live in `family.ts`** to reuse them (or they'd have to be exported).
- `getCurrentPlan(holderId)` (`backend/src/db/queries/landing.ts`), `findMealForMatching`
  (`backend/src/db/queries/meals.ts`), `updatePlanRepresentations`
  (`backend/src/db/queries/family.ts:327-344`), `getFamilyMemberLink`
  (`backend/src/db/queries/family.ts:44-59`).

**The permission guard (Slices 5–6), already present:**
- `NOT_SUGGESTION_HOLDER` (403) on accept/dismiss (`family.ts:256-258`, `:344-346`) + its tests
  (`family.test.ts:389-396`, `:480-487`) + its `docs/architecture/error-codes.md:141` row. The
  code comments at `family.ts:240-243` and `:327-331` flag that this is "made observable and
  tested in Slice 8" — the unit tests already exist, so the Slice 8 remainder is the *observable
  live 403* + UI absence, not new guard code.

**Frontend reuse surface:**
- The shared plan renderer `StoreMealDealList` (`frontend/src/components/StoreMealDealList.tsx`),
  whose optional-callback prop pattern (`onSuggestSwap?`, lines 13-23) the holder edit affordance
  mirrors.
- The replacement-meal picker: `SuggestSwapModal` + `ReplacementCard` swipe deck
  (`frontend/src/modals/SuggestSwapModal.tsx`) fed by `useMeals` → `GET /api/v1/meals` →
  `SwipeableMeal[]` (`frontend/src/hooks/useMeals.ts`, the shared pool).
- The container state/modal pattern: `FamilyPlanPage`'s `suggestingFor` PlanMeal state +
  conditional modal (`FamilyPlanPage.tsx:160`, `:235`, `:243-253`).
- The holder plan host: `LandingPage`'s plan section (`frontend/src/pages/LandingPage.tsx:285-302`,
  which today passes **no** per-meal callbacks) and its query key `['landing']` (the invalidation
  target — cf. `useAcceptSuggestion` `frontend/src/hooks/useAcceptSuggestion.ts:17-18`).

**Seeded actors:** holder `jessica@test.groceryhack.com`, family member `sam@test.groceryhack.com`
(password `testpassword123`), Jessica's current-week plan via `npm run seed:plans`.

## Scope

### In scope

**Backend — service** (`backend/src/services/family.ts`):
- `editPlanMeal(holderId, targetMealId, replacementMealId)`, a **sibling of `acceptSuggestion`**.
  Guard order:
  1. `getFamilyMemberLink(holderId)` → **403 `NOT_ACCOUNT_HOLDER`** if `link?.accountHolderId` is
     **non-null** (the caller is a family member). This is the exact inverse of the family-view
     guard (`family.ts:76-78`). A standalone/holder account (`accountHolderId === null`) passes.
  2. `getCurrentPlan(holderId)` → **404 `NO_PLAN`** if absent (same copy as `family.ts:267-269`).
  3. `planContainsMeal(plan, targetMealId)` → **400 `MEAL_NOT_IN_PLAN`** (reuse `family.ts:56-71`,
     as `suggestMeal` does at `:160-162`).
  4. `findMealForMatching(replacementMealId)` → **400 `INVALID_MEAL`** if null (as `family.ts:275-278`).
  Then **copy the gather + swap block verbatim** (`family.ts:280-303`) — deals/budget/remaining
  meals, `swapMealInPlan` once per representation, the `!newOneStore` → `NO_PLAN` guard. Persist
  via the new standalone update (below), **not** `acceptSuggestionTransaction` (which is
  suggestion-coupled — it flips `meal_suggestions.status`). Creates/touches **no** suggestion row.

**Backend — query** (`backend/src/db/queries/family.ts`):
- `updatePlanRepresentationsStandalone(planId, oneStore, twoStore)` — opens its own
  `pool.connect()` / `BEGIN` / `updatePlanRepresentations` / `COMMIT` (the existing
  `updatePlanRepresentations` at `:327-344` requires a `PoolClient`; `acceptSuggestionTransaction`
  at `:352-378` can't be reused because it also calls `markSuggestionAccepted`). It writes only
  `one_store_optimized` / `two_store_optimized`, preserving plan identity (token, week_of, …).
  _(Alternative: a plain non-transactional single `UPDATE` — see "Decisions to confirm" #4.)_

**Backend — route** (`backend/src/routes/family.ts`):
- `POST /api/v1/family/plan/edit` (`requireAuth`, `validate({ body: editPlanMealBody })`), mirroring
  the `POST /plan/suggestions` block (`routes/family.ts:74-88`). Calls
  `editPlanMeal(req.user!.userId, targetMealId, replacementMealId)`. Returns **200** (not 201 — no
  resource created) with the updated plan (see Decision #2).

**Backend — schema** (`backend/src/schemas/family.ts`):
- `editPlanMealBody` — a near-copy of `suggestMealBody` (`schemas/family.ts:4-12`): snake_case
  `{ target_meal_id: uuid, replacement_meal_id: uuid }` → camelCase, with `EditPlanMealInput =
  z.output<typeof editPlanMealBody>`.

**Frontend — shared renderer** (`frontend/src/components/StoreMealDealList.tsx`):
- Add optional prop `onEditMeal?: (meal: PlanMeal) => void` beside the existing callbacks
  (`lines 13-23`). When provided, render a **"Change meal"** pill in the same per-meal slots the
  "Suggest a swap" pill uses (the by-meal action panel and the View-All meal rows), reusing the
  already-resolved `PlanMeal`. Gated purely on the prop being passed — `LandingPage` passes it, the
  family view does not.

**Frontend — holder picker** (new `frontend/src/modals/ChangeMealModal.tsx`):
- A thin holder analogue of `SuggestSwapModal`: reuse the `ReplacementCard` swipe deck and
  `useMeals(isOpen)` candidate list, but the YUM/confirm action calls a new `useDirectEditMeal`
  mutation (below) instead of `useSuggestMeal`, with holder-facing copy ("Change … to" rather than
  "Suggest …"). _(Alternative: parameterize `SuggestSwapModal`'s submit action — see Decision #3.)_

**Frontend — mutation hook** (new `frontend/src/hooks/useDirectEditMeal.ts`):
- `POST /family/plan/edit` with `{ target_meal_id, replacement_meal_id }`; on success
  `invalidateQueries(['landing'])` so the holder plan re-renders with the swapped meal (mirrors
  `useAcceptSuggestion.ts:17-18`). It does **not** invalidate `['holderSuggestions']` (no
  suggestion involved).

**Frontend — holder page** (`frontend/src/pages/LandingPage.tsx`):
- Add `const [editingMeal, setEditingMeal] = useState<PlanMeal | null>(null)`; pass
  `onEditMeal={setEditingMeal}` into the `StoreMealDealList` instance (`:287-291`, which currently
  passes no per-meal callbacks); conditionally render `ChangeMealModal` with `targetMeal={editingMeal}`,
  mirroring `FamilyPlanPage`'s `suggestingFor` pattern.

**Frontend — family page** (`frontend/src/pages/FamilyPlanPage.tsx`):
- **No change.** Its *absence* of an `onEditMeal` callback and of any accept/dismiss control is the
  observable guarantee — the slice adds a verification (Chrome/e2e) asserting that absence, not code.

**API contract** (`api-contract.yaml`): document `POST /family/plan/edit` under the `Family` tag
(after `/family/plan/suggestions`, near `:1581`): request `{ target_meal_id, replacement_meal_id }`,
`200` → updated plan, `400 MEAL_NOT_IN_PLAN | INVALID_MEAL`, `401`, `403 NOT_ACCOUNT_HOLDER`,
`404 NO_PLAN`.

**Error codes** (`docs/architecture/error-codes.md`): add the `NOT_ACCOUNT_HOLDER | 403 | POST
/family/plan/edit` row to the Family section (`:131-143`). `NOT_SUGGESTION_HOLDER` (`:141`) already
documents the accept/dismiss family-member block — no change there.

**Tests** (`backend/src/services/family.test.ts`):
- New `describe('editPlanMeal')`: happy path (swaps target→replacement, persists via
  `updatePlanRepresentationsStandalone`, **asserts no `meal_suggestions` write** /
  `acceptSuggestionTransaction` not called); **403 `NOT_ACCOUNT_HOLDER` when the caller is a family
  member** (the primary new negative proof, asserting no plan mutation); 404 `NO_PLAN`; 400
  `MEAL_NOT_IN_PLAN`; 400 `INVALID_MEAL`; a target meal that only appears in the two-store
  representation is still swapped (mirror `family.test.ts:127`).
- **No new accept/dismiss guard test** — `family.test.ts:389-396` / `:480-487` already prove the
  family-member 403; keep them as the "cannot accept or dismiss" proof.

**Browser / live verification** (`backend/scripts/cdp.py` on `:9222`, per the WSL Chrome rule —
chrome-mcp does not apply; run the `debug-frontend` console check first):
- As Jessica on `/`: a "Change meal" affordance is present; using it swaps a meal and the plan
  section re-renders with the new meal + recomputed savings/list; no console errors.
- As Sam on `/family`: **no** "Change meal" control and **no** accept/dismiss control.
- Live 403s (logged in as Sam): `POST /family/plan/edit` → `403 NOT_ACCOUNT_HOLDER`;
  `POST /family/suggestions/:id/accept` and `…/dismiss` → `403 NOT_SUGGESTION_HOLDER` — the
  *observable* proof of the permission boundary, standard `{error,code,message}` shape.

### Out of scope (deferred)
- **Suggestion-row reconciliation on direct edit.** No scenario covers what happens to *open
  pending suggestions* for a meal the holder swaps out directly. Default (recommended): leave them
  untouched — direct edit flips no suggestion. (Benign consequence: if the holder later accepts a
  pending suggestion whose target meal was already swapped away, `swapMealInPlan`'s
  `containsTarget` no-op (`mealSwap.ts:286-289`) leaves the plan unchanged while the suggestion is
  marked accepted. Not corrupting; flag for product. See Decision #6.)
- **Client-side role gate** on the edit affordance. The codebase has zero frontend role checks;
  holder vs. family is route-based + backend-enforced, and the affordance only renders on `/`
  anyway. `User.accountHolderId` (`packages/shared/types.ts:191`) is available via `useAuth` if a
  belt-and-suspenders gate is ever wanted.
- **Store re-pick / full re-optimize.** Direct edit re-matches against the plan's existing stores
  only — identical to accept.
- **A new HTTP/supertest integration harness** for the 403s, if none already exists — the existing
  service unit tests plus the live `cdp.py`/`curl` 403 checks satisfy "provable" without standing up
  new test infrastructure. (See Decision #5.)
- **Any change to the eight scenarios already satisfied by Slices 1–7.**

### Decisions to confirm
1. **Endpoint path/verb.** Recommended: `POST /api/v1/family/plan/edit` (mirrors `POST
   /family/plan/suggestions`; holder actions already live under `/family/*`, e.g. accept/dismiss).
   _Alternative:_ a REST-ier `PATCH /plans/current/meals/:mealId` on a new `plans` route — but that
   strands the file-private reuse helpers and adds a route file. Confirm `POST /family/plan/edit`.
2. **Response shape.** Recommended: return the updated plan representations (`{ one_store_optimized,
   two_store_optimized }`) so the swap is directly assertable, while the hook still invalidates
   `['landing']` (keeping "one endpoint loads the landing page"). _Alternative:_ empty `200` + rely
   solely on `['landing']` invalidation. Confirm.
3. **Picker reuse.** Recommended: a thin new `ChangeMealModal` sharing `ReplacementCard` + `useMeals`.
   _Alternative:_ parameterize `SuggestSwapModal` (it hard-codes `useSuggestMeal` at `:65` and
   "Suggest a replacement" copy) — riskier (could accidentally submit a suggestion). Confirm.
4. **Persistence.** Recommended: `updatePlanRepresentationsStandalone` (own `BEGIN`/`COMMIT`, style
   parity with `acceptSuggestionTransaction`). _Alternative:_ a plain single `UPDATE` (no tx needed
   for one statement). Confirm.
5. **"Provable" bar for the accept/dismiss 403.** Recommended: lean on the existing service unit
   tests + a live `cdp.py`/`curl` 403 check + UI absence. _Alternative:_ add an HTTP-level
   integration test (only if/when a route-test harness exists). Confirm.
6. **Stale pending suggestions after a direct edit.** Recommended: leave untouched (MVP). _Alternative:_
   auto-dismiss suggestions whose target meal the holder just swapped out. Confirm.

### Demo data note
`npm run seed && npm run seed:plans` gives Jessica a current-week plan and one pending Sam→Jessica
suggestion. Demo direct edit logged in as **Jessica** on `/` (Change meal → pick a replacement → plan
re-renders). Demo the negatives logged in as **Sam**: the `/family` view shows only "Suggest a swap"
and "My Suggestions" (no edit, no accept/dismiss), and the three live endpoints return 403.

## Acceptance criteria
- [ ] `POST /api/v1/family/plan/edit` authenticated as **Jessica** (holder) with
      `{ target_meal_id, replacement_meal_id }` swaps the target meal for the replacement in her
      current-week plan, re-matches the replacement against deals at the plan's existing store(s),
      recomputes per-meal cost/savings, stop subtotals, plan total, `estimatedSavings`, and the
      `forMeal` shopping items across **both** the one- and two-store representations, and persists —
      with **no `meal_suggestions` row created or modified**.
- [ ] The same call authenticated as **Sam** (a linked family member) returns **403
      `NOT_ACCOUNT_HOLDER`** and mutates nothing.
- [ ] `POST /family/suggestions/:id/accept` and `…/dismiss` authenticated as **Sam** return **403**
      (`NOT_SUGGESTION_HOLDER`) from the running endpoint — observable, not only in unit tests.
- [ ] Error cases use the standard `{error,code,message}` shape: 404 `NO_PLAN` (holder has no
      current-week plan), 400 `MEAL_NOT_IN_PLAN` (target not in plan), 400 `INVALID_MEAL`
      (replacement missing).
- [ ] In Chrome (no console errors, via `cdp.py`): on `/` as Jessica each plan meal shows a
      **"Change meal"** affordance; using it opens the picker, choosing a replacement applies the
      swap and the plan section re-renders with the new meal and updated savings/list (no full page
      reload — `['landing']` invalidation). On `/family` as Sam there is **no** "Change meal" control
      and **no** accept/dismiss control.
- [ ] `backend` and `frontend` `tsc --noEmit` pass and `backend` `npm test` is green (including the
      new `editPlanMeal` block); no new **domain** type is added (the swap reuses
      `GroceryPlan`/`WeeklyPlan`/`PlanMeal` from `packages/shared/types.ts`); `api-contract.yaml`
      documents `POST /family/plan/edit`; `docs/architecture/error-codes.md` lists `NOT_ACCOUNT_HOLDER`.
- [ ] **Feature complete:** all 11 Gherkin scenarios pass end-to-end in the browser, and the only
      plan mutation a family member can cause is via an **accepted** suggestion.
