# Planner Pipeline Specification

> Pipeline 2 of 2. Runs every Wednesday at 7am ET via node-cron.

## Overview

The planner generates personalized weekly meal plans and shopping lists for each active user. It combines deal-first matching, collaborative filtering (Netflix-style "users who liked X also liked A, B, C"), community approval scores, and budget-tiered presentation. Claude Sonnet always generates at least 2-3 new meals per run to keep the database fresh, with more generated when DB matches are short. A deterministic code-based optimizer then assigns items to the cheapest stores.

## Architecture

```
For each user where subscription_active = true:

  1. Get user's active important items
  2. Find nearby store locations within radius (haversine)
  3. Get active deals from those store brands
  4. Check deal watchlist for alerts
  5. Match existing DB meals against deals + dietary filters + approval scores
  6. Collaborative filtering: find meals liked by similar users
  7. Score and rank all candidate meals (deal overlap + collaborative + approval + budget fit)
  8. Claude Sonnet generates new meals (always min 2-3, more if gaps exist)
  9. Jaccard similarity check before saving new meals
  10. Code-based optimizer builds shopping plans (1-store and 2-store)
  11. Check user recipe alerts
  12. Save weekly_plan with token
  13. Send email
```

## Step-by-Step Detail

### Step 1: Get User's Active Important Items

```sql
SELECT id, name, quantity
FROM important_items
WHERE user_id = $1
  AND is_active = true;
```

If no active important items exist, skip the important items section in the plan (meals-only plan).

### Step 2: Find Nearby Store Locations

```sql
SELECT sl.*,
       sb.name AS brand_name,
       sb.id AS store_brand_id,
       haversine(sl.lat, sl.lng, $1, $2) AS distance_km
FROM store_locations sl
JOIN store_brands sb ON sb.id = sl.store_brand_id
WHERE haversine(sl.lat, sl.lng, $1, $2) < $3
  AND sb.scrape_status = 'ok'
ORDER BY distance_km;
```

- `$1, $2` = user's lat/lng (geocoded from postal code)
- `$3` = `PLANNER_SEARCH_RADIUS_KM` env var (default: 10)
- Only include locations whose brand has `scrape_status = 'ok'`
- Multiple locations of the same brand may appear — the optimizer picks the nearest one per brand

### Step 3: Get Active Deals

Deals belong to `store_brands`, not individual locations. Deduplicate by brand — if a user has 3 No Frills locations nearby, they all share the same deals.

```sql
SELECT DISTINCT ON (d.id)
       d.*,
       sb.name AS brand_name
FROM deals d
JOIN store_brands sb ON sb.id = d.store_brand_id
WHERE d.store_brand_id = ANY($1)
  AND CURRENT_DATE BETWEEN d.valid_from AND d.valid_to
ORDER BY d.id, d.category, d.item_name;
```

`$1` = unique brand IDs from the nearby locations found in Step 2.

### Step 4: Check Deal Watchlist

```sql
SELECT * FROM deal_watchlist WHERE user_id = $1;
```

For each watchlist item, find matching deals using fuzzy text matching on `item_name` against `item_keyword`. A match must also satisfy `deal.sale_price <= watchlist.benchmark_price` (the price the user originally found exciting). If a `store_brand_id` is set on the watchlist entry, only match deals from that brand.

Collect matches as `watchlistAlerts` — these appear in the plan and the email.

### Step 5: Match Existing Meals Against Deals

This is the core "deal-first" logic. Extract ingredient keywords from all active deals, then find meals whose ingredients overlap. Include community approval scores in the results.

```sql
SELECT m.*,
       array_length(
         ARRAY(
           SELECT unnest(m.ingredient_keywords)
           INTERSECT
           SELECT unnest($1::text[])
         ), 1
       ) AS deal_overlap,
       m.approval_score,
       m.swipe_right_count + m.swipe_left_count AS total_swipes
FROM meals m
WHERE m.filter_tags @> $2
  AND (m.approval_score IS NULL OR m.approval_score >= 0.3)  -- exclude clearly disliked meals
ORDER BY deal_overlap DESC NULLS LAST
LIMIT 50;
```

- `$1` = ingredient keywords extracted from deals (see Ingredient Keyword Extraction below)
- `$2` = user's dietary restrictions (e.g. `{"vegetarian", "gluten-free"}`)
- Filter out meals with approval scores below 0.3 (strongly disliked by the community)
- Fetch 50 candidates (more than needed) so scoring can work with a rich pool
- `approval_score IS NULL` passes through new meals that haven't been rated yet

