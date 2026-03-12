# Seed Database

Generate or update the seed script (`backend/src/db/seed.ts`) with realistic Hamilton-area test data.

## Instructions

1. **Read the specs first:**
   - `docs/data/seed-data.md` — the canonical seed data specification (brands, locations, deals, meals, users)
   - `schema.sql` — table structures, constraints, column types
   - `packages/shared/types.ts` — domain object interfaces

2. **Generate `backend/src/db/seed.ts`** that:

   a. **Truncates all tables** in reverse dependency order (CASCADE)

   b. **Inserts store brands** (6) — No Frills, FreshCo, Food Basics, Fortinos, Metro, Walmart Supercentre

   c. **Inserts store locations** (12, 2 per brand) — all Hamilton/Burlington/Stoney Creek area with real addresses and approximate lat/lng

   d. **Inserts deals** (60, 10 per brand) — valid for the current week (Monday to Sunday), realistic Canadian prices, mix of categories

   e. **Inserts meals** (15) with full recipe data:
      - `ingredients` JSONB array with `{name, quantity, unit}`
      - `steps` array (4-6 numbered steps)
      - `filter_tags`, `taste_tags`, `ingredient_keywords`
      - `prep_time_minutes`, `cook_time_minutes`
      - `tips` field
      - Do NOT include prices on meals (meals are timeless, pricing is recalculated weekly)

   f. **Inserts users** (5) with:
      - Hamilton postal codes (L-series)
      - Hashed passwords using bcrypt (`testpassword123`)
      - Various budgets, dietary restrictions, household sizes

   g. **Inserts user meal preferences** (swipe data, 8-12 per user):
      - ~60% liked, ~40% skipped
      - Overlapping likes between users (for collaborative filtering)
      - Follow the specific overlap patterns in seed-data.md

   h. **Inserts important items** per user as specified in seed-data.md

   i. **Logs summary:** "Seeded: 6 brands, 12 locations, 60 deals, 15 meals, 5 users"

3. **ID generation:** Use deterministic UUIDs derived from name hashes (`crypto.createHash('sha256').update(name).digest('hex').slice(0, 32)` formatted as UUID). This makes the seed idempotent.

4. **Date handling:** Deal `valid_from` and `valid_to` should be computed from the current week (Monday to Sunday of the week when the seed runs).

5. **Dependencies:** Only use `pg` (database client) and `bcrypt` (password hashing). No external data generation libraries.

6. **Package.json scripts:** Ensure these scripts exist in `backend/package.json`:
   ```json
   {
     "seed": "tsx src/db/seed.ts",
     "seed:reset": "psql $DATABASE_URL -f ../schema.sql && tsx src/db/seed.ts"
   }
   ```
