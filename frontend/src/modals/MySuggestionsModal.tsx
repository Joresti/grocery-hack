import React from 'react';
import { ModalOverlay } from './ModalOverlay';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';
import { useMySuggestions } from '../hooks/useMySuggestions';
import type { MealSuggestion, MealSuggestionStatus } from '@groceryhack/shared/types';

interface MySuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // The holder's display name, for the subtitle + info-banner copy (mockup Screen 6).
  holderName: string;
}

const subStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  margin: '0 0 4px',
  lineHeight: 1.5,
};

// Single bordered card holding all rows, divided by border-top — mockup .sugg-card.
const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  marginTop: '16px',
  overflow: 'hidden',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  padding: '16px 22px',
  borderTop: `1px solid ${colors.border}`,
};

const firstRowStyle: React.CSSProperties = {
  ...rowStyle,
  borderTop: 'none',
};

const mealStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '1rem',
  color: colors.text,
  margin: 0,
};

const replaceStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  margin: '2px 0 0',
  lineHeight: 1.4,
};

const chipBaseStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.78rem',
  padding: '5px 13px',
  borderRadius: radii.pill,
  whiteSpace: 'nowrap',
};

// Three chip variants — palettes match mockup Screen 6 (.st-* classes) and the live
// Pending chip in PendingSuggestionModal. Dismissed is a neutral grey (the mockup hex),
// NOT danger red — dismiss is a non-destructive "no thanks".
const chipStyles: Record<MealSuggestionStatus, React.CSSProperties> = {
  pending: { ...chipBaseStyle, backgroundColor: '#FBEEDB', color: '#9A6A12' },
  accepted: { ...chipBaseStyle, backgroundColor: colors.greenBadgeBg, color: colors.greenBadgeText },
  dismissed: { ...chipBaseStyle, backgroundColor: '#EDEBE4', color: '#85857C' },
};

const chipLabels: Record<MealSuggestionStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  dismissed: 'Dismissed',
};

const infoBannerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '9px',
  alignItems: 'flex-start',
  backgroundColor: colors.greenBadgeBg,
  borderRadius: '12px',
  padding: '13px 16px',
  marginTop: '18px',
  fontFamily: fonts.body,
  fontSize: '0.84rem',
  lineHeight: 1.5,
  color: colors.greenBadgeText,
};

const emptyStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.95rem',
  color: colors.textMuted,
  textAlign: 'center',
  padding: '32px 8px',
};

function StatusChip({ status }: { status: MealSuggestionStatus }): React.ReactElement {
  return <span style={chipStyles[status]}>{chipLabels[status]}</span>;
}

/**
 * Read-only "My Suggestions" status view (mockup Screen 6). The family member sees every
 * swap they suggested on the holder's current-week plan — the replacement, the meal it would
 * replace, and a status chip (Pending / Accepted / Dismissed). No accept/dismiss controls:
 * the member can see status but cannot act on it (only the holder can — Slice 8 proves the 403).
 */
export function MySuggestionsModal({
  isOpen,
  onClose,
  holderName,
}: MySuggestionsModalProps): React.ReactElement {
  const { data, isLoading, isError } = useMySuggestions(isOpen);
  const suggestions: MealSuggestion[] = data?.suggestions ?? [];

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="My Suggestions">
      <p style={subStyle}>Replacements you&rsquo;ve suggested to {holderName}</p>

      {isLoading && <LoadingSpinner />}

      {isError && !isLoading && (
        <p style={emptyStyle}>Something went wrong loading your suggestions.</p>
      )}

      {!isLoading && !isError && suggestions.length === 0 && (
        <p style={emptyStyle}>You haven&rsquo;t suggested any swaps yet.</p>
      )}

      {!isLoading && !isError && suggestions.length > 0 && (
        <>
          <div style={cardStyle}>
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} style={index === 0 ? firstRowStyle : rowStyle}>
                <div>
                  <p style={mealStyle}>{suggestion.replacementMealName}</p>
                  <p style={replaceStyle}>Replaces {suggestion.targetMealName ?? 'this meal'}</p>
                </div>
                <StatusChip status={suggestion.status} />
              </div>
            ))}
          </div>
          <div style={infoBannerStyle}>
            <span>
              You can track status here, but only {holderName} can accept or dismiss a suggestion.
            </span>
          </div>
        </>
      )}
    </ModalOverlay>
  );
}
