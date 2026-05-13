# GroceryHack

GroceryHack is a deal-first weekly meal planner for Canadian grocery shoppers. The premise: pull this week's flyers from local stores, find what's on sale, and assemble a weekly meal plan plus a shopping list whose ingredients line up with the deals. The project is a TypeScript monorepo — Ionic React + Capacitor on the client, Node.js + Express + Postgres on the server, with scheduled pipelines and a fleet of Claude Code skills for flyer extraction.

This is a pre-MVP solo project at the scaffolded-system stage. The schema, API contract, route/service/query files, and frontend pages are in place; some components are stubs. The interesting engineering on `main` today is in two places: the **ten Claude Code scraping skills** (one per Canadian grocery banner) plus the meta-skill that generates new ones, and the **spec-first development workflow** encoded as fourteen reusable slash commands. A hybrid retrieval, LLM match validation, and Opus plan-reviewer pipeline was also designed and implemented; it was never wired into a live service and was removed from `main` (see [What was removed and why](#what-was-removed-and-why)). The design is preserved in git history at commit `bd861af`.

This README documents the current state of `main`, not aspirational state.

---

## Why this exists

There is no existing tool that sits between "this week's flyer says chicken is $4 / lb at No Frills" and "here are four meals you could cook this week that use chicken, fit your dietary restrictions, and stay within your budget." Deal aggregators (Flipp, Reebee) stop at the flyer. Meal planners (Mealime, Plan to Eat) ignore prices. The interesting work happens at the seam between them.

Three technical subproblems define that seam:

1. **Extraction.** Pulling structured deal data — name, price, unit size, sale dates, brand — from heterogeneous flyer surfaces. Some banners expose a usable DOM (Loblaw Digital uses `data-testid`; Metro uses rich `data-*` attributes). Some are pure Tailwind utility classes with no semantic anchors (Empire / Sobeys family). Some have no text DOM at all — the entire flyer is rendered as JPEG images (Highland Packers, an independent). One uses a third-party API (Walmart, via the Flipp `backflipp.wishabi.com` endpoint).
2. **Matching.** Connecting a free-text deal name ("Lean Ground Turkey Breast 454g") to a free-text recipe ingredient ("ground turkey"). Substring matching produces false positives ("butter" matches "peanut butter crackers"). Embedding similarity alone produces semantic-but-wrong matches ("lemon" → "lemon iced tea"). Both need to be combined and filtered.
3. **Optimization.** Choosing a set of meals that maximize deal coverage subject to a weekly budget, dietary restrictions, household composition (kid age brackets affect portion sizing and palatability), cooking effort, and not eating the same thing twice.

The design GroceryHack converged on attacks each subproblem differently — DOM-class-driven scraping skills with per-store drift detection for extraction; a three-phase FTS-then-embedding-fallback retrieval with LLM-validated false-positive filtering for matching; a weighted multi-factor scoring formula plus a Claude Opus structured-output review pass for optimization. The first lives on `main` and is the strongest part of the project today. The second and third are documented in git history (see below).

---

## Architecture at a glance

```
                                  GroceryHack
                                       │
       ┌───────────────────────────────┼─────────────────────────────────┐
       │                               │                                 │
   FRONTEND                         BACKEND                          PIPELINES
   ────────                         ───────                          ─────────
                                                                │
   Ionic React 8                    Express 4                   │ node-cron
   Capacitor 6                      Postgres 15                 ├─ planner (Wed 7am ET)
   TanStack Query 5                 14 routes, 14 services      │     match meals ⨯ deals
   Framer Motion 11                 14 query files              │     Claude Sonnet
                                    35 OpenAPI paths            │     gap-fill new meals
   16 hand-written SVG icons        Zod schemas at the          │     Jaccard dedup
   (no icon library)                 snake_case ↔ camelCase     │     email weekly plan
                                     boundary                   │
   useLandingData() ─────► GET /api/v1/landing                  ├─ scraper (Tue 10pm ET)
   (one query loads                  ┌──────────────────────┐   │     Puppeteer + Haiku
   the entire page)                  │  services/landing.ts │   │     [wired but frozen;
                                     │  aggregates 9 datasets│  │      replaced by skills]
                                     │  in one round-trip   │   │
                                     └──────────────────────┘   │ Manual invocation:
                                                                │   /scrape <store>
                                                                ▼
                                                          10 Claude Code skills
                                                          drive headed Chrome
                                                          via CDP, extract deals,
                                                          insert into the DB
```

The single LLM integration path live on `main` is `backend/src/lib/claude.ts` — a wrapper around `@anthropic-ai/sdk` that checks `lib/spendLimit.ts` before every call, computes per-call cost from `response.usage.input_tokens / output_tokens` at the right model rate (Haiku $1 / $5 per million tokens, Sonnet $3 / $15), and records usage. Two additional LLM integration paths were designed and removed; see below.

---

## What was removed and why

Six AI modules were designed as part of a hybrid retrieval, validation, and review pipeline for the weekly shopping plan. They were never imported by any service, route, pipeline, or test — they sat in the tree as orphan code alongside scaffold-state versions of `services/landing.ts` and `pipelines/planner.ts`. The integration that would have wired them in was lost to an unrelated `git filter-repo` operation that hard-reset the working tree.

Rather than reconstruct unfinished integration code or ship orphans alongside a scaffold, the modules were removed in commit `495b054`. The commit message documents each module in full. The source remains in commit `bd861af`. The brief summary:

| Module | What it did |
|---|---|
| `lib/matchValidator.ts` | Filtered retrieval false positives via the `claude -p` subscription CLI; verdicts cached permanently in `match_verdicts` table keyed on `(ingredient_keyword, product_type)`. Marginal cost zero. |
| `lib/planReviewer.ts` | Sent assembled plans to Claude Opus 4 via `claude -p` for structured-output corrections (`reject_match`, `swap_recipe`, `note`). Failed open if Opus was unavailable. |
| `lib/embeddings.ts` | Local 768-dim BGE-base-en-v1.5 embeddings via `@xenova/transformers`. No API calls. |
| `lib/ftsMatch.ts` | In-memory `plainto_tsquery` simulator for debug paths parallel to SQL FTS. |
| `db/queries/shoppingList.ts` | Single-CTE 3-phase ingredient↔deal retrieval. FTS on `tsv_product_type` (precision), FTS on `tsv_item_name` for unmatched keywords (fallback), pgvector HNSW on the BGE embedding for unmatched keywords with cosine distance < 0.15 (semantic long-tail). Restricted to deals at store locations within haversine ≤ 20 km. |
| `migrations/003_match_verdicts.sql` | `match_verdicts` table + 15 pre-seeded known-false-positive pairs. |

The architectural idea — FTS for precision, embedding fallback for the long tail, LLM validation against a permanent cache to filter false positives at zero marginal cost — is intact in `bd861af` for anyone reading this project as a portfolio artifact.

---

## Scraping: ten Claude Code skills plus a meta-skill

The most differentiated part of this codebase. Each Canadian grocery banner gets a dedicated skill in `.claude/skills/parse-flyer-<banner>/` containing a `SKILL.md` that describes the extraction strategy and a `references/drift-detection.md` that defines monitoring baselines. Skills are invoked by `/scrape <store>` (`.claude/commands/scrape.md`), which routes to the right skill based on the store's banner.

Three extraction strategies cover the surface area:

| Skill | Banner | Strategy | Selector type | Pagination |
|---|---|---|---|---|
| `parse-flyer-walmart` | Walmart Canada | **Flipp API** (no browser) | — | — |
| `parse-flyer-highlandpackers` | Highland Packers (indie) | **Claude Vision OCR** | image filename heuristics | none (single page) |
| `parse-flyer-metro` | Metro | DOM | `data-product-name`, `.default-product-tile` | "Load More" button |
| `parse-flyer-foodbasics` | Food Basics (Metro Inc.) | DOM | `.default-product-tile` (CSS only) | "Load More" button |
| `parse-flyer-freshco` | FreshCo (Empire / Sobeys) | DOM | Tailwind utility classes + position fallbacks | "Load More" button |
| `parse-flyer-nofrills` | No Frills (Loblaw Digital) | DOM | `data-testid="product-title"` | infinite scroll |
| `parse-flyer-rcss` | Real Canadian Superstore | DOM | `data-testid` | `?page=N` URL params |
| `parse-flyer-fortinos` | Fortinos (Loblaw Digital) | DOM | `data-testid` | `?page=N` URL params |
| `parse-flyer-nofrills-print--not-working` | No Frills print-flyer view | (deliberately broken) | — | — |
| `create-store-scraper` | meta-skill | reconnaissance + strategy classifier + scaffold | — | — |

The Walmart skill calls `backflipp.wishabi.com` directly with merchant ID 234. Per-call cost: $0. The Highland Packers skill collects image URLs from a Webflow page and sends each to Claude Haiku Vision for OCR. The DOM skills drive headed Chrome via the Chrome DevTools Protocol over a Python helper at `backend/scripts/cdp.py` (the same script is reused by every DOM skill — it exposes `goto`, `screenshot`, `scroll`, `eval`, `click`, `download`, `print_pdf`).

The `parse-flyer-nofrills-print--not-working` skill is deliberately kept in the tree with that name as a documented dead end. The No Frills print-flyer view turned out to render product data inside an iframe that the CDP attach could not reach reliably from WSL; the working path uses the deals page (`/en/deals/flyer`) instead.

### The meta-skill

`create-store-scraper` (`.claude/skills/create-store-scraper/SKILL.md`) is a 920-line procedure that generates a new banner's skill from a URL. Its six phases:

1. **Reconnaissance.** Navigate to the URL, classify the page into one of three strategies. Signals: PerimeterX or a Flipp iframe with no grid toggle → API-based. Many large images with near-zero DOM text → Vision OCR. Default → DOM-based.
2. **Selector discovery (DOM strategy).** Walk the DOM in priority order: `data-testid` > rich `data-*` attribute > semantic class > Tailwind utility. Run a position-based fallback analysis for sites that only have Tailwind. Detect pagination type (Load More / infinite scroll / `?page=N` / page numbers).
3. **Extraction test.** Write the extraction script against a single page and validate.
4. **Skill scaffolding.** Generate the `SKILL.md` from a template with a selector reference table that rates each selector's stability.
5. **Drift detection scaffolding.** Generate the paired `drift-detection.md` with per-store baselines.
6. **End-to-end validation.** Run the new skill against the live site and confirm the schema conforms.

The meta-skill encodes a parent-company taxonomy as fallback strategy: Loblaw Digital uses `data-testid` with `?page=N` pagination; Empire / Sobeys is pure Tailwind (high drift risk); Metro Inc. uses semantic CSS plus rich data attributes; Flipp-API stores are usually protected by PerimeterX; independent grocers are usually image-based.

### Per-skill drift detection

Each `parse-flyer-*` skill has a paired `references/drift-detection.md` that defines a baseline and an alert threshold across eight dimensions. These are not boilerplate — each dimension is per-store baselined against the live page at skill creation time:

- **Selector hit rate.** Percentage of expected selectors finding ≥1 element. ≥75 % proceed. 50 % – 75 % degraded extraction. < 50 % hard stop.
- **DOM path fingerprint.** Ancestor chain to a product card; flagged if the chain changes between runs.
- **Element count stability.** Expected card count on initial load — Metro 30–70, RCSS 40–60, Highland Packers 40–50 images.
- **Page weight fingerprint.** HTML kilobytes, script count, stylesheet count, iframe count per page. "3× change in any metric" triggers an alert.
- **Temporal coherence.** Extract and validate the flyer's stated date range — a stale date range means the page is cached.
- **Schema conformance.** Per-field null-rate thresholds — for example, Metro `name` > 2 % null means the skill is broken; Metro `brand` > 30 % null is normal.
- **Content volume.** Expected deal counts — Metro 500–2000, Walmart 400–900, Highland Packers ~45 images. Volume drops by ≥ 50 % between runs trigger an alert.
- **Content hash delta.** SHA of sorted product names; the same hash three weeks running means the skill is stuck on a cached page.

The drift-detection files are co-authored by Claude during skill creation but each is validated against the live site, not generated boilerplate. They are the operational layer that distinguishes "ten scrapers I wrote in a weekend" from "ten scrapers I expect to maintain through DOM churn for a year."

---

## Spec-first development with fourteen slash commands

The repo encodes a development workflow as Claude Code slash commands at `.claude/commands/`. Each command reads the project's source-of-truth specs (`schema.sql`, `api-contract.yaml`, `packages/shared/types.ts`, behavioral specs under `specs/`) and produces consistent, conformant code at the right layer.

| Command | Reads | Writes |
|---|---|---|
| `/scaffold-project` | `docs/architecture/scaffolding.md` | Full project skeleton |
| `/scaffold-route <endpoint>` | `api-contract.yaml`, `zod-strategy.md`, `error-codes.md` | Route + service + query + Zod schema |
| `/scaffold-component <name>` | `style-guide.md`, `tokens.ts` | One `.tsx` + test |
| `/scaffold-pipeline <name>` | Pipeline spec | One pipeline file + cron entry |
| `/gen-api-client` | `api-contract.yaml`, `types.ts` | `services/api.ts` + React Query hooks |
| `/build-slice <N>` | `build-plan.md`, schema, contract, types, slice spec | New files across DB → backend → frontend |
| `/review-slice <range>` | git diff + specs | Checkpoint review report (no writes) |
| `/write-tests <area>` | Source file + spec | `*.test.ts` |
| `/preflight` | All source | `tsc --noEmit && eslint --max-warnings 0 && vitest run && validate-types` report |
| `/validate-types` | `types.ts`, `schema.sql`, `api-contract.yaml` | Cross-drift report |
| `/seed-db` | `docs/data/seed-data.md` | `seed.ts` |
| `/prompt-test <template>` | Prompt template | Prompt + sample input + Claude output (no DB) |
| `/check-spend` | `usage_tracking` table | Spend report |
| `/scrape <store>` | `store_brands` table | New `deals` rows |

The `build-slice` / `review-slice` pair encodes the entire build-plan workflow as a callable. The build plan (`build-plan.md`) divides the project into 15 numbered slices with checkpoint reviews at slices 4, 8, 12, and 15. The intent is that each slice is implemented top-to-bottom (DB → backend → frontend) and reviewed before moving on, so the codebase stays consistent.

---

## Anthropic SDK integration: spend gating

The one LLM integration path live on `main` is `backend/src/lib/claude.ts`. Every call goes through `checkSpendLimit(service, userId)` before, and `recordUsage(service, userId, cost)` after. The cost is computed from `response.usage.input_tokens / output_tokens` multiplied by the per-model rate (Haiku, Sonnet, or Opus — rates configured per service).

Spend limits are split per-user-per-day and global-monthly, configured via env vars (`CLAUDE_MONTHLY_BUDGET_USD`, `CLAUDE_PER_USER_DAILY_USD`, etc.) and persisted to a `usage_tracking` table. Calls that would exceed a cap return a typed `SPEND_LIMIT_REACHED` error rather than silently dropping requests. CLAUDE.md is explicit that this gate is non-negotiable for every paid external service (Claude, Twilio, Resend, OpenCage geocoder).

This pattern would extend cleanly to the removed `claude -p` subscription CLI calls in `matchValidator.ts` and `planReviewer.ts` — the subscription cap is itself the global limit, and `recordUsage` would track per-user call counts even without a per-token cost.

---

## Stack

- **TypeScript 5.4** everywhere — `strict: true`, no `any`, ESM modules
- **Node.js** for backend (`tsx watch` in dev, `tsc → node dist` in production) and pipelines
- **Express 4.21**, `cors`, `express-rate-limit`
- **PostgreSQL 15+** with `pgcrypto`, `pg_trgm` (the removed retrieval pipeline added `vector` and `tsvector` generated columns — see `bd861af`)
- **`pg 8.13`** for raw parameterized SQL — no ORM
- **`@anthropic-ai/sdk 0.39`** for paid Claude calls
- **`puppeteer 23`** — used by the legacy `pipelines/scraper.ts` (wired into the scheduler but architecturally replaced by the Claude Code skills; see `docs/pipelines/scraper-pipeline.md` and `Status` below)
- **`node-cron 3`** for pipeline scheduling
- **`bcrypt 6`**, **`jsonwebtoken 9`** for auth
- **`zod 3.23`** for input validation
- **`stripe 17`**, **`twilio 5`** — wired, SMS path mocked
- **`vitest 2`** for backend tests
- **Ionic React 8**, **Capacitor 6**, **TanStack Query 5**, **Framer Motion 11**, **Vite 5.4** on the frontend
- **Playwright** for end-to-end specs at `e2e/`

No CI configuration is committed. No Dockerfile or deployment manifest. The pre-commit hook described in `build-plan.md` (`tsc --noEmit && eslint --max-warnings 0 && vitest run`) is implemented as `/preflight` but not yet enforced via Husky.

---

## Repository layout

```
groceryhack/
├── packages/
│   └── shared/
│       └── types.ts                  Domain types — single source of truth
├── backend/
│   ├── src/
│   │   ├── routes/                   14 files, one per API tag
│   │   ├── services/                 Business logic, snake_case ↔ camelCase
│   │   ├── schemas/                  Zod validation at the boundary
│   │   ├── db/
│   │   │   ├── client.ts             Postgres connection
│   │   │   ├── queries/              14 files, one per table
│   │   │   ├── migrations/           Forward-only, auto-applied on boot
│   │   │   └── seed.ts               Hamilton-area test data
│   │   ├── lib/
│   │   │   ├── claude.ts             SDK wrapper with spend gating
│   │   │   ├── spendLimit.ts         Per-user-day and global-month caps
│   │   │   ├── email.ts              Resend / SES wrapper
│   │   │   ├── sms.ts                Twilio wrapper (mocked path)
│   │   │   ├── geocode.ts            Postal code → lat/lng (Hamilton fallback)
│   │   │   ├── haversine.ts          Distance helper
│   │   │   └── logger.ts             console.log wrapper
│   │   ├── pipelines/
│   │   │   ├── planner.ts            Wednesday cron, generates plans, emails
│   │   │   ├── scraper.ts            Tuesday cron — Puppeteer + Haiku (frozen)
│   │   │   ├── pdfDiscovery.ts       PDF-first scraping helper
│   │   │   ├── scheduler.ts          node-cron entries
│   │   │   └── *-inspect.ts          Exploratory scripts (untracked targets)
│   │   ├── middleware/               Auth, validation, error handling
│   │   └── scripts/
│   │       ├── cdp.py                WSL → Windows Chrome DevTools bridge
│   │       └── parallel_scrape.py    Multi-tab parallel scraper
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                    Landing, Login, Register, SharedPlan
│   │   ├── components/               Meal cards, deal banners, etc.
│   │   ├── modals/                   SwipeMode, RecipeForm, Optimizer, etc.
│   │   ├── hooks/                    14 TanStack Query wrappers
│   │   ├── services/api.ts           Typed API client
│   │   └── theme/
│   │       ├── tokens.ts             Design system tokens
│   │       └── icons/                16 hand-written SVG components
│   ├── ionic.config.json
│   ├── capacitor.config.ts
│   └── package.json
├── docs/
│   ├── architecture/                 Env spec, error codes, migrations, scaffolding, Zod strategy
│   ├── pipelines/                    Scraper, planner, add-city pipeline specs
│   ├── design/                       Style guide, component tree, email templates
│   └── data/                         Seed data
├── specs/                            Behavioral specs (landing-page, recipe-upload)
├── .claude/
│   ├── skills/                       10 dirs — 9 scrapers + meta-skill
│   └── commands/                     14 slash commands
├── e2e/                              22 Playwright specs
├── schema.sql                        Source of truth for the data model
├── api-contract.yaml                 OpenAPI 3.0, 35 paths
├── build-plan.md                     15 vertical slices with checkpoints
└── CLAUDE.md                         Project conventions and critical rules
```

---

## Running locally

This is a development-only run. There is no production deployment story.

```bash
# Prerequisites
#   - Node 20+
#   - PostgreSQL 15+ with pgcrypto and pg_trgm extensions
#   - Chrome with --remote-debugging-port=9222 if you want to run the
#     scraping skills

# Install
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Initialize the database (forward-only migrations run on backend boot)
createdb groceryhack
psql -d groceryhack -f schema.sql

# Seed Hamilton-area test data
cd backend && npm run seed

# Configure env (see .env.example — DO NOT commit .env)
cp .env.example .env

# Run the backend (auto-runs pending migrations on boot)
cd backend && npm run dev

# Run the frontend in another shell
cd frontend && npm run dev

# Run scrapers manually
#   In Claude Code, with Chrome running on localhost:9222:
#     /scrape metro
#     /scrape walmart
#     /scrape nofrills
```

The backend boots the cron scheduler in-process at `backend/src/index.ts`. The planner cron runs Wednesday 7 AM ET; the legacy Puppeteer scraper cron runs Tuesday 10 PM ET. Both cron windows are configurable via `SCRAPER_CRON` and `PLANNER_CRON` env vars.

---

## Status

What's actually working versus what's scaffolded:

| Area | State | Notes |
|---|---|---|
| Database schema | Working | 14 tables, 3 migrations (001, 002, 004), forward-only with auto-apply on boot |
| API contract | Documented | 35 OpenAPI paths in `api-contract.yaml`, types in `packages/shared/types.ts` |
| Auth | Scaffolded | Register / login / refresh / forgot / reset route files exist; JWT + bcrypt wiring in place |
| Users | Scaffolded | `routes/users.ts` exists; profile fields including kid_age_brackets and cooking_effort are partial (some Zod schemas need to be widened to match types) |
| Stores | Scaffolded | Haversine helper at `lib/haversine.ts` works and is unit-tested |
| Deals | Scaffolded | List + notable endpoints; population depends on scraper runs |
| Meals | Scaffolded | List / detail / swipe / liked routes |
| Recipes | Scaffolded | CRUD + publish toggle |
| Watchlist | Scaffolded | Heart-a-deal flow with metadata extraction |
| Important items | Scaffolded | Toggleable staples with `deactivated_at` history |
| Optimizer | Scaffolded | `services/optimizer.ts` + `/optimize` route |
| Sharing | Scaffolded | Cook-for-me / make-for-you with expiring tokens |
| Admin | Scaffolded | Trial metrics dashboard |
| Events | Scaffolded | Batch ingest with public subset for share-link tracking |
| Landing aggregate | Scaffolded | `GET /api/v1/landing` returns 9 datasets; the underlying `services/landing.ts` is the scaffold version (the recovered 678-line `computeShoppingPlan` was a hybrid retrieval pipeline that depended on the removed AI modules and was not restored) |
| Planner pipeline | Scaffolded | `pipelines/planner.ts` with scoring + Sonnet gap-fill + Jaccard dedup; relied on the removed match validator for false-positive filtering |
| Scraper pipeline (Puppeteer) | Wired but architecturally replaced | `pipelines/scraper.ts` is imported and runs on cron, but the active scraping path is the ten Claude Code skills |
| Scraping skills | Working | All ten `.claude/skills/parse-flyer-*` (one explicitly broken) and the meta-skill. Tested manually against live sites |
| Drift detection | Working as documentation | `references/drift-detection.md` files exist per skill; not yet integrated into a CI-style check |
| Spec-first slash commands | Working | 14 commands at `.claude/commands/` |
| Anthropic SDK wrapper | Working | `lib/claude.ts` with spend gating via `lib/spendLimit.ts` |
| SMS | Stubbed | `lib/sms.ts` is a console.log mock |
| Geocoder | Stubbed | `lib/geocode.ts` is a hardcoded Hamilton fallback |
| Frontend | Scaffolded | Pages, components, modals, hooks, icons exist. Some components are the original scaffold; some were edited and lost in the same `git filter-repo` event that took the AI modules |
| End-to-end tests | Working | 22 Playwright specs at `e2e/` |
| Backend unit tests | Partial | Vitest tests next to source for `haversine`, `emailTemplates`, `smsTemplates`, `admin`, `sharing`, `optimizer` |
| CI | Not configured | No `.github/workflows`. The `/preflight` command runs `tsc --noEmit && eslint --max-warnings 0 && vitest run` locally |
| Deployment | Not configured | No Dockerfile, no infra-as-code |

---

## Known limitations

These are the rough edges a senior reviewer would notice on a first read.

- **The interesting retrieval and validation architecture is in git history, not on `main`.** See [What was removed and why](#what-was-removed-and-why). The repo on `main` is a scaffolded system with one differentiated piece (the scrapers) and a removed-but-documented piece (the hybrid retrieval).
- **The Puppeteer scraper is wired into the scheduler but architecturally replaced.** `pipelines/scraper.ts` and its cron entry in `pipelines/scheduler.ts` predate the migration to Claude Code skills. The skills require a Claude Code session to run — there is no scheduled runner that invokes them automatically. Closing the loop on weekly automated scraping is unfinished.
- **Fuzzy ingredient↔deal matching is the unsolved problem.** Substring matching has false positives ("butter" / "peanut butter crackers"). Embeddings have semantic-but-wrong matches. The removed `matchValidator` + `match_verdicts` pattern addressed this with LLM-validated permanent caching. Without it, the planner relies on cleaner heuristics that have not been re-implemented on `main`.
- **Two parallel optimizers existed.** `services/optimizer.ts` is the original (now `@deprecated` per its JSDoc) and `computeShoppingPlan` in the recovered `services/landing.ts` was the active one with FTS + embeddings + plan review. With the AI modules removed, the deprecated optimizer is what `/optimize` actually uses. A new contributor would have to read this README to know which path is current.
- **The 90-second Opus plan review pass was acceptable for a dashboard but not for an interactive UX.** This is one of the reasons the integration was unfinished — a caching layer was the next step. Notes in the removed code marked the 2-store plan review as skipped pending that caching.
- **`HouseholdMember` schema is mid-rename.** `types.ts` introduced `ageBracket: MemberAgeBracket` to replace `age: number`. The corresponding Zod schema in `schemas/users.ts` was part of the lost-then-not-restored set and is still on the old shape. This is a known boundary error to be fixed before any live use.
- **SMS and geocoding are stubs.** Twilio is wired but the send path is a `console.log`. The geocoder returns a hardcoded Hamilton lat/lng for any postal code.
- **No CI, no deploy story, no error tracking, no metrics, no structured logger.** `lib/logger.ts` is a 32-line `console.log` wrapper. Any production move would start here.
- **No production-grade observability of the LLM integrations.** Spend limits are tracked in Postgres but there is no dashboard or alerting. Token consumption and per-user cost shape are visible only via the `/check-spend` slash command.

---

## License

No license is granted. This repository is published as a portfolio reading artifact. Code, design, schemas, and skills are not licensed for reuse, redistribution, or derivative works. Reach out if you want to use any part of this in your own project.
