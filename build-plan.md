# GroceryHack Build Plan

## Build Strategy

Single-agent vertical slices. Each slice goes **database → backend → frontend** in one session so context stays intact. All specs are already written — implementation follows them directly.

Before each slice, the agent reads:
- `schema.sql` — tables and constraints
- `api-contract.yaml` — endpoint shapes
- `packages/shared/types.ts` — domain types
- Relevant spec files (listed per slice below)

---

## Quality Gates

### Every commit: pre-commit hook (automatic)

Runs automatically via Husky. Blocks the commit if any check fails.

```
tsc --noEmit              # Type check (backend + frontend + shared)
eslint --max-warnings 0   # Lint (zero warnings policy)
vitest run                # Tests pass
```

### Every slice: PR checklist (before merge)

Each slice gets its own branch (`slice/01-auth`, `slice/02-stores-deals`, etc.) and PR. The PR description includes this checklist — all must pass before merging to main:

- [ ] `tsc --noEmit` passes (no type errors)
- [ ] `eslint --max-warnings 0` passes (no lint warnings)
- [ ] All tests pass (`npm test`)
- [ ] `/validate-types` reports no mismatches
- [ ] New code follows the spec (endpoint shapes match api-contract.yaml)
- [ ] Error codes match docs/architecture/error-codes.md
- [ ] Spend limits checked before any external API call
- [ ] No `any` types introduced
- [ ] No hardcoded secrets or credentials
- [ ] Snake_case ↔ camelCase mapping at route boundary (not in services)

### Every 3rd slice: review checkpoint

Pause at slices 4, 8, and 12 for a deeper review. Run `/review-slice` which checks:

1. **Spec compliance** — read each spec file, read the implementation, compare
2. **Cross-slice consistency** — are services reusing shared utilities or duplicating logic?
3. **Error handling** — are all error codes used correctly? Any raw throws without AppError?
4. **Test quality** — do tests cover error paths, not just happy paths?
5. **Security** — parameterized queries only? No string interpolation in SQL? JWT validation solid?
6. **Spend limits** — every external call (Claude, email, SMS, geocode) goes through checkSpendLimit?

Output: a report with findings + suggested fixes. Fix before continuing.

### Checkpoint schedule

```
Slices 1-4   → CHECKPOINT 1 (auth + stores + meals + landing API)
                "Can a user register, see deals, swipe meals, and get a plan response?"

Slices 5-8   → CHECKPOINT 2 (UI + recipes + watchlist + optimizer)
                "Can a user interact with the full frontend and generate a shopping plan?"

Slices 9-12  → CHECKPOINT 3 (sharing + email + pipelines)
                "Does the full weekly cycle work? Scrape → plan → email → share → accept?"

Slices 13-15 → FINAL (seed + admin + analytics)
                "Is the system observable? Can we see what's happening during the trial?"
```

---

## PR Workflow

Each slice follows this workflow:

```
1. git checkout -b slice/NN-name
2. Build the slice (database → backend → frontend)
3. Write tests alongside code
4. Pre-commit hook runs on each commit (tsc + eslint + vitest)
5. git push -u origin slice/NN-name
6. gh pr create with checklist from this plan
7. Review the diff
8. If checkpoint slice (4, 8, 12): run /review-slice before merge
9. gh pr merge
10. git checkout main && git pull
```

---

## External Services

| Service | Status | Account needed? | Notes |
|---------|--------|-----------------|-------|
| PostgreSQL | **Real (local)** | No | Runs locally, no signup |
| Anthropic Claude | **Real** | Yes (have it) | Need real output for pipeline testing. ~$0.50 to test both pipelines. |
| Stripe | **Real (test mode)** | Yes (free) | Test mode — no charges. Needed for subscription flow. 5 min setup. |
| Resend (email) | **Real** | Yes (free) | Free tier 3K/month. Want to see actual emails during testing. 2 min signup. |
| Twilio (SMS) | **Mock** | No | Log what would be sent. SMS is nice-to-have pre-MVP. |
| OpenCage (geocode) | **Mock** | No | Seed data has lat/lng. Hardcode Hamilton-area coords. Only matters for new cities. |

### Mock implementations

```typescript
// backend/src/lib/sms.ts — mock for pre-MVP
async function sendSms(to: string, body: string): Promise<void> {
  console.log(`[SMS MOCK] To: ${to}\n${body}`);
  // Still track in usage_tracking so spend limit logic is testable
}

// backend/src/lib/geocode.ts — mock for pre-MVP
async function geocode(postalCode: string): Promise<{lat: number; lng: number}> {
  // Hamilton-area fallback
  console.log(`[GEOCODE MOCK] ${postalCode} → Hamilton default`);
  return { lat: 43.2557, lng: -79.8711 };
}
```

