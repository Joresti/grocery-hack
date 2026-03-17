import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { callClaude } from '../lib/claude.js';
import { sendEmail } from '../lib/email.js';
import { renderWeeklyPlanEmail } from '../lib/emailTemplates.js';
import { checkSpendLimit } from '../lib/spendLimit.js';
import { insertEvent } from '../db/queries/events.js';
import * as plannerQueries from '../db/queries/planner.js';
import * as optimizerQueries from '../db/queries/optimizer.js';
import {
  buildDealsByBrand,
  buildOneStorePlan,
  buildTwoStorePlan,
  buildNeededKeywords,
  getAverageDealPrice,
  calculateBrandCost,
  getWeekOfMonday,
} from '../services/optimizer.js';
import type { GroceryPlan, WatchlistAlert, RecipeAlert, PriceTier } from '@groceryhack/shared/types.js';
import {
  JACCARD_SIMILARITY_THRESHOLD,
  MIN_NEW_MEALS_PER_RUN,
  MEALS_PER_PLAN,
} from '@groceryhack/shared/constants.js';
import type {
  PlannerUser,
  MealWithKeywords,
  DealRow,
  LocationRow,
  WatchlistEntry,
} from '../db/queries/planner.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ScoredMealCandidate {
  meal: MealWithKeywords;
  ingredientOverlapCount: number;
  totalIngredients: number;
  collaborativeBoost: number;
  approvalScore: number;
  estimatedCost: number;
  budgetTier: 'value' | 'sweet_spot' | 'splurge';
}

export interface GeneratedMeal {
  name: string;
  tagline: string | null;
  description: string | null;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number;
  difficulty: 'easy' | 'medium';
  filter_tags: string[];
  taste_tags: Record<string, string>;
  tips: string | null;
  ingredient_keywords: string[];
  budget_tier: 'value' | 'sweet_spot' | 'splurge';
}

export interface PlannerSummary {
  usersProcessed: number;
  usersSkipped: number;
  mealsGenerated: number;
  totalCostUsd: number;
}

interface BudgetTierDistribution {
  value: number;
  sweetSpot: number;
  splurge: number;
}

// ────────────────────────────────────────────────────────────
// Exported pure functions (for testing)
// ────────────────────────────────────────────────────────────

/**
 * Score a candidate meal using the 4-factor weighted formula.
 * Weights: dealOverlap(30%) + collaborative(30%) + approval(20%) + budgetFit(20%)
 */
export function scoreMeal(
  candidate: ScoredMealCandidate,
  perMealBudget: number | null,
): number {
  const dealOverlapScore =
    candidate.ingredientOverlapCount / Math.max(candidate.totalIngredients, 1);
  const collaborativeScore = candidate.collaborativeBoost;
  const approvalScore = candidate.approvalScore;
  const budgetScore =
    perMealBudget !== null && perMealBudget > 0
      ? candidate.estimatedCost <= perMealBudget
        ? 1.0
        : Math.max(0, 1 - (candidate.estimatedCost - perMealBudget) / perMealBudget)
      : 0.7; // no budget set — neutral

  // For cold start (no collaborative data), redistribute weights
  if (collaborativeScore === 0) {
    return (
      dealOverlapScore * 0.40 +
      approvalScore * 0.35 +
      budgetScore * 0.25
    );
  }

  return (
    dealOverlapScore * 0.3 +
    collaborativeScore * 0.3 +
    approvalScore * 0.2 +
    budgetScore * 0.2
  );
}

/**
 * Check if a new meal is too similar to any existing meal using Jaccard similarity.
 */
