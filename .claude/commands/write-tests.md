# Write Tests

Generate comprehensive tests for a given module, following the testing strategy from the relevant spec.

## Input

$ARGUMENTS — A file path or module name to test (e.g. "backend/src/services/auth.service.ts", "auth", "optimizer", "scraper")

## Instructions

### 1. Find the module

Resolve `$ARGUMENTS` to specific source files:
- If it's a file path, test that file directly
- If it's a module name (e.g. "auth"), find all related files: `services/auth.service.ts`, `routes/auth.ts`, `schemas/auth.ts`, `db/queries/users.ts`1
- If it's a pipeline name ("scraper", "planner", "optimizer"), find `pipelines/{name}.ts` and supporting files

### 2. Read the spec's testing strategy

Every spec includes a testing strategy section. Find and read the relevant one:

| Module | Testing strategy in |
|--------|-------------------|
| Auth | `api-contract.yaml` (Auth tag) + standard patterns |
| Stores, Deals | `api-contract.yaml` (Stores/Deals tags) |
| Meals, Swiping | `api-contract.yaml` (Meals tag) + `docs/pipelines/planner-pipeline.md` (approval score section) |
| Landing page | `specs/landing-page.md` |
| Recipes | `specs/recipe-upload.md` + `api-contract.yaml` (Recipes tag) |
| Watchlist, Items | `api-contract.yaml` (Watchlist/ImportantItems tags) |
| Optimizer | `docs/pipelines/planner-pipeline.md` (Steps 10-11: optimizer tests) |
| Scraper | `docs/pipelines/scraper-pipeline.md` (Testing Strategy section) |
| Planner | `docs/pipelines/planner-pipeline.md` (Testing Strategy section — 13 items) |
| Email | `docs/design/email-templates.md` |
| Events | `docs/architecture/analytics-spec.md` |
| Zod schemas | `docs/architecture/zod-strategy.md` (Testing section) |

### 3. Read the source code

Read every source file you're testing. Understand:
- Function signatures and return types
- External dependencies (database queries, APIs, other services)
- Error paths (what throws, what error codes)
- Edge cases in the business logic

### 4. Generate tests

Create test files co-located with source: `auth.service.ts` → `auth.service.test.ts`

#### Test framework: Vitest

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

#### Test structure

For each function in the module:

**a. Happy path tests** — the function works correctly with valid inputs
```typescript
it('should register a new user with valid input', async () => { ... });
it('should return JWT token on successful login', async () => { ... });
```

**b. Error path tests** — every error code from error-codes.md that this function can throw
```typescript
it('should throw EMAIL_ALREADY_EXISTS for duplicate registration', async () => { ... });
it('should throw INVALID_CREDENTIALS for wrong password', async () => { ... });
```

**c. Edge case tests** — boundary conditions, empty states, null handling
```typescript
it('should handle empty dietary restrictions array', async () => { ... });
it('should return empty meals array when no deals match', async () => { ... });
```

**d. Validation tests** — for Zod schemas
```typescript
it('should reject email without @ symbol', async () => { ... });
it('should reject password shorter than 8 characters', async () => { ... });
it('should transform snake_case input to camelCase', async () => { ... });
```

**e. Spend limit tests** — for any function calling external APIs
```typescript
it('should throw SPEND_LIMIT_REACHED when at 100% budget', async () => { ... });
it('should log warning when at 80% budget', async () => { ... });
it('should record usage after successful API call', async () => { ... });
```

#### Mocking strategy

- **Database queries**: Mock the query functions from `db/queries/` — test business logic, not SQL
- **External APIs**: Mock Claude, Twilio, email providers — never make real API calls in tests
- **Auth middleware**: Mock JWT verification for route tests
- **Time**: Use `vi.useFakeTimers()` for time-dependent tests (token expiry, flyer dates)
- **Environment variables**: Use `vi.stubEnv()` for spend limits and config

#### Test naming conventions

- Describe blocks match the function or feature name
- Test names read as sentences: "should {expected behavior} when {condition}"
- Group related tests: describe('register'), describe('login'), describe('refresh')

### 5. Check test coverage targets

From the build plan, tests should cover:
- All happy paths
- All error codes listed in error-codes.md for this module
- Spend limit enforcement for any external API call
- snake_case ↔ camelCase mapping at route boundaries
- Zod schema validation (valid passes, invalid fails with correct path)

### 6. Run the tests

After generating, run the tests to verify they pass:
```bash
cd backend && npx vitest run {test-file-path}
```
or
```bash
cd frontend && npx vitest run {test-file-path}
```

If tests fail, diagnose whether the issue is in the test (fix the test) or the source code (report the bug).

## Output

List:
- Test files created
- Test count: X tests across Y describe blocks
- Coverage: which functions/error codes are covered
- Any gaps: error codes or edge cases from the spec that couldn't be tested (and why)