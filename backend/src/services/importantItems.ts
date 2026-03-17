import * as itemQueries from '../db/queries/importantItems.js';
import { throwNotFound, throwConflict } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Get Important Items
// ────────────────────────────────────────────────────────────

export async function getImportantItems(
  userId: string,
  activeOnly: boolean,
): Promise<Record<string, unknown>[]> {
  return itemQueries.findImportantItems(userId, activeOnly);
}

// ────────────────────────────────────────────────────────────
// Add Important Item
// ────────────────────────────────────────────────────────────

interface AddItemResult {
  item: Record<string, unknown>;
  reactivated: boolean;
}

export async function addImportantItem(
  userId: string,
  name: string,
  quantity?: string,
): Promise<AddItemResult> {
  const existing = await itemQueries.findImportantItemByName(userId, name);

  if (existing) {
    const isActive = existing.is_active as boolean;

    if (isActive) {
      throwConflict(
        'DUPLICATE_ITEM',
        'You already have this item.',
      );
    }

    // Item exists but is inactive — reactivate it
    const reactivated = await itemQueries.reactivateItem(existing.id as string);
    return { item: reactivated, reactivated: true };
  }

  // New item — create it
  const item = await itemQueries.createImportantItem(userId, name, quantity);
  return { item, reactivated: false };
}

// ────────────────────────────────────────────────────────────
// Update Important Item
// ────────────────────────────────────────────────────────────

export async function updateImportantItem(
  userId: string,
  itemId: string,
  updates: { name?: string; quantity?: string; isActive?: boolean },
): Promise<Record<string, unknown>> {
  const existing = await itemQueries.findImportantItemById(itemId, userId);

  if (!existing) {
    throwNotFound('ITEM_NOT_FOUND', 'Item not found.');
  }

  const updated = await itemQueries.updateImportantItem(itemId, userId, updates);

  if (!updated) {
    throwNotFound('ITEM_NOT_FOUND', 'Item not found.');
  }

  return updated;
}
