import { z } from 'zod';
import { postalCode, maxStores } from './primitives.js';

const householdMemberSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
  dietary_restrictions: z.array(z.string()).default([]),
}).transform(d => ({
  name: d.name,
  age: d.age,
  dietaryRestrictions: d.dietary_restrictions,
}));

export const updateUserSchema = z.object({
  display_name: z.string().optional(),
  postal_code: postalCode.optional(),
  budget: z.number().positive().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  max_stores: maxStores.optional(),
  household_size: z.number().int().min(1).max(12).optional(),
  household_members: z.array(householdMemberSchema).optional(),
  household_names: z.array(z.string()).optional(),
}).transform(d => ({
  displayName: d.display_name,
  postalCode: d.postal_code,
  budget: d.budget,
  dietaryRestrictions: d.dietary_restrictions,
  maxStores: d.max_stores,
  householdSize: d.household_size,
  householdMembers: d.household_members,
  householdNames: d.household_names,
}));

export type UpdateUserInput = z.output<typeof updateUserSchema>;