### Step 6: Collaborative Filtering

Netflix-style recommendation: find users with similar taste, recommend what they liked that this user hasn't seen.

#### 6a. Find Similar Users

```sql
-- Get the 20 most similar users based on shared meal preferences
WITH user_likes AS (
  SELECT meal_id FROM user_meal_preferences
  WHERE user_id = $1 AND liked = true
),
other_users AS (
  SELECT
    ump.user_id,
    COUNT(*) FILTER (WHERE ump.liked = true AND ump.meal_id IN (SELECT meal_id FROM user_likes)) AS shared_likes,
    COUNT(*) AS total_votes
  FROM user_meal_preferences ump
  WHERE ump.user_id != $1
  GROUP BY ump.user_id
  HAVING COUNT(*) FILTER (WHERE ump.liked = true AND ump.meal_id IN (SELECT meal_id FROM user_likes)) >= 2
)
SELECT user_id,
       shared_likes::float / GREATEST(total_votes, 1) AS similarity
FROM other_users
ORDER BY shared_likes DESC
LIMIT 20;
```

- Requires the current user to have at least a few swipes for meaningful results
- `shared_likes >= 2` threshold prevents noise from single-meal overlap
- Returns up to 20 similar users with a similarity score

#### 6b. Get Collaborative Recommendations

```sql
-- Meals liked by similar users that this user hasn't swiped on
SELECT
  m.*,
  COUNT(DISTINCT ump.user_id) AS recommender_count,
  AVG(ou.similarity) AS avg_recommender_similarity
FROM user_meal_preferences ump
JOIN meals m ON m.id = ump.meal_id
JOIN (
  -- similar_users CTE from 6a, passed as parameter
  SELECT unnest($2::uuid[]) AS user_id, unnest($3::float[]) AS similarity
) ou ON ou.user_id = ump.user_id
WHERE ump.liked = true
  AND ump.meal_id NOT IN (
    SELECT meal_id FROM user_meal_preferences WHERE user_id = $1
  )
  AND m.filter_tags @> $4  -- dietary restrictions
GROUP BY m.id
ORDER BY recommender_count DESC, avg_recommender_similarity DESC
LIMIT 20;
```

This produces meals that similar users loved but the current user hasn't seen yet. Each gets a `collaborative_score`:

```typescript
// collaborative_score = weighted sum of recommender signals
function collaborativeScore(
  recommenderCount: number,
  avgSimilarity: number,
  maxRecommenders: number
): number {
  // Normalize recommender count to 0-1
  const countScore = Math.min(recommenderCount / Math.max(maxRecommenders, 1), 1);
  // Weight by how similar those recommenders are
  return countScore * 0.6 + avgSimilarity * 0.4;
}
```

#### 6c. Cold Start Handling

When a user has fewer than 5 swipes, collaborative filtering has no data. Fall back to:
1. Community approval score (global popularity)
2. Deal overlap (on-sale ingredients)
3. Recency (newer meals get a small boost to ensure exposure)

```typescript
const MIN_SWIPES_FOR_COLLAB = 5;
const useCollabFiltering = userSwipeCount >= MIN_SWIPES_FOR_COLLAB;
```

### Step 7: Score and Rank All Candidate Meals

Merge the deal-matched meals (Step 5) and collaborative recommendations (Step 6) into a single scored pool.

