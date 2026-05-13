# GroceryHack — Repository Characterization

> Snapshot date: 2026-04-29. Branch: `main`. Working tree has substantial uncommitted changes (40 modified files + ~25 new files); most current implementation lives there, not in the committed history. See §6.

---

## 1. Repo orientation

GroceryHack is a deal-first meal planning app for Canadian grocery shoppers. The pitch: scrape weekly flyers from local grocery chains, find what's on sale, and assemble personalized weekly meal plans + shopping lists optimized for savings. The user picks their postal code, sets a budget, swipes meals (Tinder-style) to teach a taste profile, hearts deals to track items, and gets a Wednesday-morning plan email with a 1-store and 2-store option per week.

**Stage:** post-scaffolding, mid-implementation, single-developer, pre-MVP. The committed history is three commits totaling specs + scaffold; the uncommitted working tree (~25,458 LOC of TS) is where the real engineering lives — embeddings, semantic retrieval, AI-driven match validation, AI plan review, and a fleet of agentic scraping skills. The intended audience is end-users (B2C consumer app), but it has not shipped.

The project is also visibly an experimental harness for **agentic engineering patterns**: nearly every cross-cutting concern (scraping, code generation, project preflight checks) is encoded as a Claude Code skill or slash command. See §7 — that's the most distinctive thing about this repo.

---

## 2. Architecture at a glance

```
groceryhack/                         (npm workspaces monorepo)
├── packages/shared/types.ts         single source of truth — domain types
├── backend/                         Node.js + Express + Postgres
│   └── src/
│       ├── routes/        14 files  HTTP layer, snake_case JSON
│       ├── services/      ~10 files business logic, camelCase
│       ├── schemas/       11 zod    snake→camel transform schemas
│       ├── db/queries/    16 files  raw parameterized SQL, one file/table
│       ├── db/migrations/ 4 files   forward-only, auto-applied on boot
│       ├── lib/           14 files  claude.ts, embeddings.ts, spendLimit.ts,
│       │                            matchValidator.ts, planReviewer.ts,
│       │                            ftsMatch.ts, email/sms/geocode wrappers
│       ├── pipelines/                puppeteer scraper (frozen),
│       │                             planner (active), node-cron scheduler,
│       │                             pdfDiscovery, flipp-inspect, scraper-dry-run
│       └── scripts/                  cdp.py, parallel_scrape.py,
│                                     backfill-embeddings.ts
├── frontend/                         Ionic React + Capacitor + Vite
│   └── src/
│       ├── pages/         4 files    Landing, Login, Register, SharedPlan
│       ├── components/    13 files   meal cards, deal banners, etc.
│       ├── modals/        10 files   SwipeMode, RecipeForm, Optimizer, etc.
│       └── hooks/         14 files   TanStack Query wrappers
├── .claude/
│   ├── skills/            10 dirs    9 store flyer parsers + create-store-scraper
│   └── commands/          15 files   /build-slice, /review-slice, /scrape, …
├── e2e/                   22 specs   Playwright tests
├── docs/                  14 files   ~6.6K lines of architecture/design specs
├── specs/                 4 files    behavioral specs (landing-page, recipe-upload, …)
├── schema.sql                        14 tables, pgvector HNSW + pg_trgm + tsvector
└── api-contract.yaml                 OpenAPI 3.0 — 35 paths, 42 operations
```

**Request flow for the most common operation — landing page render:**

```
Frontend                    Backend                            Postgres + AI
─────────                   ─────────                          ─────────────
GET /                       routes/landing.ts (auth middleware)
useLandingData()       →    services/landing.ts
                              ├─ userQueries.findUserById      → users
                              ├─ Promise.all([
                              │    savings (this week, ytd)    → events / weekly_plans
                              │    watchlistAlerts             → deal_watchlist
                              │    recipeAlerts                → user_recipes
                              │    swipeableMeals              → meals (filtered)
                              │    likedMeals                  → user_meal_preferences
                              │    notableDeals                → deals
                              │    importantItems              → important_items
                              │    computeShoppingPlan(user)   → see below
                              │  ])
                              └─ map snake_case for response

  computeShoppingPlan(user):
    1. embedBatch(ingredient names + keywords)  → @xenova/transformers (BGE-base-en-v1.5, 768-d, local)
    2. Single CTE in findKeywordDealMatches():
         a. nearby store_locations (haversine ≤ 20km)
         b. Phase 1a: FTS on tsv_product_type @@ plainto_tsquery
         c. Phase 1b: FTS on tsv_item_name (only for keywords with no Phase-1a hit)
         d. Phase 2:  pgvector HNSW <=> on deals.embedding (only for FTS-miss keywords, < 0.15 cosine)
    3. validateMatches() against match_verdicts cache; misses go to claude -p CLI (subscription)
    4. optimizeOneStore + optimizeTwoStore — best recipe combos by savings
    5. reviewPlan() → claude -p --model opus, returns JSON corrections, applied to plan
    6. Return WeeklyPlan-shaped payload
```

The **planner cron** (`pipelines/planner.ts`, 1,277 lines) runs Wednesday 6 a.m. ET and does the same matching but per-user, plus calls Claude Sonnet to generate gap-filling meals (Jaccard-similarity-deduped against existing meals) and emails the result. The **scraper cron** is currently commented out in `pipelines/scheduler.ts:16-34` — scraping has been migrated to Claude Code skills (see §7).

---

## 3. Tech stack inventory

