# CLAUDE.md — GroceryHack

## Project Overview

GroceryHack is a deal-first meal planning app. It scrapes grocery store flyers, finds what's on sale, and builds personalized meal plans and shopping lists optimized for savings. The entire project is TypeScript — frontend, backend, and background pipelines.

## Tech Stack

- **Language:** TypeScript everywhere (strict mode, no exceptions)
- **Frontend:** React + Vite SPA — `react-router-dom` routing, TanStack Query for server state, inline styles against `frontend/src/theme/tokens.ts`. Capacitor packages the web build for iOS/Android. (Ionic React + Capacitor are dependencies for native packaging, but the current app shell uses plain React Router, not Ionic components or routing.)
- **Backend API:** Node.js with Express
- **Background Pipelines:** Node.js with node-cron (flyer scraping, plan generation)
- **Database:** PostgreSQL 15+
- **AI:** Anthropic Claude API (Haiku for scraping, Sonnet for plan generation) via @anthropic-ai/sdk
- **Scraping:** Puppeteer (headless Chrome for rendering flyer pages)
- **Push Notifications:** Firebase Cloud Messaging + APNs via Capacitor (v1)
- **Email:** Resend or AWS SES
- **SMS:** Twilio
- **Payments:** Stripe
- **Validation:** Zod
- **Server State (frontend):** TanStack React Query
- **Testing:** Vitest

## Architecture

```
groceryhack/
├── packages/
│   └── shared/
│       ├── types.ts              # Domain object interfaces — THE contract
│       └── constants.ts          # Shared enums, config values
├── backend/
│   ├── src/
│   │   ├── routes/               # One file per API tag (auth.ts, meals.ts, etc.)
│   │   ├── services/             # Business logic (no HTTP concerns)
│   │   ├── middleware/           # Auth, validation, error handling
│   │   ├── db/
│   │   │   ├── client.ts         # Postgres connection
│   │   │   ├── queries/          # Raw SQL queries, one file per table
│   │   │   └── migrations/       # Schema migrations
│   │   ├── pipelines/
│   │   │   ├── scraper.ts        # Tuesday night: fetch flyers → Claude Haiku → deals
│   │   │   ├── planner.ts        # Wednesday AM: match meals → Claude Sonnet → plans
│   │   │   └── scheduler.ts      # node-cron schedule definitions
│   │   ├── lib/
│   │   │   ├── claude.ts         # Anthropic SDK wrapper
│   │   │   ├── email.ts          # Email sending
│   │   │   ├── sms.ts            # Twilio wrapper
│   │   │   └── geocode.ts        # Postal code → lat/lng
│   │   └── index.ts              # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # Ionic page components
│   │   ├── components/           # Reusable UI components
│   │   ├── modals/               # Full-screen modals (swipe, recipe, sharing, lucky)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── services/
│   │   │   └── api.ts            # API client (typed against shared types)
│   │   ├── theme/
│   │   │   ├── tokens.ts         # Colors, fonts, radii, shadows
│   │   │   └── icons/            # Custom SVG icon components
│   │   └── App.tsx
│   ├── package.json
│   ├── ionic.config.json
│   ├── capacitor.config.ts
│   └── tsconfig.json
├── docs/
│   ├── architecture/              # System design, env, errors, migrations, scaffolding, Zod
│   ├── pipelines/                 # Scraper, planner, add-city pipeline specs
│   ├── design/                    # Style guide, component tree, email templates
│   └── data/                      # Seed data
├── specs/                         # Behavioral specs (landing page, recipe upload)
│   ├── landing-page.md
│   └── recipe-upload.md
├── schema.sql                     # PostgreSQL schema (source of truth for data model)
├── api-contract.yaml              # OpenAPI 3.0 spec (source of truth for API shapes)
└── README.md
```

## Critical Rules

### Validate frontend in Chrome after every change
After writing or modifying any frontend code, validate it in a real Chrome browser before marking the work complete:
1. Ensure Chrome is running with `--remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile`
2. Navigate to the relevant page
3. Check for runtime errors (console exceptions)
4. Verify the page renders correctly (visible text, layout)
5. Test user interactions (login, form submit, navigation) where applicable

If Chrome MCP tools are available, use them. If not, use the Chrome DevTools Protocol directly via python3+websockets on port 9222. This applies to agents too — any agent writing frontend code must validate its output in the browser before reporting success.

### Read specs before coding
Before implementing any feature, read:
- `schema.sql` — database tables, constraints, indexes
- `api-contract.yaml` — every endpoint's request/response shape
- `specs/` — behavioral expectations

If a spec exists for what you're building, follow it exactly. Do not invent fields, endpoints, or behaviors not in the specs.

### Shared types are the contract
`packages/shared/types.ts` defines every domain object. Both frontend and backend import from this file. When you need a new type, add it to shared types FIRST, then use it. Never define a type locally that represents a domain object.

