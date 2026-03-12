# Preflight Check

Run all quality gates from the build plan's PR checklist before committing or creating a PR. This is the "measure twice, cut once" step.

## Input

$ARGUMENTS — Optional. A slice number (e.g. "4") to run checkpoint-level review, or "quick" for just type checking and linting.

## Instructions

### 1. Run the standard quality gates

Run these checks sequentially (each depends on the previous passing):

#### a. TypeScript type checking
```bash
npx tsc --noEmit -p backend/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json
```
Report any type errors with file paths and line numbers.

#### b. ESLint (zero warnings policy)
```bash
npx eslint . --ext .ts,.tsx --max-warnings 0
```
Report any lint errors or warnings.

#### c. Tests
```bash
cd backend && npm test
cd frontend && npm test
```
Report pass/fail counts and any failing test names.

#### d. Type contract validation
Run `/validate-types` to check for drift between schema.sql, api-contract.yaml, and packages/shared/types.ts.

### 2. Check the PR checklist items

After the automated checks, verify these manually by reading the code:

- [ ] **No `any` types** — grep for `: any` or `as any` in all .ts/.tsx files. Report any occurrences.
- [ ] **No hardcoded secrets** — grep for patterns that look like API keys, passwords, or tokens in source files (not .env). Check for strings matching common key patterns.
- [ ] **Error codes match catalog** — for any new AppError throws, verify the code exists in `docs/architecture/error-codes.md`.
- [ ] **snake_case ↔ camelCase at boundary** — verify that route handlers map between cases and services only use camelCase.
- [ ] **Spend limits on external calls** — for any code calling Claude, Twilio, Resend, or OpenCage, verify `checkSpendLimit()` is called before the API call and usage is recorded after.

### 3. If a slice number is provided, run checkpoint review

When `$ARGUMENTS` includes a slice number that's a checkpoint (4, 8, 12, 15), also run the deeper review from `/review-slice`. This adds:
- Spec compliance check (read each spec, compare to implementation)
- Cross-slice consistency
- Test quality assessment (error paths covered, not just happy paths)
- Security review (parameterized queries, JWT validation, bcrypt usage)

### 4. Report results

Present a clear pass/fail summary:

```
PREFLIGHT RESULTS
─────────────────
✓ TypeScript     — no errors
✓ ESLint         — no warnings
✓ Tests          — 47 passed, 0 failed
✓ Type contract  — schema/api/types aligned
✓ No any types   — clean
✓ No secrets     — clean
✓ Error codes    — all match catalog
✓ Case mapping   — correct at boundary
✓ Spend limits   — all external calls guarded

READY TO COMMIT
```

Or if there are failures:

```
PREFLIGHT RESULTS
─────────────────
✓ TypeScript     — no errors
✗ ESLint         — 2 warnings in backend/src/services/meals.service.ts
✓ Tests          — 45 passed, 2 failed
  FAIL backend/src/services/meals.service.test.ts > swipe > should reject duplicate swipe
  FAIL backend/src/routes/auth.test.ts > register > should hash password
✓ Type contract  — aligned
✗ No any types   — found 1 occurrence: backend/src/lib/claude.ts:42

BLOCKING: Fix 4 issues before committing
```

### 5. Quick mode

If `$ARGUMENTS` is "quick", only run steps 1a and 1b (type checking and linting). Skip tests and manual checks. Useful for fast iteration during development.
