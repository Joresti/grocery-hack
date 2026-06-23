import { pool } from '../client.js';

export interface FamilyMemberLink {
  accountHolderId: string | null;
  holderDisplayName: string | null;
}

export interface CreateMealSuggestionParams {
  suggesterId: string;
  accountHolderId: string;
  weeklyPlanId: string;
  targetMealId: string;
  replacementMealId: string;
}

/**
 * Map a meal_suggestions row (joined with meal names) to a snake_case API object.
 * The route returns this directly as JSON; the frontend camelCases it.
 */
function mapSuggestionRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    suggester_id: row.suggester_id as string,
    account_holder_id: row.account_holder_id as string,
    weekly_plan_id: row.weekly_plan_id as string,
    target_meal_id: row.target_meal_id as string,
    replacement_meal_id: row.replacement_meal_id as string,
    status: row.status as string,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
    replacement_meal_name: row.replacement_meal_name as string,
    target_meal_name: (row.target_meal_name as string | null) ?? null,
    suggester_name: (row.suggester_name as string | null) ?? null,
  };
}

/**
 * Resolve a user's account_holder_id and the holder's display_name in one JOIN.
 * Returns null if the user doesn't exist.
 */
export async function getFamilyMemberLink(userId: string): Promise<FamilyMemberLink | null> {
  const { rows } = await pool.query(
    `SELECT u.account_holder_id,
            h.display_name AS holder_display_name
     FROM users u
     LEFT JOIN users h ON h.id = u.account_holder_id
     WHERE u.id = $1`,
    [userId],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    accountHolderId: (row.account_holder_id as string | null) ?? null,
    holderDisplayName: (row.holder_display_name as string | null) ?? null,
  };
}

/**
 * Insert a meal suggestion and return it with denormalised meal names.
 * Joins meals for the replacement (FK-guaranteed) and LEFT JOINs for the target
 * (target_meal_id is a PlanMeal.mealId with no FK, so the name may be absent).
 */
export async function createMealSuggestion(
  params: CreateMealSuggestionParams,
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO meal_suggestions
         (suggester_id, account_holder_id, weekly_plan_id, target_meal_id, replacement_meal_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT i.*,
            rm.name AS replacement_meal_name,
            tm.name AS target_meal_name
     FROM inserted i
     JOIN meals rm ON rm.id = i.replacement_meal_id
     LEFT JOIN meals tm ON tm.id = i.target_meal_id`,
    [
      params.suggesterId,
      params.accountHolderId,
      params.weeklyPlanId,
      params.targetMealId,
      params.replacementMealId,
    ],
  );

  return mapSuggestionRow(rows[0] as Record<string, unknown>);
}

/**
 * Get the suggester's own pending suggestions for a specific weekly plan.
 * Used to populate `pending_suggestions` on GET /family/plan so the UI can render
 * "Suggestion pending" markers. Returns snake_case objects, newest first.
 */
export async function getMySuggestionsForPlan(
  suggesterId: string,
  weeklyPlanId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT s.*,
            rm.name AS replacement_meal_name,
            tm.name AS target_meal_name
     FROM meal_suggestions s
     JOIN meals rm ON rm.id = s.replacement_meal_id
     LEFT JOIN meals tm ON tm.id = s.target_meal_id
     WHERE s.suggester_id = $1
       AND s.weekly_plan_id = $2
       AND s.status = 'pending'
     ORDER BY s.created_at DESC`,
    [suggesterId, weeklyPlanId],
  );

  return (rows as Record<string, unknown>[]).map(mapSuggestionRow);
}

/**
 * The suggester's existing *pending* suggestion for a single target meal in a plan,
 * or null. Backs the duplicate-guard pre-check in `suggestMeal` (one pending
 * suggestion per meal per family member). Mirrors getMySuggestionsForPlan but
 * filtered to one target meal and returning a single row. The meal-name joins are
 * fidelity-only — the service only checks existence — but kept so the shape matches.
 */
export async function getPendingSuggestionForMeal(
  suggesterId: string,
  weeklyPlanId: string,
  targetMealId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT s.*,
            rm.name AS replacement_meal_name,
            tm.name AS target_meal_name
     FROM meal_suggestions s
     JOIN meals rm ON rm.id = s.replacement_meal_id
     LEFT JOIN meals tm ON tm.id = s.target_meal_id
     WHERE s.suggester_id = $1
       AND s.weekly_plan_id = $2
       AND s.target_meal_id = $3
       AND s.status = 'pending'
     LIMIT 1`,
    [suggesterId, weeklyPlanId, targetMealId],
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? mapSuggestionRow(row) : null;
}

/**
 * Get all *pending* suggestions addressed to an account holder, across all family
 * members. Joins the suggester (su.display_name AS suggester_name), the replacement
 * meal (rm.name, FK-guaranteed) and the target meal (LEFT JOIN — target_meal_id is a
 * PlanMeal.mealId with no FK, so the name may be null). Newest first. Returns
 * snake_case objects via mapSuggestionRow. Backs GET /family/suggestions.
 */
export async function getHolderPendingSuggestions(
  accountHolderId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT s.*,
            su.display_name AS suggester_name,
            rm.name AS replacement_meal_name,
            tm.name AS target_meal_name
     FROM meal_suggestions s
     JOIN users su ON su.id = s.suggester_id
     JOIN meals rm ON rm.id = s.replacement_meal_id
     LEFT JOIN meals tm ON tm.id = s.target_meal_id
     WHERE s.account_holder_id = $1
       AND s.status = 'pending'
     ORDER BY s.created_at DESC`,
    [accountHolderId],
  );

  return (rows as Record<string, unknown>[]).map(mapSuggestionRow);
}

/**
 * Count the *pending* suggestions addressed to an account holder. Backs the
 * count-gated "Suggestions (N)" landing entry (rides on GET /landing).
 */
export async function countHolderPendingSuggestions(
  accountHolderId: string,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count
     FROM meal_suggestions
     WHERE account_holder_id = $1
       AND status = 'pending'`,
    [accountHolderId],
  );

  return (rows[0] as { count: number }).count;
}
