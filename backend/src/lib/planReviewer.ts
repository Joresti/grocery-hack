import { spawn } from 'node:child_process';
import type { GroceryPlan, PlanStop, PlanShoppingItem } from '@groceryhack/shared/types.js';
import type { RecipeRow, KeywordDealMatch } from '../db/queries/shoppingList.js';
import { logger } from './logger.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PlanReviewContext {
  userProfile: {
    dietaryRestrictions: string[];
    cookingEffort: string;
    householdSize: number;
    kidAgeBrackets: string[];
  };
  selectedRecipes: {
    name: string;
    ingredients: { name: string; quantity: string; unit: string }[];
    ingredientKeywords: string[];
    servings: number;
    filterTags: string[];
  }[];
  dealAssignments: {
    recipeName: string;
    ingredient: string;
    dealName: string;
    productType: string | null;
    salePrice: number;
    regularPrice: number | null;
    store: string;
  }[];
  unmatchedIngredients: {
    recipeName: string;
    ingredient: string;
  }[];
  availableDeals: {
    itemName: string;
    productType: string | null;
    salePrice: number;
    regularPrice: number | null;
    store: string;
    unit: string;
  }[];
}

interface ReviewCorrection {
  type: 'reject_match' | 'swap_recipe' | 'note';
  recipeName: string;
  ingredient?: string;
  reason: string;
  suggestion?: string;
}

interface ReviewResult {
  approved: boolean;
  corrections: ReviewCorrection[];
  varietyIssue: string | null;
  leftoverOpportunities: string[];
}

// ────────────────────────────────────────────────────────────
// Claude CLI (opus)
// ────────────────────────────────────────────────────────────

