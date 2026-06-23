# Slice 4: Account holder reviews pending suggestions

> **Status:** APPROVED — 2026-06-23

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
The account holder (Jessica), on her existing landing page (`/`), can open a
**"Pending Suggestions"** review surface and see every pending meal-swap suggestion her
family members have submitted. Each one shows **who suggested it** (name + how long ago),
the **replacement meal**, and **the meal it would replace** ("Replaces _{meal}_ in this
week's plan") — matching the mockup's **Screen 7** (`mockups/groceryhack-mockups.html:1168`).
This is the first time the *holder's* side of the loop becomes observable: until now
suggestions could only be written (Slice 2) and viewed by the suggester (Slice 3). The
surface is **read-only** this slice — Accept (Slice 5) and Dismiss (Slice 6) add the
actions; here the holder can only *see* what's pending.

## Gherkin coverage

**Scenario: Account holder views pending suggestions** — *full*:
- ✅ "Given a family member has submitted one or more suggestions / When I view my
  pending suggestions / Then I see each suggestion, the meal it would replace, and who
  suggested it." — the review modal lists each pending suggestion with replacement meal,
  the target meal it replaces, and the suggester's name.

No other scenario is completed here. **Account holder accepts** (Slice 5) and **dismisses**
(Slice 6) build the actions on top of this surface; the family member's **status view**
(Slice 7) and the explicit **permission 403s** (Slice 8) remain deferred.

## Dependencies
Slices 1–3 — the `users.account_holder_id` link (migration 006), the `meal_suggestions`
table (migrations 007/008), the `suggestMeal` write path, and the `MealSuggestion` shared
type (with `replacementMealName` / `targetMealName` / `createdAt` / `status`) must all
exist. This slice only adds a holder-scoped **read** over data Slices 2–3 already write.

## Scope

### In scope

**Shared types** (`packages/shared/types.ts`):
- Add an optional denormalised display field `suggesterName?: string | null` to the
  existing `MealSuggestion` interface — joined from the suggester's `users.display_name`,
  consistent with the existing `replacementMealName` / `targetMealName` denormalised
  fields. (Family-member queries from Slices 2–3 simply leave it unset; the holder read
  populates it.) _Alternative considered: a separate `HolderSuggestion` type — rejected to
  avoid duplicating a near-identical shape; see "Decision to confirm."_
- Add response type `HolderSuggestionsResponse { suggestions: MealSuggestion[] }`
  (wire shape: `{ suggestions: [...] }`, snake_case on the wire).
- Add `pendingSuggestionCount: number` to the `LandingPage` interface — the count of
  pending suggestions addressed to the logged-in holder, so the landing page can render
  the review entry point **without a second request** (honours the "one endpoint loads
  the landing page" rule; the count rides on the existing `/landing` response).

**Backend — queries** (`backend/src/db/queries/family.ts`):
- Extend `mapSuggestionRow` to carry `suggester_name` (`(row.suggester_name as string | null) ?? null`).
- `getHolderPendingSuggestions(accountHolderId)` → all `status = 'pending'` rows where
  `account_holder_id = $1`, joined to `suggester` (`su.display_name AS suggester_name`),
  the replacement meal (`rm.name`) and target meal (`LEFT JOIN … tm.name`), newest first.
  Returns snake_case objects via `mapSuggestionRow`.
- `countHolderPendingSuggestions(accountHolderId)` → `SELECT count(*)::int … WHERE
  account_holder_id = $1 AND status = 'pending'`, returning a `number`. Backs the landing
  badge.

**Backend — service** (`backend/src/services/family.ts`):
- `getHolderSuggestions(holderId)` → returns `{ suggestions: await getHolderPendingSuggestions(holderId) }`.
  No family-member-link lookup is needed: the caller *is* the holder, so we query by
  `account_holder_id = caller`. A family member calling it naturally gets `[]` (their id is
  never an `account_holder_id`); the explicit `403` for that case is deferred to **Slice 8**
  per the roadmap, which keeps authorization-hardening in one place.

**Backend — landing** (`backend/src/services/landing.ts`):
- Add `countHolderPendingSuggestions(userId)` (imported from `db/queries/family.js`) to the
  existing `Promise.all`, and include `pending_suggestion_count` in `LandingPageResponse`
  and the returned object.

**Backend — route** (`backend/src/routes/family.ts`):
- `GET /api/v1/family/suggestions` (`requireAuth`): `res.json(await getHolderSuggestions(req.user!.userId))`.

**Seed — demo data** so the holder's panel has deterministic content after a fresh
`npm run seed && npm run seed:plans` (the seed currently creates **no** suggestions):
- In `backend/src/db/seedPlans.ts`, **after** Jessica's plan is generated (so the
  `weekly_plans` id and a real `PlanMeal.mealId` are known), insert **one** pending
  `meal_suggestions` row: `suggester_id` = Sam, `account_holder_id` = Jessica,
  `weekly_plan_id` = Jessica's new plan, `target_meal_id` = the first meal in that plan's
  `one_store_optimized.stops[].meals[]`, `replacement_meal_id` = any other shared meal not
  already in the plan. Idempotent (skip if a pending row already exists for that
  suggester+plan+meal, which the Slice-3 partial-unique index also guarantees).
  _(The live create→review loop — Sam suggests via the Slice-2 modal, Jessica reviews — also
  works and is the more end-to-end demo; the seed just makes Chrome verification repeatable.)_

**Frontend — service / hook**:
- `frontend/src/services/api.ts`: no change needed if the modal uses the generic
  `api.get`; otherwise add a typed `getHolderSuggestions()` helper.
- New `frontend/src/hooks/useHolderSuggestions.ts`: `useQuery<HolderSuggestionsResponse>({
  queryKey: ['holderSuggestions'], queryFn: () => api.get('/family/suggestions') })`.
  (Slices 5/6 will invalidate this key after accept/dismiss.)

**Frontend — modal** (new `frontend/src/modals/ReviewSuggestionsModal.tsx`):
- Props: `{ isOpen, onClose, holderName: string }`. Built on the existing `ModalOverlay`
  centered-dialog pattern (same as `PendingSuggestionModal`), titled **"Pending Suggestions"**
  with the sub-line "Meal swaps suggested by your family members."
- Fetches via `useHolderSuggestions`; renders one **review card** per suggestion (Screen 7):
  an avatar with the suggester's initials, "{suggesterName} · suggested {relative time from
  `createdAt`}", the replacement meal name (bold, Sora), and "Replaces _{targetMealName ??
  'a meal'}_ in this week's plan". Colors/spacing from `theme/tokens` matching the mockup's
  `.review-card` / `.review-who` / `.review-new` / `.review-replace`.