```typescript
interface ScoredMeal {
  meal: Meal;
  dealOverlap: number;        // 0-1 normalized (overlap count / max overlap in pool)
  collaborativeScore: number;  // 0-1 from Step 6 (0 for cold start users)
  approvalScore: number;       // 0-1 from meals table (0.5 default for unrated)
  budgetFit: number;           // 0-1, see below
  finalScore: number;          // weighted combination
  budgetTier: 'value' | 'sweet_spot' | 'splurge';
}

// Scoring weights
const WEIGHTS = {
  dealOverlap: 0.30,
  collaborative: 0.30,
  approval: 0.20,
  budgetFit: 0.20,
};

function scoreMeal(
  meal: Meal,
  dealOverlap: number,
  collaborativeScore: number,
  deals: Deal[],
  userBudget: number | null,
  mealsNeeded: number
): ScoredMeal {
  // Normalize deal overlap to 0-1
  const normalizedOverlap = Math.min(dealOverlap / 5, 1); // cap at 5 ingredients

  // Approval score: use 0.5 for unrated meals (neutral)
  const approval = meal.approvalScore ?? 0.5;

  // Budget fit: estimate meal cost from deals, score by how well it fits
  const estimatedCost = estimateMealCost(meal, deals);
  const perMealBudget = userBudget ? userBudget / mealsNeeded : null;
  const { budgetFit, budgetTier } = calculateBudgetFit(estimatedCost, perMealBudget);

  // For cold start users, redistribute collaborative weight to deal overlap and approval
  const weights = collaborativeScore > 0
    ? WEIGHTS
    : { dealOverlap: 0.40, collaborative: 0, approval: 0.35, budgetFit: 0.25 };

  const finalScore =
    normalizedOverlap * weights.dealOverlap +
    collaborativeScore * weights.collaborative +
    approval * weights.approval +
    budgetFit * weights.budgetFit;

  return {
    meal,
    dealOverlap,
    collaborativeScore,
    approvalScore: approval,
    budgetFit,
    finalScore,
    budgetTier,
  };
}
```

#### Budget Fit Calculation

```typescript
function calculateBudgetFit(
  estimatedCost: number,
  perMealBudget: number | null
): { budgetFit: number; budgetTier: 'value' | 'sweet_spot' | 'splurge' } {
  if (!perMealBudget) {
    // No budget set — all meals are "sweet spot", neutral score
    return { budgetFit: 0.7, budgetTier: 'sweet_spot' };
  }

  const ratio = estimatedCost / perMealBudget;

  if (ratio <= 0.75) {
    // Under budget — good value
    return { budgetFit: 0.9, budgetTier: 'value' };
  } else if (ratio <= 1.0) {
    // At budget — sweet spot
    return { budgetFit: 1.0, budgetTier: 'sweet_spot' };
  } else if (ratio <= 1.25) {
    // Slightly over — splurge-worthy if the meal is great
    return { budgetFit: 0.6, budgetTier: 'splurge' };
  } else {
    // Too expensive
    return { budgetFit: 0.2, budgetTier: 'splurge' };
  }
}
```

#### Meal Cost Estimation

```typescript
function estimateMealCost(meal: Meal, deals: Deal[]): number {
  let total = 0;
  const dealMap = buildDealLookup(deals); // keyword → cheapest deal

  for (const ingredient of meal.ingredients) {
    const keyword = ingredient.name.toLowerCase();
    const deal = dealMap.get(keyword);
    if (deal) {
      total += deal.salePrice;
    } else {
      // No deal found — estimate from regular price or use fallback
      total += deal?.regularPrice ?? estimatePantryPrice(keyword);
    }
  }

  return total;
}

// Conservative fallback prices for common pantry items
function estimatePantryPrice(keyword: string): number {
  const PANTRY_ESTIMATES: Record<string, number> = {
    'salt': 0.10, 'pepper': 0.15, 'olive oil': 0.50,
    'garlic': 0.50, 'onion': 0.75, 'butter': 1.00,
    'flour': 0.30, 'sugar': 0.20, 'soy sauce': 0.30,
    // ... expanded as needed
  };
  return PANTRY_ESTIMATES[keyword] ?? 1.50; // default $1.50 for unknown items
}
```

### Step 8: Meal Selection with Budget Tiers

Select meals from the scored pool ensuring variety in protein, budget tier, and cuisine.

```typescript
function pickBestMeals(
  candidates: ScoredMeal[],
  primaryCount: number = 5,
  alternateCount: number = 3
): { primary: ScoredMeal[]; alternates: ScoredMeal[] } {
  // Sort by final weighted score
  const sorted = candidates
    .filter(m => m.dealOverlap >= 1)  // at least 1 ingredient on sale
    .sort((a, b) => b.finalScore - a.finalScore);

  const selected: ScoredMeal[] = [];
  const usedProteins = new Set<string>();
  const tierCounts = { value: 0, sweet_spot: 0, splurge: 0 };

  for (const meal of sorted) {
    if (selected.length >= primaryCount) break;

    const protein = meal.meal.tasteTags?.protein ?? 'none';

    // Enforce protein variety: no more than 2 of same protein
    if (usedProteins.has(protein) && selected.filter(
      s => (s.meal.tasteTags?.protein ?? 'none') === protein
    ).length >= 2) continue;

    // Enforce budget tier variety: aim for mix of tiers
    // Allow max 3 of any single tier in primary meals
    if (tierCounts[meal.budgetTier] >= 3) continue;

    selected.push(meal);
    usedProteins.add(protein);
    tierCounts[meal.budgetTier]++;
  }

  // Alternates: next best that aren't in primary
  const alternates = sorted
    .filter(m => !selected.includes(m))
    .slice(0, alternateCount);

  return { primary: selected, alternates };
}
```

