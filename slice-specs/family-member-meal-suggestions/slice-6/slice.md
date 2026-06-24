# Slice 6: Account holder dismisses a suggestion

> **Status:** APPROVED — 2026-06-24

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
On the holder's existing **Pending Suggestions** review surface (the
`ReviewSuggestionsModal` from Slices 4–5, opened from the landing page), each pending
suggestion now has a **Dismiss** action alongside the Slice-5 **Accept**. Dismissing a
suggestion marks it `dismissed` and **leaves the account holder's plan completely
unchanged** — no swap, no re-match, no shopping-list or savings change. The dismissed
suggestion leaves the holder's pending list, the "Suggestions (N)" badge drops by one,
and (because the family member's plan view only surfaces *pending* markers) the
suggestion stops showing as a pending marker on their `GET /family/plan`. This is the
negative half of the review loop: the holder can now reject input as cleanly as they can
accept it, and rejecting it is provably inert on the plan.

## Gherkin coverage

**Scenario: Account holder dismisses a suggestion** — *full for the plan-unchanged +
marked-dismissed Thens, partial for the family-member-visibility Then*:
- ✅ "When I dismiss that suggestion / Then the meal plan is unchanged" — `dismissSuggestion`
  only flips `meal_suggestions.status`; it never loads, re-matches, or writes
  `weekly_plans`. The plan JSONB is byte-identical before and after.
- ✅ "And the suggestion is marked as dismissed" — `meal_suggestions.status` → `'dismissed'`
  (already permitted by the `CHECK` constraint), so it leaves the holder's pending list and
  drops out of `pending_suggestion_count`.
- ◐ "And the family member can see that their suggestion was dismissed" — the `dismissed`
  status is now **persisted and true in the data** (and the suggestion disappears from the
  family member's pending markers on `GET /family/plan`, whose query is pending-only), but
  the family member's explicit **"My Suggestions" status view** that renders the word
  *dismissed* to the suggester is **Slice 7**. This slice makes the fact true; Slice 7 makes
  it visible. (Same split Slice 5 used for *accepted*.)

No other scenario is completed here. The explicit **403** for a *family member* attempting to
dismiss is added as a guard here (reusing the Slice-5 holder check) but made *observable and
tested* in **Slice 8**, together with the family-member "cannot accept or dismiss" scenario.

## Dependencies
Slices 1–5. Specifically:
- The `meal_suggestions` table and its `CHECK (status IN ('pending','accepted','dismissed'))`
  already allow `dismissed` (`backend/src/db/migrations/007_add_meal_suggestions.sql:13-14`,
  mirrored at `schema.sql:379`) — **no new migration is needed**.
- The holder review surface and its plumbing, all built in Slices 4–5:
  `ReviewSuggestionsModal` (`frontend/src/modals/ReviewSuggestionsModal.tsx`),
  `useHolderSuggestions` (`frontend/src/hooks/useHolderSuggestions.ts`),
  `GET /family/suggestions` → `getHolderSuggestions` (`backend/src/routes/family.ts:21`,
  `backend/src/services/family.ts:101`), and the `pending_suggestion_count` on `/landing`.
- The Slice-5 accept path is the exact template to mirror, minus the swap:
  `acceptSuggestion` (`backend/src/services/family.ts:216`), `getSuggestionById` +
  `markSuggestionAccepted` (`backend/src/db/queries/family.ts:212,238`),
  `acceptSuggestionParams` (`backend/src/schemas/family.ts:15`), the
  `POST /suggestions/:id/accept` route (`backend/src/routes/family.ts:31`), and
  `useAcceptSuggestion` (`frontend/src/hooks/useAcceptSuggestion.ts`).
- The seeded pending Sam→Jessica suggestion (`backend/src/db/seedPlans.ts`) gives a
  deterministic row to dismiss after `npm run seed && npm run seed:plans`. (It seeds **one**
  pending suggestion; accepting *or* dismissing it consumes it, so re-seed to demo the other.)

## Scope

### In scope

**Backend — query** (`backend/src/db/queries/family.ts`):
- `dismissSuggestion(id)` → race-safe single-statement
  `UPDATE meal_suggestions SET status='dismissed' WHERE id=$1 AND status='pending'
  RETURNING …`, re-joined to `suggester_name` / `replacement_meal_name` / `target_meal_name`
  and mapped through the existing `mapSuggestionRow`, so it returns the same snake_case
  `MealSuggestion` shape (now `status:"dismissed"`). Returns `null` if the row was not pending
  (already accepted/dismissed) → the service maps that to 409. **No transaction and no
  `PoolClient`** — unlike `markSuggestionAccepted`, there is no second write to keep atomic, so
  this runs directly on `pool` (mirrors `markSuggestionAccepted`'s SQL but on the pool).

**Backend — service entry** (`backend/src/services/family.ts`):
- `dismissSuggestion(holderId, suggestionId)`, structurally the first half of
  `acceptSuggestion` with **no plan loading and no swap**:
  1. Load the suggestion (`getSuggestionById`). **404 `SUGGESTION_NOT_FOUND`** if missing.
  2. **Authorization guard:** `suggestion.accountHolderId === holderId`, else **403
     `NOT_SUGGESTION_HOLDER`** (a family member's id is never an `account_holder_id`, so this
     blocks them from dismissing; Slice 8 makes that negative case observable/tested).
  3. Status must be `'pending'`, else **409 `SUGGESTION_NOT_PENDING`** (idempotent / race-safe).
  4. Call the query; if it returns `null` (lost a race — another accept/dismiss flipped it
     first), throw the same **409 `SUGGESTION_NOT_PENDING`**. Otherwise return the updated row.
  - Deliberately **omits** the `NO_PLAN` / `PLAN_CHANGED` guards that accept needs — dismiss
    never touches `weekly_plans`, so there is nothing to guard. (A suggestion against a stale
    week can still be dismissed; that's correct — it just clears it out.)

**Backend — route** (`backend/src/routes/family.ts`):
- `POST /api/v1/family/suggestions/:id/dismiss` (`requireAuth`, `validate({ params })`):
  `res.json(await dismissSuggestion(req.user!.userId, req.params.id))`. Mirrors the accept
  route block at `routes/family.ts:31-44`.

**Backend — schema** (`backend/src/schemas/family.ts`):
- The params are an identical `{ id: uuid }`. **Recommended:** reuse the existing
  `acceptSuggestionParams` for the dismiss route too (it is structurally identical; the name
  is cosmetic), avoiding a re-touch of approved Slice-5 code. _Alternative (see "Decision to
  confirm"):_ rename it to a neutral `suggestionIdParams` shared by both routes, or add a
  parallel `dismissSuggestionParams`.

**Frontend — mutation hook** (new `frontend/src/hooks/useDismissSuggestion.ts`):
- Exact mirror of `useAcceptSuggestion`: `useMutation` → `api.post('/family/suggestions/${id}/dismiss')`;
  on success `invalidateQueries(['holderSuggestions'])` **and** `invalidateQueries(['landing'])`
  so the dismissed card disappears and the "Suggestions (N)" badge decrements. Variable is the
  suggestion id.

**Frontend — review modal** (`frontend/src/modals/ReviewSuggestionsModal.tsx`):
- Add a **Dismiss** button to each `ReviewCard`, beside the existing Accept. Styling: a
  **secondary / ghost** pill (transparent or `white` bg, `border`, `textMuted` text) — *not*
  `danger` red: dismissing is a neutral "no thanks", not a destructive/error action, and the
  design system reserves `danger` for deletes/errors (see "Decision to confirm").
- Wire it to `useDismissSuggestion` with the same per-card in-flight pattern Accept uses
  (`acceptMutation.variables` → `acceptingId`): track a `dismissingId`, show a spinner + the
  label "Dismissing…" on that one card, and **disable both buttons on a card while *either*
  mutation is in flight for it** so a holder can't accept-and-dismiss the same suggestion.
- Success toast ("Dismissed {replacement} — your plan is unchanged"); error toast on failure.
  The info banner copy already present ("…Dismissing leaves your plan unchanged.") now
  describes a live action.

**API contract** (`api-contract.yaml`): document `POST /family/suggestions/{id}/dismiss` under
the `Family` tag — `200` returning the updated `MealSuggestion` (`status:"dismissed"`), plus the
`403 NOT_SUGGESTION_HOLDER` / `404 SUGGESTION_NOT_FOUND` / `409 SUGGESTION_NOT_PENDING` error
cases. Mirror the accept entry added in Slice 5.

**Conventions:** snake_case wire ↔ camelCase internal, named exports, explicit return types,
parameterized SQL, all domain types from `packages/shared/types.ts` (the response is the
existing `MealSuggestion` — no new type). Validate in Chrome via `backend/scripts/cdp.py` on
`:9222` (WSL — chrome-mcp does not apply) before marking complete; check the console first per
the `debug-frontend` flow.

### Out of scope (deferred)
- **Any plan mutation** on dismiss — there is intentionally none; the swap service stays an
  accept-only path (Slices 5 / 8).
- The family member's **"My Suggestions"** status view that renders *dismissed* (and *accepted*)
  to the suggester → **Slice 7**. This slice only persists the status and removes the pending
  marker.
- The **provable / tested negative cases** — a family member gets **403** on dismiss, and the
  "A family member cannot review or act on suggestions" scenario → **Slice 8**. The 403 guard is
  *written* here; Slice 8 makes it observable and adds the test.
- The account holder's **direct meal edit** (no suggestion) → **Slice 8**.
- **Cleanup of other now-stale pending suggestions.** Dismiss only flips the one row; it does
  not touch other family members' pending suggestions on the same meal. (Consistent with the
  Slice-5 decision to leave them pending for MVP.)

### Decision to confirm
1. **Endpoint shape.** Recommended: `POST /family/suggestions/:id/dismiss` (an explicit action
   verb, parallel to the Slice-5 accept, returning the updated `MealSuggestion`). _Alternative:_
   `PATCH /family/suggestions/:id` with `{ status: 'dismissed' }` (more RESTful but invites
   arbitrary status writes the service must reject, and Slice 5 already set the action-POST
   precedent). Confirm the action-style POST.
2. **Params schema.** Recommended: reuse `acceptSuggestionParams` for both routes (identical
   `{ id: uuid }`; no re-touch of approved code). _Alternative:_ rename it to a neutral
   `suggestionIdParams`. Confirm reuse-as-is vs. rename.
3. **Dismiss button style.** Recommended: a **neutral/ghost** secondary pill (not `danger`
   red), since dismiss is non-destructive and the design system reserves red for
   deletes/errors. _Alternative:_ red/`danger` to read as a harder reject. Confirm neutral.

## Acceptance criteria
- [ ] `POST /api/v1/family/suggestions/:id/dismiss` authenticated as **Jessica**, for the
      seeded pending Sam→Jessica suggestion, returns the suggestion with `status:"dismissed"`
      and flips the row to `dismissed` in `meal_suggestions`.
- [ ] After dismissing, Jessica's `weekly_plans` row is **unchanged** — `one_store_optimized`
      and `two_store_optimized` are byte-identical to before the call (no meal swapped, no
      shopping-list / subtotal / total / `estimatedSavings` change).
- [ ] `GET /api/v1/family/suggestions` as Jessica no longer returns the dismissed suggestion,
      and `GET /api/v1/landing` as Jessica shows `pending_suggestion_count` decreased by one.
- [ ] `GET /api/v1/family/plan` as **Sam** no longer lists the dismissed suggestion among
      `pending_suggestions` (its pending marker is gone), since that query is pending-only.
- [ ] Authorization: dismissing a suggestion **not** addressed to the caller returns `403
      NOT_SUGGESTION_HOLDER`; dismissing a missing id returns `404 SUGGESTION_NOT_FOUND`;
      dismissing an already-accepted/dismissed suggestion returns `409 SUGGESTION_NOT_PENDING`.
      All errors use the standard `{error,code,message}` shape.
- [ ] In Chrome (no console errors, validated via `cdp.py`): logged in as
      `jessica@test.groceryhack.com`, opening **Pending Suggestions** shows an **Accept** and a
      **Dismiss** button per card; clicking **Dismiss** removes that card, the "Suggestions (N)"
      badge drops, and the landing plan section is **unchanged**. Both buttons on a card disable
      while either action is in flight.
- [ ] `api-contract.yaml` documents the dismiss endpoint and its error cases; `backend` and
      `frontend` `tsc --noEmit` pass; all domain types come from `packages/shared/types.ts`.
