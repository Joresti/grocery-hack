# Scaffold Project

Generate the full Phase 0 project skeleton so that all subsequent slices have a working foundation to build on.

## Input

$ARGUMENTS — Optional. If "check" is passed, only verify what's missing without generating anything.

## Instructions

### 1. Read the scaffolding spec

Read `docs/architecture/scaffolding.md` — it contains the exact file tree, every package.json, every tsconfig.json, and the constants file. Follow it precisely.

Also read:
- `docs/architecture/env-spec.md` — for the .env.example file
- `docs/design/style-guide.md` — for the frontend theme tokens
- `docs/architecture/zod-strategy.md` — for the validation middleware pattern
- `docs/architecture/error-codes.md` — for the error handler pattern
- `docs/architecture/migration-strategy.md` — for the migration runner

### 2. Check what already exists

Before generating, check the current state:
- Does `packages/shared/types.ts` exist? (It should — don't overwrite it)
- Do any package.json files exist?
- Are there any existing source files?

Never overwrite existing files that contain real code. Only create missing files.

### 3. Generate the root workspace

- `package.json` — workspace config with scripts (from scaffolding spec)
- `tsconfig.base.json` — shared compiler options (from scaffolding spec)
- `.env.example` — every env var from `docs/architecture/env-spec.md` with descriptions and defaults
- `.gitignore` — node_modules, dist, .env, etc. (from scaffolding spec)

### 4. Generate packages/shared

- `packages/shared/package.json` — (from scaffolding spec)
- `packages/shared/tsconfig.json` — (from scaffolding spec)
- `packages/shared/constants.ts` — categories, dietary tags, budget tiers, thresholds (from scaffolding spec)
- Do NOT touch `packages/shared/types.ts` — it already exists

### 5. Generate backend scaffold

#### Config and entry

- `backend/package.json` — dependencies and scripts (from scaffolding spec)
- `backend/tsconfig.json` — (from scaffolding spec)
- `backend/src/config.ts` — env var loading with Zod validation, typed config export
- `backend/src/index.ts` — server entry: run migrations, start Express
- `backend/src/app.ts` — Express app setup: cors, json parsing, route mounting, error handler

#### Middleware stubs

- `backend/src/middleware/auth.ts` — JWT verification middleware (reads from Authorization header, verifies with JWT_SECRET, attaches user to req)
- `backend/src/middleware/validate.ts` — Zod validation middleware (from zod-strategy.md)
- `backend/src/middleware/errorHandler.ts` — central error handler (from error-codes.md, produces `{error, code, message}`)
- `backend/src/middleware/rateLimit.ts` — rate limiter setup using express-rate-limit

#### Database

- `backend/src/db/client.ts` — pg Pool setup from DATABASE_URL env var
- `backend/src/db/migrate.ts` — migration runner (from migration-strategy.md)
- `backend/src/db/migrateStatus.ts` — migration status checker
- `backend/src/db/migrations/` — create directory (empty for now)

#### Shared utilities (lib/)

- `backend/src/lib/spendLimit.ts` — checkSpendLimit utility: query usage_tracking, compare against env var limits, warn at 80%, throw SPEND_LIMIT_REACHED at 100%, record usage after success
- `backend/src/lib/logger.ts` — structured JSON logger (use console with JSON.stringify for MVP, or pino if you prefer)
- `backend/src/lib/haversine.ts` — haversine distance calculation function
- `backend/src/lib/sms.ts` — mock SMS sender (logs to console, still tracks in usage_tracking)
- `backend/src/lib/geocode.ts` — mock geocode (returns Hamilton defaults, logs)

#### Zod primitives

- `backend/src/schemas/primitives.ts` — shared Zod types: uuid, email, postalCode, maxStores, difficulty, priceTier, ingredientSchema, nutritionSchema (from zod-strategy.md)

#### Empty route/service/query directories

Create placeholder `index.ts` barrel files or `.gitkeep` in:
- `backend/src/routes/`
- `backend/src/services/`
- `backend/src/db/queries/`
- `backend/src/pipelines/`

### 6. Generate frontend scaffold

#### Config and entry

- `frontend/package.json` — dependencies and scripts (from scaffolding spec)
- `frontend/tsconfig.json` — (from scaffolding spec)
- `frontend/vite.config.ts` — Vite config with React plugin
- `frontend/ionic.config.json` — Ionic configuration
- `frontend/capacitor.config.ts` — Capacitor config
- `frontend/index.html` — HTML entry with Google Fonts (Sora + Inter)

#### App shell

- `frontend/src/App.tsx` — IonApp + IonReactRouter + routes (/, /login, /register, /plans/:token) wrapped in AuthProvider and QueryClientProvider
- `frontend/src/pages/LandingPage.tsx` — placeholder page component
- `frontend/src/pages/LoginPage.tsx` — placeholder
- `frontend/src/pages/RegisterPage.tsx` — placeholder
- `frontend/src/pages/SharedPlanPage.tsx` — placeholder

#### Theme

- `frontend/src/theme/tokens.ts` — full design token export matching style-guide.md: all colors, font families, font weights, radii, spacing, shadows, breakpoints, animations

#### Services

- `frontend/src/services/api.ts` — base API client: typed fetch wrapper with auth header injection, base URL from env, snake_case/camelCase response mapping

#### Hooks

- `frontend/src/hooks/useAuth.ts` — auth context stub (JWT storage, isAuthenticated, login/register/logout functions)

#### Empty directories

Create placeholder files in:
- `frontend/src/components/`
- `frontend/src/modals/`
- `frontend/src/hooks/`
- `frontend/src/theme/icons/`
- `frontend/src/utils/`

### 7. Tooling setup

- ESLint config (`.eslintrc.json` or `eslint.config.js`) — TypeScript rules, no-any, consistent returns
- Vitest config in both backend and frontend
- Husky + lint-staged for pre-commit hooks (tsc + eslint + vitest)

### 8. Verify the scaffold

After generating everything:
1. Run `npm install` at the root
2. Run `tsc --noEmit` from both backend and frontend to confirm type checking passes
3. Run `npm test` to confirm vitest is configured (tests will be empty but should not error)
4. Verify `packages/shared/types.ts` is importable from both backend and frontend

## Output

List every file created, then confirm:
- [ ] npm install succeeds
- [ ] tsc --noEmit passes (backend + frontend)
- [ ] Vitest runs without config errors
- [ ] Shared types are importable from both packages
