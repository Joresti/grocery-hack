import React, { useState, useCallback } from 'react';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { ShareIcon } from '../theme/icons/ShareIcon';
import { ModalOverlay } from './ModalOverlay';
import { useShareMeal, useSharePlan } from '../hooks/useShare';
import { useTrack } from '../hooks/useTrack';
import type { ShareType, MealSource } from '@groceryhack/shared/types';

interface ShareContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealId?: string;
  mealSource?: MealSource;
  planToken?: string;
  shareType?: ShareType;
}

export function ShareContactModal({
  isOpen,
  onClose,
  mealId,
  mealSource,
  planToken,
  shareType,
}: ShareContactModalProps): React.ReactElement {
  const { track } = useTrack();
  const shareMealMutation = useShareMeal();
  const sharePlanMutation = useSharePlan();

  const [contact, setContact] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const isMealShare = mealId !== undefined && shareType !== undefined;
  const isPlanShare = planToken !== undefined;

  const isPending = shareMealMutation.isPending || sharePlanMutation.isPending;

  const handleSend = useCallback(() => {
    if (!contact.trim()) return;

    if (isMealShare && mealId && shareType) {
      shareMealMutation.mutate(
        {
          mealId,
          mealSource: mealSource ?? 'meal',
          recipientContact: contact.trim(),
          recipientName: recipientName.trim() || undefined,
          shareType,
          date: date || undefined,
          time: time || undefined,
        },
        {
          onSuccess: (response) => {
            track('share_meal_sent', {
              meal_id: mealId,
              share_type: shareType,
              channel: response.channel,
            });
            setShowSuccess(true);
            setTimeout(() => {
              setShowSuccess(false);
              resetForm();
              onClose();
            }, 1500);
          },
        }
      );
    } else if (isPlanShare && planToken) {
      sharePlanMutation.mutate(
        {
          planToken,
          recipientContact: contact.trim(),
          recipientName: recipientName.trim() || undefined,
        },
        {
          onSuccess: (response) => {
            track('share_plan_sent', {
              plan_token: planToken,
              channel: response.channel,
            });
            setShowSuccess(true);
            setTimeout(() => {
              setShowSuccess(false);
              resetForm();
              onClose();
            }, 1500);
          },
        }
      );
    }
  }, [
    contact,
    recipientName,
    date,
    time,
    isMealShare,
    isPlanShare,
    mealId,
    mealSource,
    shareType,
    planToken,
    shareMealMutation,
    sharePlanMutation,
    track,
    onClose,
  ]);

  const resetForm = useCallback(() => {
    setContact('');
    setRecipientName('');
    setDate('');
    setTime('');
  }, []);

  const canSend = contact.trim().length > 0 && !isPending;

  const title = isMealShare
    ? shareType === 'cook_for_me'
      ? 'Cook this for me?'
      : "I'll make this for you!"
    : 'Share Plan';

  const displayName = recipientName.trim() || 'your friend';

  const cookForMePreview = `Hey ${displayName}! Someone would love it if you'd make a meal for them. Tap below to see the recipe and let them know!`;
  const makeForYouPreview = `Good news, ${displayName}! Someone is planning to make a meal for you. Here's the recipe!`;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title={title}>
      <div style={styles.container}>
        {showSuccess ? (
          <div style={styles.successState}>
            <ShareIcon size={48} color={colors.success} />
            <p style={styles.successText}>Sent!</p>
          </div>
        ) : (
          <>
            {/* Contextual explanation */}
            {isMealShare && shareType === 'cook_for_me' && (
              <p style={styles.explanation}>
                Ask someone to cook this meal for you! They'll get an email or
                text with the recipe and can accept or decline.
              </p>
            )}
            {isMealShare && shareType === 'make_for_you' && (
              <p style={styles.explanation}>
                Let someone know you're making this meal for them! They'll get
                the recipe and a calendar link.
              </p>
            )}
            {isPlanShare && !isMealShare && (
              <p style={styles.explanation}>
                Share your weekly shopping plan with someone so they can see
                your meals and deals.
              </p>
            )}

            <div style={styles.field}>
              <label style={styles.label} htmlFor="share-name">
                Recipient Name (optional)
              </label>
              <input
                id="share-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Their name"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="share-contact">
                Email or Phone Number
              </label>
              <input
                id="share-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="email@example.com or +1234567890"
                style={styles.input}
                autoComplete="email"
              />
              <span style={styles.inputHint}>
                Enter their email address or phone number
              </span>
            </div>

            {/* Live message preview */}
            {isMealShare && (
              <div style={styles.messagePreview}>
                <span style={styles.messagePreviewLabel}>Message preview</span>
                <p style={styles.messagePreviewText}>
                  {shareType === 'cook_for_me'
                    ? cookForMePreview
                    : makeForYouPreview}
                </p>
              </div>
            )}

            {isMealShare && (
              <>
                <div style={styles.field}>
                  <label style={styles.label} htmlFor="share-date">
                    Date (optional)
                  </label>
                  <input
                    id="share-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label} htmlFor="share-time">
                    Time (optional)
                  </label>
                  <input
                    id="share-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                ...styles.sendButton,
                opacity: canSend ? 1 : 0.5,
                cursor: canSend ? 'pointer' : 'not-allowed',
              }}
              type="button"
            >
              {isPending ? 'Sending...' : 'Send'}
            </button>

            {(shareMealMutation.isError || sharePlanMutation.isError) && (
              <p style={styles.errorText}>
                Failed to send. Please check the contact and try again.
              </p>
            )}
          </>
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
  explanation: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    lineHeight: 1.5,
    margin: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '12px 16px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    minHeight: 44,
  },
  inputHint: {
    fontFamily: fonts.body,
    fontSize: '0.78rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    marginTop: '2px',
  },
  messagePreview: {
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.card,
    padding: '16px 20px',
  },
  messagePreviewLabel: {
    fontFamily: fonts.body,
    fontSize: '0.75rem',
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    display: 'block',
    marginBottom: '8px',
  },
  messagePreviewText: {
    fontFamily: fonts.body,
    fontSize: '0.88rem',
    fontWeight: fontWeights.regular,
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 1.55,
    margin: 0,
  },
  sendButton: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 32px',
    boxShadow: shadows.button,
    minHeight: 44,
    transition: 'all 0.2s ease',
    marginTop: '4px',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.medium,
    color: colors.danger,
    margin: 0,
  },
  successState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px 24px',
  },
  successText: {
    fontFamily: fonts.heading,
    fontSize: '1.4rem',
    fontWeight: fontWeights.bold,
    color: colors.success,
    margin: 0,
  },
};