export function isTooSimilar(
  newKeywords: string[],
  newName: string,
  existingMeals: { name: string; ingredientKeywords: string[] }[],
  threshold: number = JACCARD_SIMILARITY_THRESHOLD,
): boolean {
  const newSet = new Set(newKeywords.map(k => k.toLowerCase()));

  for (const existing of existingMeals) {
    // Exact name match
    if (newName.toLowerCase().trim() === existing.name.toLowerCase().trim()) {
      return true;
    }

    // Jaccard on ingredient keywords
    const existingSet = new Set(existing.ingredientKeywords.map(k => k.toLowerCase()));
    if (existingSet.size === 0 || newSet.size === 0) continue;

    const intersection = new Set([...newSet].filter(k => existingSet.has(k)));
    const union = new Set([...newSet, ...existingSet]);

    if (union.size > 0 && intersection.size / union.size >= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Distribute the required meals across budget tiers.
 */
export function distributeBudgetTiers(count: number): BudgetTierDistribution {
  if (count <= 0) return { value: 0, sweetSpot: 0, splurge: 0 };
  if (count === 1) return { value: 0, sweetSpot: 1, splurge: 0 };
  if (count === 2) return { value: 1, sweetSpot: 1, splurge: 0 };

  // For 5 primary: 2 value, 2 sweet_spot, 1 splurge
  const splurge = Math.max(1, Math.floor(count / 5));
  const remaining = count - splurge;
  const value = Math.ceil(remaining / 2);
  const sweetSpot = remaining - value;

  return { value, sweetSpot, splurge };
}

/**
 * Parse Claude's generated meals response. Returns valid meals only.
 */
export function parseGeneratedMeals(response: string): GeneratedMeal[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error('[PLANNER] Failed to parse Claude response as JSON', {
      responsePreview: cleaned.slice(0, 200),
    });
    return [];
  }

  if (!Array.isArray(parsed)) {
    logger.error('[PLANNER] Claude response is not an array');
    return [];
  }

  const validMeals: GeneratedMeal[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;

    // Validate required fields
    if (
      typeof obj.name !== 'string' ||
      !Array.isArray(obj.ingredients) ||
      !Array.isArray(obj.steps) ||
      !Array.isArray(obj.ingredient_keywords)
    ) {
      logger.warn('[PLANNER] Skipping invalid generated meal', {
        name: typeof obj.name === 'string' ? obj.name : 'unknown',
      });
      continue;
    }

    const difficulty = obj.difficulty === 'medium' ? 'medium' : 'easy';
    const budgetTier =
      obj.budget_tier === 'value' || obj.budget_tier === 'splurge'
        ? obj.budget_tier
        : 'sweet_spot';

    validMeals.push({
      name: obj.name,
      tagline: typeof obj.tagline === 'string' ? obj.tagline : null,
      description: typeof obj.description === 'string' ? obj.description : null,
      ingredients: (obj.ingredients as { name: string; quantity: string; unit: string }[]),
      steps: obj.steps as string[],
      prep_time_minutes: typeof obj.prep_time_minutes === 'number' ? obj.prep_time_minutes : null,
      cook_time_minutes: typeof obj.cook_time_minutes === 'number' ? obj.cook_time_minutes : null,
      servings: typeof obj.servings === 'number' ? obj.servings : 4,
      difficulty,
      filter_tags: Array.isArray(obj.filter_tags) ? (obj.filter_tags as string[]) : [],
      taste_tags: typeof obj.taste_tags === 'object' && obj.taste_tags !== null
        ? (obj.taste_tags as Record<string, string>)
        : {},
      tips: typeof obj.tips === 'string' ? obj.tips : null,
      ingredient_keywords: obj.ingredient_keywords as string[],
      budget_tier: budgetTier,
    });
  }

  return validMeals;
}

/**
 * Estimate a meal's cost based on active deals.
 */
export function estimateMealCost(
  ingredientKeywords: string[],
  deals: DealRow[],
  fallbackPrice: number,
): number {
  let total = 0;

  for (const keyword of ingredientKeywords) {
    const kwLower = keyword.toLowerCase();
    let bestDeal: DealRow | null = null;

    for (const deal of deals) {
      if (deal.itemName.toLowerCase().includes(kwLower)) {
        if (!bestDeal || deal.salePrice < bestDeal.salePrice) {
          bestDeal = deal;
        }
      }
    }

    if (bestDeal) {
      total += bestDeal.salePrice;
    } else {
      total += estimatePantryPrice(kwLower, fallbackPrice);
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Conservative fallback prices for common pantry items.
 */
function estimatePantryPrice(keyword: string, fallbackPrice: number): number {
  const PANTRY_ESTIMATES: Record<string, number> = {
    'salt': 0.10,
    'pepper': 0.15,
    'olive oil': 0.50,
    'garlic': 0.50,
    'onion': 0.75,
    'butter': 1.00,
    'flour': 0.30,
    'sugar': 0.20,
    'soy sauce': 0.30,
    'oil': 0.40,
    'vinegar': 0.25,
    'lemon': 0.50,
    'lime': 0.40,
    'ginger': 0.40,
    'cumin': 0.15,
    'paprika': 0.15,
    'oregano': 0.10,
    'thyme': 0.10,
    'basil': 0.15,
    'parsley': 0.15,
    'water': 0,
  };

  return PANTRY_ESTIMATES[keyword] ?? Math.round(fallbackPrice * 1.5 * 100) / 100;
}

/**
 * Determine budget tier for a meal based on its cost vs per-meal budget.
 */
export function determineBudgetTier(
  estimatedCost: number,
  perMealBudget: number | null,
): 'value' | 'sweet_spot' | 'splurge' {
  if (perMealBudget === null || perMealBudget <= 0) return 'sweet_spot';

  const ratio = estimatedCost / perMealBudget;
  if (ratio <= 0.75) return 'value';
  if (ratio <= 1.0) return 'sweet_spot';
  return 'splurge';
}

/**
 * Build the deal list string for Claude's user message.
 */
export function formatDealsForPrompt(deals: DealRow[]): string {
  // Deduplicate by item name, keeping cheapest
  const deduped = new Map<string, DealRow>();
  for (const deal of deals) {
    const key = deal.itemName.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || deal.salePrice < existing.salePrice) {
      deduped.set(key, deal);
    }
  }

  return [...deduped.values()]
    .slice(0, 60) // limit to 60 deals to stay within token budget
    .map(d => {
      const savings = d.regularPrice
        ? ` (reg $${d.regularPrice.toFixed(2)}, save $${(d.regularPrice - d.salePrice).toFixed(2)})`
        : '';
      return `- ${d.itemName} — $${d.salePrice.toFixed(2)}/${d.unit} at ${d.storeBrandName}${savings}`;
    })
    .join('\n');
}

// ────────────────────────────────────────────────────────────
// Watchlist alert detection
// ────────────────────────────────────────────────────────────

function detectWatchlistAlerts(
  watchlist: WatchlistEntry[],
  deals: DealRow[],
  _locations: LocationRow[],
): WatchlistAlert[] {
  const alerts: WatchlistAlert[] = [];

  for (const entry of watchlist) {
    const kwLower = entry.itemKeyword.toLowerCase();

    for (const deal of deals) {
      // Filter by store brand if specified
      if (entry.storeBrandId && deal.storeBrandId !== entry.storeBrandId) continue;

      // Fuzzy match: deal item_name contains the keyword
      if (!deal.itemName.toLowerCase().includes(kwLower)) continue;

      // Price must be at or below benchmark
      if (deal.salePrice > entry.benchmarkPrice) continue;

      alerts.push({
        item: entry.itemKeyword,
        store: deal.storeBrandName,
        salePrice: deal.salePrice,
        regularPrice: deal.regularPrice ?? entry.benchmarkPrice,
        benchmarkPrice: entry.benchmarkPrice,
        priceTier: entry.priceTier as PriceTier,
      });
    }
  }

  return alerts;
}

// ────────────────────────────────────────────────────────────
// Recipe alert detection
// ────────────────────────────────────────────────────────────

function detectRecipeAlerts(
  recipes: { id: string; name: string; ingredientKeywords: string[]; costDrivers: string[] }[],
  deals: DealRow[],
): RecipeAlert[] {
  const alerts: RecipeAlert[] = [];

  for (const recipe of recipes) {
    // Count cost drivers on sale
    let costDriversOnSale = 0;
    let estimatedCost = 0;
    let regularCost = 0;

    for (const keyword of recipe.ingredientKeywords) {
      const kwLower = keyword.toLowerCase();
      let bestDeal: DealRow | null = null;

      for (const deal of deals) {
        if (deal.itemName.toLowerCase().includes(kwLower)) {
          if (!bestDeal || deal.salePrice < bestDeal.salePrice) {
            bestDeal = deal;
          }
        }
      }

      if (bestDeal) {
        estimatedCost += bestDeal.salePrice;
        regularCost += bestDeal.regularPrice ?? bestDeal.salePrice;

        // Check if this ingredient is a cost driver
        if (recipe.costDrivers.some(cd => cd.toLowerCase() === kwLower)) {
          costDriversOnSale++;
        }
      } else {
        // Estimate non-sale price
        const estimated = 1.50;
        estimatedCost += estimated;
        regularCost += estimated;
      }
    }

    const savings = regularCost - estimatedCost;
    const savingsPercent = regularCost > 0 ? savings / regularCost : 0;

    // Alert if 2+ cost drivers on sale OR 30%+ savings
    if (costDriversOnSale >= 2 || savingsPercent >= 0.30) {
      alerts.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        ingredientsOnSale: costDriversOnSale,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        regularCost: Math.round(regularCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
      });
    }
  }

  return alerts;
}

// ────────────────────────────────────────────────────────────
// Claude meal generation
// ────────────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are a meal planning chef for a Canadian grocery deal app. You create practical, family-friendly dinner recipes that use ingredients currently on sale at local grocery stores.

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
  "name": string,
  "tagline": string,
  "description": string,
  "ingredients": [{"name": string, "quantity": string, "unit": string}],
  "steps": [string],
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "servings": number,
  "difficulty": "easy" | "medium",
  "filter_tags": [string],
  "taste_tags": {"protein": string, "cuisine": string, "style": string},
  "tips": string | null,
  "ingredient_keywords": [string],
  "budget_tier": "value" | "sweet_spot" | "splurge"
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
9. Return ONLY the JSON array. No markdown, no explanation, no code fences.`;

async function generateMealsWithClaude(
  gap: number,
  householdSize: number,
  dietaryRestrictions: string[],
  budget: number | null,
  mealsNeeded: number,
  deals: DealRow[],
  existingMealNames: string[],
  userId: string | null,
): Promise<GeneratedMeal[]> {
  const perMealBudget = budget && mealsNeeded > 0 ? budget / mealsNeeded : null;
  const tiers = distributeBudgetTiers(gap);

  const budgetGuidance = perMealBudget
    ? `- Weekly budget: $${budget?.toFixed(2)} for ${mealsNeeded} meals
- Per-meal target: ~$${perMealBudget.toFixed(2)}
- Generate approximately: ${tiers.value} VALUE meals, ${tiers.sweetSpot} SWEET SPOT meals, ${tiers.splurge} SPLURGE meals`
    : '- No specific budget set. Generate a mix of value and sweet spot meals.';

  const dealsText = formatDealsForPrompt(deals);
  const existingText = existingMealNames.length > 0
    ? existingMealNames.slice(0, 30).map(n => `- ${n}`).join('\n')
    : '(none — this is the first run)';

  const dietaryText = dietaryRestrictions.length > 0
    ? dietaryRestrictions.join(', ')
    : 'None';

  const userMessage = `Generate ${gap} dinner recipes.

HOUSEHOLD SIZE: ${householdSize}
DIETARY RESTRICTIONS: ${dietaryText}

BUDGET GUIDANCE:
${budgetGuidance}

INGREDIENTS ON SALE THIS WEEK:
${dealsText}

EXISTING MEALS TO AVOID DUPLICATING:
${existingText}`;

  const response = await callClaude(
    [{ role: 'user', content: userMessage }],
    {
      model: config.CLAUDE_PLANNER_MODEL,
      maxTokens: 8000,
      system: PLANNER_SYSTEM_PROMPT,
      temperature: 0.7,
    },
    userId,
  );

  return parseGeneratedMeals(response);
}

// ────────────────────────────────────────────────────────────
// Collaborative filtering
// ────────────────────────────────────────────────────────────

const MIN_SWIPES_FOR_COLLAB = 5;

async function getCollaborativeBoosts(
  userId: string,
  allMeals: MealWithKeywords[],
  swipedMealIds: Set<string>,
): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();

  // Check if user has enough swipes
  const swipeCount = await plannerQueries.countUserSwipes(userId);
  if (swipeCount < MIN_SWIPES_FOR_COLLAB) {
    return boosts; // Cold start — return empty
  }

  // Find similar users
  const similarUsers = await plannerQueries.findSimilarUsers(userId, 3);
  if (similarUsers.length === 0) return boosts;

  // Get meals liked by similar users
  const similarUserIds = similarUsers.map(u => u.userId);
  const likedByOthers = await plannerQueries.findLikedMealsByUsers(similarUserIds);

  // Count recommendations per meal
  const mealRecommenderCount = new Map<string, Set<string>>();
  for (const like of likedByOthers) {
    if (swipedMealIds.has(like.mealId)) continue; // Skip already swiped

    const existing = mealRecommenderCount.get(like.mealId);
    if (existing) {
      existing.add(like.userId);
    } else {
      mealRecommenderCount.set(like.mealId, new Set([like.userId]));
    }
  }

  const maxRecommenders = Math.max(
    1,
    ...Array.from(mealRecommenderCount.values()).map(s => s.size),
  );

  // Calculate collaborative score for each meal
  for (const meal of allMeals) {
    const recommenders = mealRecommenderCount.get(meal.id);
    if (!recommenders) continue;

    const countScore = Math.min(recommenders.size / maxRecommenders, 1);
    // Use the average shared_likes as similarity proxy
    let avgSimilarity = 0;
    for (const sim of similarUsers) {
      if (recommenders.has(sim.userId)) {
        avgSimilarity += sim.sharedLikes;
      }
    }
    avgSimilarity = avgSimilarity / Math.max(recommenders.size, 1) / Math.max(
      similarUsers.reduce((max, u) => Math.max(max, u.sharedLikes), 1),
      1,
    );

    const score = countScore * 0.6 + avgSimilarity * 0.4;
    boosts.set(meal.id, Math.min(score, 1));
  }

  return boosts;
}

// ────────────────────────────────────────────────────────────
// Per-user planner
// ────────────────────────────────────────────────────────────

export async function runPlannerForUser(
  user: PlannerUser,
): Promise<{ mealsGenerated: number; planSaved: boolean }> {
  const startTime = Date.now();
  logger.info('[PLANNER] Processing user', { userId: user.id, email: user.email });

  // Step 1: Get user's active important items
  const importantItems = await optimizerQueries.findActiveImportantItems(user.id);

  // Step 2: Find nearby store locations (25km radius)
  if (user.lat === null || user.lng === null) {
    logger.warn('[PLANNER] User has no lat/lng, skipping', { userId: user.id });
    return { mealsGenerated: 0, planSaved: false };
  }

  const locations = await optimizerQueries.findNearbyLocations(user.lat, user.lng, 25);
  if (locations.length === 0) {
    logger.warn('[PLANNER] No nearby stores for user', { userId: user.id });
    return { mealsGenerated: 0, planSaved: false };
  }

  const brandIds = [...new Set(locations.map(l => l.storeBrandId))];

  // Step 3: Get active deals at those stores
  const deals = await optimizerQueries.findActiveDealsByBrands(brandIds);
  if (deals.length === 0) {
    logger.warn('[PLANNER] No active deals for user', { userId: user.id });
    return { mealsGenerated: 0, planSaved: false };
  }

  // Map deals to planner DealRow format
  const plannerDeals: DealRow[] = deals.map(d => ({
    id: d.id,
    storeBrandId: d.storeBrandId,
    storeBrandName: d.storeBrandName,
    itemName: d.itemName,
    salePrice: d.salePrice,
    regularPrice: d.regularPrice,
    unit: d.unit,
    category: d.category,
  }));

  // Step 4: Check watchlist for alerts
  const watchlist = await plannerQueries.findUserWatchlist(user.id);
  const plannerLocations: LocationRow[] = locations.map(l => ({
    id: l.id,
    storeBrandId: l.storeBrandId,
    brandName: l.brandName,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    distanceKm: l.distanceKm,
  }));
  const watchlistAlerts = detectWatchlistAlerts(watchlist, plannerDeals, plannerLocations);

  // Step 5: Match existing DB meals against deals
  const allMeals = await plannerQueries.findAllMealsWithKeywords();
  const swipedMealIds = await plannerQueries.findSwipedMealIds(user.id);
  const fallbackPrice = getAverageDealPrice(deals);

  // Filter meals by dietary restrictions and minimum approval score
  const dietarySet = new Set(user.dietaryRestrictions);
  const candidateMeals = allMeals.filter(meal => {
    // Apply dietary filter: meal must have all user dietary tags
    if (dietarySet.size > 0) {
      for (const tag of dietarySet) {
        if (!meal.filterTags.includes(tag)) return false;
      }
    }
    // Exclude meals with approval score below 0.3
    if (meal.approvalScore !== null && meal.approvalScore < 0.3) return false;
    return true;
  });

  // Calculate deal keyword set from active deals
  const dealKeywordSet = new Set(
    plannerDeals.map(d => d.itemName.toLowerCase()),
  );

  // Step 6: Collaborative filtering
  const collaborativeBoosts = await getCollaborativeBoosts(
    user.id,
    candidateMeals,
    swipedMealIds,
  );

  // Step 7: Score each candidate meal
  const mealsNeeded = MEALS_PER_PLAN; // 8 (5 primary + 3 alternates)
  const perMealBudget = user.budget && mealsNeeded > 0 ? user.budget / mealsNeeded : null;

  const scoredCandidates: ScoredMealCandidate[] = candidateMeals.map(meal => {
    // Count ingredient overlap with deals
    let overlapCount = 0;
    for (const kw of meal.ingredientKeywords) {
      const kwLower = kw.toLowerCase();
      for (const dealName of dealKeywordSet) {
        if (dealName.includes(kwLower)) {
          overlapCount++;
          break;
        }
      }
    }

    const estimatedCost = estimateMealCost(meal.ingredientKeywords, plannerDeals, fallbackPrice);
    const budgetTier = determineBudgetTier(estimatedCost, perMealBudget);

    return {
      meal,
      ingredientOverlapCount: overlapCount,
      totalIngredients: meal.ingredientKeywords.length,
      collaborativeBoost: collaborativeBoosts.get(meal.id) ?? 0,
      approvalScore: meal.approvalScore ?? 0.5,
      estimatedCost,
      budgetTier,
    };
  });

  // Sort by score
  const scored = scoredCandidates
    .map(c => ({ candidate: c, score: scoreMeal(c, perMealBudget) }))
    .sort((a, b) => b.score - a.score);

  // Step 8: Select top meals with budget tier distribution
  const goodMatches = scored
    .filter(s => s.candidate.ingredientOverlapCount >= 1)
    .slice(0, mealsNeeded);

  logger.info('[PLANNER] Meal matching results', {
    userId: user.id,
    totalCandidates: candidateMeals.length,
    goodMatches: goodMatches.length,
    collaborativeRecs: collaborativeBoosts.size,
  });

  // Step 9: Generate new meals with Claude Sonnet
  const gap = Math.max(MIN_NEW_MEALS_PER_RUN, mealsNeeded - goodMatches.length);
  let mealsGenerated = 0;

  let generatedMeals: GeneratedMeal[] = [];
  let claudeSkipped = false;

  try {
    // Check spend limit before generating
    await checkSpendLimit('claude', null);

    generatedMeals = await generateMealsWithClaude(
      gap,
      user.householdSize,
      user.dietaryRestrictions,
      user.budget,
      mealsNeeded,
      plannerDeals,
      allMeals.map(m => m.name),
      null, // pipeline-level tracking
    );

    logger.info('[PLANNER] Claude generated meals', {
      userId: user.id,
      requested: gap,
      received: generatedMeals.length,
    });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'SPEND_LIMIT_REACHED') {
      claudeSkipped = true;
      logger.warn('[PLANNER] Spend limit hit, skipping Claude generation', {
        userId: user.id,
      });
    } else {
      // Retry once on other errors
      logger.error('[PLANNER] Claude generation failed, retrying', {
        userId: user.id,
        error: String(err),
      });
      try {
        await checkSpendLimit('claude', null);
        generatedMeals = await generateMealsWithClaude(
          gap,
          user.householdSize,
          user.dietaryRestrictions,
          user.budget,
          mealsNeeded,
          plannerDeals,
          allMeals.map(m => m.name),
          null,
        );
      } catch (retryErr: unknown) {
        const retryError = retryErr as { code?: string };
        if (retryError.code === 'SPEND_LIMIT_REACHED') {
          claudeSkipped = true;
        }
        logger.error('[PLANNER] Claude generation retry failed', {
          userId: user.id,
          error: String(retryErr),
        });
      }
    }
  }

  // Step 10: Jaccard similarity check and insert new meals
  const existingMealsForJaccard = allMeals.map(m => ({
    name: m.name,
    ingredientKeywords: m.ingredientKeywords,
  }));

  for (const generated of generatedMeals) {
    if (isTooSimilar(
      generated.ingredient_keywords,
      generated.name,
      existingMealsForJaccard,
    )) {
      logger.info('[PLANNER] Skipping similar meal', {
        userId: user.id,
        mealName: generated.name,
      });
      continue;
    }

    try {
      const newMealId = await plannerQueries.insertMeal({
        name: generated.name,
        tagline: generated.tagline,
        description: generated.description,
        instructions: null,
        ingredients: generated.ingredients,
        steps: generated.steps,
        prepTimeMinutes: generated.prep_time_minutes,
        cookTimeMinutes: generated.cook_time_minutes,
        servings: generated.servings,
        difficulty: generated.difficulty,
        filterTags: generated.filter_tags,
        tasteTags: generated.taste_tags,
        tips: generated.tips,
        ingredientKeywords: generated.ingredient_keywords,
        nutrition: null,
      });

      mealsGenerated++;

      // Add to existing meals list to prevent duplicates in this batch
      existingMealsForJaccard.push({
        name: generated.name,
        ingredientKeywords: generated.ingredient_keywords,
      });

      logger.info('[PLANNER] Inserted new meal', {
        userId: user.id,
        mealId: newMealId,
        mealName: generated.name,
      });
    } catch (err) {
      logger.error('[PLANNER] Failed to insert meal', {
        userId: user.id,
        mealName: generated.name,
        error: String(err),
      });
    }
  }

  // Step 11: Run optimizer
  // Build the liked meals for the optimizer.
  // Use both matched meals from DB and newly generated meals.
  const likedMeals = await optimizerQueries.findLikedMealsFull(user.id);

  // If user has no liked meals, use the best scored candidates
  const mealsForOptimizer = likedMeals.length > 0
    ? likedMeals
    : goodMatches.slice(0, 5).map(s => ({
        id: s.candidate.meal.id,
        name: s.candidate.meal.name,
        ingredientKeywords: s.candidate.meal.ingredientKeywords,
        ingredients: s.candidate.meal.ingredients,
        servings: s.candidate.meal.servings,
      }));

  if (mealsForOptimizer.length === 0) {
    logger.warn('[PLANNER] No meals available for optimizer', { userId: user.id });
    return { mealsGenerated, planSaved: false };
  }

  const dealsByBrand = buildDealsByBrand(deals);
  const neededKeywords = buildNeededKeywords(mealsForOptimizer, importantItems);

  // Calculate cost per brand
  const brandCosts = [];
  for (const [brandId, brandDeals] of dealsByBrand) {
    const brandName = brandDeals[0]?.storeBrandName ?? 'Unknown';
    const cost = calculateBrandCost(brandId, brandName, brandDeals, neededKeywords, fallbackPrice);
    brandCosts.push(cost);
  }

  if (brandCosts.length === 0) {
    logger.warn('[PLANNER] No brand costs calculated', { userId: user.id });
    return { mealsGenerated, planSaved: false };
  }

  const oneStorePlan = buildOneStorePlan(brandCosts, locations, mealsForOptimizer, user.budget);

  let twoStorePlan: GroceryPlan | null = null;
  if (user.maxStores >= 2 && brandIds.length >= 2) {
    twoStorePlan = buildTwoStorePlan(
      dealsByBrand,
      locations,
      mealsForOptimizer,
      importantItems,
      user.budget,
      fallbackPrice,
    );
  }

  // Step 12: Check user recipe alerts
  const userRecipes = await plannerQueries.findUserRecipesWithCostDrivers(user.id);
  const recipeAlerts = detectRecipeAlerts(userRecipes, plannerDeals);

  // Step 13: Save plan + send email
  const token = crypto.randomUUID();
  const weekOf = getWeekOfMonday();

  try {
    await optimizerQueries.saveWeeklyPlan(
      user.id,
      token,
      weekOf,
      oneStorePlan,
      twoStorePlan,
      watchlistAlerts,
      recipeAlerts,
    );

    logger.info('[PLANNER] Plan saved', {
      userId: user.id,
      token,
      weekOf,
      mealsGenerated,
      claudeSkipped,
    });
  } catch (err) {
    logger.error('[PLANNER] Failed to save plan', {
      userId: user.id,
      error: String(err),
    });
    return { mealsGenerated, planSaved: false };
  }

  // Send weekly plan email
  try {
    const totalSavings = oneStorePlan.estimatedSavings;
    const topMeals = oneStorePlan.stops.flatMap(s =>
      s.meals.map(m => ({ name: m.name, savings: m.savings })),
    ).slice(0, 5);

    const emailToken = crypto.randomUUID();
    const emailContent = renderWeeklyPlanEmail({
      displayName: user.displayName,
      weekOf,
      planToken: token,
      totalSavings,
      mealCount: oneStorePlan.stops.reduce((sum, s) => sum + s.meals.length, 0),
      topMeals,
      appUrl: config.APP_URL,
      userId: user.id,
      emailToken,
    });

    await sendEmail(
      {
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      },
      user.id,
    );

    logger.info('[PLANNER] Email sent', { userId: user.id });
  } catch (err) {
    // Email failure doesn't fail the plan — user can access via app
    logger.error('[PLANNER] Failed to send email', {
      userId: user.id,
      error: String(err),
    });
  }

  const duration = Date.now() - startTime;
  logger.info('[PLANNER] User processing complete', {
    userId: user.id,
    durationMs: duration,
    mealsGenerated,
    watchlistAlerts: watchlistAlerts.length,
    recipeAlerts: recipeAlerts.length,
  });

  return { mealsGenerated, planSaved: true };
}

// ────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────

export async function runPlannerForAllUsers(): Promise<PlannerSummary> {
  const startTime = Date.now();
  logger.info('[PLANNER] Starting weekly plan generation');

  const summary: PlannerSummary = {
    usersProcessed: 0,
    usersSkipped: 0,
    mealsGenerated: 0,
    totalCostUsd: 0,
  };

  let spendLimitHit = false;

  try {
    const users = await plannerQueries.findActiveUsers();
    logger.info('[PLANNER] Found users to process', { count: users.length });

    for (const user of users) {
      if (spendLimitHit) {
        summary.usersSkipped++;
        logger.warn('[PLANNER] Skipping user due to spend limit', { userId: user.id });

        await insertEvent(
          user.id,
          null,
          'pipeline_planner_user_skipped',
          { user_id: user.id, reason: 'spend_limit_reached' },
        ).catch(() => { /* ignore event insert errors */ });

        continue;
      }

      try {
        // Pre-check spend limit
        await checkSpendLimit('claude', null);
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'SPEND_LIMIT_REACHED') {
          spendLimitHit = true;
          summary.usersSkipped++;

          await insertEvent(
            user.id,
            null,
            'pipeline_spend_limit_hit',
            { service: 'claude', percentage: 100, period_key: new Date().toISOString().slice(0, 7) },
          ).catch(() => { /* ignore event insert errors */ });

          logger.warn('[PLANNER] Spend limit reached, will skip remaining users', {
            userId: user.id,
          });

          // Still try to run for this user without Claude
          try {
            const result = await runPlannerForUser(user);
            if (result.planSaved) {
              summary.usersProcessed++;
            } else {
              summary.usersSkipped++;
            }
            summary.mealsGenerated += result.mealsGenerated;
          } catch (userErr) {
            summary.usersSkipped++;
            logger.error('[PLANNER] User processing failed', {
              userId: user.id,
              error: String(userErr),
            });
          }

          continue;
        }
      }

      try {
        const result = await runPlannerForUser(user);
        if (result.planSaved) {
          summary.usersProcessed++;
        } else {
          summary.usersSkipped++;

          await insertEvent(
            user.id,
            null,
            'pipeline_planner_user_skipped',
            { user_id: user.id, reason: 'no_plan_generated' },
          ).catch(() => { /* ignore event insert errors */ });
        }
        summary.mealsGenerated += result.mealsGenerated;
      } catch (err) {
        summary.usersSkipped++;
        logger.error('[PLANNER] User processing failed', {
          userId: user.id,
          error: String(err),
        });

        await insertEvent(
          user.id,
          null,
          'pipeline_planner_user_skipped',
          { user_id: user.id, reason: 'error' },
        ).catch(() => { /* ignore event insert errors */ });
      }
    }
  } catch (err) {
    logger.error('[PLANNER] Fatal error in pipeline', { error: String(err) });
  }

  const duration = Date.now() - startTime;
  logger.info('[PLANNER] Pipeline complete', {
    ...summary,
    durationMs: duration,
  });

  // Log pipeline completion event
  await insertEvent(
    '', // system-level event
    null,
    'pipeline_planner_completed',
    {
      users_processed: summary.usersProcessed,
      users_skipped: summary.usersSkipped,
      meals_generated: summary.mealsGenerated,
      total_cost_usd: summary.totalCostUsd,
      duration_ms: duration,
    },
  ).catch(() => { /* ignore event insert errors */ });

  return summary;
}
