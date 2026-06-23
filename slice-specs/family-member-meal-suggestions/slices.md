# Feature: Family Member Meal Suggestions

## Overview
A family member — a login linked to an account holder — can view the account
holder's current-week meal plan (read-only) and suggest replacing any meal with
another. The account holder reviews pending suggestions and either accepts one
(which swaps the meal in the plan) or dismisses it (plan unchanged). Each side can
track suggestion status (pending / accepted / dismissed). "Done" = all 11 Gherkin
scenarios pass end-to-end in the browser, and the only plan mutation a family
member can cause is via an accepted suggestion.

## Approach notes
*Project setup — ports, run/seed/migrate commands, snake_case↔camelCase mapping,
Zod, error shape, the shared-types-first rule, and Chrome validation — lives in
`CLAUDE.md` and is not repeated here. This section is only what's specific to this
feature.*

**Where it lives.** A new frontend route **`/family`** hosts the family-member
views — a family member owns no `/landing` data of their own, so it can't reuse `/`
(`frontend/src/pages/LandingPage.tsx` assumes the logged-in user owns everything it
renders). New backend endpoints sit under `/api/v1` (`family/*`, `suggestions/*`).
The account holder's review / accept / dismiss / direct-edit affordances attach to
the existing `LandingPage` (`/`) plan section, modal-driven like the rest of the app.

**The new model (the spec's Background is a precondition, not a scenario).** Today
there is no account-linkage, no roles, and no suggestion concept — the JWT payload
is `{userId,email}` (`backend/src/middleware/auth.ts`) and `users.household_members`
is JSONB names/ages, not logins (confirmed by grep across `backend/src`,
`frontend/src`, `schema.sql`, `api-contract.yaml`). So:

1. **Family member = a `users` row linked to an account holder** via a new nullable
   self-FK `users.account_holder_id` (`NULL` ⇒ account holder / standalone; set ⇒
   family member of that holder). **Role is derived from the column** — no enum, no
   join table. _Deferred alternative:_ an `account_members` join table for
   multi-holder membership; rejected for MVP because every scenario uses exactly one
   holder per member. *(Confirmed — column for MVP.)*
2. **The link is created by seed, not UI.** Family-member invitation / self-signup /
   onboarding is **out of scope** (no scenario covers it; confirmed). A seeded member
   (`sam@test.groceryhack.com`) linked to Jessica signs in through the existing `/login`.
3. **Suggestions = a new `meal_suggestions` table** (suggester, holder, the plan/week,
   target `meal_id`, replacement `meal_id`, status, timestamps) with a partial-unique
   index enforcing "one *pending* suggestion per meal per family member" (Scenario 3).
4. **Replacement meal = an existing meal from the shared `meals` pool** (the pool
   swiping draws from), so "accept" swaps in a real `meal_id`. *(Decided.)*
5. **"The meal plan" = the account holder's current-week `weekly_plans` row.** A meal
   in the plan is a `PlanMeal` inside `one_store_optimized.stops[].meals[]` (and the
   same in `two_store_optimized`). Swapping a meal (on accept or direct edit)
   **re-matches the replacement meal's ingredient keywords against current deals at the
   store(s) already in the plan — it does not re-pick stores or re-run the whole
   optimizer.** It reuses the optimizer's matching helpers (`findBestDealForKeyword`,
   `calculateBrandCost`, `buildPlanStop` in `backend/src/services/optimizer.ts`) to:
   replace the target `PlanMeal` with the new meal, add/refresh that meal's matched
   deals as `PlanShoppingItem`s (tagged `forMeal`) on each stop **so the new meal's
   on-sale groceries show on the list**, compute the new meal's cost and savings from
   those deals, and update each stop subtotal, the plan total, and `estimatedSavings` —
   across both the one- and two-store representations wherever the meal appears.
   *(Decided.)* A replacement is **allowed even when few or none of its ingredients are on
   sale** at the plan's stores, but the swap must **apply every deal that does exist there
   (never skip an on-sale item)**; ingredients with no deal use the optimizer's estimate
   (1.5× avg) and the "also needed (any store)" list. _Implementation caveat for Slice 5:_ the optimizer dedups ingredient
   keywords across meals and tags each item's `forMeal` to the *first* meal needing it,
   so the swap must handle ingredients shared with other meals when adding/removing the
   swapped meal's items.

