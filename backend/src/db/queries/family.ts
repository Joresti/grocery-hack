import { pool } from '../client.js';

export interface FamilyMemberLink {
  accountHolderId: string | null;
  holderDisplayName: string | null;
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
