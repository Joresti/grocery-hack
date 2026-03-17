import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mapper
// ────────────────────────────────────────────────────────────

function mapItemRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    quantity: (row.quantity as string) ?? null,
    is_active: row.is_active as boolean,
    created_at: (row.created_at as Date).toISOString(),
    deactivated_at: row.deactivated_at
      ? (row.deactivated_at as Date).toISOString()
      : null,
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

const BASE_COLUMNS = `id, user_id, name, quantity, is_active, created_at, deactivated_at`;

/**
 * Find important items for a user.
 * If activeOnly is true, only return items where is_active = true.
 * Returns snake_case objects ordered by created_at DESC.
 */
export async function findImportantItems(
  userId: string,
  activeOnly: boolean,
): Promise<Record<string, unknown>[]> {
  const activeFilter = activeOnly ? ' AND is_active = true' : '';

  const { rows } = await pool.query(
    `SELECT ${BASE_COLUMNS}
     FROM important_items
     WHERE user_id = $1${activeFilter}
     ORDER BY created_at DESC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(mapItemRow);
}

/**
 * Find an important item by name for a specific user (for dedup check).
 * Case-insensitive match via LOWER().
 */
export async function findImportantItemByName(
  userId: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT ${BASE_COLUMNS}
     FROM important_items
     WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
    [userId, name],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapItemRow(rows[0] as Record<string, unknown>);
}

/**
 * Create a new important item. Returns the inserted row.
 */
export async function createImportantItem(
  userId: string,
  name: string,
  quantity: string | undefined,
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `INSERT INTO important_items (user_id, name, quantity)
     VALUES ($1, $2, $3)
     RETURNING ${BASE_COLUMNS}`,
    [userId, name, quantity ?? null],
  );

  return mapItemRow(rows[0] as Record<string, unknown>);
}

/**
 * Reactivate an inactive important item.
 * Sets is_active = true and deactivated_at = null.
 * Returns the updated row.
 */
export async function reactivateItem(
  itemId: string,
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `UPDATE important_items
     SET is_active = true, deactivated_at = NULL
     WHERE id = $1
     RETURNING ${BASE_COLUMNS}`,
    [itemId],
  );

  return mapItemRow(rows[0] as Record<string, unknown>);
}

/**
 * Update an important item by ID and user_id.
 * Dynamically builds the SET clause based on which fields are provided.
 * If isActive === false, sets deactivated_at = now().
 * If isActive === true, sets deactivated_at = null.
 * Returns the updated row or null if not found.
 */
export async function updateImportantItem(
  itemId: string,
  userId: string,
  updates: { name?: string; quantity?: string; isActive?: boolean },
): Promise<Record<string, unknown> | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.quantity !== undefined) {
    setClauses.push(`quantity = $${paramIndex++}`);
    values.push(updates.quantity);
  }

  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);

    if (updates.isActive === false) {
      setClauses.push(`deactivated_at = now()`);
    } else {
      setClauses.push(`deactivated_at = NULL`);
    }
  }

  if (setClauses.length === 0) {
    // Nothing to update — return the existing row
    return findImportantItemById(itemId, userId);
  }

  values.push(itemId);
  const itemIdParam = paramIndex++;
  values.push(userId);
  const userIdParam = paramIndex;

  const { rows } = await pool.query(
    `UPDATE important_items
     SET ${setClauses.join(', ')}
     WHERE id = $${itemIdParam} AND user_id = $${userIdParam}
     RETURNING ${BASE_COLUMNS}`,
    values,
  );

  if (rows.length === 0) {
    return null;
  }

  return mapItemRow(rows[0] as Record<string, unknown>);
}

/**
 * Find an important item by ID and user_id (for ownership check).
 */
export async function findImportantItemById(
  itemId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT ${BASE_COLUMNS}
     FROM important_items
     WHERE id = $1 AND user_id = $2`,
    [itemId, userId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapItemRow(rows[0] as Record<string, unknown>);
}
