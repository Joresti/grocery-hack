import React, { useState, useCallback } from 'react';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';
import { PlusIcon } from '../theme/icons/PlusIcon';
import { ModalOverlay } from './ModalOverlay';
import {
  useImportantItems,
  useAddImportantItem,
  useUpdateImportantItem,
} from '../hooks/useImportantItems';
import { useTrack } from '../hooks/useTrack';
import type { ImportantItem } from '@groceryhack/shared/types';

interface ImportantItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportantItemsModal({
  isOpen,
  onClose,
}: ImportantItemsModalProps): React.ReactElement {
  const { data: items } = useImportantItems();
  const addMutation = useAddImportantItem();
  const updateMutation = useUpdateImportantItem();
  const { track } = useTrack();

  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');

  const handleAdd = useCallback(() => {
    const name = newItemName.trim();
    if (!name) return;

    const quantity = newItemQuantity.trim() || undefined;

    addMutation.mutate(
      { name, quantity },
      {
        onSuccess: () => {
          track('important_item_added', { item_name: name });
          setNewItemName('');
          setNewItemQuantity('');
        },
      }
    );
  }, [newItemName, newItemQuantity, addMutation, track]);

  const handleToggle = useCallback(
    (item: ImportantItem) => {
      const newActive = !item.isActive;
      updateMutation.mutate(
        { id: item.id, data: { isActive: newActive } },
        {
          onSuccess: () => {
            track('important_item_toggled', {
              item_id: item.id,
              is_active: newActive,
            });
          },
        }
      );
    },
    [updateMutation, track]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  const allItems = items ?? [];

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Important Items">
      <div style={styles.container}>
        <div style={styles.addRow}>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Item name (e.g., milk)"
            style={styles.nameInput}
            aria-label="Item name"
          />
          <input
            type="text"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Qty"
            style={styles.quantityInput}
            aria-label="Item quantity"
          />
          <button
            onClick={handleAdd}
            disabled={!newItemName.trim() || addMutation.isPending}
            style={{
              ...styles.addButton,
              opacity: !newItemName.trim() || addMutation.isPending ? 0.5 : 1,
            }}
            aria-label="Add item"
            type="button"
          >
            <PlusIcon size={18} color={colors.white} />
          </button>
        </div>

        {allItems.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>
              Add items you buy every week. They'll be included in your optimized
              shopping plan.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {allItems.map((item) => (
              <div
                key={item.id}
                style={{
                  ...styles.itemRow,
                  opacity: item.isActive ? 1 : 0.5,
                }}
              >
                <button
                  onClick={() => handleToggle(item)}
                  style={styles.toggleWrapper}
                  aria-label={`Toggle ${item.name} ${item.isActive ? 'off' : 'on'}`}
                  type="button"
                >
                  <div
                    style={{
                      ...styles.toggle,
                      backgroundColor: item.isActive
                        ? colors.primary
                        : colors.border,
                    }}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        transform: item.isActive
                          ? 'translateX(18px)'
                          : 'translateX(2px)',
                      }}
                    />
                  </div>
                </button>
                <div style={styles.itemInfo}>
                  <span
                    style={{
                      ...styles.itemName,
                      textDecoration: item.isActive ? 'none' : 'line-through',
                    }}
                  >
                    {item.name}
                  </span>
                  {item.quantity && (
                    <span style={styles.itemQuantity}>{item.quantity}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  addRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 14px',
    outline: 'none',
    minHeight: 44,
  },
  quantityInput: {
    width: 70,
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 14px',
    outline: 'none',
    minHeight: 44,
    flexShrink: 0,
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  emptyState: {
    padding: '32px 16px',
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.65,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 0',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    transition: 'opacity 0.2s ease',
  },
  toggleWrapper: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    position: 'relative',
    transition: 'background-color 0.2s ease',
    flexShrink: 0,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: colors.white,
    position: 'absolute',
    top: 2,
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.medium,
    color: colors.text,
    transition: 'text-decoration 0.2s ease',
  },
  itemQuantity: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    backgroundColor: colors.bg,
    padding: '2px 8px',
    borderRadius: radii.pill,
  },
};
