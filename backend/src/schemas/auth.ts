import { z } from 'zod';
import { email, postalCode, maxStores } from './primitives.js';

export const registerSchema = z.object({
  email: email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  postal_code: postalCode,
  display_name: z.string().min(1, 'Name is required'),
  budget: z.number().positive().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  max_stores: maxStores.optional(),
  household_size: z.number().int().min(1).max(12).optional(),
}).transform(d => ({
  email: d.email,
  password: d.password,
  postalCode: d.postal_code,
  displayName: d.display_name,
  budget: d.budget,
  dietaryRestrictions: d.dietary_restrictions,
  maxStores: d.max_stores,
  householdSize: d.household_size,
}));

export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1),
}).transform(d => ({
  email: d.email,
  password: d.password,
}));

export type LoginInput = z.output<typeof loginSchema>;

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
}).transform(d => ({
  refreshToken: d.refresh_token,
}));

export type RefreshInput = z.output<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({
  email: email,
}).transform(d => ({
  email: d.email,
}));

export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
}).transform(d => ({
  token: d.token,
  newPassword: d.new_password,
}));

export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
