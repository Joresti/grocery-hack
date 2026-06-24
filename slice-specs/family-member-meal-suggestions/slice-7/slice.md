# Slice 7: Family member tracks suggestion status

> **Status:** APPROVED — 2026-06-24

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
The family member gets a **"My Suggestions"** view on the `/family` page: a modal that
lists every suggestion they have made on the account holder's current-week plan, each
with a **status chip** — *Pending* (amber), *Accepted* (green), or *Dismissed* (neutral
grey). This closes the feedback loop opened in Slices 5–6: when Jessica accepts or
dismisses one of Sam's suggestions, Sam can now *see* the outcome rendered as a word, not
just have it be true in the database. The view is read-only by construction — it has the
suggester's own suggestions and **no accept/dismiss controls** (the family member can see
status but cannot act on it). The account holder's plan is never touched by anything in
this slice.

## Gherkin coverage

**Scenario: Family member views the status of their suggestions** — *full*:
- ✅ "When I view my suggestions / Then I see each suggestion with its current status" — the
  `MySuggestionsModal` lists each of the caller's suggestions for the holder's current plan
  (target → replacement), each carrying its `status`.
- ✅ "And the status is one of: pending, accepted, or dismissed" — every row renders a status
  chip driven by `MealSuggestion.status` (`MealSuggestionStatus = 'pending' | 'accepted' |
  'dismissed'`, `packages/shared/types.ts:23`); the new read returns **all** statuses, not
  pending-only.

**Completes two deferred "And" Thens from earlier slices** (the data was made true there; this
slice makes it *visible to the suggester*):
- ✅ Scenario "Account holder accepts a suggestion" → "And the family member can see that their
  suggestion was accepted" — deferred from Slice 5 (`slice-5/slice.md`), now rendered as an
  *Accepted* chip.
- ✅ Scenario "Account holder dismisses a suggestion" → "And the family member can see that their
  suggestion was dismissed" — deferred from Slice 6 (`slice-6/slice.md`), now rendered as a
  *Dismissed* chip.

