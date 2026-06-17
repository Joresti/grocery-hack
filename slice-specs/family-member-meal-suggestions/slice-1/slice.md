# Slice 1: Walking skeleton — family member sees the account holder's plan

> **Status:** APPROVED — 2026-06-02

**Spec:** `specs/family-member-meal-suggestions/family-member-meal-suggestions.md`

## Goal
A family member — a login linked to an account holder — can sign in, open a new
`/family` route, and see the **account holder's current-week meal plan**, read-only,
clearly labelled as a family-member view of someone else's plan. This slice stands up
the one genuinely new seam the whole feature rests on — a family-member identity linked
to an account holder — and proves it end-to-end (DB → role-aware endpoint → UI) with
nothing wired beyond the read path. No suggestion actions exist yet; the meals simply
render, matching the mockup's Screen 3 minus the interactive controls.

## Gherkin coverage
- **Scenario: Family member views the current meal plan** — *partial*:
  - ✅ "When I open the current week's meal plan / Then I can see each meal in the plan."
  - ⛔ "And I can see which meals already have a pending suggestion from me" — **deferred
    to Slice 2** (markers) / **Slice 3** (view existing); no suggestions can exist yet.
- **Scenario: Family member cannot directly edit the meal plan** — *groundwork only*: the
  `/family` view renders no edit controls. Explicit enforcement and verification (API 403,
  "the only change I can make is to submit a suggestion") land in **Slice 8**.

No scenario is fully completed by this slice alone; this is the walking skeleton the later
slices deepen.

## Dependencies
None — walking skeleton.

## Scope
### In scope
- **Data model** — `backend/src/db/migrations/006_add_account_holder_link.sql`, mirrored
  into `schema.sql`: add nullable self-FK `account_holder_id UUID REFERENCES users(id)
  ON DELETE CASCADE` to `users` + an index. `NULL` ⇒ account holder; set ⇒ family member
  of that holder. Role is derived from this column.
- **Shared types** (`packages/shared/types.ts`): add `accountHolderId: string | null` to
  `User`; add a `UserRole = 'account_holder' | 'family_member'` alias; add the response
  type for the new endpoint (holder display name + this-week savings + the holder's
  `WeeklyPlan`).
- **Seed** (`backend/src/db/seed.ts`): add family-member user `sam@test.groceryhack.com`
  ("Sam M", `account_holder_id` = Jessica's deterministic id), so a linked member exists
  whose holder gets a current-week plan from `npm run seed:plans`.
- **Backend** — role-aware read endpoint `GET /api/v1/family/plan` (`requireAuth`): resolve
  the caller's `account_holder_id`; if set, return that holder's current-week plan (reuse
  the `getCurrentPlan` pattern in `backend/src/db/queries/landing.ts`) plus holder display
  name and savings. If the caller has no `account_holder_id` → `403 NOT_A_FAMILY_MEMBER`;
  if the holder has no current plan → `404 NO_PLAN`. New `routes/family.ts`,
  `services/family.ts`, `db/queries/family.ts`; register the router in `backend/src/app.ts`.
- **Frontend** — `/family` route: `frontend/src/pages/FamilyPlanPage.tsx` + a `useFamilyPlan`
  query hook; add the route in `App.tsx`. Render the holder's plan meals **read-only**,
  reusing the existing plan rendering (`frontend/src/components/StoreMealDealList.tsx`) so
  meals/stores/subtotals show. Include the mockup's **"Family member" role pill** and **info
  banner**: *"Same plan {holderName} sees. You can suggest a swap on any meal — only
  {holderName} can change the plan directly."* (banner copy present; the suggest affordance
  is inert/absent this slice).
- New types/endpoints/migration follow CLAUDE.md conventions; validate in Chrome before
  marking complete (CLAUDE.md rule).

### Out of scope (deferred)
- "Suggest a swap" action + "Suggestion pending" marker → **Slice 2**.
- Blocking a second pending suggestion + viewing the existing one → **Slice 3**.
- Account-holder review / accept / dismiss → **Slices 4–6**.
- "My Suggestions" status view → **Slice 7**.
- Account-holder direct meal edit; explicit family-member 403s and tests; post-login
  auto-routing of family members to `/family` (manual navigation suffices to demo this
  slice) → **Slice 8**.
- Family-member invitation / self-signup / onboarding → not in spec; link is seeded.
- Adding the new endpoint to `api-contract.yaml` may happen here or alongside Slice 2; the
  migration mirror into `schema.sql` is in scope here.

## Acceptance criteria

> **Verified 2026-06-17**

- [x] Migration `006` adds `users.account_holder_id` (+ index); `schema.sql` mirrors it;
      `npm run migrate` runs clean; backend `tsc --noEmit` passes.
- [x] After `npm run seed && npm run seed:plans`, `sam@test.groceryhack.com` exists with
      `account_holder_id` = Jessica's id, and Jessica has a current-week `weekly_plans` row.
- [x] `GET /api/v1/family/plan` authenticated as Sam returns the **account holder's**
      current-week plan (snake_case) including holder display name and savings; returns
      `403 NOT_A_FAMILY_MEMBER` when called by a non-linked user (e.g. Jessica); `404 NO_PLAN`
      if the holder has no current plan.
- [x] Logging in as `sam@test.groceryhack.com` (`testpassword123`) and visiting `/family`
      renders, **in Chrome with no console errors**, the account holder's plan meals (the meal
      names from Jessica's plan) read-only, with a visible "Family member" label and the "Same
      plan Jessica M sees … only Jessica M can change the plan directly" banner.
- [x] No mutation is possible from this view — no Suggest/edit control performs any write.
- [x] Frontend `tsc --noEmit` passes; the new `User.accountHolderId` / response shapes come
      from `packages/shared` (no locally-defined domain types).
