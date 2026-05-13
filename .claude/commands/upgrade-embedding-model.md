# Upgrade Embedding Model: MiniLM → bge-base-en-v1.5

## Context

We use local embeddings via `@xenova/transformers` for semantic matching between recipe ingredients and grocery store deals. The current model `Xenova/all-MiniLM-L6-v2` (384 dims) produces too many false positives — it can't distinguish "butter" from "peanut butter crackers" or "lemon" from "lemonade" at the threshold boundary (0.6-0.65). We're upgrading to `Xenova/bge-base-en-v1.5` (768 dims, MTEB 63.6 vs 56.3) for better fine-grained grocery term distinction.

## What to Change

### 1. `backend/src/lib/embeddings.ts`
- Change `MODEL_NAME` from `'Xenova/all-MiniLM-L6-v2'` to `'Xenova/bge-base-en-v1.5'`
- Change `EMBEDDING_DIM` from `384` to `768`
- Keep `SIMILARITY_THRESHOLD = 0.65` (can tune after testing)
- Keep everything else (embed, embedBatch, cosineSimilarity, toPgVector) unchanged

### 2. `schema.sql`
- Change `embedding vector(384)` to `embedding vector(768)` on the deals table
- The HNSW index `idx_deals_embedding` uses `vector_cosine_ops` — recreate it after column change

### 3. Database migration (run via psql)
```sql
-- Drop the old index
DROP INDEX IF EXISTS idx_deals_embedding;
-- Change column type
ALTER TABLE deals ALTER COLUMN embedding TYPE vector(768);
-- Recreate HNSW index
CREATE INDEX idx_deals_embedding ON deals USING hnsw (embedding vector_cosine_ops);
```

### 4. `backend/src/db/queries/shoppingList.ts`
- In `findKeywordDealMatches`, change `$${vecParamIdx}::vector(384)` to `$${vecParamIdx}::vector(768)` in the VALUES clause

### 5. Re-embed all deals
After the code changes, run:
```bash
npx tsx /home/dev/groceryhack/backend/scripts/backfill-embeddings.ts --all
```
This script embeds using `deal.item_name` (already correct). It will re-embed all ~1900 deals with the new 768-dim model. Takes ~2-3 minutes.

### 6. `backend/src/db/queries/planner.ts`
- In `findMatchingDealsForKeywords`, the `COSINE_DISTANCE_THRESHOLD` is `0.4` (= similarity 0.6). Change to `0.35` (= similarity 0.65) to match the updated `SIMILARITY_THRESHOLD`.
- The VALUES clause also has `vector(384)` — change to `vector(768)`

## Files to Check for `384` References
Grep for `384` and `vector(384)` across the backend to catch any hardcoded dimension references:
- `backend/src/lib/embeddings.ts` — EMBEDDING_DIM
- `backend/src/db/queries/shoppingList.ts` — CTE VALUES clause
- `backend/src/db/queries/planner.ts` — CTE and COSINE_DISTANCE_THRESHOLD
- `schema.sql` — column definition

## Verification

1. **Build**: `cd backend && npx tsc --noEmit` — clean
2. **Tests**: `npx vitest run src/services/optimizer.test.ts src/pipelines/planner.test.ts` — all pass
3. **Restart backend**: `cd backend && npx tsx src/index.ts`
4. **Test matching quality**: Hit the landing API and check logs for:
   - `butter` should NOT match "Ritz Peanut Butter Crackers"
   - `lemon` should NOT match "Fruité Raspberry Lemonade" or "7Up Lemon Lime"
   - `parmesan cheese` should NOT match "Philadelphia Cream Cheese"
   - `feta cheese` SHOULD match "Saputo Feta Cheese"
   - `chicken breast` SHOULD match "Bone-In Skinless Chicken Breasts"
5. **Chrome**: Navigate to localhost:5173, check shopping list for sensible matches
6. **Compare**: The Pan-Seared Steak recipe should no longer show crackers, soda, or chips as matches

## Do NOT Change
- The matching algorithm in `landing.ts` (CTE + store optimization) — this is correct
- The `@xenova/transformers` package version
- The backfill script logic (it already uses `item_name`)
- The `cosineSimilarity` function
- Any frontend code
