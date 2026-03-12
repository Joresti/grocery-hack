# Scaffold Route

Generate the full file set for a new API endpoint: route handler, service, database query, and Zod schema.

## Input

$ARGUMENTS — An endpoint description, e.g. "POST /meals/{meal_id}/swipe" or "GET /deals/notable"

## Instructions

1. **Read the specs first.** Before generating any code:
   - Read `api-contract.yaml` to find the endpoint definition (request/response shapes)
   - Read `schema.sql` to understand the relevant tables and columns
   - Read `packages/shared/types.ts` for existing domain types
   - Read `docs/architecture/zod-strategy.md` for the Zod schema pattern
   - Read `docs/architecture/error-codes.md` for relevant error codes

2. **Determine the API tag.** The endpoint's tag in `api-contract.yaml` determines which file it belongs to (e.g., tag `Meals` → `routes/meals.ts`, `services/meals.service.ts`, etc.).

3. **Generate these files** (or append to existing files if they already exist):

### a. Zod schema (`backend/src/schemas/{tag}.ts`)

```typescript
// snake_case input → .transform() → camelCase output
// Use z.output<typeof schema> for the inferred type
// Follow patterns in docs/architecture/zod-strategy.md exactly
```

- Path params: `{tag}Params` schema
- Query params: `{tag}Query` schema (if GET with query params)
- Request body: `{tag}Body` schema (if POST/PATCH/PUT)
- All fields snake_case on input, camelCase after transform

### b. Database query (`backend/src/db/queries/{table}.ts`)

```typescript
// Raw SQL with parameterized queries only ($1, $2, etc.)
// snake_case column names
// Return typed results
// One function per query
```

### c. Service (`backend/src/services/{tag}.service.ts`)

```typescript
// Business logic only — no HTTP concepts (no req, res, status codes)
// Accept camelCase params (output of Zod transform)
// Return domain objects (from packages/shared/types.ts)
// Throw AppError with codes from error-codes.md
// Check spend limits before any external API call
```

### d. Route handler (`backend/src/routes/{tag}.ts`)

```typescript
// HTTP concerns only — parse request, call service, format response
// Use validate() middleware with Zod schema
// Map camelCase service output back to snake_case for JSON response
// Catch errors (global error handler takes care of formatting)
```

4. **Check for consistency:**
   - Does the Zod schema match the api-contract.yaml definition?
   - Does the SQL query match the schema.sql table structure?
   - Does the service use types from packages/shared/types.ts?
   - Are all error codes from error-codes.md used correctly?

5. **Output a summary** listing all files created/modified and any warnings about missing specs.