function runClaudeOpus(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', 'opus'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('claude -p (opus) timed out after 90s'));
      }
    }, 90_000);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p (opus) exited ${code}: stdout=${stdout.slice(0, 200)} stderr=${stderr.slice(0, 200)}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`claude -p (opus) spawn error: ${err.message}`));
    });

    child.stdin.on('error', (err) => {
      logger.error('[PLAN_REVIEWER] stdin write error', { error: err.message });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ────────────────────────────────────────────────────────────
// Build review prompt
// ────────────────────────────────────────────────────────────

function buildReviewPrompt(ctx: PlanReviewContext): string {
  const profile = [
    `Dietary: ${ctx.userProfile.dietaryRestrictions.length > 0 ? ctx.userProfile.dietaryRestrictions.join(', ') : 'none'}`,
    `Cooking effort: ${ctx.userProfile.cookingEffort}`,
    `Household: ${ctx.userProfile.householdSize} people`,
    ctx.userProfile.kidAgeBrackets.length > 0 ? `Kids: ${ctx.userProfile.kidAgeBrackets.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const recipes = ctx.selectedRecipes.map((r) => {
    const ings = r.ingredients.map((i) => `  - ${i.quantity} ${i.unit} ${i.name}`).join('\n');
    return `## ${r.name} (${r.servings} servings, ${r.filterTags.join(', ') || 'no tags'})\n${ings}`;
  }).join('\n\n');

  const assignments = ctx.dealAssignments.map((a) =>
    `- [${a.recipeName}] ${a.ingredient} → "${a.dealName}" (${a.productType ?? 'no type'}) $${a.salePrice} at ${a.store}`
  ).join('\n');

  const unmatched = ctx.unmatchedIngredients.length > 0
    ? ctx.unmatchedIngredients.map((u) => `- [${u.recipeName}] ${u.ingredient}`).join('\n')
    : 'None';

  // Top 40 available deals for the stores in the plan, sorted by price
  const deals = ctx.availableDeals.slice(0, 40).map((d) =>
    `- "${d.itemName}" (${d.productType ?? 'no type'}) $${d.salePrice}${d.regularPrice ? ` (reg $${d.regularPrice})` : ''} ${d.unit} at ${d.store}`
  ).join('\n');

  return `You are a meal planning expert reviewing a weekly grocery shopping plan. Evaluate the plan and return corrections as JSON.

USER PROFILE:
${profile}

SELECTED RECIPES:
${recipes}

DEAL-TO-INGREDIENT ASSIGNMENTS:
${assignments}

UNMATCHED INGREDIENTS (no deal found):
${unmatched}

AVAILABLE DEALS AT THESE STORES (not yet assigned):
${deals}

REVIEW CRITERIA:
1. MATCH QUALITY: For each deal-ingredient assignment, is the deal actually a valid substitute for what the recipe needs? A recipe needing "fresh dill" should not get "dill pickles". A recipe needing "cream" should not get "ice cream". Be strict — the deal must work as that ingredient in the recipe.
2. VARIETY: Are there 3+ recipes with the same primary protein? Flag it.
3. LEFTOVERS: If a bulk deal (family pack, multi-pack) covers one recipe with surplus, could that surplus supply another recipe's unmatched ingredient?
4. SUBSTITUTIONS: For unmatched ingredients, is there an available deal that could work as a substitute?

Return ONLY a JSON object (no markdown fences) with this shape:
{
  "approved": boolean,
  "corrections": [
    {
      "type": "reject_match" | "swap_recipe" | "note",
      "recipeName": string,
      "ingredient": string | null,
      "reason": string,
      "suggestion": string | null
    }
  ],
  "varietyIssue": string | null,
  "leftoverOpportunities": [string]
}

If the plan is good, return {"approved": true, "corrections": [], "varietyIssue": null, "leftoverOpportunities": []}.
Be concise in reasons (under 20 words each).`;
}

// ────────────────────────────────────────────────────────────
// Parse review response
// ────────────────────────────────────────────────────────────

function parseReviewResponse(raw: string): ReviewResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(cleaned) as ReviewResult;
  } catch {
    logger.error('[PLAN_REVIEWER] Failed to parse opus response', {
      response: raw.slice(0, 500),
    });
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Apply corrections to plan
// ────────────────────────────────────────────────────────────

function applyCorrections(plan: GroceryPlan, review: ReviewResult, context: PlanReviewContext): GroceryPlan {
  const rejectKeys = new Set<string>();

  for (const correction of review.corrections) {
    if (correction.type === 'reject_match' && correction.ingredient) {
      rejectKeys.add(`${correction.recipeName}|${correction.ingredient}`.toLowerCase());
      logger.info('[PLAN_REVIEWER] Rejecting match', {
        recipe: correction.recipeName,
        ingredient: correction.ingredient,
        reason: correction.reason,
      });
    }
    if (correction.type === 'swap_recipe') {
      logger.info('[PLAN_REVIEWER] Recipe swap suggested', {
        recipe: correction.recipeName,
        reason: correction.reason,
        suggestion: correction.suggestion,
      });
    }
    if (correction.type === 'note') {
      logger.info('[PLAN_REVIEWER] Note', {
        recipe: correction.recipeName,
        note: correction.reason,
      });
    }
  }

  if (review.varietyIssue) {
    logger.info('[PLAN_REVIEWER] Variety issue', { issue: review.varietyIssue });
  }

  for (const opp of review.leftoverOpportunities) {
    logger.info('[PLAN_REVIEWER] Leftover opportunity', { opportunity: opp });
  }

  if (rejectKeys.size === 0) return plan;

  // Build ingredient→dealName lookup from the review context so we can
  // match Opus corrections (which reference ingredient keywords) against
  // plan items (which use deal names).
  // Key: "recipename|dealname" → true if that deal should be rejected
  const rejectedDealKeys = new Set<string>();
  for (const assignment of context.dealAssignments) {
    const ingredientKey = `${assignment.recipeName}|${assignment.ingredient}`.toLowerCase();
    if (rejectKeys.has(ingredientKey)) {
      const dealKey = `${assignment.recipeName}|${assignment.dealName}`.toLowerCase();
      rejectedDealKeys.add(dealKey);
      logger.info('[PLAN_REVIEWER] Mapped rejection to deal', {
        ingredient: assignment.ingredient,
        dealName: assignment.dealName,
        recipe: assignment.recipeName,
      });
    }
  }

  function isRejected(forMeal: string, dealName: string): boolean {
    return rejectedDealKeys.has(`${forMeal}|${dealName}`.toLowerCase());
  }

  // Remove rejected deal assignments from the plan
  const updatedStops: PlanStop[] = plan.stops.map((stop) => {
    const keptItems: PlanShoppingItem[] = [];
    let removedCost = 0;
    let removedSavings = 0;

    for (const item of stop.items) {
      if (item.isOnSale && item.forMeal && isRejected(item.forMeal, item.name)) {
        removedCost += item.salePrice ?? 0;
        removedSavings += (item.regularPrice ?? item.salePrice ?? 0) - (item.salePrice ?? 0);
        // Convert to unmatched item
        keptItems.push({
          name: item.name,
          quantity: item.quantity,
          salePrice: null,
          regularPrice: null,
          isOnSale: false,
          dealNote: null,
          forMeal: item.forMeal,
        });
      } else {
        keptItems.push(item);
      }
    }

    // Recalculate meal costs if items were removed
    const updatedMeals = stop.meals.map((meal) => {
      const mealItems = keptItems.filter((i) => i.forMeal === meal.name && i.isOnSale);
      const mealCost = mealItems.reduce((sum, i) => sum + (i.salePrice ?? 0), 0);
      const mealRegular = mealItems.reduce((sum, i) => sum + (i.regularPrice ?? i.salePrice ?? 0), 0);
      const servings = stop.meals.find((m) => m.mealId === meal.mealId)
        ? 4 : 4; // default servings
      return {
        ...meal,
        totalCost: Math.round(mealCost * 100) / 100,
        costPerServing: Math.round((mealCost / servings) * 100) / 100,
        savings: Math.round((mealRegular - mealCost) * 100) / 100,
      };
    });

    return {
      ...stop,
      items: keptItems,
      meals: updatedMeals,
      subtotal: Math.round((stop.subtotal - removedCost) * 100) / 100,
    };
  });

  const newTotal = updatedStops.reduce((sum, s) => sum + s.subtotal, 0);
  const newSavings = updatedStops.reduce((sum, s) =>
    sum + s.items.reduce((itemSum, item) => {
      if (item.isOnSale && item.regularPrice !== null && item.salePrice !== null) {
        return itemSum + (item.regularPrice - item.salePrice);
      }
      return itemSum;
    }, 0), 0);

  return {
    ...plan,
    stops: updatedStops,
    total: Math.round(newTotal * 100) / 100,
    estimatedSavings: Math.round(newSavings * 100) / 100,
    budgetRemaining: Math.round((plan.budgetRemaining + (plan.total - newTotal)) * 100) / 100,
  };
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Review a grocery plan with Claude Opus. Returns the corrected plan.
 * Fails open: if Opus call fails, returns the original plan unchanged.
 */
export async function reviewPlan(
  plan: GroceryPlan,
  context: PlanReviewContext,
): Promise<GroceryPlan> {
  const prompt = buildReviewPrompt(context);

  logger.info('[PLAN_REVIEWER] Sending plan to opus for review', {
    recipeCount: context.selectedRecipes.length,
    assignmentCount: context.dealAssignments.length,
    unmatchedCount: context.unmatchedIngredients.length,
  });

  try {
    const raw = await runClaudeOpus(prompt);
    const review = parseReviewResponse(raw);

    if (!review) {
      logger.warn('[PLAN_REVIEWER] Could not parse review, returning original plan');
      return plan;
    }

    logger.info('[PLAN_REVIEWER] Review complete', {
      approved: review.approved,
      corrections: review.corrections.length,
      varietyIssue: review.varietyIssue,
      leftoverOpportunities: review.leftoverOpportunities.length,
    });

    if (review.approved && review.corrections.length === 0) {
      return plan;
    }

    return applyCorrections(plan, review, context);
  } catch (err) {
    logger.error('[PLAN_REVIEWER] Opus review failed, returning original plan', {
      error: err instanceof Error ? err.message : String(err),
    });
    return plan;
  }
}
