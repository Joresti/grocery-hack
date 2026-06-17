import { pool } from '../client.js';
import type { User, HouseholdMember } from '@groceryhack/shared/types.js';

// ────────────────────────────────────────────────────────────
// Row → Domain Mapper
// ────────────────────────────────────────────────────────────

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string | null,
    postalCode: row.postal_code as string,
    lat: row.lat as number | null,
    lng: row.lng as number | null,
    budget: row.budget ? Number(row.budget) : null,
    dietaryRestrictions: (row.dietary_restrictions as string[]) ?? [],
    maxStores: (row.max_stores as 1 | 2) ?? 1,
    householdSize: (row.household_size as number) ?? 1,
    householdMembers: (row.household_members as HouseholdMember[]) ?? [],
    householdNames: (row.household_names as string[]) ?? [],
    tasteProfile: (row.taste_profile as Record<string, number>) ?? {},
    subscriptionActive: (row.subscription_active as boolean) ?? false,
    accountHolderId: (row.account_holder_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find a user by email, including password_hash for auth verification.
 * Returns null if not found.
 */
export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string | null }) | null> {
  const { rows } = await pool.query(
    `SELECT *, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash as string | null,
  };
}

/**
 * Find a user by ID (no password_hash).
 * Returns null if not found.
 */
export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, postal_code, lat, lng, budget,
            dietary_restrictions, max_stores, household_size,
            household_members, household_names, taste_profile,
            subscription_active, account_holder_id, created_at, updated_at
     FROM users WHERE id = $1`,
    [id],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapUserRow(row);
}

/**
 * Create a new user. Returns the created user (without password_hash).
 */
export interface CreateUserData {
  email: string;
  passwordHash: string;
  postalCode: string;
  displayName?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: 1 | 2;
  householdSize?: number;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const { rows } = await pool.query(
    `INSERT INTO users (
       email, password_hash, display_name, postal_code, budget,
       dietary_restrictions, max_stores, household_size
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, display_name, postal_code, lat, lng, budget,
               dietary_restrictions, max_stores, household_size,
               household_members, household_names, taste_profile,
               subscription_active, account_holder_id, created_at, updated_at`,
    [
      data.email,
      data.passwordHash,
      data.displayName ?? null,
      data.postalCode,
      data.budget ?? null,
      data.dietaryRestrictions ?? [],
      data.maxStores ?? 1,
      data.householdSize ?? 1,
    ],
  );
  return mapUserRow(rows[0] as Record<string, unknown>);
}

/**
 * Update a user. Only sets the fields that are provided (not undefined).
 * Returns the updated user.
 */
export interface UpdateUserData {
  displayName?: string;
  postalCode?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: 1 | 2;
  householdSize?: number;
  householdMembers?: HouseholdMember[];
  householdNames?: string[];
  passwordHash?: string;
}

export async function updateUser(id: string, data: UpdateUserData): Promise<User | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.displayName !== undefined) {
    setClauses.push(`display_name = $${paramIndex++}`);
    values.push(data.displayName);
  }
  if (data.postalCode !== undefined) {
    setClauses.push(`postal_code = $${paramIndex++}`);
    values.push(data.postalCode);
  }
  if (data.budget !== undefined) {
    setClauses.push(`budget = $${paramIndex++}`);
    values.push(data.budget);
  }
  if (data.dietaryRestrictions !== undefined) {
    setClauses.push(`dietary_restrictions = $${paramIndex++}`);
    values.push(data.dietaryRestrictions);
  }
  if (data.maxStores !== undefined) {
    setClauses.push(`max_stores = $${paramIndex++}`);
    values.push(data.maxStores);
  }
  if (data.householdSize !== undefined) {
    setClauses.push(`household_size = $${paramIndex++}`);
    values.push(data.householdSize);
  }
  if (data.householdMembers !== undefined) {
    setClauses.push(`household_members = $${paramIndex++}`);
    values.push(JSON.stringify(data.householdMembers));
  }
  if (data.householdNames !== undefined) {
    setClauses.push(`household_names = $${paramIndex++}`);
    values.push(data.householdNames);
  }
  if (data.passwordHash !== undefined) {
    setClauses.push(`password_hash = $${paramIndex++}`);
    values.push(data.passwordHash);
  }

  if (setClauses.length === 0) {
    return findUserById(id);
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, email, display_name, postal_code, lat, lng, budget,
               dietary_restrictions, max_stores, household_size,
               household_members, household_names, taste_profile,
               subscription_active, account_holder_id, created_at, updated_at`,
    values,
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapUserRow(row);
}
