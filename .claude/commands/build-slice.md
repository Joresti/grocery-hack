# Build Slice

Implement a complete vertical slice of the GroceryHack application following spec-first development.

## Input

$ARGUMENTS — A slice number (1-15) or name (e.g. "1", "auth", "stores-deals", "landing-ui")

## Instructions

### 1. Identify the slice

Read `build-plan.md` and find the matching slice. Extract:
- The slice number and name
- Every checklist item (these are your implementation tasks)
- The **Specs** line listing which files to read
- Whether this is a checkpoint slice (4, 8, 12, 15)

### 2. Read ALL referenced specs

Before writing a single line of code, read every spec file listed for this slice. Always read these four foundation files plus the slice-specific ones:

**Always read:**
- `schema.sql` — tables, constraints, indexes, triggers relevant to this slice
- `api-contract.yaml` — endpoint request/response shapes for this slice's endpoints
- `packages/shared/types.ts` — domain types you'll use or need to add
- `docs/architecture/error-codes.md` — error codes for this slice's domain

**Then read the slice-specific specs** listed in the build plan. Common ones:
- `docs/architecture/zod-strategy.md` — for any slice with Zod schemas
- `docs/architecture/env-spec.md` — for slices involving external APIs
- `docs/design/style-guide.md` — for frontend slices
- `docs/design/component-tree.md` — for frontend slices
- `docs/pipelines/scraper-pipeline.md` — for slice 11
- `docs/pipelines/planner-pipeline.md` — for slices 8, 12
- `specs/landing-page.md` — for slices 4, 5
- `specs/recipe-upload.md` — for slice 6
- `docs/design/email-templates.md` — for slices 9, 10
- `docs/architecture/analytics-spec.md` — for slices 14, 15

### 3. Check what already exists

Before generating files, check what code already exists for this slice's domain:
- Are there existing route, service, query, or schema files for this tag?
- Are there existing frontend components or hooks?
- Does `packages/shared/types.ts` already have the types you need, or do you need to add new ones?

If files exist, append to them rather than overwriting.

### 4. Implement in order: database → backend → frontend

Follow this sequence within the slice. Each layer builds on the previous one.

#### a. Database queries (`backend/src/db/queries/{table}.ts`)

- One file per table, one exported async function per query
- Raw SQL with parameterized queries only (`$1`, `$2`, etc.) — never string interpolation
- snake_case column names in SQL
- Return typed results using the shared types
- Match the exact table structure from `schema.sql`

#### b. Zod schemas (`backend/src/schemas/{tag}.ts`)

- Follow the patterns in `docs/architecture/zod-strategy.md` exactly
- snake_case input fields with `.transform()` to camelCase output
- Use primitives from `schemas/primitives.ts` where applicable
- Export inferred types via `z.output<typeof schema>`
- Validate every field constraint from `api-contract.yaml`

#### c. Service layer (`backend/src/services/{tag}.service.ts`)

- Business logic only — no HTTP concepts (no req, res, status codes)
- Accept camelCase params (output of Zod transform)
- Return domain objects from `packages/shared/types.ts`
- Throw AppError with codes from `docs/architecture/error-codes.md`
- Check spend limits before any external API call (Claude, email, SMS, geocode)
- Call database query functions, not raw SQL

#### d. Route handlers (`backend/src/routes/{tag}.ts`)

- HTTP concerns only — parse request, call service, format response
- Use `validate()` middleware with the Zod schemas
- Map camelCase service output back to snake_case for JSON response
- Wrap async handlers to catch errors (or use express-async-errors)
- Response shapes must match `api-contract.yaml` exactly

#### e. Frontend components (if the slice includes UI)

- Read `docs/design/component-tree.md` for the component hierarchy
- Read `docs/design/style-guide.md` for colors, typography, spacing, animations
- Use design tokens from `frontend/src/theme/tokens.ts`
- Ionic React components with Capacitor compatibility
- Custom SVG icons only — no icon libraries
- TanStack React Query for server state
- Framer Motion or CSS transitions for animations
- All interactive elements must respect AuthGate (anonymous → sign-up prompt)

#### f. Tests (`*.test.ts` next to source)

- Vitest for all tests
- Test happy paths AND error paths
- Test Zod schema validation (valid input passes, invalid fails with correct error)
- Test service logic with mocked database queries
- Test that error codes match the catalog
- For services calling external APIs: test spend limit enforcement

### 5. Cross-cutting concerns

Apply these to every file you generate:

- **TypeScript strict mode**: No `any` types. Explicit return types on all functions.
- **Named exports** everywhere (except React page components which use default export)
- **async/await** only — no raw callbacks or `.then()` chains
- **camelCase** for variables, functions, component names, file names
- **PascalCase** for types, interfaces, components, classes
- **Error shape**: `{"error": true, "code": "MACHINE_READABLE", "message": "Human-readable"}`
- **Spend limits**: Query `usage_tracking` before ANY paid external call, warn at 80%, block at 100%
- **snake_case ↔ camelCase**: Map at the route handler boundary, not in services

### 6. Verify consistency

After generating all files for the slice:
- Confirm Zod schemas match `api-contract.yaml` request shapes
- Confirm SQL queries match `schema.sql` table structures
- Confirm services use types from `packages/shared/types.ts`
- Confirm error codes match `docs/architecture/error-codes.md`
- Confirm response shapes match `api-contract.yaml` response schemas

### 7. Checkpoint slices (4, 8, 12, 15)

If this is a checkpoint slice, remind the user to run `/review-slice` after implementation is complete. The review covers spec compliance, cross-slice consistency, security, test quality, and spend limit enforcement.

## Output

Provide a summary listing:
1. All files created or modified
2. Any new types added to `packages/shared/types.ts`
3. Any spec ambiguities or decisions you made
4. Reminder to run tests (`cd backend && npm test`)
