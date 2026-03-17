import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row mappers
// ────────────────────────────────────────────────────────────

function mapShareRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    sender_id: row.sender_id as string,
    token: row.token as string,
    meal_id: row.meal_id as string,
    meal_source: row.meal_source as string,
    share_type: row.share_type as string,
    recipient_name: (row.recipient_name as string | null) ?? null,
    recipient_contact: row.recipient_contact as string,
    channel: row.channel as string,
    status: row.status as string,
    date: row.date ? (row.date as Date).toISOString().split('T')[0] : null,
    time: (row.time as string | null) ?? null,
    responded_at: row.responded_at ? (row.responded_at as Date).toISOString() : null,
    expires_at: (row.expires_at as Date).toISOString(),
    created_at: (row.created_at as Date).toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

export async function createMealShare(data: {
  senderId: string;
  token: string;
  mealId: string;
  mealSource: string;
  shareType: string;
  recipientName: string | null;
  recipientContact: string;
  channel: string;
  date: string | null;
  time: string | null;
  expiresAt: string;
}): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `INSERT INTO meal_shares
       (sender_id, token, meal_id, meal_source, share_type,
        recipient_name, recipient_contact, channel, date, time, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.senderId,
      data.token,
      data.mealId,
      data.mealSource,
      data.shareType,
      data.recipientName,
      data.recipientContact,
      data.channel,
      data.date,
      data.time,
      data.expiresAt,
    ],
  );

  return mapShareRow(rows[0] as Record<string, unknown>);
}

export async function findShareByToken(
  token: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT ms.*, u.display_name AS sender_display_name, u.email AS sender_email
     FROM meal_shares ms
     JOIN users u ON u.id = ms.sender_id
     WHERE ms.token = $1`,
    [token],
  );

  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;
  return {
    ...mapShareRow(row),
    sender_display_name: (row.sender_display_name as string | null) ?? null,
    sender_email: row.sender_email as string,
  };
}

export async function updateShareStatus(
  token: string,
  status: 'accepted' | 'declined',
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `UPDATE meal_shares
     SET status = $2, responded_at = now()
     WHERE token = $1
     RETURNING *`,
    [token, status],
  );

  if (rows.length === 0) return null;

  return mapShareRow(rows[0] as Record<string, unknown>);
}

export async function findMealName(
  mealId: string,
  mealSource: string,
): Promise<string | null> {
  if (mealSource === 'user_recipe') {
    const { rows } = await pool.query(
      `SELECT name FROM user_recipes WHERE id = $1`,
      [mealId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? (row.name as string) : null;
  }

  const { rows } = await pool.query(
    `SELECT name FROM meals WHERE id = $1`,
    [mealId],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? (row.name as string) : null;
}

export async function findSenderDisplayName(
  userId: string,
): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT display_name FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? (row.display_name as string | null) : null;
}

export async function findPlanByToken(
  planToken: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT wp.*, u.display_name AS owner_display_name
     FROM weekly_plans wp
     JOIN users u ON u.id = wp.user_id
     WHERE wp.token = $1`,
    [planToken],
  );

  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token: row.token as string,
    week_of: row.week_of ? (row.week_of as Date).toISOString().split('T')[0] : null,
    one_store_optimized: row.one_store_optimized,
    two_store_optimized: row.two_store_optimized,
    watchlist_alerts: row.watchlist_alerts,
    recipe_alerts: row.recipe_alerts,
    owner_display_name: (row.owner_display_name as string | null) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}