### One endpoint loads the landing page
`GET /api/v1/landing` returns ALL data the main page needs in a single response. The frontend makes ONE network request to render the full page. Do not split landing page data into multiple calls.

### Error shape is non-negotiable
Every API error response:
```json
{"error": true, "code": "MACHINE_READABLE", "message": "Human-readable message"}
```
No exceptions. No alternative shapes. No raw strings. No stack traces in production.

### Every external API call must check spend limits
Before calling any paid external service (Claude, Twilio, Resend/SES, OpenCage), the code must:
1. Query the `usage_tracking` table for the current period's count and cost
2. Compare against the env var limit (`CLAUDE_MONTHLY_BUDGET_USD`, `TWILIO_MONTHLY_SMS_LIMIT`, etc.)
3. If at 80%+, log a warning
4. If at 100%, refuse the call and return a user-friendly error (`SPEND_LIMIT_REACHED`)
5. After a successful call, increment the counter and estimated cost

This applies to both user-triggered calls (optimizer, sharing) and pipeline calls (scraper, planner). Pipeline runs that hit the cap must log which users were skipped. See `docs/architecture/env-spec.md` for all limit variables and `schema.sql` table 13 for the tracking schema.

### No Python in application code
Application code (frontend, backend services, routes, queries, schemas, pipelines) is TypeScript. Pipelines (scraping, plan generation) run as Node.js scripts scheduled with node-cron, using Puppeteer for page rendering and `@anthropic-ai/sdk` for Claude API calls. See `docs/pipelines/scraper-pipeline.md` for the full scraper specification.

The one exception is the browser-bridge helpers used by the Claude Code scraping skills:
- `backend/scripts/cdp.py` — WSL → Windows Chrome DevTools Protocol bridge. Connects to a headed Chrome on `localhost:9222` over WebSocket and exposes a CLI (`goto`, `screenshot`, `scroll`, `eval`, `click`, `download`, `print_pdf`). Python is used here because the websocket-based CDP attach is more reliable from a Python helper than from a Node child process running in WSL.
- `backend/scripts/parallel_scrape.py` — multi-tab parallel driver built on top of `cdp.py` for stores that paginate via `?page=N` (Loblaw Digital).

Both scripts are thin transport wrappers and contain no domain logic. Domain logic — extraction, parsing, dedup — lives in the `.claude/skills/parse-flyer-*/` skills and runs in the Claude Code session.

## Coding Conventions

### TypeScript
- `"strict": true` in every tsconfig.json
- No `any` types — ever
- camelCase for variables, functions, component names, file names
- PascalCase for types, interfaces, components, classes
- Named exports everywhere (except React page components which use default export)
- async/await, never raw callbacks or raw .then() chains
- All functions have explicit return types
- All API input validated with Zod schemas