**Budget tier presentation in the frontend:**
- **Value** meals: tagged with "Great Value" — under budget
- **Sweet spot** meals: no special tag — right at budget
- **Splurge** meals: tagged with "Worth the Splurge" — slightly over budget but highly rated

### Step 9: Generate New Meals with Claude Sonnet

**Always generates at least `MIN_NEW_MEALS` (2-3) per run** to keep the database growing and content fresh. Generates more when the scored pool doesn't fill the needed slots.

```
MEALS_NEEDED = 8           // 5 primary + 3 alternates
MIN_NEW_MEALS = 3          // always generate at least this many
good_matches = scored meals from Steps 5-8
gap = max(MIN_NEW_MEALS, MEALS_NEEDED - len(good_matches))
```

#### Meal Generation — System Prompt

```
You are a meal planning chef for a Canadian grocery deal app. You create practical, family-friendly dinner recipes that use ingredients currently on sale at local grocery stores.

Your recipes must be:
- Achievable for home cooks with basic skills (no sous vide, no blowtorches, no specialty equipment)
- Ready in under 60 minutes total (prep + cook)
- Built around the sale ingredients provided — at least 2-3 key ingredients per recipe must come from the deals list
- Portioned for the household size specified

You will be asked to generate meals across different budget tiers:
- VALUE meals: maximize savings, use mostly sale items, keep total cost well under the per-meal budget
- SWEET SPOT meals: balanced cost and quality, use several sale items but don't compromise on the recipe
- SPLURGE meals: prioritize meal quality, use some sale items but allow premium ingredients if they make the dish great

Each recipe must include ALL of the following fields:

{
  "name": string,                    // Creative but clear name. Not generic ("Chicken Dinner") or pretentious ("Deconstructed Rustic Galette")
  "tagline": string,                 // One punchy line, max 8 words. Personality encouraged. e.g. "Crispy outside, melty inside 🧀"
  "description": string,            // 1-2 sentences explaining the dish
  "ingredients": [                   // Every ingredient needed, including pantry staples
    {"name": "chicken thighs", "quantity": "1.5", "unit": "lb"},
    {"name": "olive oil", "quantity": "2", "unit": "tbsp"}
  ],
  "steps": [string],                // 4-6 clear steps. Start each with a verb. No sub-steps.
  "prep_time_minutes": number,       // Realistic prep time
  "cook_time_minutes": number,       // Realistic cook time
  "servings": number,               // Must match household_size (or nearest reasonable portion)
  "difficulty": "easy" | "medium",  // No "hard" — this app is for everyday cooking
  "filter_tags": [string],          // Dietary tags: "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "halal", "kosher"
  "taste_tags": {                   // For taste profile matching
    "protein": "chicken",            // Primary protein (or "none" for vegetarian)
    "cuisine": "asian",              // Broad cuisine category
    "style": "stir-fry"             // Cooking style
  },
  "tips": string | null,            // One practical tip. "Leftovers keep 3 days in the fridge." or null
  "ingredient_keywords": [string],  // Lowercase, singular: ["chicken", "broccoli", "rice", "soy sauce", "garlic"]
  "budget_tier": "value" | "sweet_spot" | "splurge"  // Which tier this recipe targets
}

RULES:
1. Every recipe must use at least 2 ingredients from the DEALS list.
2. Include ALL ingredients — don't assume the cook has oil, salt, garlic, etc.
3. Steps must be specific: "Cook chicken thighs skin-side down for 5 minutes" not "Cook the chicken."
4. Servings must match HOUSEHOLD SIZE. Scale ingredient quantities accordingly.
5. Respect ALL dietary restrictions — no exceptions.
6. Do not duplicate or closely resemble any meal in the EXISTING MEALS list.
7. ingredient_keywords must be lowercase, singular nouns. These are used for deal matching and deduplication.
8. Generate meals across the budget tiers as requested in the BUDGET GUIDANCE section.
9. Return ONLY the JSON array. No markdown, no explanation, no code fences.
```