- Footer info banner: "Accepting swaps the meal in your plan. Dismissing leaves your plan
  unchanged." (verbatim from the mockup) — present as guidance even though the actions
  themselves arrive in Slices 5–6.
- States: loading spinner while fetching; an empty state "No pending suggestions right
  now."; an error toast/message on failure.
- **No Accept/Dismiss buttons this slice** (read-only review). See "Decision to confirm."

**Frontend — LandingPage** (`frontend/src/pages/LandingPage.tsx`):
- Add `reviewSuggestionsOpen` state.
- When `data.pendingSuggestionCount > 0`, render a **"Suggestions (N)"** entry in the
  action bar (alongside "My Staples", same pill styling) that opens the modal. Hidden when
  the count is 0, so users with no pending suggestions (incl. non-holders) see nothing new.
- Render `<ReviewSuggestionsModal isOpen={reviewSuggestionsOpen} onClose={…}
  holderName={data.user.displayName} />`.

**API contract** (`api-contract.yaml`):
- Add `GET /family/suggestions` under the existing `Family` tag, returning
  `HolderSuggestionsResponse`.
- Add `suggester_name` to the `MealSuggestion` schema and `pending_suggestion_count` to the
  landing response schema.

- New types/queries follow CLAUDE.md conventions (snake_case wire ↔ camelCase internal,
  named exports, explicit return types, parameterized SQL, all domain types from
  `packages/shared/types.ts`). Validate in Chrome via `backend/scripts/cdp.py` on `:9222`
  (WSL — chrome-mcp does not apply) before marking complete.

