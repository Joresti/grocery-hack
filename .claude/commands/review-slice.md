# Review Slice

Deep code review at checkpoint boundaries. Run after slices 4, 8, 12, and 15.

## Input

$ARGUMENTS — The slice range to review, e.g. "1-4" or "9-12"

## Instructions

### 1. Identify what was built

Read `build-plan.md` to determine which slices are in scope. For each slice, identify the files that were created or modified by checking git:

```bash
# See all files changed across the slice branches
git log --oneline --name-only main..HEAD
```

### 2. Spec compliance check

For each slice, read the spec files listed in `build-plan.md` and compare against the implementation:

- **API contract**: Does every endpoint in `api-contract.yaml` for these slices exist? Do request/response shapes match exactly?
- **Schema**: Do queries match `schema.sql` table structures? Are indexes being used?
- **Types**: Does the code use types from `packages/shared/types.ts`? Any local type definitions that should be shared?
- **Error codes**: Does every error thrown use a code from `docs/architecture/error-codes.md`? Any raw throws?
- **Zod schemas**: Do they follow the pattern in `docs/architecture/zod-strategy.md`? snake_case input → transform → camelCase?

### 3. Cross-slice consistency check

Look for patterns across the slices:

- **Duplicated logic**: Are multiple services doing the same thing? (e.g., two places that format dates, two places that check spend limits)
- **Shared utilities**: Is `backend/src/lib/` being used for cross-cutting concerns? Or is logic scattered?
- **Error handling**: Is the error handler middleware catching all errors? Any unhandled promise rejections?
- **Import patterns**: Are all domain types coming from `packages/shared/types.ts`? Any local duplicates?

### 4. Security check

- [ ] All SQL queries use parameterized values ($1, $2) — no string interpolation
- [ ] No `any` types anywhere
- [ ] JWT middleware validates token on all protected routes
- [ ] Passwords are hashed with bcrypt (never stored or logged in plaintext)
- [ ] No secrets in code (API keys, passwords, tokens)
- [ ] Rate limiting is applied
- [ ] CORS is configured (not wide open)
- [ ] Input validation via Zod on every endpoint that accepts user input

### 5. Spend limit check

For every external API call in the reviewed code:

- [ ] `checkSpendLimit()` is called BEFORE the API call
- [ ] Usage is tracked AFTER a successful call
- [ ] Pipeline code handles mid-run cap correctly (skip + log, don't crash)
- [ ] User-facing calls return `SPEND_LIMIT_REACHED` error

### 6. Test quality check

For each test file:

- Does it test the **happy path**?
- Does it test **error paths** (invalid input, not found, unauthorized, duplicate)?
- Does it test **edge cases** (empty arrays, null values, boundary values)?
- Are tests **isolated** (no test depends on another test's state)?
- Do tests use **realistic data** (not just `"test"` and `123`)?

### 7. Output the report

```
## Review Report: Slices {N}-{M}

### Spec Compliance
| Slice | Spec file | Status | Issues |
|-------|-----------|--------|--------|
| ...   | ...       | PASS/FAIL | ... |

### Cross-Slice Issues
- {description of issue + suggested fix}

### Security
- [ ] Parameterized queries: {PASS/FAIL}
- [ ] No `any` types: {PASS/FAIL}
- [ ] JWT middleware: {PASS/FAIL}
...

### Spend Limits
- {list of external calls and whether they check limits}

### Test Coverage
| File | Happy path | Error paths | Edge cases | Verdict |
|------|-----------|-------------|------------|---------|
| ...  | ...       | ...         | ...        | ...     |

### Action Items
1. {thing to fix, with file path and line number}
2. ...

### Verdict
{PASS — safe to continue | BLOCK — fix action items first}
```

Do NOT modify any files. Report findings so the user can decide what to fix.