#### Meal Generation — User Message

```
Generate {gap} dinner recipes.

HOUSEHOLD SIZE: {household_size}
DIETARY RESTRICTIONS: {dietary_restrictions}

BUDGET GUIDANCE:
- Weekly budget: ${budget} for {meals_needed} meals
- Per-meal target: ~${per_meal_budget}
- Generate approximately: {value_count} VALUE meals, {sweet_count} SWEET SPOT meals, {splurge_count} SPLURGE meals

INGREDIENTS ON SALE THIS WEEK:
- Chicken Thighs — $3.99/lb at No Frills (reg $6.99, save $3.00)
- Broccoli Crown — $2.49 each at No Frills
- Olive Oil 1L — $8.99 at FreshCo (reg $13.99, save $5.00)
...

EXISTING MEALS TO AVOID DUPLICATING:
- Honey Garlic Chicken Stir-Fry
- One-Pan Lemon Herb Salmon
- Veggie Black Bean Tacos
...

POPULAR WITH SIMILAR USERS (generate meals in this style too):
- Asian-style stir-fries with rice (high approval)
- One-pan Mediterranean dishes (trending)
- Quick pasta bakes (budget favorites)
```

The "POPULAR WITH SIMILAR USERS" section is derived from the collaborative filtering data — it tells Claude what flavors and styles are trending in the community so new meals align with proven preferences.

#### Why Sonnet (Not Haiku) for Meal Generation

Meal generation requires creativity, coherent multi-step instructions, and balanced portioning. Haiku produces generic recipes with vague steps. Sonnet produces recipes that feel like a food blogger wrote them — which is the quality bar for the app.

### Step 10: Jaccard Similarity Check

Before saving any generated meal to the database:

```typescript
function isTooSimilar(
  newMeal: GeneratedMeal,
  existingMeals: Meal[],
  threshold: number = 0.8
): boolean {
  const newKeywords = new Set(newMeal.ingredient_keywords);

  for (const existing of existingMeals) {
    const existingKeywords = new Set(existing.ingredientKeywords);
    if (existingKeywords.size === 0) continue;

    // Exact name match
    if (newMeal.name.toLowerCase().trim() === existing.name.toLowerCase().trim()) {
      return true;
    }

    // Jaccard similarity on ingredient keywords
    const intersection = new Set([...newKeywords].filter(k => existingKeywords.has(k)));
    const union = new Set([...newKeywords, ...existingKeywords]);
    const similarity = intersection.size / union.size;

    if (similarity >= threshold) {
      return true;
    }
  }

  return false;
}
```

- Compare against ALL meals in the database, not just the ones matched for this user
- Threshold: 0.8 (80% ingredient overlap = too similar)
- Meals that pass the check are inserted into the `meals` table and become available to all users forever
- New meals start with `swipe_right_count = 0`, `swipe_left_count = 0`, `approval_score = NULL`

### Step 10: Code-Based Shopping Optimizer

The optimizer is deterministic math — not a creative task. Instead of burning a Claude call, this runs as code.

```typescript
interface OptimizerInput {
  meals: ScoredMeal[];         // primary + alternates with budget tiers
  importantItems: ImportantItem[];
  deals: Deal[];
  nearbyLocations: StoreLocation[];
  userBudget: number | null;
  maxStores: MaxStores;
}

function buildShoppingPlan(input: OptimizerInput): {
  oneStore: GroceryPlan;
  twoStore: GroceryPlan | null;
} {
  const { meals, importantItems, deals, nearbyLocations, userBudget, maxStores } = input;

  // Build lookup: ingredient keyword → cheapest deal per brand
  const dealsByBrand = buildDealsByBrand(deals);

  // For each brand, calculate total cost of all needed items
  const brandCosts = calculateBrandCosts(meals, importantItems, dealsByBrand);

  // 1-store plan: pick the brand with lowest total, use nearest location
  const oneStore = buildOneStorePlan(brandCosts, nearbyLocations, meals, importantItems, userBudget);

  // 2-store plan: assign each item to cheapest brand across top 2
  let twoStore: GroceryPlan | null = null;
  if (maxStores >= 2) {
    twoStore = buildTwoStorePlan(brandCosts, nearbyLocations, meals, importantItems, userBudget);
  }

  return { oneStore, twoStore };
}
```