Swap to real implementations when ready — the interface stays the same.

---

## Phase 1: Scaffold

Generate the full project skeleton from `docs/architecture/scaffolding.md`:
- Root workspace package.json, tsconfig.base.json
- backend/ — package.json, tsconfig, src/ directory structure, DB client, middleware stubs
- frontend/ — package.json, tsconfig, Ionic React + Capacitor setup, theme tokens, App.tsx shell
- packages/shared/ — types.ts, constants.ts wired up
- Tooling: ESLint config, Husky + lint-staged pre-commit hook, Vitest config
- .env.example from docs/architecture/env-spec.md

**Specs:** `docs/architecture/scaffolding.md`, `docs/design/style-guide.md`

---

## Phase 2: Vertical Slices

### Slice 1: Auth
- [ ] DB: users table + password_reset_tokens table via schema.sql
- [ ] Backend: POST /auth/register (hash password, create user, return JWT)
- [ ] Backend: POST /auth/login (verify password, return JWT)
- [ ] Backend: POST /auth/refresh (rotate refresh token)
- [ ] Backend: POST /auth/forgot-password (generate token, send reset email)
- [ ] Backend: POST /auth/reset-password (validate token, update password)
- [ ] Backend: Auth middleware (verify JWT, attach user to request)
- [ ] Backend: Zod schemas (registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema)
- [ ] Tests: register, login, refresh, forgot/reset flow, expired token, middleware rejection
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Auth tag), `docs/architecture/error-codes.md` (Auth section), `docs/architecture/zod-strategy.md` (auth.ts schemas)

### Slice 2: Stores + Deals
- [ ] Backend: GET /stores/nearby (haversine query with radius)
- [ ] Backend: GET /stores/brands (all brands)
- [ ] Backend: GET /deals (active deals, filtered by store_brand_id, category)
- [ ] Backend: GET /deals/notable (top 10 by discount %)
- [ ] Backend: Zod schemas (nearbyStoresQuery, dealsQuery)
- [ ] Tests: nearby stores with distance, deals filtering, no results cases
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Stores + Deals tags), `docs/architecture/error-codes.md` (Stores + Deals sections)

### Slice 3: Meals + Swiping
- [ ] Backend: GET /meals (swipeable meals, filtered by dietary restrictions, with attribution)
- [ ] Backend: GET /meals/{meal_id} (single meal detail)
- [ ] Backend: POST /meals/{meal_id}/swipe (record preference, update approval scores)
- [ ] Backend: GET /meals/liked (liked meals with deal context)
- [ ] Backend: Zod schemas (mealIdParam, swipeBody, mealsQuery)
- [ ] Tests: swipe right/left, duplicate swipe rejection, approval score calculation, liked meals with sale context
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Meals tag), `docs/pipelines/planner-pipeline.md` (approval score section)

### Slice 4: Landing Page API
- [ ] Backend: GET /api/v1/landing (single response with all landing page data)
- [ ] Service: aggregate user, savings, watchlist alerts, recipe alerts, swipeable meals, liked meals preview, current plan, notable deals, important items
- [ ] Tests: authenticated vs anonymous, user with plan vs without, empty states
- [ ] Gate: PR checklist passes
- [ ] **CHECKPOINT 1**: run `/review-slice` across slices 1-4

**Specs:** `api-contract.yaml` (Landing tag), `specs/landing-page.md`

### Slice 5: Landing Page UI
- [ ] Frontend: LandingPage component structure
- [ ] Frontend: SavingsSummary (animated counter)
- [ ] Frontend: SwipeDeck (card stack with gesture handling)
- [ ] Frontend: SwipeMode modal (full-screen swiping)
- [ ] Frontend: RecipeModal (ingredients, steps, deal badges)
- [ ] Frontend: StoreMealDealList + ShoppingList
- [ ] Frontend: StoreLimitToggle (1-store / 2-store)
- [ ] Frontend: NotableDeals section
- [ ] Frontend: LikedMealsPreview + LikedMealsModal
- [ ] Frontend: FeelingLuckyModal (spinner)
- [ ] Frontend: ShareContactModal
- [ ] Frontend: API client (typed against shared types)
- [ ] Frontend: Theme tokens, typography, color system
- [ ] Gate: PR checklist passes

**Specs:** `specs/landing-page.md`, `docs/design/component-tree.md`, `docs/design/style-guide.md`

