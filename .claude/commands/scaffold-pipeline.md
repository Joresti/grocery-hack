# Scaffold Pipeline

Generate a complete pipeline implementation (scraper or planner) matching the pipeline specification exactly.

## Input

$ARGUMENTS — The pipeline name: "scraper" or "planner"

## Instructions

### 1. Read the pipeline spec

Read the full specification for the requested pipeline:
- **Scraper**: `docs/pipelines/scraper-pipeline.md`
- **Planner**: `docs/pipelines/planner-pipeline.md`

Also read these supporting files:
- `schema.sql` — tables the pipeline reads from and writes to
- `packages/shared/types.ts` — domain types
- `docs/architecture/env-spec.md` — environment variables and spend limits
- `docs/architecture/error-codes.md` — error handling patterns
- `api-contract.yaml` — if the pipeline produces data consumed by API endpoints

### 2. Check existing code

Before generating, check what already exists:
- `backend/src/pipelines/scraper.ts` or `planner.ts`
- `backend/src/pipelines/scheduler.ts`
- `backend/src/lib/claude.ts` — Anthropic SDK wrapper
- `backend/src/lib/spendLimit.ts` — spend limit utility
- `backend/src/lib/email.ts` — email sender
- `backend/src/db/queries/` — existing query files for tables this pipeline uses

Build on existing code. Don't recreate utilities that already exist.

### 3. Generate the scraper pipeline

If `$ARGUMENTS` is "scraper", generate these files following `docs/pipelines/scraper-pipeline.md`:

#### a. `backend/src/pipelines/scraper.ts`

The main pipeline runner. Follow the spec's architecture section exactly:

1. **Browser setup**: One Puppeteer browser instance per run, reused across stores
2. **Page capture**: Navigate, dismiss cookie banners, scroll in viewport chunks (1280x800), capture screenshot + visible text per chunk, cap at 20 chunks
3. **Claude Haiku calls**: One call per chunk with the exact system prompt and user message structure from the spec. Send screenshot as base64 image + visible text.
4. **Flyer date detection**: Extract dates from first chunk, default to Thursday-Wednesday cycle
5. **Output validation**: Validate every deal with the `DealExtractionSchema` Zod schema from the spec
6. **Deduplication**: Deduplicate by item_name + brand (case-insensitive), keep the most complete record
7. **Database operations**: Within a transaction — delete old flyer deals for the store, insert new ones, update store metadata
8. **Spend limit enforcement**: Before EVERY Claude API call, check `usage_tracking` against `CLAUDE_MONTHLY_BUDGET_USD`. Warn at 80%, block at 100%. After success, record usage.
9. **Error handling**: Follow the error table in the spec exactly (timeouts, invalid JSON, validation failures, spend limit)
10. **Logging**: Log everything listed in the spec's logging section

#### b. Database queries (if not already in `backend/src/db/queries/`)

- `deals.ts` — delete old deals for store, batch insert new deals
- `storeLocations.ts` or `storeBrands.ts` — update scrape status and last_scraped_at
- `usageTracking.ts` — query current usage, insert/upsert usage record

#### c. Claude wrapper (`backend/src/lib/claude.ts` if not exists)

- Initialize `@anthropic-ai/sdk` with `ANTHROPIC_API_KEY`
- Wrap calls with spend limit checks
- Estimate cost per call (input tokens × rate + output tokens × rate)
- Support both Haiku (scraper) and Sonnet (planner) models

#### d. Tests (`backend/src/pipelines/scraper.test.ts`)

Follow the testing strategy from the spec:
- Zod validation edge cases
- Deduplication logic
- Spend limit enforcement (mock usage_tracking at various thresholds)
- Claude response parsing (save fixture responses, validate extraction)

### 4. Generate the planner pipeline

If `$ARGUMENTS` is "planner", generate these files following `docs/pipelines/planner-pipeline.md`:

#### a. `backend/src/pipelines/planner.ts`

The main pipeline runner. Follow ALL 13 steps from the spec:

1. **Get user's active important items** — query important_items table
2. **Find nearby store locations** — haversine query within PLANNER_SEARCH_RADIUS_KM
3. **Get active deals** — deals by store_brand_id, deduplicate by brand
4. **Check deal watchlist** — fuzzy match watchlist items against deals
5. **Match existing meals against deals** — ingredient keyword overlap + dietary filters + approval scores
6. **Collaborative filtering** — find similar users (shared likes >= 2), get their liked meals the user hasn't seen. Handle cold start (< 5 swipes → fall back to approval-based ranking)
7. **Score and rank candidates** — multi-factor scoring with weights: dealOverlap 0.30, collaborative 0.30, approval 0.20, budgetFit 0.20. Redistribute weights for cold start users.
8. **Select meals** — enforce protein variety (max 2 same), budget tier variety (max 3 same tier), pick 5 primary + 3 alternates
9. **Generate new meals with Claude Sonnet** — always generate MIN_NEW_MEALS (3), more if gaps exist. Use the exact system prompt and user message from the spec.
10. **Jaccard similarity check** — threshold 0.8 on ingredient_keywords before saving new meals
11. **Code-based optimizer** — build 1-store and 2-store shopping plans. Pure code, no Claude. Follow the optimizer logic from the spec exactly.
12. **Check user recipe alerts** — 2+ cost drivers on sale OR 30%+ cheaper
13. **Save weekly plan + send email** — generate shareable token, save plan JSON, send via email service

#### b. Supporting modules

- `backend/src/pipelines/optimizer.ts` — the code-based shopping optimizer (buildOneStorePlan, buildTwoStorePlan, itemAssignment logic)
- `backend/src/pipelines/scoring.ts` — meal scoring, collaborative filtering score, budget fit calculation
- `backend/src/pipelines/keywords.ts` — ingredient keyword extraction (the KEYWORD_MAP lookup table)

#### c. Database queries (extend existing files or create new ones)

- `meals.ts` — query meals by ingredient overlap and dietary filters, insert new meals
- `userMealPreferences.ts` — get user's swipe history, find similar users, get collaborative recs
- `weeklyPlans.ts` — insert weekly plan
- `importantItems.ts` — get active items for user
- `dealWatchlist.ts` — get watchlist, fuzzy match against deals
- `usageTracking.ts` — spend limit queries (if not already created)

#### d. Tests (`backend/src/pipelines/planner.test.ts`)

Follow the 13-item testing strategy from the spec:
- Meal scoring with known inputs
- Collaborative filtering
- Cold start handling
- Budget tier assignment
- Meal selection variety enforcement
- Jaccard similarity
- Keyword extraction
- Optimizer edge cases (1-store, 2-store, no deals)
- Spend limit mid-run behavior
- Approval score calculation

### 5. Generate the scheduler

Update or create `backend/src/pipelines/scheduler.ts`:

```typescript
// Scraper: Tuesday 10pm ET
cron.schedule('0 22 * * 2', runScraper, { timezone: 'America/Toronto' });

// Planner: Wednesday 7am ET
cron.schedule('0 7 * * 3', runPlanner, { timezone: 'America/Toronto' });
```

### 6. Cross-cutting requirements

Apply to all generated pipeline code:

- **Spend limits**: Check before EVERY Claude API call. Track with `user_id = NULL` for pipeline-level usage. Log which users/stores were skipped when limit is hit.
- **Error handling**: Follow the error tables in each spec. Never crash the pipeline — log errors and continue to next store/user.
- **Logging**: Every run logs start/end time, duration, per-store/user stats, Claude API usage, estimated cost, and skip reasons.
- **TypeScript strict**: No `any`. Explicit return types. Use shared types.
- **Cost estimation**: Track tokens and estimate cost per the rates in the spec (Haiku: input $0.80/M, output $4.00/M; Sonnet: input $3/M, output $15/M).

## Output

List all files created or modified, estimated Claude API cost per run, and any spec ambiguities you encountered.