#### One-Store Logic

```typescript
function buildOneStorePlan(
  brandCosts: Map<string, BrandCostBreakdown>,
  locations: StoreLocation[],
  meals: ScoredMeal[],
  importantItems: ImportantItem[],
  budget: number | null
): GroceryPlan {
  // Rank brands by total cost (deals + estimated non-sale items)
  const ranked = [...brandCosts.entries()]
    .sort(([, a], [, b]) => a.totalCost - b.totalCost);

  const [bestBrandId, bestCost] = ranked[0];
  const nearestLocation = findNearestLocation(locations, bestBrandId);

  // Build shopping items list
  const items = buildItemsList(meals, importantItems, bestBrandId, bestCost);

  return {
    stops: [{
      storeBrandName: nearestLocation.brandName,
      storeLocationId: nearestLocation.id,
      storeAddress: nearestLocation.address,
      storeBrandId: bestBrandId,
      meals: meals.map(m => ({
        mealId: m.meal.id,
        name: m.meal.name,
        costPerServing: calculateCostPerServing(m, bestCost),
        totalCost: calculateMealCost(m, bestCost),
        savings: calculateMealSavings(m, bestCost),
      })),
      items,
      subtotal: bestCost.totalCost,
    }],
    total: bestCost.totalCost,
    budgetRemaining: budget ? budget - bestCost.totalCost : 0,
    estimatedSavings: bestCost.totalSavings,
  };
}
```

#### Two-Store Logic

```typescript
function buildTwoStorePlan(
  brandCosts: Map<string, BrandCostBreakdown>,
  locations: StoreLocation[],
  meals: ScoredMeal[],
  importantItems: ImportantItem[],
  budget: number | null
): GroceryPlan {
  // For each item, find which brand has the cheapest price
  // Then group items by brand, keeping only the top 2 brands by item count
  // If an item is only available at one brand, it goes there
  // If an item has no deals at any brand, assign to the brand where
  // the user is already going (minimize stops for non-sale items)

  const itemAssignments = assignItemsToCheapestBrand(meals, importantItems, brandCosts);

  // Find top 2 brands by total savings
  const topBrands = selectTopTwoBrands(itemAssignments);

  // Build stops for each brand
  const stops = topBrands.map(brandId => {
    const location = findNearestLocation(locations, brandId);
    const brandItems = itemAssignments.get(brandId)!;
    return buildStop(location, brandItems, meals);
  });

  const total = stops.reduce((sum, s) => sum + s.subtotal, 0);

  return {
    stops,
    total,
    budgetRemaining: budget ? budget - total : 0,
    estimatedSavings: stops.reduce((sum, s) =>
      sum + s.items.reduce((is, i) =>
        is + (i.isOnSale && i.regularPrice ? i.regularPrice - (i.salePrice ?? 0) : 0), 0), 0),
  };
}
```

#### Why Code Instead of Claude for Optimization

1. **Deterministic**: Same inputs always produce same output. No temperature variance.
2. **Fast**: Runs in <10ms vs 5-10s for a Claude call.
3. **Free**: No API cost — saves ~$0.03/user/week.
4. **Testable**: Unit tests cover every edge case. Claude prompts can't be unit tested.
5. **Debuggable**: When a plan looks wrong, you can step through the logic.

### Step 11: Check User Recipe Alerts

```sql
SELECT ur.id, ur.name, ur.ingredient_keywords, ur.cost_drivers
FROM user_recipes ur
WHERE ur.user_id = $1;
```

For each user recipe, count how many of its `cost_drivers` (expensive ingredients) are on sale this week. Generate a `RecipeAlert` if:
- 2+ cost drivers are on sale, OR
- Estimated cost is 30%+ cheaper than regular price

### Step 12: Save Weekly Plan

```sql
INSERT INTO weekly_plans (user_id, token, one_store_optimized, two_store_optimized,
                          watchlist_alerts, recipe_alerts, week_of)
VALUES ($1, $2, $3, $4, $5, $6, $7);
```

- `token` = cryptographically random URL-safe string (for shareable links and email deep links)
- `week_of` = Monday of the current week
- Plan JSON includes `budgetTier` on each meal for frontend display