**Sources of truth to extend as slices land:** `packages/shared/types.ts` (new types
first), `schema.sql` + a numbered migration (`006` link, `007` suggestions, and `008`
partial-unique pending index have all landed; Slice 4 is read-only and adds no migration —
the next migration is whatever Slice 5's swap needs, if any), and `api-contract.yaml`
(new endpoints).

## Slices
| # | Title | Status | Delivers (one line) |
|---|-------|--------|---------------------|
| 1 | Walking skeleton — family member sees the holder's plan | Done | A linked family member logs in, opens `/family`, and sees the account holder's current-week plan meals, read-only, labelled as a family-member view. |
| 2 | Family member suggests a meal replacement | Done | "Suggest a swap" on a meal → pick a replacement → it's stored pending and the meal shows "Suggestion pending"; the plan is unchanged. |
| 3 | One pending suggestion per meal + view existing | Done | A meal that already has a pending suggestion from me blocks a second submission and shows my existing pending suggestion instead. |
| 4 | Account holder reviews pending suggestions | Done | The account holder opens a Suggestions panel and sees each pending suggestion: the meal it would replace, the replacement, and who suggested it. |
| 5 | Account holder accepts a suggestion → plan updated | Planned | Accepting swaps the target meal for the replacement, re-matches the new meal's ingredients to deals at the plan's selected stores (shown on the list), recomputes costs/savings, and marks the suggestion accepted. |
| 6 | Account holder dismisses a suggestion | Planned | Dismissing a pending suggestion marks it dismissed and leaves the plan unchanged. |
| 7 | Family member tracks suggestion status | Planned | "My Suggestions" shows each suggestion with its status (pending / accepted / dismissed), completing the accepted/dismissed feedback loop. |
| 8 | Account holder direct edit + permission hardening | Planned | The account holder can change a meal directly (no suggestion); family members are provably blocked from editing the plan and from accepting/dismissing (403 + no controls). |

## Roadmap narrative
Slice 1 is the walking skeleton: it stands up the only genuinely new seam — a
family-member identity linked to an account holder — and proves it by rendering the
holder's plan under `/family` with nothing wired but the read path. Slice 2 adds the
first write (a suggestion) and reflects it back on that same view; slice 3 closes the
duplicate-submission rule on it. Slices 4–6 build the account holder's side of the
loop (review → accept-which-mutates-the-plan → dismiss), with the meal-swap service —
which re-matches the replacement against deals at the plan's existing stores and
refreshes the shopping list — introduced in slice 5 and reused by direct edit in slice 8. Slice 7 gives the family member the
status view that closes the loop opened by 5 and 6. Slice 8 hardens the permission
boundary the feature is really about — adding the account holder's own direct-edit
capability (reusing slice 5's swap) and making the family member's inability to edit
or to accept/dismiss explicit and verifiable. Authorization checks are added *within*
each slice that creates an endpoint (e.g. accept is account-holder-only from slice 5);
slice 8 makes the negative cases observable and tested rather than adding guards late.

## Open questions
_Resolved on review (folded into Approach notes #1–2, #4–5): the family-member↔holder link
is a single `users.account_holder_id` column (one holder → many members; the `account_members`
join table is deferred); replacement meals come from the shared `meals` pool; swapping
re-matches the new meal against deals at the plan's already-selected stores and shows those
deals on the list; a replacement is allowed even if few or none of its ingredients are on
sale, but every available deal at those stores must still be applied; and family-member
provisioning (invitation / self-signup) is out of scope — the link is seeded._

1. **"Active account."** The Background says the holder has an *active* account. MVP does
   not gate this feature on `subscription_active`; confirm no paywall is intended.
2. **Account-holder review surface** _(resolved — folded into Slice 4)._ It is a
   `ReviewSuggestionsModal` on the existing `LandingPage` (no new route), opened from a
   count-gated "Suggestions (N)" action-bar entry. The badge count rides on the single
   `/landing` response (`pending_suggestion_count`), preserving the "one endpoint loads the
   landing page" rule; the modal fetches the full list from `GET /family/suggestions`.

## Source spec
`specs/family-member-meal-suggestions/family-member-meal-suggestions.md`
