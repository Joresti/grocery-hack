# Validate Types

Check that `packages/shared/types.ts` is consistent with `schema.sql` and `api-contract.yaml`. Report all mismatches.

## Instructions

1. **Read all three files:**
   - `schema.sql` — database tables, columns, types, constraints
   - `api-contract.yaml` — API schemas under `components/schemas`
   - `packages/shared/types.ts` — TypeScript interfaces and types

2. **Check schema.sql → types.ts alignment:**

   For every table in `schema.sql`, verify that `types.ts` has a matching interface with:
   - Every column represented as a property (snake_case → camelCase)
   - Correct type mapping:
     - `UUID` → `string`
     - `TEXT` → `string`
     - `TEXT[]` → `string[]`
     - `BOOLEAN` → `boolean`
     - `INTEGER`, `SMALLINT` → `number`
     - `NUMERIC(x,y)` → `number`
     - `DOUBLE PRECISION` → `number`
     - `JSONB` → specific interface or `Record<string, unknown>`
     - `TIMESTAMPTZ` → `string` (ISO format)
     - `DATE` → `string`
   - Nullable columns (`NOT NULL` absent) have `| null` in the type
   - `DEFAULT` values don't affect the TypeScript type (they exist at DB level)
   - CHECK constraints with enums match TypeScript literal union types

3. **Check api-contract.yaml → types.ts alignment:**

   For every schema under `components/schemas` in the API contract, verify:
   - A matching interface exists in `types.ts`
   - Property names match (snake_case in YAML → camelCase in TS)
   - Types match (`type: string` → `string`, `type: integer` → `number`, etc.)
   - `nullable: true` in YAML → `| null` in TS
   - `enum` values in YAML → literal union types in TS
   - `$ref` references resolve to the correct TS interface
   - Array items match

4. **Check types.ts → api-contract.yaml alignment (reverse):**

   For every interface in `types.ts` that represents an API response, verify it has a corresponding schema in `api-contract.yaml`. Flag any interfaces that exist in TS but not in the API contract (may indicate stale types).

5. **Check EventType completeness:**
   - Every `event_type` referenced in `docs/architecture/analytics-spec.md` exists in the `EventType` union
   - Every value in the `EventType` union is documented in the analytics spec

6. **Output a report** in this format:

```
## Validation Report

### Matches (X)
- [table/schema] → [interface]: OK

### Mismatches (X)
- [table/schema] → [interface]: [description of mismatch]
  - Expected: [what it should be]
  - Found: [what it actually is]

### Missing (X)
- [table/schema]: No matching interface in types.ts
- [interface]: No matching schema in api-contract.yaml

### Warnings (X)
- [any other inconsistencies]
```

Do NOT modify any files. This is a read-only validation check. Report findings so the user can decide what to fix.