### Languages & runtimes
- **TypeScript 5.4.0** everywhere (strict mode, no `any`); ESM modules across the project.
- **Node.js** for backend (`tsx watch` in dev, `tsc → node dist` in prod) and pipelines.
- **Python 3** for two helper scripts only (`backend/scripts/cdp.py`, `parallel_scrape.py`) — bridges WSL → Windows Chrome via DevTools Protocol over websockets. CLAUDE.md is explicit that the project is otherwise no-Python.

### Backend (`backend/package.json`)
- `express ^4.21`, `cors`, `express-rate-limit`
- `pg ^8.13` (raw SQL, no ORM), `bcrypt`, `jsonwebtoken`
- `@anthropic-ai/sdk ^0.39` (used in `lib/claude.ts` for paid API calls), and shell-out to the `claude` CLI binary in `lib/matchValidator.ts` and `lib/planReviewer.ts` (subscription, not metered API)
- `@xenova/transformers ^2.17.2` — local 768-dim embeddings via `Xenova/bge-base-en-v1.5` (recently upgraded from `Xenova/all-MiniLM-L6-v2` 384-dim — see `.claude/commands/upgrade-embedding-model.md`)
- `puppeteer ^23` — used by the legacy scraper and `pdfDiscovery.ts`
- `node-cron ^3`
- `zod ^3.23` validation
- `stripe ^17`, `twilio ^5` — wired but the SMS path is mocked
- `vitest ^2` for tests

### Database (`schema.sql`, 14 tables)
- **PostgreSQL 15+** with `pgcrypto`, `pg_trgm`, **`vector`** extensions
- pgvector HNSW index on `deals.embedding vector(768)`
- Two GIN tsvector indexes (`tsv_product_type`, `tsv_item_name`) on the `deals` table
- A pl/pgsql `haversine()` function for distance, `update_timestamp()` trigger for `updated_at` columns
- Forward-only migrations in `backend/src/db/migrations/` (4 files, latest `004_deals_unit_size_price_type.sql`), runner is `db/migrate.ts`, auto-applied on server boot

### Frontend (`frontend/package.json`)
- `@ionic/react ^8` + `@capacitor/core ^6` (web, iOS, Android from one codebase — Capacitor sync is documented but not yet exercised)
- `@tanstack/react-query ^5`
- `framer-motion ^11`
- `react-router-dom ^6.26`
- `vite ^5.4` build, `vitest ^2` tests
- No UI library beyond Ionic; **no icon libraries** — every icon is a hand-written SVG component in `frontend/src/theme/icons/` (16 of them). This is enforced by CLAUDE.md.

### AI / LLM
- Anthropic Claude — three distinct integration paths:
  - **Paid API** (`@anthropic-ai/sdk`) for the planner's meal generation (Sonnet 4.5) and scraper's flyer extraction (Haiku 4.5). Wrapped by `lib/claude.ts` which enforces spend limits.
  - **Subscription CLI** (`spawn('claude', ['-p', '--model', 'sonnet'])`) for `lib/matchValidator.ts` — small ingredient↔product validation calls cached in `match_verdicts`.
  - **Subscription CLI with Opus** for `lib/planReviewer.ts` — context-aware review of generated grocery plans.
- Local embeddings via `@xenova/transformers` (no API call, runs in-process the first time then cached).

### Testing & CI
- **Vitest** unit/integration tests next to source (`*.test.ts`). Counted ~21 backend test files, ~1 frontend.
- **Playwright** e2e suite in `e2e/` (22 spec files: settings flows, recipe form CRUD, landing sections). `playwright.config.ts` at root.
- **No CI configuration** committed (no `.github/workflows`, no `.gitlab-ci.yml`).
- ESLint config (`.eslintrc.json`) with `@typescript-eslint`, `--max-warnings 0` policy referenced in `build-plan.md` but not enforced via Husky in the visible state.

### Infra / deployment
- **None visible.** No Dockerfile, no Terraform, no deployment manifest. The project still runs locally — `cd backend && npm run dev`, `cd frontend && npm run dev`, `psql -f schema.sql`. The cron scheduler boots inside the API server process. This is appropriate for the current pre-MVP stage but is a clear gap for shipping.

### Active vs. legacy
| Status | Component | Notes |
|---|---|---|
| Active | Planner pipeline (`pipelines/planner.ts`) | Cron-scheduled, generates meals + emails |
| Active | Landing-page shopping plan computation (`services/landing.ts`) | The "real" optimizer; used by every landing render |
| Active | All 10 Claude Code scraping skills | Documented in `.claude/skills/`, invoked via `/scrape` |
| Frozen but kept | Old Puppeteer scraper (`pipelines/scraper.ts`) | Imported but commented out in `pipelines/scheduler.ts:16-34`. CLAUDE.md memory note says it's "kept but frozen" |
| Deprecated | `services/optimizer.ts:566` | Self-labels with `@deprecated` JSDoc — preserved for the `/optimize` endpoint, but `landing.ts` is preferred |

---

## 4. Engineering decisions worth calling out

### 4.1 Spec-first development encoded as agentic skills
The codebase commits to a flow where every feature starts with `schema.sql`, `api-contract.yaml`, `packages/shared/types.ts`, and a behavioral spec under `specs/`, then is implemented by invoking `/build-slice` (`.claude/commands/build-slice.md`). The build plan in `build-plan.md` divides the project into 15 numbered slices with checkpoints at slices 4/8/12/15 where `/review-slice` runs.

**Tradeoff:** This produces unusually well-documented and consistent code (every route file has a service file has a query file has a Zod schema), but it ties the project's productivity to having Claude available — and the build plan is currently inconsistent with reality (e.g. the scraper slice 11 is checked off in spirit but the actual runtime scraper has been replaced).

