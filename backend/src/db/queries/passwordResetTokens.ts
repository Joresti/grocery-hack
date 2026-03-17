import { pool } from '../client.js';

export interface PasswordResetTokenRow {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

function mapRow(row: Record<string, unknown>): PasswordResetTokenRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    token: row.token as string,
    expiresAt: row.expires_at as Date,
    usedAt: row.used_at as Date | null,
    createdAt: row.created_at as Date,
  };
}

/**
 * Create a password reset token.
 */
export async function createResetToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<PasswordResetTokenRow> {
  const { rows } = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, token, expiresAt],
  );
  return mapRow(rows[0] as Record<string, unknown>);
}

/**
 * Find a valid (unused, not expired) token.
 */
export async function findValidToken(
  token: string,
): Promise<PasswordResetTokenRow | null> {
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapRow(row);
}

/**
 * Mark a token as used by setting used_at to now().
 */
export async function markTokenUsed(token: string): Promise<void> {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = now() WHERE token = $1`,
    [token],
  );
}