**Scenario: A family member cannot review or act on suggestions** — *partial (the "can see
status" half)*:
- ✅ "When I view my suggestions / Then I can see their status" — satisfied by this view.
- ◐ "But I cannot accept or dismiss any suggestion" — the My Suggestions view simply has **no
  accept/dismiss controls** (observable by their absence), but the **provable, tested 403** when
  a family member calls the holder-only accept/dismiss endpoints directly is **Slice 8**. This
  slice makes "can see status" true; Slice 8 makes "cannot act" provable.

No other scenario is completed here. No new plan mutation, no permission endpoint, no direct edit.

## Dependencies
Slices 1–6. Specifically:
- The family-member identity + link and the `/family` page they land on:
  `FamilyPlanPage` (`frontend/src/pages/FamilyPlanPage.tsx`), `useFamilyPlan`
  (`frontend/src/hooks/useFamilyPlan.ts`), `getFamilyPlan` /
  `getFamilyMemberLink` (`backend/src/services/family.ts:68`,
  `backend/src/db/queries/family.ts:44`).
- The `meal_suggestions` table already stores all three statuses
  (`backend/src/db/migrations/007_add_meal_suggestions.sql`, mirrored at `schema.sql:379`) —
  **no new migration is needed**. Slices 5–6 already write `accepted` / `dismissed` rows.
- The `MealSuggestion` shared type and its denormalised display fields
  (`packages/shared/types.ts:784`) — the response reuses it as-is; **no new domain type**.
- The holder-side read is the exact template to mirror: `getHolderPendingSuggestions`
  (`backend/src/db/queries/family.ts:158`) → `getHolderSuggestions`
  (`backend/src/services/family.ts:102`) → `GET /family/suggestions`
  (`backend/src/routes/family.ts:21`) → `useHolderSuggestions`
  (`frontend/src/hooks/useHolderSuggestions.ts`) → `ReviewSuggestionsModal`
  (`frontend/src/modals/ReviewSuggestionsModal.tsx`). This slice builds the family-member
  mirror of that chain, minus the action buttons, plus accepted/dismissed chips.
- The seeded **Sam → Jessica** suggestion (`backend/src/db/seedPlans.ts:22`) gives a deterministic
  row; the live accept/dismiss flows from Slices 5–6 turn it into accepted/dismissed for the demo.
  Family member = `sam@test.groceryhack.com`; holder = `jessica@test.groceryhack.com`.

## Scope

### In scope

**Backend — query** (`backend/src/db/queries/family.ts`):
- `getAllMySuggestionsForPlan(suggesterId, weeklyPlanId)` → the suggester's suggestions for one
  plan **in every status**, newest first, mapped through the existing `mapSuggestionRow`. It is
  `getMySuggestionsForPlan` (`queries/family.ts:99`) **minus the `AND s.status = 'pending'`
  filter**. It is a *separate* query — `getMySuggestionsForPlan` must stay pending-only, because
  `GET /family/plan` uses it to render the plan's "Suggestion pending" markers, and folding
  accepted/dismissed rows into that would mis-mark swapped/rejected meals as still pending.
  (Optional: also `LEFT JOIN users su ON su.id = s.suggester_id` to populate `suggester_name`
  for shape-parity with the holder read; not required since the suggester is the caller.)

**Backend — service entry** (`backend/src/services/family.ts`):
- `getMySuggestions(userId)`, structured like `getFamilyPlan` (`services/family.ts:68`):
  1. `getFamilyMemberLink(userId)`; **403 `NOT_A_FAMILY_MEMBER`** if not linked to a holder
     (same guard/copy the plan view uses — a holder calling this isn't a family member).
  2. `getCurrentPlan(holderId)`; **404 `NO_PLAN`** if the holder has no current-week plan.
  3. Return `{ suggestions: await getAllMySuggestionsForPlan(userId, plan.id) }`.

**Backend — route** (`backend/src/routes/family.ts`):
- `GET /api/v1/family/my-suggestions` (`requireAuth`): `res.json(await getMySuggestions(req.user!.userId))`.
  Mirrors the `GET /family/suggestions` block (`routes/family.ts:21`). No params/body to validate.

**Shared type** (`packages/shared/types.ts`):
- `MySuggestionsResponse { suggestions: MealSuggestion[] }` — the family-member analogue of the
  existing `HolderSuggestionsResponse` (`types.ts:810`). Distinct name because the semantics
  differ (the caller's *own* suggestions, all statuses, `suggesterName` unused) even though the
  shape matches. _Alternative (see "Decision to confirm"):_ reuse `HolderSuggestionsResponse`.

**Frontend — query hook** (new `frontend/src/hooks/useMySuggestions.ts`):
- `useMySuggestions(enabled)` → `useQuery(['mySuggestions'], () => api.get<MySuggestionsResponse>('/family/my-suggestions'), { enabled })`.
  Exact mirror of `useHolderSuggestions`; `enabled` so it fetches only when the modal opens.
- Wire freshness: add `['mySuggestions']` to the `useSuggestMeal` `onSuccess` invalidation
  (`frontend/src/hooks/useFamilyPlan.ts:25`, currently invalidates only `['familyPlan']`) so a
  newly-submitted suggestion appears the next time the modal opens.

**Frontend — modal** (new `frontend/src/modals/MySuggestionsModal.tsx`):
- Built on `ModalOverlay` (title e.g. "My Suggestions"), driven by `useMySuggestions(isOpen)`.
- One row per suggestion: "**{replacementMealName}** to replace **{targetMealName ?? 'this
  meal'}**" plus a **status chip**. **No accept/dismiss buttons** — read-only by construction
  (the family member can see status but cannot act).
- Status chip — three variants, reusing existing design tokens:
  - **Pending** — amber, matching the chip already in `PendingSuggestionModal`
    (`frontend/src/modals/PendingSuggestionModal.tsx:37`, `#FBEEDB` bg / `#9A6A12` text) and the
    plan's pending markers.
  - **Accepted** — green, using `greenBadgeBg` (`#E6F4EA`) / `greenBadgeText` (`#1A7F37`) /
    `success`.
  - **Dismissed** — **neutral** grey (`primaryLight`/`border` bg, `textMuted` text), **not**
    `danger` red — consistent with Slice 6's decision that dismiss is a neutral "no thanks", not
    a destructive/error action (the design system reserves red for deletes/errors).
- Loading and empty states: a spinner while fetching; an empty line ("You haven't suggested any
  swaps yet.") when the list is empty.

**Frontend — page** (`frontend/src/pages/FamilyPlanPage.tsx`):
- Add a **"My Suggestions"** button (pill/secondary, near the role pill + banner) that opens the
  `MySuggestionsModal` (`const [mySuggestionsOpen, setMySuggestionsOpen] = useState(false)`).
  This is the family-member analogue of the holder's "Suggestions (N)" landing entry, without a
  count badge (no count is required by the scenario; keep it thin).

**API contract** (`api-contract.yaml`): document `GET /family/my-suggestions` under the `Family`
tag — `200` returning `MySuggestionsResponse` (add the schema, or `$ref` `HolderSuggestionsResponse`
if reused), plus the `403 NOT_A_FAMILY_MEMBER` / `404 NO_PLAN` error cases. Mirror the `/family/plan`
and `/family/suggestions` entries (`api-contract.yaml:1398`, `:1428`).

**Conventions:** snake_case wire ↔ camelCase internal, named exports (default export only for the
page component), explicit return types, parameterized SQL, all domain types from
`packages/shared/types.ts` (the row is the existing `MealSuggestion`). Validate in Chrome via
`backend/scripts/cdp.py` on `:9222` (WSL — chrome-mcp does not apply); check the console first per
the `debug-frontend` flow before marking complete.

### Out of scope (deferred)
- **The provable / tested "cannot accept or dismiss" negative** — a family member gets **403** on
  the holder-only accept/dismiss endpoints, completing "A family member cannot review or act on
  suggestions" → **Slice 8**. This slice satisfies that scenario's "can see status" half only.
- The account holder's **direct meal edit** (no suggestion) → **Slice 8**.
- **Any plan mutation.** This is a pure read; the swap service stays an accept-only path.
- **A count badge / unread indicator** for the family member (e.g. "accepted since you last
  looked"). Not required by the scenario; the button opens the list on demand.
- **Cross-week / all-time history.** The view is scoped to the holder's *current* weekly plan
  (mirroring `getFamilyPlan`), so accepted/dismissed rows for past weeks don't accumulate. See
  "Decision to confirm".
- **Realtime status push.** The chip reflects server state at fetch time; the holder's
  accept/dismiss is reflected on the family member's next open/refetch (TanStack staleTime), not
  pushed live.

### Decision to confirm
1. **Scope of "my suggestions".** Recommended: scope to the **holder's current weekly plan**
   (reuse `getCurrentPlan`, identical NO_PLAN handling to the plan view) — keeps the whole feature
   current-week and shows the full pending→accepted/dismissed lifecycle for the active week.
   _Alternative:_ all-time across every plan the member ever suggested on (matches the scenario's
   unqualified wording but accumulates stale-week rows whose target meals no longer exist).
   Confirm current-plan scope.
2. **Response type.** Recommended: a dedicated `MySuggestionsResponse` for clarity (the
   semantics differ from the holder read). _Alternative:_ reuse `HolderSuggestionsResponse`
   (identical shape, one fewer type). Confirm new-type vs. reuse.
3. **Entry-point affordance.** Recommended: a plain **"My Suggestions"** button on `/family`
   with no count. _Alternative:_ add an accepted/dismissed-since-last-seen count badge (more
   plumbing, not required). Confirm no-count button.

### Demo data note
`seedPlans.ts` seeds **one pending** Sam → Jessica suggestion, so out of the box the modal shows a
single *Pending* chip. To exercise all three chips, run the live loop from Slices 5–6: as Jessica,
**accept** the seeded suggestion → reopen My Suggestions as Sam → it now reads *Accepted*; re-seed
(`npm run seed:plans`) and, as Jessica, **dismiss** the new one → it reads *Dismissed*. _Optional
(faithful) seed enhancement:_ additionally seed one **dismissed** Sam → Jessica suggestion in
`seedPlans.ts` (dismiss leaves the plan unchanged, so this introduces no plan/data inconsistency),
giving the modal two distinct chips without manual steps. (Avoid seeding an *accepted* row directly —
that would assert a swap the plan JSONB wouldn't reflect.)

## Acceptance criteria
- [ ] `GET /api/v1/family/my-suggestions` authenticated as **Sam** (`sam@test.groceryhack.com`)
      returns `{ suggestions: [...] }` containing **every** Sam → Jessica suggestion on Jessica's
      current plan **regardless of status** (pending, accepted, and dismissed all appear), newest
      first, each with `status` and the denormalised `target_meal_name` / `replacement_meal_name`.
- [ ] `GET /api/v1/family/plan` as Sam is **unchanged** — its `pending_suggestions` still lists
      pending-only markers; accepted/dismissed suggestions do **not** reappear as pending markers
      on the plan (the pending-only query `getMySuggestionsForPlan` is untouched).
- [ ] Authorization/empty behaviour: calling `GET /family/my-suggestions` as a **non-linked** user
      (an account holder) returns `403 NOT_A_FAMILY_MEMBER`; a linked member whose holder has no
      current plan returns `404 NO_PLAN`. Errors use the standard `{error,code,message}` shape.
- [ ] In Chrome (no console errors, validated via `cdp.py`): logged in as
      `sam@test.groceryhack.com`, the `/family` page shows a **"My Suggestions"** button; opening it
      lists each suggestion with a status chip — **Pending** (amber), **Accepted** (green), or
      **Dismissed** (neutral grey) — and shows **no accept/dismiss controls**.
- [ ] End-to-end feedback loop: after Jessica **accepts** Sam's pending suggestion (Slice 5 flow),
      Sam reopening My Suggestions sees that suggestion as **Accepted**; after Jessica **dismisses**
      a suggestion (Slice 6 flow), Sam sees it as **Dismissed**.
- [ ] `api-contract.yaml` documents `GET /family/my-suggestions` and its `403` / `404` cases;
      `backend` and `frontend` `tsc --noEmit` pass; the suggestion row is the existing
      `MealSuggestion` from `packages/shared/types.ts` (no new domain type beyond the response
      envelope).
