import { pool } from '../client.js';

/**
 * Insert an event into the events table.
 */
export async function insertEvent(
  userId: string,
  sessionId: string | null,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO events (id, user_id, session_id, event_type, metadata)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [userId, sessionId, eventType, JSON.stringify(metadata)],
  );
}

/**
 * Check if an event with a matching token in metadata already exists
 * for a given user and event type. Used for deduplication of email
 * open/click tracking.
 */
export async function hasEvent(
  userId: string,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const token = metadata.token as string | undefined;
  const url = metadata.link_target as string | undefined;

  let result;
  if (url) {
    result = await pool.query(
      `SELECT 1 FROM events
       WHERE user_id = $1
         AND event_type = $2
         AND metadata ->> 'token' = $3
         AND metadata ->> 'link_target' = $4
       LIMIT 1`,
      [userId, eventType, token, url],
    );
  } else {
    result = await pool.query(
      `SELECT 1 FROM events
       WHERE user_id = $1
         AND event_type = $2
         AND metadata ->> 'token' = $3
       LIMIT 1`,
      [userId, eventType, token],
    );
  }

  return result.rows.length > 0;
}

/**
 * Insert a public (unauthenticated) event with no user association.
 */
export async function insertPublicEvent(
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO events (id, user_id, session_id, event_type, metadata)
     VALUES (gen_random_uuid(), NULL, NULL, $1, $2)`,
    [eventType, JSON.stringify(metadata)],
  );
}