### 4.2 Snake_case at the boundary, camelCase internally
Zod schemas in `backend/src/schemas/*.ts` accept snake_case input and `.transform()` to camelCase output. Services and queries operate in camelCase. Route handlers map back to snake_case for JSON responses. Database columns are snake_case. Shared types are camelCase.

**Alternative:** standardize on camelCase end-to-end with a runtime caser. **Why this was chosen:** matches PostgreSQL idiom and OpenAPI convention without forcing JS/TS users to think in snake. The cost is a serialization layer at the route boundary; the benefit is that `psql` queries and API JSON look "right" to anyone reading them.

### 4.3 One landing endpoint returns everything
`GET /api/v1/landing` (route in `routes/landing.ts`, service in `services/landing.ts:633`) returns user + savings + watchlist alerts + recipe alerts + swipeable meals + liked meals + current plan + notable deals + important items in a single response. The frontend has exactly one `useLandingData` hook (`hooks/useLandingData.ts`) that powers the entire main page.

**Alternative:** REST resource endpoints with HTTP/2 multiplexing or GraphQL. **Tradeoff:** the single-endpoint approach makes the frontend dead simple (one query, one stale time, one error path) and trivially cacheable, but couples the backend service to the landing UI's data needs. Adding a new dashboard means another aggregate endpoint, not just a new query. CLAUDE.md is emphatic: "One endpoint loads the landing page. … Do not split landing page data into multiple calls."

### 4.4 Hybrid retrieval: 3-phase FTS → embedding fallback
`backend/src/db/queries/shoppingList.ts:findKeywordDealMatches` is a single CTE that:
1. **Phase 1a:** `tsvector @@ plainto_tsquery` on the deal's normalized `product_type` (the most precise — a deal whose `product_type='chicken breast'` matches the keyword "chicken breast")
2. **Phase 1b:** Same FTS on `item_name`, but only for keywords with zero Phase-1a hits *and* deals with NULL `product_type`
3. **Phase 2:** pgvector HNSW (`d.embedding <=> kv.vec`) only for keywords with zero FTS hits, with cosine distance < 0.15

