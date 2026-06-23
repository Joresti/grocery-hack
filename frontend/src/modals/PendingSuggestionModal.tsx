import React from 'react';
import { ModalOverlay } from './ModalOverlay';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';
import type { MealSuggestion } from '@groceryhack/shared/types';

interface PendingSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: MealSuggestion;
  holderName: string;
}

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '16px',
};

const sentenceStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.95rem',
  color: colors.text,
  lineHeight: 1.5,
  margin: 0,
};

const mealNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  color: colors.text,
};

// Amber "Pending" chip — matches the marker the user tapped (pillPendingStyle) and the
// mockup's .st-pending status chip.
const statusChipStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.78rem',
  backgroundColor: '#FBEEDB',
  color: '#9A6A12',
  padding: '5px 13px',
  borderRadius: radii.pill,
};

const noteStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  lineHeight: 1.5,
  margin: 0,
};

/**
 * Read-only detail for an existing pending suggestion. Opened by tapping a
 * "Suggestion pending" marker in StoreMealDealList. Naming-only — no resubmit and no
 * accept/dismiss controls (the holder's review loop is a later slice).
 */
export function PendingSuggestionModal({
  isOpen,
  onClose,
  suggestion,
  holderName,
}: PendingSuggestionModalProps): React.ReactElement {
  const targetName = suggestion.targetMealName ?? 'this meal';

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Your suggestion">
      <div style={bodyStyle}>
        <p style={sentenceStyle}>
          You suggested <strong style={mealNameStyle}>{suggestion.replacementMealName}</strong> to
          replace <strong style={mealNameStyle}>{targetName}</strong>.
        </p>
        <span style={statusChipStyle}>Pending</span>
        <p style={noteStyle}>Only {holderName} can accept or dismiss this.</p>
      </div>
    </ModalOverlay>
  );
}
