import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { colors } from '../theme/tokens';
import { CloseIcon } from '../theme/icons/CloseIcon';
import { Toast } from '../components/shared';
import { useMeals } from '../hooks/useMeals';
import { useDirectEditMeal } from '../hooks/useDirectEditMeal';
// Reuse the family-side swipe deck and modal chrome verbatim — only the copy and the
// submit action (direct edit, not a suggestion) differ.
import { ReplacementCard, styles } from './SuggestSwapModal';
import type { PlanMeal } from '@groceryhack/shared/types';

const GENERIC_ERROR_MESSAGE = "Couldn't change the meal. Please try again.";

interface ChangeMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The plan meal the holder is replacing (its mealId is the edit's target_meal_id). */
  targetMeal: PlanMeal;
  /** Called after the swap is applied, so the host can close the modal and confirm. */
  onApplied: () => void;
}

function SwapIcon({ size = 20, color = colors.primary }: { size?: number; color?: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h13a4 4 0 0 1 4 4" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H8a4 4 0 0 1-4-4" />
    </svg>
  );
}

export function ChangeMealModal({
  isOpen,
  onClose,
  targetMeal,
  onApplied,
}: ChangeMealModalProps): React.ReactElement | null {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<number>(0);
  const [errorVisible, setErrorVisible] = useState(false);

  const { data: meals, isLoading } = useMeals(isOpen);
  const editMutation = useDirectEditMeal();

  const handleNope = useCallback(() => {
    if (editMutation.isPending) return;
    setExitDirection(-1);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setExitDirection(0);
    }, 300);
  }, [editMutation.isPending]);

  const handleYum = useCallback(() => {
    const meal = meals?.[currentIndex];
    if (!meal || editMutation.isPending) return;
    editMutation.mutate(
      { targetMealId: targetMeal.mealId, replacementMealId: meal.id },
      {
        onSuccess: () => {
          onApplied();
        },
        onError: () => {
          setErrorVisible(true);
        },
      },
    );
  }, [meals, currentIndex, editMutation, targetMeal.mealId, onApplied]);

  if (!isOpen) {
    return null;
  }

  const total = meals?.length ?? 0;
  const isFinished = !isLoading && currentIndex >= total;
  const currentMeal = meals?.[currentIndex];

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={styles.fullScreen}
      role="dialog"
      aria-modal="true"
      aria-label={`Change ${targetMeal.name} to another meal`}
    >
      {/* Context bar */}
      <div style={styles.header}>
        <div style={styles.contextGroup}>
          <SwapIcon size={20} color={colors.primary} />
          <span style={styles.contextText}>
            Changing <strong style={styles.contextName}>{targetMeal.name}</strong> to…
          </span>
        </div>
        <div style={styles.headerRight}>
          {total > 0 && !isFinished && (
            <span style={styles.counter}>
              {currentIndex + 1} of {total}
            </span>
          )}
          <button
            onClick={onClose}
            style={styles.exitButton}
            aria-label="Close"
            type="button"
          >
            <CloseIcon size={20} color={colors.textMuted} />
          </button>
        </div>
      </div>

      {/* Card area */}
      <div style={styles.cardArea}>
        {isLoading ? (
          <p style={styles.message}>Loading meals…</p>
        ) : total === 0 ? (
          <p style={styles.message}>No meals to choose from right now.</p>
        ) : isFinished ? (
          <div style={styles.finishedMessage}>
            <p style={styles.message}>That's every meal we have to choose from right now.</p>
            <button onClick={onClose} style={styles.doneButton} type="button">
              Done
            </button>
          </div>
        ) : (
          currentMeal && (
            <div style={styles.cardStack}>
              <ReplacementCard
                key={currentMeal.id}
                meal={currentMeal}
                exitDirection={exitDirection}
                disabled={editMutation.isPending}
                onNope={handleNope}
                onYum={handleYum}
              />
            </div>
          )
        )}
      </div>

      {/* Action bar */}
      {!isLoading && !isFinished && total > 0 && (
        <div style={styles.actionBar}>
          <button
            onClick={handleNope}
            style={styles.nopeButton}
            disabled={editMutation.isPending}
            aria-label="Skip this meal"
            type="button"
          >
            NOPE
          </button>
          <button
            onClick={handleYum}
            style={styles.yumButton}
            disabled={editMutation.isPending}
            aria-label="Use this meal"
            type="button"
          >
            YUM
          </button>
        </div>
      )}

      <Toast
        message={GENERIC_ERROR_MESSAGE}
        type="error"
        visible={errorVisible}
        onDismiss={() => setErrorVisible(false)}
      />
    </motion.div>
  );
}
