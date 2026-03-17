import { z } from 'zod';

export const shareMealBody = z.object({
  meal_id: z.string().uuid(),
  meal_source: z.enum(['meal', 'user_recipe']).default('meal'),
  recipient_name: z.string().optional(),
  recipient_contact: z.string().min(1),
  share_type: z.enum(['cook_for_me', 'make_for_you']),
  date: z.string().optional(),
  time: z.string().optional(),
}).transform(d => ({
  mealId: d.meal_id,
  mealSource: d.meal_source,
  recipientName: d.recipient_name ?? null,
  recipientContact: d.recipient_contact,
  shareType: d.share_type,
  date: d.date ?? null,
  time: d.time ?? null,
}));

export type ShareMealInput = z.output<typeof shareMealBody>;

export const shareRespondParams = z.object({
  token: z.string().min(1),
});

export type ShareRespondParams = z.output<typeof shareRespondParams>;

export const shareRespondQuery = z.object({
  action: z.enum(['accept', 'decline']),
});

export type ShareRespondQuery = z.output<typeof shareRespondQuery>;

export const sharePlanBody = z.object({
  plan_token: z.string().min(1),
  recipient_name: z.string().optional(),
  recipient_contact: z.string().min(1),
}).transform(d => ({
  planToken: d.plan_token,
  recipientName: d.recipient_name ?? null,
  recipientContact: d.recipient_contact,
}));

export type SharePlanInput = z.output<typeof sharePlanBody>;