### Step 13: Send Email

After the plan is saved, render and send the weekly email:

- Subject line varies based on content (watchlist alerts get priority in subject)
- Email contains: top savings highlights, meal previews with budget tier badges, CTA to open full plan
- Email includes tracking pixel: `GET /api/v1/events/pixel?t={token}&e=email_opened`
- All links in email use redirect: `GET /api/v1/r?url={app_url}&t={token}&e=email_link_clicked`

## Community Approval Scores (Real-Time, Not Pipeline)

Approval scores are maintained by the `POST /meals/{meal_id}/swipe` endpoint in real-time — **not** by the pipeline. The pipeline only reads these scores during Step 7 (scoring).

The swipe endpoint updates counts and recalculates:

```sql
-- On swipe right (liked = true):
UPDATE meals
SET swipe_right_count = swipe_right_count + 1,
    approval_score = CASE
      WHEN swipe_right_count + swipe_left_count + 1 >= 5
      THEN (swipe_right_count + 1)::numeric / (swipe_right_count + swipe_left_count + 1)
      ELSE NULL
    END
WHERE id = $1;

-- On swipe left (liked = false):
UPDATE meals
SET swipe_left_count = swipe_left_count + 1,
    approval_score = CASE
      WHEN swipe_right_count + swipe_left_count + 1 >= 5
      THEN swipe_right_count::numeric / (swipe_right_count + swipe_left_count + 1)
      ELSE NULL
    END
WHERE id = $1;
```

- `approval_score` stays `NULL` until a meal has 5+ total swipes
- Once active, it's a simple ratio: `right / (right + left)`
- The pipeline uses this score directly in the ranking formula (Step 7)

## Ingredient Keyword Extraction

Deals have full product names like "Boneless Skinless Chicken Breast Family Pack". Meals have ingredient keywords like "chicken". A mapping function bridges the gap:

```typescript
function extractIngredientKeywords(deals: Deal[]): string[] {
  const KEYWORD_MAP: Record<string, string> = {
    'chicken breast': 'chicken',
    'chicken thigh': 'chicken',
    'chicken drumstick': 'chicken',
    'ground beef': 'beef',
    'lean ground beef': 'beef',
    'extra lean ground beef': 'beef',
    'stewing beef': 'beef',
    'pork chop': 'pork',
    'pork loin': 'pork',
    'ground pork': 'pork',
    'salmon fillet': 'salmon',
    'atlantic salmon': 'salmon',
    'extra virgin olive oil': 'olive oil',
    'seedless grapes': 'grapes',
    'green seedless grapes': 'grapes',
    'red seedless grapes': 'grapes',
    'granulated sugar': 'sugar',
    'brown sugar': 'sugar',
    'roma tomatoes': 'tomato',
    'grape tomatoes': 'tomato',
    'cherry tomatoes': 'tomato',
    'english cucumber': 'cucumber',
    'mini cucumbers': 'cucumber',
    'romaine hearts': 'lettuce',
    'iceberg lettuce': 'lettuce',
    'jasmine rice': 'rice',
    'basmati rice': 'rice',
    'long grain rice': 'rice',
    'all purpose flour': 'flour',
    'whole wheat bread': 'bread',
    'white bread': 'bread',
    // ... 200+ entries, built up over time from real scrape data
  };

  const keywords = new Set<string>();

  for (const deal of deals) {
    const normalized = deal.itemName.toLowerCase().trim();

    // Try exact match first
    for (const [pattern, keyword] of Object.entries(KEYWORD_MAP)) {
      if (normalized.includes(pattern)) {
        keywords.add(keyword);
        break;
      }
    }

    // Fallback: strip brand name, strip common adjectives,
    // return the remaining noun(s) in lowercase singular form
    // This handles unmapped items with less precision
  }

  return Array.from(keywords);
}
```

This is a curated lookup table, not an AI call. It grows as we see new deal names from the scraper. Unmapped items still work (the raw name gets passed through) but keyword matching is less precise.

## Claude API Calls Per User

| Call | Model | Purpose | Est. Input Tokens | Est. Output Tokens |
|------|-------|---------|-------------------|-------------------|
| Meal generation (always) | Sonnet | Generate 2-3+ new meals | ~3,000 | ~3,000-6,000 |

