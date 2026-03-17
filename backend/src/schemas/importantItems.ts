import { z } from 'zod';

export const addImportantItemBody = z.object({
  name: z.string().min(1, 'Item name is required.'),
  quantity: z.string().optional(),
}).transform(d => ({
  name: d.name,
  quantity: d.quantity,
}));

export type AddImportantItemInput = z.output<typeof addImportantItemBody>;

export const updateImportantItemBody = z.object({
  name: z.string().min(1).optional(),
  quantity: z.string().optional(),
  is_active: z.boolean().optional(),
}).transform(d => ({
  name: d.name,
  quantity: d.quantity,
  isActive: d.is_active,
}));

export type UpdateImportantItemInput = z.output<typeof updateImportantItemBody>;

export const importantItemIdParam = z.object({
  item_id: z.string().uuid(),
}).transform(d => ({
  itemId: d.item_id,
}));

export type ImportantItemIdParam = z.output<typeof importantItemIdParam>;

export const importantItemsQuery = z.object({
  active_only: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
}).transform(d => ({
  activeOnly: d.active_only,
}));

export type ImportantItemsQuery = z.output<typeof importantItemsQuery>;
