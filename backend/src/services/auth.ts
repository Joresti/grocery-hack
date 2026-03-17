import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import * as userQueries from '../db/queries/users.js';
import * as tokenQueries from '../db/queries/passwordResetTokens.js';
import { throwConflict, throwUnauthorized, throwBadRequest, throwNotFound } from '../middleware/errorHandler.js';
import type { User } from '@groceryhack/shared/types.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10;

interface TokenPair {
  token: string;
  refreshToken: string;
}

function signTokens(userId: string, email: string): TokenPair {
  const token = jwt.sign(
    { userId, email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY as jwt.SignOptions['expiresIn'] },
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'] },
  );
  return { token, refreshToken };
}

// ────────────────────────────────────────────────────────────
// Snake-case serializer for API responses
// ────────────────────────────────────────────────────────────

export function userToSnakeCase(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    postal_code: user.postalCode,
    lat: user.lat,
    lng: user.lng,
    budget: user.budget,
    dietary_restrictions: user.dietaryRestrictions,
    max_stores: user.maxStores,
    household_size: user.householdSize,
    household_members: user.householdMembers,
    household_names: user.householdNames,
    taste_profile: user.tasteProfile,
    subscription_active: user.subscriptionActive,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

// ────────────────────────────────────────────────────────────
// Register
// ────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  postalCode: string;
  displayName?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: 1 | 2;
  householdSize?: number;
}

export async function register(input: RegisterInput): Promise<{ user: User; token: string; refreshToken: string }> {
  const existing = await userQueries.findUserByEmail(input.email);
  if (existing) {
    throwConflict('EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await userQueries.createUser({
    email: input.email,
    passwordHash,
    postalCode: input.postalCode,
    displayName: input.displayName,
    budget: input.budget,
    dietaryRestrictions: input.dietaryRestrictions,
    maxStores: input.maxStores,
    householdSize: input.householdSize,
  });

  const { token, refreshToken } = signTokens(user.id, user.email);

  return { user, token, refreshToken };
}

// ────────────────────────────────────────────────────────────
// Login
// ────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput): Promise<{ user: User; token: string; refreshToken: string }> {
  const userWithPassword = await userQueries.findUserByEmail(input.email);

  if (!userWithPassword || !userWithPassword.passwordHash) {
    throwUnauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(input.password, userWithPassword.passwordHash);
  if (!valid) {
    throwUnauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  // Strip passwordHash before returning the user
  const { passwordHash: _ph, ...user } = userWithPassword;
  const { token, refreshToken } = signTokens(user.id, user.email);

  return { user, token, refreshToken };
}

// ────────────────────────────────────────────────────────────
// Refresh Token
// ────────────────────────────────────────────────────────────

export interface RefreshInput {
  refreshToken: string;
}

export async function refreshToken(input: RefreshInput): Promise<{ token: string; refreshToken: string }> {
  let payload: { userId: string; type: string };
  try {
    payload = jwt.verify(input.refreshToken, config.JWT_REFRESH_SECRET) as { userId: string; type: string };
  } catch {
    throwUnauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  if (payload.type !== 'refresh') {
    throwUnauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  const user = await userQueries.findUserById(payload.userId);
  if (!user) {
    throwUnauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  const tokens = signTokens(user.id, user.email);
  return { token: tokens.token, refreshToken: tokens.refreshToken };
}

// ────────────────────────────────────────────────────────────
// Forgot Password
// ────────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ sent: boolean }> {
  const user = await userQueries.findUserByEmail(email);

  // Never reveal whether the email exists
  if (!user) {
    return { sent: true };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await tokenQueries.createResetToken(user.id, token, expiresAt);

  // TODO: send password reset email via email service
  console.log(`[AUTH] Password reset token for ${email}: ${token}`);

  return { sent: true };
}

// ────────────────────────────────────────────────────────────
// Reset Password
// ────────────────────────────────────────────────────────────

export async function resetPassword(token: string, newPassword: string): Promise<{ reset: boolean }> {
  const resetToken = await tokenQueries.findValidToken(token);
  if (!resetToken) {
    throwBadRequest('RESET_TOKEN_INVALID', 'This reset link is invalid or has expired.');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await userQueries.updateUser(resetToken.userId, { passwordHash });
  await tokenQueries.markTokenUsed(token);

  return { reset: true };
}

// ────────────────────────────────────────────────────────────
// Get Profile
// ────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<User> {
  const user = await userQueries.findUserById(userId);
  if (!user) {
    throwNotFound('USER_NOT_FOUND', 'User not found.');
  }
  return user;
}

// ────────────────────────────────────────────────────────────
// Update Profile
// ────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  displayName?: string;
  postalCode?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: 1 | 2;
  householdSize?: number;
  householdMembers?: { name: string; age: number; dietaryRestrictions: string[] }[];
  householdNames?: string[];
}

export async function updateProfile(userId: string, data: UpdateProfileInput): Promise<User> {
  const user = await userQueries.updateUser(userId, data);
  if (!user) {
    throwNotFound('USER_NOT_FOUND', 'User not found.');
  }
  return user;
}