- Meal generation **always runs** (minimum 2-3 new meals per run for freshness)
- Shopping optimization is **code-based** — zero API cost
- **Cost per user: ~$0.02-0.05/week** (Sonnet input $3/M, output $15/M)
- At 30 trial users: ~$0.60-1.50/week → ~$2.50-6/month
- At 500 users: ~$10-25/week → ~$40-100/month
- Significantly cheaper than v1 spec thanks to code-based optimizer

## Spend Limit Enforcement

Same pattern as scraper pipeline. Before each Claude call:

1. Query `usage_tracking` for current month's Anthropic spend
2. Compare against `CLAUDE_MONTHLY_BUDGET_USD`
3. Warn at 80%, block at 100%
4. After success, record usage with `user_id = NULL` (pipeline-level)

**If spend limit is reached mid-run:**
- Log which users were skipped
- Users who were skipped still get a plan from DB-matched meals + code optimizer (no Claude generation, but the optimizer still runs)
- Send admin alert with count of skipped users

## Error Handling

| Error | Action |
|-------|--------|
| User has no nearby store locations with `scrape_status = 'ok'` | Skip user, log "no stores available" |
| No active deals found for nearby brands | Skip user, log "no active deals" |
| No meal matches AND Claude generation fails | Build plan from top-approval meals (ignore deal overlap), log |
| Claude returns invalid JSON (meal generation) | Retry once. If still fails, proceed with DB meals only |
| Code optimizer produces empty plan | Log, skip user |
| Spend limit reached | Skip Claude generation for remaining users, still run code optimizer with DB meals |
| Email send fails | Log error, plan is still saved (user can access via app) |
| Database error during plan insert | Skip user, log with full error |
| Collaborative filtering returns 0 results | Fall back to approval-based ranking (not an error) |

## Logging

Every pipeline run logs:
- Start time, end time, total duration
- Users processed, users skipped (with reasons)
- Per user: meals matched from DB, meals generated, collaborative recs found
- Per user: budget tier breakdown (X value, Y sweet spot, Z splurge)
- Total Claude API calls, total tokens, estimated cost
- Aggregate: avg savings per user, avg meals from DB vs generated
- Collaborative filtering stats: avg similar users found, avg recs per user

## Cron Schedule

```typescript
// scheduler.ts
cron.schedule('0 7 * * 3', async () => {
  logger.info('Starting weekly plan generation');
  await runPlanner();
}, {
  timezone: 'America/Toronto'
});
```

## Testing Strategy

1. **Meal scoring tests**: Given meals with known deal overlap, collaborative scores, approval scores, and budget — assert correct final scores and tier assignments
2. **Collaborative filtering tests**: Given a set of user preferences, assert correct similar users and recommendations
3. **Cold start tests**: User with <5 swipes gets approval-based ranking, not collaborative
4. **Budget tier tests**: Meals at various price points correctly assigned value/sweet_spot/splurge
5. **Meal selection tests**: Given scored candidates, assert protein variety, budget tier variety, and correct primary/alternate split
6. **Jaccard similarity tests**: Known similar/dissimilar meal pairs, assert correct pass/block decisions
7. **Keyword extraction tests**: Map of deal names → expected keywords
8. **Code optimizer tests**: Given meals + deals + stores, assert correct 1-store and 2-store plan generation
9. **Optimizer edge cases**: No deals at any store, all items at one store, item with no matching deal
10. **Claude prompt snapshot tests**: Save real deal data, run through meal generation prompt, validate output structure with Zod
11. **Spend limit tests**: Mock usage_tracking at various thresholds — assert Claude skipped but optimizer still runs
12. **Approval score tests**: Swipe updates produce correct counts and scores, NULL until 5 swipes
13. **Full integration test**: Mock Claude responses, run entire pipeline for a test user, assert correct weekly_plan record with budget tiers

## Future Optimizations (Not MVP)

- **Taste profile weighting** (v1): Add taste_score to the scoring formula using the user's `taste_profile` JSONB
- **Batch Claude calls**: Group users with similar dietary restrictions and nearby stores to share meal generation calls
- **Incremental planning**: If deals are similar to last week, only generate delta meals
- **Time-decay on approval scores**: Recent swipes count more than old ones
- **Diversity injection**: Periodically surface low-exposure meals to collect more swipe data
- **A/B testing**: Test different scoring weights per user cohort
