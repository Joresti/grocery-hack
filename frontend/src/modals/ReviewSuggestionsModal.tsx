import React, { useState } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { InitialsAvatar } from '../components/shared/InitialsAvatar';
import { Toast } from '../components/shared';
import { SpinnerIcon } from '../theme/icons';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';
import { useHolderSuggestions } from '../hooks/useHolderSuggestions';
import { useAcceptSuggestion } from '../hooks/useAcceptSuggestion';
import type { MealSuggestion } from '@groceryhack/shared/types';

interface ReviewSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // The holder's display name. Not rendered in this read-only surface (the modal
  // title is fixed copy), but part of the contract — Slices 5/6 surface it in the
  // accept/dismiss confirmation copy. Accepted here so the call site stays stable.
  holderName: string;
}

/** "suggested 2 days ago" style relative time from an ISO timestamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  return 'just now';
}

const subStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  margin: '0 0 4px',
  lineHeight: 1.5,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  padding: '20px 22px',
  marginTop: '16px',
};

const whoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontFamily: fonts.body,
  fontSize: '0.82rem',
  color: colors.textMuted,
};

const newMealStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.text,
  margin: '14px 0 0',
};

const replaceStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.875rem',
  color: colors.textMuted,
  margin: '3px 0 0',
  lineHeight: 1.4,
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

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '16px',
};

const acceptButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.95rem',
  color: colors.white,
  backgroundColor: colors.primary,
  border: 'none',
  borderRadius: radii.pill,
  padding: '11px 30px',
  minHeight: '44px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const acceptButtonDisabledStyle: React.CSSProperties = {
  ...acceptButtonStyle,
  opacity: 0.6,
  cursor: 'default',
};

function ReviewCard({
  suggestion,
  onAccept,
  isAccepting,
}: {
  suggestion: MealSuggestion;
  onAccept: (suggestion: MealSuggestion) => void;
  isAccepting: boolean;
}): React.ReactElement {
  const who = suggestion.suggesterName ?? 'A family member';
  const targetName = suggestion.targetMealName ?? 'a meal';
  return (
    <div style={cardStyle}>
      <div style={whoStyle}>
        <InitialsAvatar name={who} size={34} />
        <span>
          {who} &middot; suggested {relativeTime(suggestion.createdAt)}
        </span>
      </div>
      <p style={newMealStyle}>{suggestion.replacementMealName}</p>
      <p style={replaceStyle}>Replaces {targetName} in this week&rsquo;s plan</p>
      <div style={actionsRowStyle}>
        <button
          type="button"
          style={isAccepting ? acceptButtonDisabledStyle : acceptButtonStyle}
          onClick={() => onAccept(suggestion)}
          disabled={isAccepting}
          aria-label={`Accept ${suggestion.replacementMealName}`}
        >
          {isAccepting && <SpinnerIcon size={16} color={colors.white} />}
          {isAccepting ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

/**
 * Read-only review surface (mockup Screen 7). The account holder sees every pending
 * meal-swap suggestion her family members submitted — who, when, the replacement meal,
 * and the meal it replaces. No Accept/Dismiss controls this slice: those arrive wired
 * up in Slices 5 (accept) and 6 (dismiss).
 */
export function ReviewSuggestionsModal({
  isOpen,
  onClose,
}: ReviewSuggestionsModalProps): React.ReactElement {
  const { data, isLoading, isError } = useHolderSuggestions(isOpen);
  const suggestions = data?.suggestions ?? [];
  const acceptMutation = useAcceptSuggestion();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleAccept = (suggestion: MealSuggestion): void => {
    if (acceptMutation.isPending) return; // one accept at a time
    acceptMutation.mutate(suggestion.id, {
      onSuccess: () =>
        setToast({ message: `Swapped ${suggestion.replacementMealName} into your plan`, type: 'success' }),
      onError: () =>
        setToast({ message: "Couldn't accept that suggestion. Please try again.", type: 'error' }),
    });
  };

  // The id of the in-flight accept, so only its card shows the spinner / disables.
  const acceptingId = acceptMutation.isPending ? acceptMutation.variables : undefined;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Pending Suggestions">
      <p style={subStyle}>Meal swaps suggested by your family members</p>

      {isLoading && <LoadingSpinner />}

      {isError && !isLoading && (
        <p style={emptyStyle}>Something went wrong loading your suggestions.</p>
      )}

      {!isLoading && !isError && suggestions.length === 0 && (
        <p style={emptyStyle}>No pending suggestions right now.</p>
      )}

      {!isLoading && !isError && suggestions.length > 0 && (
        <>
          {suggestions.map((suggestion) => (
            <ReviewCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={handleAccept}
              isAccepting={acceptingId === suggestion.id}
            />
          ))}
          <div style={infoBannerStyle}>
            <span>
              Accepting swaps the meal in your plan. Dismissing leaves your plan unchanged.
            </span>
          </div>
        </>
      )}

      <Toast
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        visible={toast !== null}
        onDismiss={() => setToast(null)}
      />
    </ModalOverlay>
  );
}