### Slice 6: Recipes
- [ ] Backend: GET /recipes (user's recipes)
- [ ] Backend: POST /recipes (create with ingredient_keywords extraction)
- [ ] Backend: GET /recipes/{recipe_id}
- [ ] Backend: PATCH /recipes/{recipe_id}
- [ ] Backend: DELETE /recipes/{recipe_id}
- [ ] Backend: GET /recipes/{recipe_id}/stats (owner-only match counts)
- [ ] Frontend: RecipeFormModal (create + edit modes, publish toggle)
- [ ] Tests: CRUD, ownership enforcement, public recipe stats
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Recipes tag), `specs/recipe-upload.md`, `docs/architecture/error-codes.md` (Recipes section)

### Slice 7: Watchlist + Important Items
- [ ] Backend: GET /watchlist
- [ ] Backend: POST /watchlist (heart deal → extract metadata, classify price tier)
- [ ] Backend: DELETE /watchlist/{id}
- [ ] Backend: GET /important-items
- [ ] Backend: POST /important-items (create, reactivate if exists)
- [ ] Backend: PATCH /important-items/{item_id} (toggle active/inactive)
- [ ] Backend: DELETE /important-items/{item_id}
- [ ] Frontend: ImportantItemsModal
- [ ] Tests: heart/unheart, duplicate item reactivation, active/inactive toggle
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Watchlist + Important Items tags), `docs/architecture/error-codes.md`

### Slice 8: Optimizer
- [ ] Backend: POST /optimize (run code-based optimizer)
- [ ] Service: deal matching against liked meals (ingredient keyword overlap)
- [ ] Service: store assignment (1-store and 2-store plans)
- [ ] Service: budget tier calculation (value/sweet_spot/splurge)
- [ ] Service: important items inclusion
- [ ] Frontend: OptimizerModal (postal code, store selector, run button)
- [ ] Tests: optimizer with various meal/deal combos, budget enforcement, empty states
- [ ] Gate: PR checklist passes
- [ ] **CHECKPOINT 2**: run `/review-slice` across slices 5-8

**Specs:** `api-contract.yaml` (Optimize tag), `docs/pipelines/planner-pipeline.md` (Steps 9-11: optimizer logic)

### Slice 9: Sharing
- [ ] Backend: POST /share/meal (create meal_shares record, send email/SMS)
- [ ] Backend: GET /share/{token}/respond (accept/decline, unauthenticated)
- [ ] Backend: POST /share/plan (informational share)
- [ ] Backend: Response emails (accepted → both parties, declined → sender)
- [ ] Backend: Calendar link generation on accept
- [ ] Frontend: ShareContactModal wiring for meal + plan
- [ ] Tests: share flow, accept/decline, expiration, already-responded
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Sharing tag), `docs/design/email-templates.md` (templates 2-4, 3a, 3b), `docs/architecture/error-codes.md` (Sharing section)

### Slice 10: Email + SMS
- [ ] Backend: Email renderer (string templates for all 7+ email types)
- [ ] Backend: Email sender (Resend integration)
- [ ] Backend: SMS sender (mock for pre-MVP)
- [ ] Backend: Tracking pixel endpoint (GET /events/pixel)
- [ ] Backend: Click redirect endpoint (GET /api/v1/r)
- [ ] Backend: Spend limit checks before sending
- [ ] Tests: template rendering, tracking deduplication
- [ ] Gate: PR checklist passes

**Specs:** `docs/design/email-templates.md`, `docs/architecture/env-spec.md` (Email + SMS sections)

### Slice 11: Scraper Pipeline
- [ ] Backend: Puppeteer page load + screenshot
- [ ] Backend: Claude Haiku prompt (screenshot → structured deals)
- [ ] Backend: Deal upsert (match existing, insert new)
- [ ] Backend: Cron schedule (Tuesday 10pm)
- [ ] Backend: Spend limit enforcement mid-pipeline
- [ ] Backend: Error handling + retry logic
- [ ] Tests: prompt output parsing, deal deduplication
- [ ] Gate: PR checklist passes

**Specs:** `docs/pipelines/scraper-pipeline.md`, `docs/architecture/env-spec.md` (Claude + Pipeline sections)

### Slice 12: Planner Pipeline
- [ ] Backend: Deal matching against existing meals
- [ ] Backend: Collaborative filtering (similar users)
- [ ] Backend: Multi-factor meal scoring
- [ ] Backend: Claude Sonnet meal generation (gap filling)
- [ ] Backend: Jaccard similarity check for new meals
- [ ] Backend: Code optimizer integration (from slice 8)
- [ ] Backend: Weekly plan save + email send
- [ ] Backend: Cron schedule (Wednesday 6am)
- [ ] Tests: scoring weights, collaborative filtering with seed data
- [ ] Gate: PR checklist passes
- [ ] **CHECKPOINT 3**: run `/review-slice` across slices 9-12