### Database interaction
- Raw SQL queries via pg (node-postgres) — no ORM
- One query file per table in `backend/src/db/queries/`
- Parameterized queries only — never string interpolation for values
- snake_case for all column and table names
- UUIDs for all primary keys (gen_random_uuid() in Postgres)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` on every table
- `updated_at` with auto-update trigger on mutable tables

### API serialization
- API JSON payloads use **snake_case** (matches database column names)
- TypeScript code uses **camelCase** internally
- Map between them at the route handler boundary
- Zod schemas validate incoming snake_case, service layer works in camelCase

### File organization
- One route file per API tag: `routes/auth.ts`, `routes/meals.ts`, `routes/watchlist.ts`, etc.
- Route files handle HTTP only — parse request, call service, format response
- Service files contain business logic — testable without HTTP
- Tests live next to source: `meals.service.ts` → `meals.service.test.ts`

## Design System

See `docs/design/style-guide.md` for the full specification. Summary below.

### Colors (light theme)
| Token | Hex | Usage |
|-------|-----|-------|
| bg | #FAF9F6 | Page background (warm off-white) |
| white | #FFFFFF | Card backgrounds, input backgrounds |
| primary | #3D7B7B | Muted teal — buttons, links, prices, savings |
| primaryLight | rgba(61,123,123,0.08) | Hover backgrounds, subtle tints |
| primaryShadow | rgba(61,123,123,0.15) | Card and button shadows |
| accent | #C9A84C | Gold — Feeling Lucky, special highlights |
| text | #2D2D2D | Primary text |
| textMuted | #5A5A5A | Secondary text, labels, hints |
| border | rgba(61,123,123,0.12) | Dividers, card internal separators |
| greenBadgeBg | #E6F4EA | Discount badge background |
| greenBadgeText | #1A7F37 | Discount badge text |
| danger | #DC2626 | Errors, NOPE swipe stamp, alerts, delete actions |
| success | #1A7F37 | YUM swipe stamp, confirmations |

### Typography
- **Headings, logo, prices, badges:** Sora (Google Fonts)
- **Body text, labels, buttons, inputs:** Inter (Google Fonts)
- **Font weights:** 400 (body), 500 (labels/ingredients), 600 (buttons/prices/badges), 700 (headings/logo/savings)

### Spacing and Radii
- Container max-width: 720px
- Card border radius: 16px
- Button border radius: 99px (pill)
- Modal border radius: 20px top corners
- Internal card padding: 28-40px (responsive)
- Section padding: 32px vertical
- Touch target minimum: 44x44px

### Icons
- Custom SVG components only — NO icon libraries
- Emoji acceptable on meal cards for personality
- 2px stroke weight, rounded line caps and joins
- Active: `primary`, inactive: `textMuted`, on buttons: `white`
- Store in `frontend/src/theme/icons/`

### Animations
- Swipe card sway: `gentleSway` keyframe, 4s ease-in-out infinite, pauses on hover
- Swipe gesture: spring physics (cubic-bezier(.175, .885, .32, 1.275))
- Savings counter: ease-out cubic, ~500-900ms
- Confetti: CSS keyframe, triggered on savings > $5 per meal match
- Modals: slide up from bottom, 250ms ease-out
- Toasts: fade in/out with Y translation, 1.5s total
- Button hover: `translateY(-1px)` with shadow intensify, 0.2s ease
- Card hover: shadow intensifies, 0.3s ease
- All via CSS transitions/keyframes or Framer Motion — never setInterval

## Key Domain Concepts

**Meals** are timeless. They store ingredients and steps but NO prices. Pricing is recalculated weekly against current deals. Never store a price on a meal.

**User recipes** are private by default. `is_public: true` promotes them into the shared meal pool visible to all users during swiping.

**Important items** are a user's recurring staples (milk, eggs, bread). One row per item per user in the `important_items` table. Items are never deleted — they are toggled active/inactive via `is_active`. The `deactivated_at` timestamp tracks when items were turned off, enabling analysis of how shopping habits change over time. The optimizer includes all active important items in the weekly shopping plan.

**Deal watchlist** stores rich product metadata — not just the item name. The `product_metadata` JSONB field captures subcategory, target audience, brand, size, nutrition info. This feeds the predictive preference engine. When a user hearts a deal, the server classifies the price tier (staple/premium/luxury) and extracts all metadata from the deal record. The frontend only sends a `deal_id`.

**Taste profile** is a JSONB object on the user record with weighted tags. Swipes and deal hearts update the weights. Staple deal hearts boost ingredient/category weights in the taste profile. Luxury deal hearts go to the watchlist only — they do NOT boost the taste profile (to prevent overlearning).

**Hybrid meal generation:** The meals table starts empty. Each week, the planner matches existing meals against deals first. Claude generates only what's needed to fill gaps. New meals are saved if they pass a Jaccard similarity check against existing meals (threshold 0.8). Over time, the database fills itself and Claude generates less.

## Build Commands

**Local URLs & ports:** backend API on `http://localhost:3000`, frontend on
`http://localhost:5173` (Vite; the Playwright e2e harness overrides to `:5176`).
Vite proxies `/api` → `http://localhost:3000` (`frontend/vite.config.ts`), so the
frontend always calls the API at the relative base path `/api/v1`.

```bash
# Install dependencies
npm install                     # Root workspace (npm workspaces)
cd backend && npm install
cd frontend && npm install

# Development
npm run dev                     # Root: runs backend + frontend together (concurrently)
cd backend && npm run dev       # API server only — :3000, tsx watch / hot reload
cd frontend && npm run dev      # Vite dev server only — :5173

# Database
psql -f schema.sql              # Initialize schema from scratch
cd backend && npm run migrate         # Apply numbered migrations in src/db/migrations/
cd backend && npm run migrate:status  # Show applied / pending migrations
cd backend && npm run seed            # Seed test users (password: testpassword123)
cd backend && npm run seed:plans      # Generate current-week weekly_plans for seeded users
# schema.sql is the source of truth and must be hand-updated to mirror every new
# migration added under backend/src/db/migrations/.

# Tests
cd backend && npm test
cd frontend && npm test
npx playwright test             # End-to-end (Playwright, baseURL :5176; see e2e/)

# Build
cd frontend && npm run build    # Web build (tsc && vite build)
npx cap sync                    # Sync to iOS/Android
```

## MVP Scope Boundary

Build ONLY features listed under "MVP" in the business plan. Do NOT build:
- Push notifications (v1)
- Taste profile weighting system (v1)
- Price tier classification logic (v1)
- App store builds (v1)
- User-reported deals (v2)
- Nutritional tracking
- Price history
- AI-generated meal images

If you're unsure whether something is in scope, check the business plan's MVP feature set and the "What I Am NOT Building" scope protection table.