### Out of scope (deferred)
- **Accept** a suggestion → swaps the meal, re-matches deals, recomputes costs/savings,
  marks `accepted` → **Slice 5** (introduces the meal-swap service).
- **Dismiss** a suggestion → marks `dismissed`, plan unchanged → **Slice 6**.
- The family member's **"My Suggestions"** status view (all statuses) → **Slice 7**.
- Explicit **`403`** when a family member hits `GET /family/suggestions` (or accept/dismiss),
  and the provable "family member cannot edit / cannot act" cases → **Slice 8**.
- A header **bell + unread badge** like the mockup's Screen-7 chrome — the action-bar
  "Suggestions (N)" entry is sufficient to discover and open the surface; a dedicated bell
  is polish, not required by the scenario.

### Decision to confirm
1. **Review-surface entry point.** Recommended: a **"Suggestions (N)" action-bar button on
   the existing landing page**, shown only when `pendingSuggestionCount > 0` (count returned
   on `/landing`), opening a `ReviewSuggestionsModal`. _Alternative:_ an always-visible
   entry (no landing-count change, thinner) that everyone sees and that shows an empty state
   for holders with nothing pending — simpler but noisier and not faithful to the mockup's
   "you have suggestions to review" badge. Confirm the count-gated entry, or pick the
   always-on alternative.
2. **Read-only vs. inert actions.** Recommended: render the review cards with **no
   Accept/Dismiss buttons** this slice (the actions land wired-up in Slices 5/6), so nothing
   on screen is dead. _Alternative:_ show disabled Accept/Dismiss placeholders now. Confirm
   omitting them.
3. **`suggesterName` on `MealSuggestion` vs. a new `HolderSuggestion` type.** Recommended:
   extend `MealSuggestion` with optional `suggesterName` (matches the existing denormalised
   display-field pattern). _Alternative:_ a dedicated `HolderSuggestion` interface. Confirm
   the extend approach.

## Acceptance criteria
- [ ] `GET /api/v1/family/suggestions` authenticated as **Jessica** returns
      `{ suggestions: [...] }` containing every *pending* suggestion addressed to her, each
      with `suggester_name`, `replacement_meal_name`, `target_meal_name`, `status:"pending"`,
      and `created_at` (snake_case). Accepted/dismissed rows are excluded.
- [ ] After `npm run seed && npm run seed:plans`, at least one pending suggestion from
      **Sam → Jessica** exists, referencing a real meal in Jessica's current-week plan;
      `backend tsc --noEmit` passes and the seed is idempotent on re-run.
- [ ] `GET /api/v1/landing` as Jessica includes `pending_suggestion_count` ≥ 1; as a user
      with no pending suggestions it is `0`.
- [ ] In Chrome (no console errors, validated via `cdp.py`): logged in as
      `jessica@test.groceryhack.com`, the landing page shows a **"Suggestions (N)"** entry;
      clicking it opens the review modal listing each pending suggestion with the
      **suggester's name + when**, the **replacement meal**, and **"Replaces {meal} in this
      week's plan"**. The modal is read-only (no Accept/Dismiss controls).
- [ ] A holder with zero pending suggestions sees **no** "Suggestions" entry on the landing
      page (count-gated); opening the modal in that state (if forced) shows the empty state.
- [ ] Jessica's `weekly_plans` row is unchanged by viewing — this surface performs no writes.
- [ ] `api-contract.yaml` documents `GET /family/suggestions` and the new
      `suggester_name` / `pending_suggestion_count` fields; `backend`/`frontend`
      `tsc --noEmit` pass; all domain types come from `packages/shared/types.ts`.