**Specs:** `docs/pipelines/planner-pipeline.md`, `docs/architecture/env-spec.md`

### Slice 13: Seed Script + Migration Runner
- [ ] Backend: seed.ts — all Hamilton-area test data
- [ ] Backend: migrate.ts — forward-only migration runner
- [ ] Backend: migrateStatus.ts — show applied migrations
- [ ] Backend: 001_initial_schema.sql baseline migration
- [ ] Backend: Auto-migrate on server startup
- [ ] Run: verify seed + migrate cycle works end-to-end
- [ ] Gate: PR checklist passes

**Specs:** `docs/data/seed-data.md`, `docs/architecture/migration-strategy.md`

### Slice 14: Admin Dashboard
- [ ] Backend: GET /admin/trial-metrics (aggregated analytics)
- [ ] Backend: Engagement score calculation
- [ ] Backend: Email breakdown by type
- [ ] Backend: Pipeline health stats
- [ ] Frontend: Simple admin page (table + charts, internal only)
- [ ] Tests: metric calculations with seed data
- [ ] Gate: PR checklist passes

**Specs:** `api-contract.yaml` (Admin tag), `docs/architecture/analytics-spec.md`

### Slice 15: Events + Analytics
- [ ] Backend: POST /events (single + batch, authenticated)
- [ ] Backend: POST /events/public (share_link_opened, shared_plan_viewed, share_recipient_signed_up)
- [ ] Backend: trackEvent utility (fire-and-forget)
- [ ] Backend: Spend limit utility (checkSpendLimit for all services)
- [ ] Frontend: useTrack hook (queue + batch flush every 5s + sendBeacon on unload)
- [ ] Frontend: Wire tracking calls into all UI interactions
- [ ] Tests: event insertion, batch processing, spend limit enforcement
- [ ] Gate: PR checklist passes
- [ ] **FINAL CHECKPOINT**: run `/review-slice` across slices 13-15 + full integration check

**Specs:** `docs/architecture/analytics-spec.md`, `docs/architecture/env-spec.md` (Spend Limits section)

---

## Phase 3: Integration + Polish

- [ ] Run `/validate-types` to catch any drift between schema, API contract, and types
- [ ] Run `/check-spend` to verify spend limit enforcement
- [ ] End-to-end test: register → swipe → generate plan → view shopping list → share meal → accept
- [ ] Wire up frontend API client to all backend endpoints
- [ ] Capacitor sync for mobile builds (not MVP blocker)

---

## Parallel Opportunities

After slices 1-4 are complete (auth, stores, meals, landing API), these slices are independent and can run in parallel worktrees:

- **Group A:** Slices 6 + 7 (Recipes, Watchlist/Important Items)
- **Group B:** Slice 8 (Optimizer)
- **Group C:** Slice 9 + 10 (Sharing, Email/SMS)

Slices 11-12 (pipelines) depend on slices 2, 3, and 8.
Slice 5 (landing UI) depends on slice 4.
Slices 14-15 (admin, analytics) can run anytime after slice 1.

---

## Recommended Build Order

Priority order optimized for "earliest testable product":

1. **Scaffold** → can verify project compiles
2. **Slice 13** (Seed + Migrations) → database has data to work with
3. **Slice 1** (Auth) → can register and log in
4. **Slice 2** (Stores + Deals) → can see nearby stores and deals
5. **Slice 3** (Meals + Swiping) → can swipe through meals
6. **Slice 15** (Events + Analytics) → tracking wired in early so all subsequent slices get tracked
7. **Slice 4** (Landing API) → full data endpoint works ← **CHECKPOINT 1**
8. **Slice 8** (Optimizer) → can generate shopping plans
9. **Slice 7** (Watchlist + Important Items) → can heart deals, manage staples
10. **Slice 6** (Recipes) → can upload recipes
11. **Slice 10** (Email + SMS) → email rendering + sending works ← **CHECKPOINT 2**
12. **Slice 9** (Sharing) → can share meals with accept/decline
13. **Slice 5** (Landing UI) → full frontend ← **"show someone" milestone**
14. **Slice 11** (Scraper) → real deal data flows in
15. **Slice 12** (Planner) → weekly plans auto-generate ← **CHECKPOINT 3**
16. **Slice 14** (Admin) → can monitor trial metrics ← **FINAL CHECKPOINT**