**Alternative:** pure embeddings everywhere (cleaner, simpler) or pure FTS (cheaper). **Why hybrid:** FTS is essentially free and handles the precise cases ("milk" → "Astro Yogurt" doesn't match, "chicken breast" → exact deal does), embedding semantics catch the long-tail (e.g. "ground turkey" → "lean ground turkey breast" via vector similarity). Doing it as a single CTE means the entire shopping plan is one round-trip to Postgres. The tradeoff is that the SQL is ~150 lines of CTE that's hard to debug.

### 4.5 AI-driven match validation with a permanent cache
False positives ("butter" matching "peanut butter crackers", "lemon" matching "lemon iced tea") are filtered by `lib/matchValidator.ts`. It maintains a `match_verdicts` table (migration `003_match_verdicts.sql`, pre-seeded with 15 known-bad pairs) keyed on `(ingredient_keyword, product_type)`. Cache misses are batched into a Claude Sonnet call **via the `claude -p` subscription CLI**, not the metered API — so the marginal cost is zero.

**Alternative:** train a small classifier, or hand-curate a denylist. **Why this:** verdicts are stable forever once known (peanut butter is not butter today and won't be tomorrow); using `claude -p` rather than the API trades latency for cost (no per-token billing). Notably, this means the spend-limit middleware does NOT cover these calls — the subscription plan is the cap. Files: `lib/matchValidator.ts:60-88` (CLI spawn), `:90-130` (batch prompt), `:158-184` (cache write with `ON CONFLICT DO NOTHING`).

### 4.6 Claude Opus plan reviewer
After the optimizer assembles a 1-store plan, `lib/planReviewer.ts` sends the user profile + selected recipes + deal-to-ingredient assignments + unmatched ingredients + available alternative deals to Opus 4 (again via `claude -p`) and asks for structured corrections. Opus replies with `{approved, corrections, varietyIssue, leftoverOpportunities}`; the system applies `reject_match` corrections by removing the bad assignment, recomputing meal cost and savings.

**Alternative:** rules-based heuristics (much cheaper, much dumber). **Tradeoff:** ~90s latency per landing-page render in the worst case (`services/landing.ts:589` — only the 1-store plan is reviewed; 2-store is skipped with `// TODO: review 2-store plan when caching is in place`). The plan reviewer fails open — if Opus is unavailable, it returns the original plan unchanged. This is a pragmatic last-mile quality gate that wouldn't be feasible with metered API pricing.

### 4.7 Spend limits on every external call (almost)
`lib/spendLimit.ts` exposes `checkSpendLimit(service, userId)` and `recordUsage(service, userId, cost)`. The Claude SDK wrapper in `lib/claude.ts:46-103` calls both: it checks before, computes cost from `response.usage.input_tokens / output_tokens` × per-service rates (Haiku $1/$5 per Mtok; Sonnet $3/$15), then records. Limits are split per-user-per-day and global-monthly. CLAUDE.md flags this as non-negotiable: "Every external API call must check spend limits."

**Caveat I noticed:** the `claude -p` CLI calls in `matchValidator.ts` and `planReviewer.ts` bypass this — they're not metered, so it's defensible, but it's worth knowing if the project ever migrates them to API.

### 4.8 PDF-first scraping with chunk fallback (legacy pipeline)
The (now-frozen) Puppeteer pipeline in `pipelines/scraper.ts:550-687` first calls `pdfDiscovery.ts` to look for a PDF flyer button (text patterns "Download PDF", "View PDF", context-menu ellipsis), downloads it, and sends the entire PDF as one document content block to Claude Haiku. If no PDF is found, it falls back to a viewport-by-viewport scroll-and-screenshot loop, sending each chunk individually. The discovery is generic — no per-store selectors hardcoded; spec at `specs/scraper-pdf-discovery.md`.

**Why this matters:** even though this pipeline is disabled, the design pattern is reused in the new agentic skills — the PDF-first idea, the cookie banner dismissal scan, and the date-range parsing all reappear in `.claude/skills/create-store-scraper/SKILL.md`.

### 4.9 Hybrid meal generation: existing meals first, Claude fills gaps
The planner (`pipelines/planner.ts:802-840`) scores existing DB meals against current deals using a 4-factor weighted score: `dealOverlap × 0.30 + collaborative × 0.30 + approval × 0.20 + budgetFit × 0.20`, with a cold-start fallback (`scoreMeal:106-112`) that redistributes weights when collaborative data is missing. Only the *gap* (`mealsNeeded − goodMatches`) is generated via Claude Sonnet, then deduped against existing meals via a 0.8-threshold Jaccard similarity check on ingredient keywords (`isTooSimilar:125-152`). New meals that pass dedup are inserted into `meals`.

**Tradeoff:** the database fills itself over time and Claude's role shrinks — but cold-start runs are expensive ($0.50ish per pipeline run per the build-plan estimate). This is a clean, principled design even if I haven't seen the steady-state behavior.

### 4.10 Scraping moved from Puppeteer to Claude Code skills
This is the biggest in-flight architectural shift. The frozen Puppeteer pipeline still exists, but the active path is: `/scrape <store-name>` (`.claude/commands/scrape.md`) looks up the store, picks the right `parse-flyer-<store>` skill from `.claude/skills/`, and that skill drives Chrome via the `cdp.py` CDP bridge to extract deals. Each skill has a paired `references/drift-detection.md` with selector hit-rate thresholds, content volume bounds, button label drift checks, and a content-hash delta to detect cached/stale pages.

**Alternative:** keep Puppeteer + Claude Haiku as the runtime scraper. **Why the shift:** Memory note says "scraping moved to Claude Code + cron". My read: per-store DOM idiosyncrasies (Loblaw's `data-testid`, Metro's `data-product-name` rich attributes, Empire/Sobeys's pure Tailwind, Highland Packers's image-only flyer, Walmart's Flipp API) are too varied for a single Puppeteer + LLM-vision pipeline to handle cleanly, and Claude Code skills make each store's logic separately testable, debuggable, and updatable. The cost is that the scraper now requires a Claude Code session to run, not a headless cron — the integration plan for that isn't visible in the codebase yet.

---

## 5. What's been accomplished

### Concretely working (from reading the code, not from the README)

**Backend API (35 paths in `api-contract.yaml`, 14 route files mounted in `app.ts`):**
- Full auth: register/login/refresh/forgot/reset, JWT with refresh rotation in the frontend api client (`frontend/src/services/api.ts:54-77`), bcrypt password hashing, `password_reset_tokens` table.
- Users (`/users/me`), with the rich profile schema (postal code, lat/lng, budget, dietary restrictions, household members with age brackets, kid age brackets, cooking effort, max stores).
- Stores nearby (haversine ≤ 25 km), brands list.
- Deals listing + notable (top 10 by % off).
- Meals listing/detail/swipe + liked meals — with attribution metadata (who shared, weekly match count).
- Recipes CRUD with publish toggle, owner-only stats endpoint.
- Watchlist (heart deal → extract product metadata, classify price tier into `staple/premium/luxury`).
- Important items (toggleable staples, never deleted, tracks `deactivated_at` for habit-change analysis).
- Optimizer (`/optimize`).
- Sharing (cook_for_me / make_for_you with expiring tokens, accept/decline endpoints, calendar URL on accept).
- Admin trial metrics dashboard (`/admin/trial-metrics`).
- Events ingestion (`/events`, batch + public unauthenticated subset for share-link tracking).
- Shopping list public endpoint (`/shopping-list`).
- Landing aggregate endpoint.

**Pipelines:**
- Planner pipeline runs end-to-end: deal-matching, collaborative filtering, multi-factor scoring, Claude Sonnet generation, Jaccard dedup, optimizer, plan save, weekly email send. Has a 18-test test file (`planner.test.ts`).
- Scraper pipeline (Puppeteer + Haiku) is implemented but disabled at the cron level.
- PDF discovery is a separate library (`pdfDiscovery.ts`).

**Frontend (Ionic React):**
- Landing page with: header savings counter, action bar (Optimize, Feeling Lucky, View Shopping List, My Staples), deal alert banner, recipes-on-sale, dream meal matching swipe deck, liked meals preview, store-meal-deal list with 1-/2-store toggle, notable deals, "no matching deals" empty state.
- 10 modals: SwipeMode (full screen, 585 lines), FeelingLucky (spinner that picks a meal for someone in the household), LikedMeals, Optimizer, ImportantItems, ShareContact, Settings, RecipeForm (1500+ lines, has the most modification of any file), RecipeDetail, RecipeModal.
- Auth pages (Login, Register), SharedPlan public viewer page.
- 14 React Query hooks wrapping the API.
- 16 hand-written SVG icons.
- Theme tokens (`theme/tokens.ts`) with the design system summarized in CLAUDE.md.

**Agentic infrastructure (see §7):**
- 10 `.claude/skills/`: 9 store-specific flyer parsers + a meta-skill `create-store-scraper` that generates new ones.
- 15 `.claude/commands/`: build/scaffold/review/preflight/seed/scrape/upgrade-embedding-model.

**Database:**
- 14 tables, 4 migrations, 1006-line `seed.ts` with deterministic UUIDs, ~$Hamilton-area test data (13 store locations across 7 brands, dozens of meals and deals).
- BGE 768-dim embedding column on `deals` with HNSW index.
- Per-table parameterized SQL query files (16 of them).

**Testing:**
- 22 backend Vitest test files covering services, schemas, middleware, libs, and the planner+scraper pipelines.
- 22 Playwright e2e specs in `e2e/` covering settings, recipe forms, landing sections.

### Stubbed / in progress
- **SMS** (`lib/sms.ts`) is a 10-line console.log mock; build-plan calls this out explicitly.
- **Geocoder** (`lib/geocode.ts`) is a 7-line hardcoded Hamilton fallback.
- **Scraper cron integration** for the Claude Code skill workflow — `/scrape` exists as a manual command but I see no scheduled runner that invokes it automatically. The frozen Puppeteer scraper is the only thing wired into `node-cron`.
- **2-store plan reviewer** — `services/landing.ts:589` notes `// TODO: review 2-store plan when caching is in place`.
- **App store builds** — `frontend/capacitor.config.ts` exists but iOS/Android builds aren't in scope for v1 per CLAUDE.md.

### Recent debugging history
There are explicit "FIX 1 Layer 1/3/4", "FIX 2", "FIX 3", "FIX 4", "FIX 5" comments scattered through `pipelines/planner.ts`, `services/optimizer.ts`, and four frontend files (`Header.tsx`, `StoreMealDealList.tsx`, `FeelingLuckyModal.tsx`). They appear to be a single iterative debugging pass (likely a checkpoint review session) that addressed: meals being included in plans without any on-sale ingredients, the savings header behavior, the 2-store toggle, and the Feeling Lucky name flow.

---

## 6. What I personally appear to have driven

`git log --pretty='%an <%ae>' | sort -u` returns exactly **one author**: `Joresti <j.oresti@gmail.com>`. This is a **solo project**. The committed history is three commits, all by you:

| Commit | Date | Message | Lines added |
|---|---|---|---|
| `9d356bf` | 2026-03-12 | Initial commit: complete project specs and planning | ~12 docs + 6 skills + schema + API contract + types + business plan |
| `7097f0b` | 2026-03-12 | Add 7 Claude Code skills for spec-driven code generation | +896 |
| `ba218d1` | 2026-03-17 | Add project scaffolding: backend, frontend, shared packages, and config | full backend + frontend skeleton |

All three commits are co-authored by Claude Opus 4.6 (the second and third with the 1M-context variant). Every commit message is yours-and-Claude's; the work pattern is clearly pair-programming with Claude Code.

**The interesting story is what's *uncommitted*.** `git status` shows 40 modified files and ~25 new files; `git diff --stat HEAD` shows +3,740 / -1,376 lines of changes. Concretely, the uncommitted work on this branch since 2026-03-17 includes:

- **The retrieval rewrite.** New: `lib/embeddings.ts` (BGE-base-en-v1.5, 768-dim, BGE prefix), `lib/ftsMatch.ts` (in-memory FTS-like word matching to mirror Postgres `plainto_tsquery`), `db/queries/shoppingList.ts` (the 3-phase CTE described in §4.4). Schema diff: pgvector extension added, `vector(768)` embedding column on deals, two `tsvector` generated columns, three new indexes (HNSW + 2× GIN on tsv).
- **Match validation.** New: `lib/matchValidator.ts` + migration `003_match_verdicts.sql` with 15 pre-seeded false-positive pairs.
- **Plan review.** New: `lib/planReviewer.ts` calling `claude -p --model opus`.
- **Migrating scraping to Claude Code skills.** New: all 10 directories under `.claude/skills/`, new `/scrape` command, new `/upgrade-embedding-model` command, new `backend/scripts/` with `cdp.py`, `parallel_scrape.py`, `backfill-embeddings.ts`. Five new pipeline files for inspection: `find-pdf-link.ts`, `flipp-inspect.ts`, `inspect-print-flyer.ts`, `pdfDiscovery.ts`, `scraper-dry-run.ts`. Migration `004_deals_unit_size_price_type.sql` adds fields the new skills produce.
- **Refactoring the household model.** Schema + types renamed `HouseholdMember.age` (number) → `HouseholdMember.ageBracket` (enum), introduced `kid_age_brackets` and `cooking_effort` columns, and added 7 new analytics events for settings interactions.
- **Frontend rewrites.** `RecipeFormModal.tsx` saw 1,587 lines changed (out of ~1,800), `StoreMealDealList.tsx` got 430 lines of changes (item check-off badge for "purchased" / "already at home"), `Header.tsx` got the savings breakdown modal, `FeelingLuckyModal.tsx` got rewritten (213 lines).
- **The whole `e2e/` Playwright suite (22 files).**

In short: the uncommitted diff is where the project went from "scaffolded" to "interesting." A commit at this point would be one of the larger commits I've ever seen.

**Patterns in your work:**
- **Spec-first, then scaffold.** The first two commits are pure planning/skill creation; the third is generated scaffolding. No exploratory code in the history.
- **Rapid iteration without intermediate commits.** Six weeks of substantive engineering between commit 3 and now lives in one giant uncommitted diff. This is unusual and worth being intentional about — `git stash` recovery is your only backstop right now.
- **AI-collaboration-as-tooling, not AI-collaboration-as-author.** Every commit message reads "I built this with Claude" but the design choices (hybrid retrieval, claude-p for unmetered validation, drift-detection-per-skill) are coherent and yours — they reflect product taste, not just Claude default behavior.
- **Productionizing experimental ideas.** The `match_verdicts` cache, the `claude -p` subscription pattern, and the per-skill drift-detection harness all read like ideas from someone who's run scrapers in production before and got tired of debugging them.

---

## 7. AI / agentic infrastructure

This is the section I want to be most precise about — it's the most distinctive thing in the repo.

### 7.1 Slash commands (`.claude/commands/`, 15 files)

| Command | Purpose | Reads | Writes |
|---|---|---|---|
| `/build-slice <N or name>` | Implement a vertical slice from the build plan, DB → backend → frontend | `build-plan.md`, `schema.sql`, `api-contract.yaml`, `types.ts`, slice-specific specs | new files in `routes/`, `services/`, `db/queries/`, `schemas/`, `components/` |
| `/scaffold-route <endpoint>` | Generate a single endpoint's route + service + query + Zod schema from the OpenAPI contract | `api-contract.yaml`, `zod-strategy.md`, `error-codes.md` | 4 files |
| `/scaffold-component <name>` | Ionic React component matching the design system | `style-guide.md`, `tokens.ts` | one `.tsx` + test |
| `/scaffold-pipeline <name>` | Scaffold a node-cron pipeline | pipeline spec | one pipeline file |
| `/scaffold-project` | One-shot generate the entire project skeleton | `scaffolding.md` | the whole tree |
| `/gen-api-client` | Generate frontend API client + React Query hooks from the OpenAPI contract | `api-contract.yaml`, `types.ts` | `services/api.ts`, hooks |
| `/write-tests <area>` | Generate Vitest tests | source file + spec | `*.test.ts` |
| `/preflight` | Run `tsc --noEmit && eslint --max-warnings 0 && vitest run && validate-types` | — | report |
| `/check-spend` | Show current usage vs configured monthly/daily caps | `usage_tracking` table | report |
| `/validate-types` | Cross-check `types.ts` ↔ `schema.sql` ↔ `api-contract.yaml` for drift | all three | report |
| `/seed-db` | Generate Hamilton test data | `seed-data.md` | `seed.ts` |
| `/prompt-test <template>` | Run a Claude prompt with sample input, no DB | prompt template | output |
| `/review-slice <range>` | Checkpoint review at slice 4/8/12/15 | git diff + specs | report (no writes) |
| `/scrape <store>` | Look up store, dispatch to the right `parse-flyer-*` skill, insert deals | `store_brands` table | `deals` rows |
| `/upgrade-embedding-model` | Migration recipe: MiniLM 384 → BGE 768 | source files | edits config + schema + queries + runs backfill script |

The `/build-slice` and `/review-slice` pair encodes the entire build-plan workflow as a callable: plan → build → review at checkpoints → continue. This is unusually disciplined.

### 7.2 Skills (`.claude/skills/`, 10 dirs)

Nine production scrapers + one meta-skill:

| Skill | Strategy | Selector type | Pagination | Notes |
|---|---|---|---|---|
| `parse-flyer-walmart` | **Flipp API** (no browser) | — | — | Calls `backflipp.wishabi.com` directly with merchant ID 234. Cost: $0 |
| `parse-flyer-highlandpackers` | **Vision OCR** | filename heuristics | none (single page) | Webflow site, image-only flyer, sends each image to Haiku Vision |
| `parse-flyer-metro` | DOM | `data-product-name`, `.default-product-tile` | Load More button (200+ clicks) | Has paired `evals/evals.json` with 3 programmatic assertions |
| `parse-flyer-foodbasics` | DOM | `.default-product-tile` (CSS only, no rich data attrs) | Load More button | Metro Inc. sibling of Metro |
| `parse-flyer-freshco` | DOM | Tailwind classes + position fallbacks | Load More button | Empire/Sobeys family, highest drift risk |
| `parse-flyer-nofrills` | DOM | `data-testid="product-title"` | Infinite scroll | Loblaw Digital |
| `parse-flyer-rcss` | DOM | `data-testid` | `?page=N` URL params | Loblaw Digital |
| `parse-flyer-fortinos` | DOM | `data-testid` | `?page=N` URL params | Loblaw Digital |
| `parse-flyer-nofrills-print--not-working` | DOM | (broken) | print-flyer page | Explicitly named broken; kept as a documented dead-end |
| `create-store-scraper` | meta-skill | — | — | Generates new `parse-flyer-*` skills for any URL |

Every skill has a paired `references/drift-detection.md` (eight of them — only `create-store-scraper` and `parse-flyer-nofrills-print--not-working` lack one). The drift files are **not** boilerplate; each one documents per-store baselines:
- **Selector hit rate** (% of expected selectors finding ≥1 element, with thresholds for "proceed", "partial drift — degraded extraction", "hard drift — stop")
- **DOM path fingerprint** (ancestor chain to a product card)
- **Element count stability** (expected card count on initial load — for example, Metro 30–70, RCSS 40–60, Highland Packers 40–50 images)
- **Page weight fingerprint** (HTML KB, script count, stylesheet count, iframe count) with per-store baselines and "3× change in any metric" as the alert signal
- **Temporal coherence** (extract and validate the flyer date range)
- **Schema conformance** (per-field null-rate thresholds — for example, Metro `name` >2% null is broken, `brand` >30% null is normal)
- **Content volume** (Metro 500–2000 deals expected, Walmart 400–900, Highland Packers ~45 images)
- **Content hash delta** (SHA of sorted product names; same hash 3 weeks running = stuck on cached page)
- **Step completion verification** (after each click — Grid View, Complete Flyer, Load More — verify the page changed)
- **Button label drift** (log the actual text of each button the skill clicks, even on success)
- **Soft-404 detection**

### 7.3 The `create-store-scraper` meta-skill

This is the most ambitious piece. `.claude/skills/create-store-scraper/SKILL.md` is a 920-line procedure that generates a new store's scraping skill from a URL:

1. **Phase 1 — Reconnaissance.** Navigate to the URL, classify the page into one of three strategies:
   - **API-based** (signal: PerimeterX or Flipp iframe with no grid toggle) → use Flipp `merchant_id` lookup
   - **Vision OCR** (signal: many large images, near-zero DOM text) → image-filename section mapping + Haiku Vision per image
   - **DOM-based** (default) → CSS selector discovery
2. **Phase 1 (DOM)** — discover product card selectors (priority order: `data-testid` > rich `data-*` attribute > semantic class > Tailwind utility). Run a position-based fallback analysis for Tailwind sites. Detect pagination type (Load More button / infinite scroll / `?page=N` / page numbers).
3. **Phase 2** — write and test the extraction script.
4. **Phase 3** — generate the `SKILL.md` from a template that includes a selector reference table with stability ratings.
5. **Phase 4** — generate the matching `drift-detection.md`.
6. **Phase 5** — validate end-to-end against the live site.
7. **Phase 6** — save both files.

It encodes a **parent-company taxonomy** for fallback strategy: Loblaw Digital uses `data-testid` with `?page=N` pagination; Empire/Sobeys is pure Tailwind (high drift risk); Metro Inc. uses semantic CSS + rich data attributes; Flipp-API stores are protected by PerimeterX; independents are usually image-based.

### 7.4 Browser bridge (`backend/scripts/cdp.py`)

A 220-line Python script that connects to a headed Chrome on `localhost:9222` over WebSocket and exposes a CLI: `goto`, `screenshot`, `scroll`, `eval <js>`, `click <js>`, `download <path>`, `print_pdf`. Used by every scraping skill via `python3 backend/scripts/cdp.py …`. The WSL-side trick is real: it lets a WSL Linux Claude session drive Windows Chrome.

`backend/scripts/parallel_scrape.py` adds multi-tab parallelism (4 concurrent tabs by default) for sites that paginate via `?page=N` (Loblaw Digital), with session-cookie warmup so each tab inherits a store-selected session.

### 7.5 MCP

`.mcp.json` declares one MCP server: `chrome-mcp` (npx). The `.claude/settings.local.json` allowlist confirms `mcp__chrome-mcp__*` is enabled. So Chrome is accessible both via the MCP server and via the `cdp.py` shell script — the skills primarily use the script (more deterministic), the broader CLAUDE.md instructions for frontend validation use the MCP tools.

### 7.6 Stage assessment

This is past-prototype, not yet runtime-integrated. The `/scrape` slash command works manually (and by the look of `evals.json` for Metro, has been tested). The committed `node-cron` scheduler still has the legacy Puppeteer pipeline commented out and no new entry pointing at the skill workflow — so weekly auto-scraping currently requires a human (you) to invoke `/scrape` for each store. That's a clear next-step, and the project memory note `project_scraping_architecture.md` ("Scraping moving to Claude Code + cron") confirms it's planned.

---

## 8. Honest gaps and rough edges

- **The 3-commit history vs. the giant working tree is the single biggest risk.** Six weeks of substantive engineering — easily the most valuable code in the repo — is unstashed, unstaged work on `main`. A bad `git reset` or disk failure loses it. This is not a code-quality issue; it is an operational one.
- **No CI, no Husky pre-commit hook.** `build-plan.md` describes a `tsc --noEmit && eslint --max-warnings 0 && vitest run` pre-commit hook ("Runs automatically via Husky"), but I see no Husky config and no `.husky/` directory. The quality gate is aspirational, not enforced.
- **No deploy story.** No Dockerfile, no `fly.toml`/`render.yaml`/`vercel.json`, no Kubernetes manifest, no Terraform. The cron scheduler boots inside the API server (`backend/src/index.ts:14`), which is fine for one box but not for HA.
- **Two parallel optimizers.** `services/optimizer.ts` (the original, now JSDoc-`@deprecated`) and the inline `computeShoppingPlan` in `services/landing.ts` (the active one with FTS+embeddings+plan reviewer). The old one still serves `/optimize`. A new contributor would have to figure out which to read first; the answer is `landing.ts` is current, `optimizer.ts` is legacy-but-still-running.
- **Spend tracking inconsistency.** The `claude -p` CLI calls in `matchValidator.ts` and `planReviewer.ts` don't go through `lib/spendLimit.ts`. CLAUDE.md asserts every external call must check spend limits. Defense: the subscription cap is the cap, so there's no API bill to control. Still, these are unmetered Opus-4 calls during every landing-page render — operationally significant if performance or rate limits hit.
- **`/scrape` is manual.** No scheduler entry runs the Claude Code skills. The legacy scheduler has both pipelines wired but the scraper one is commented out (`scheduler.ts:16-34`). Closing the loop on automated weekly scraping is unfinished.
- **`HouseholdMember` schema is mid-rename.** `types.ts` says `ageBracket: MemberAgeBracket`; the schema migration adds `kid_age_brackets`, but `seed.ts` may still reference the old shape. The Settings frontend code is also being reworked. Mid-refactor state.
- **The match-verdicts cache is opinionated and could outgrow itself.** Pre-seeded with 15 known-bad pairs; everything else is filled in JIT. There's no admin UI, no way to see what's in the cache, no way to invalidate stale verdicts (e.g. if a product type gets renamed). Today this is fine; in production it will need observability.
- **Plan reviewer adds ~90s to landing render.** Acceptable for a dashboard view but kills any sense of "instant" UX. There's a `// TODO: review 2-store plan when caching is in place` comment indicating the plan was to introduce result caching but it isn't here yet.
- **No structured logger, no metrics, no error tracking.** `lib/logger.ts` is a 32-line `console.log` wrapper. For a system that issues paid Claude calls and runs cron jobs in an unsupervised loop, this is the next observability gap.
- **`proposed-changes.json` and `nofrills-flyer.pdf` and a 127MB `google-chrome-stable_current_amd64.deb` sit in the repo root.** Cleanup needed.
- **Several pipeline experiments are untracked: `find-pdf-link.ts`, `flipp-inspect.ts`, `inspect-print-flyer.ts`, `scraper-dry-run.ts`.** They look like exploratory scripts; if they're keepers, they should move to `scripts/`; if they're not, they should be deleted.
- **Day-1 onboarding pain points for a new senior engineer:** the build-plan vs. reality drift (slice numbering doesn't match what's actually been built), the two optimizers, and the fact that you can't run end-to-end without manually invoking `/scrape` per store. CLAUDE.md is excellent and would help, but the project memory file (`project_scraping_architecture.md`) is what tells you scraping has migrated; without that, the commented-out scheduler is confusing.

---

## 9. Resume-relevant claims you could honestly make

Each is defensible from a specific file or commit. Trim/recombine as you like.

1. **Designed and implemented a TypeScript monorepo** (Express + Postgres + Ionic React + Capacitor + node-cron) with 14 database tables, 35 API endpoints across 14 route files, and a single landing-page aggregate query that returns 9 distinct datasets in one round-trip. *(`schema.sql`, `api-contract.yaml`, `backend/src/services/landing.ts:633`, `backend/src/app.ts`)*
2. **Built a hybrid retrieval system for ingredient-to-deal matching** combining PostgreSQL full-text search (3-phase CTE: `tsvector @@ plainto_tsquery` on `product_type` → on `item_name` → pgvector HNSW embedding fallback at cosine distance < 0.15), with 768-dim BGE-base-en-v1.5 embeddings generated locally via `@xenova/transformers`. *(`backend/src/db/queries/shoppingList.ts:findKeywordDealMatches`, `backend/src/lib/embeddings.ts`, schema migration `004_deals_unit_size_price_type.sql`)*
3. **Designed an LLM-validated match cache (`match_verdicts` table)** to filter retrieval false positives ("butter" / "peanut butter crackers"), routing cache misses through the `claude -p` subscription CLI rather than the metered API to drive marginal validation cost to zero — and pre-seeded the table with 15 documented known-bad pairs to bootstrap. *(`backend/src/lib/matchValidator.ts`, `backend/src/db/migrations/003_match_verdicts.sql`)*
4. **Built a Claude Opus plan reviewer** that takes a generated grocery plan plus user profile and returns structured JSON corrections (`reject_match`, `swap_recipe`, `note`), then transactionally applies them to the plan and recomputes meal cost and savings. Fails open if Opus is unavailable. *(`backend/src/lib/planReviewer.ts`, called from `backend/src/services/landing.ts:589`)*
5. **Architected a deal-first weekly meal planner** with a 4-factor weighted scoring formula (ingredient overlap × 30% + collaborative filtering × 30% + approval score × 20% + budget fit × 20%, with cold-start re-weighting), Claude Sonnet gap-fill generation, and Jaccard-similarity (≥0.8) deduplication of generated meals against the existing meal corpus. *(`backend/src/pipelines/planner.ts:scoreMeal`, `:isTooSimilar`, `:runPlannerForUser`)*
6. **Built a fleet of 10 Claude Code skills for grocery-flyer scraping** spanning three strategies (DOM CSS/data-attributes, Flipp HTTP API, Claude Vision OCR for image-only flyers) with a meta-skill (`create-store-scraper`) that auto-classifies new stores into the right strategy and generates both `SKILL.md` and a paired drift-detection harness. *(`.claude/skills/create-store-scraper/SKILL.md`, `.claude/skills/parse-flyer-*/SKILL.md`)*
7. **Designed a per-skill drift-detection harness** for production scraper maintenance: selector hit-rate thresholds (≥75% proceed / 50–75% degraded / <50% hard-stop), DOM path fingerprints, page-weight baselines, content volume bounds, content-hash delta to catch cached/stale pages, button-label drift logging, and post-step verification after every interaction. *(`.claude/skills/parse-flyer-metro/references/drift-detection.md` and 7 siblings)*
8. **Wrote a spend-limit middleware** that gates every paid external API call (Claude, Twilio, Resend, OpenCage) with both per-user-per-day and global-monthly caps, computes per-call cost from response token usage at the right model rate, and refuses requests above the cap with a typed `SPEND_LIMIT_REACHED` error. *(`backend/src/lib/spendLimit.ts`, called from `backend/src/lib/claude.ts:46`)*
9. **Built a WSL→Windows Chrome DevTools Protocol bridge** with a 220-line Python helper exposing `goto`/`screenshot`/`scroll`/`eval`/`click`/`print_pdf`/`download` subcommands, plus a multi-tab parallel scraper (4 concurrent tabs with session-cookie warmup) for paginated Loblaw Digital flyer pages. *(`backend/scripts/cdp.py`, `backend/scripts/parallel_scrape.py`)*
10. **Codified a spec-first development process** as 15 reusable Claude Code slash commands (`/build-slice`, `/scaffold-route`, `/review-slice`, `/preflight`, `/validate-types`, …) that read the OpenAPI contract, the schema, the shared types, and behavioral specs, and generate consistent route + service + query + Zod schema + test files at each layer — and used this process to scaffold the entire backend and frontend in three days (commits `9d356bf` → `7097f0b` → `ba218d1`, 2026-03-12 to 2026-03-17). *(`.claude/commands/`, `build-plan.md`)*