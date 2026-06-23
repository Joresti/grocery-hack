import React, { useCallback, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { CloseIcon } from '../theme/icons/CloseIcon';
import { Toast } from '../components/shared';
import { getMealHeaderGradient } from '../utils/mealCardHeader';
import { getMealIcon } from '../utils/mealCardIcons';
import { useMeals } from '../hooks/useMeals';
import { useSuggestMeal } from '../hooks/useFamilyPlan';
import { ApiError } from '../services/api';
import type { PlanMeal, SwipeableMeal, MealSuggestion } from '@groceryhack/shared/types';

const GENERIC_ERROR_MESSAGE = "Couldn't send your suggestion. Please try again.";
const DUPLICATE_ERROR_MESSAGE = 'You already have a pending suggestion for this meal.';

interface SuggestSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMeal: PlanMeal;
  onSubmitted: (suggestion: MealSuggestion) => void;
}

const SWIPE_THRESHOLD = 120;
const HEADER_HEIGHT = 64;
const ACTION_BAR_HEIGHT = 80;

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

export function SuggestSwapModal({
  isOpen,
  onClose,
  targetMeal,
  onSubmitted,
}: SuggestSwapModalProps): React.ReactElement | null {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<number>(0);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState(GENERIC_ERROR_MESSAGE);

  const { data: meals, isLoading } = useMeals(isOpen);
  const suggestMutation = useSuggestMeal();

  const handleNope = useCallback(() => {
    if (suggestMutation.isPending) return;
    setExitDirection(-1);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setExitDirection(0);
    }, 300);
  }, [suggestMutation.isPending]);

  const handleYum = useCallback(() => {
    const meal = meals?.[currentIndex];
    if (!meal || suggestMutation.isPending) return;
    suggestMutation.mutate(
      { targetMealId: targetMeal.mealId, replacementMealId: meal.id },
      {
        onSuccess: (suggestion) => {
          onSubmitted(suggestion);
        },
        onError: (err) => {
          setErrorMessage(
            err instanceof ApiError && err.code === 'DUPLICATE_SUGGESTION'
              ? DUPLICATE_ERROR_MESSAGE
              : GENERIC_ERROR_MESSAGE,
          );
          setErrorVisible(true);
        },
      },
    );
  }, [meals, currentIndex, suggestMutation, targetMeal.mealId, onSubmitted]);

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
      aria-label={`Suggest a replacement for ${targetMeal.name}`}
    >
      {/* Context bar */}
      <div style={styles.header}>
        <div style={styles.contextGroup}>
          <SwapIcon size={20} color={colors.primary} />
          <span style={styles.contextText}>
            Finding a replacement for <strong style={styles.contextName}>{targetMeal.name}</strong>
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
          <p style={styles.message}>No meals to suggest right now.</p>
        ) : isFinished ? (
          <div style={styles.finishedMessage}>
            <p style={styles.message}>That's every meal we have to suggest right now.</p>
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
                disabled={suggestMutation.isPending}
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
            disabled={suggestMutation.isPending}
            aria-label="Skip this meal"
            type="button"
          >
            NOPE
          </button>
          <button
            onClick={handleYum}
            style={styles.yumButton}
            disabled={suggestMutation.isPending}
            aria-label="Suggest this meal"
            type="button"
          >
            YUM
          </button>
        </div>
      )}

      <Toast
        message={errorMessage}
        type="error"
        visible={errorVisible}
        onDismiss={() => setErrorVisible(false)}
      />
    </motion.div>
  );
}

interface ReplacementCardProps {
  meal: SwipeableMeal;
  exitDirection: number;
  disabled: boolean;
  onNope: () => void;
  onYum: () => void;
}

function formatDifficulty(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function ReplacementCard({
  meal,
  exitDirection,
  disabled,
  onNope,
  onYum,
}: ReplacementCardProps): React.ReactElement {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const yumOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (disabled) return;
      if (info.offset.x > SWIPE_THRESHOLD) {
        onYum();
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        onNope();
      }
    },
    [disabled, onYum, onNope],
  );

  const animateProps =
    exitDirection !== 0 ? { x: exitDirection * 500, opacity: 0 } : { x: 0 };

  return (
    <motion.div
      style={{
        ...styles.card,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x,
        rotate,
      }}
      drag={disabled ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      animate={animateProps}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <motion.div style={{ ...styles.stamp, ...styles.yumStamp, opacity: yumOpacity }}>
        YUM
      </motion.div>
      <motion.div style={{ ...styles.stamp, ...styles.nopeStamp, opacity: nopeOpacity }}>
        NOPE
      </motion.div>

      {meal.images.length > 0 ? (
        <div
          style={{
            ...styles.cardHeader,
            backgroundImage: `url(${meal.images[0]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <div style={{ ...styles.cardHeader, background: getMealHeaderGradient(meal.name) }}>
          <div style={styles.headerIcon}>
            {(() => {
              const Icon = getMealIcon(meal.name, meal.filterTags);
              return <Icon size={120} color="#FFFFFF" />;
            })()}
          </div>
        </div>
      )}

      <div style={styles.cardContent}>
        <h3 style={styles.mealName}>{meal.name}</h3>
        {meal.tagline && <p style={styles.mealTagline}>{meal.tagline}</p>}
        <div style={styles.metaRow}>
          <span style={styles.metaItem}>{meal.servings} servings</span>
          <span style={styles.metaItem}>{formatDifficulty(meal.difficulty)}</span>
          {meal.prepTimeMinutes !== null && (
            <span style={styles.metaItem}>{meal.prepTimeMinutes} min prep</span>
          )}
        </div>
        <ul style={styles.ingredientList}>
          {meal.ingredients.slice(0, 6).map((ingredient, index, arr) => (
            <li
              key={`${ingredient.name}-${index}`}
              style={{
                ...styles.ingredientItem,
                borderBottom:
                  index === arr.length - 1 ? 'none' : `1px solid ${colors.borderSubtle}`,
              }}
            >
              {ingredient.quantity} {ingredient.unit} {ingredient.name}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fullScreen: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 16px',
    minHeight: `${HEADER_HEIGHT}px`,
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  contextGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  contextText: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    lineHeight: 1.3,
  },
  contextName: {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
    whiteSpace: 'nowrap',
  },
  exitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
    padding: 0,
  },
  cardArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: '0 12px',
    position: 'relative',
    minHeight: 0,
  },
  cardStack: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    height: `calc(100vh - ${HEADER_HEIGHT}px - ${ACTION_BAR_HEIGHT}px - 16px)`,
    margin: '0 auto',
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.card,
    boxShadow: shadows.card,
    cursor: 'grab',
    userSelect: 'none',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    flex: '0 0 40%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: `${radii.card} ${radii.card} 0 0`,
    position: 'relative',
  },
  headerIcon: {
    color: '#FFFFFF',
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))',
    opacity: 0.95,
  },
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 20px 20px',
    gap: '6px',
    overflow: 'hidden',
  },
  mealName: {
    fontFamily: fonts.heading,
    fontSize: '1.5rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: 0,
    lineHeight: 1.3,
  },
  mealTagline: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.5,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    marginTop: '4px',
    marginBottom: '4px',
  },
  metaItem: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.8rem',
    color: colors.textMuted,
  },
  ingredientList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    flex: 1,
    overflow: 'hidden',
  },
  ingredientItem: {
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: '0.85rem',
    color: colors.text,
    padding: '4px 0',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  stamp: {
    position: 'absolute',
    fontFamily: fonts.heading,
    fontSize: '2.5rem',
    fontWeight: fontWeights.bold,
    padding: '8px 20px',
    borderRadius: '8px',
    border: '4px solid',
    zIndex: 20,
    pointerEvents: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    top: '45%',
  },
  yumStamp: {
    left: 20,
    color: colors.success,
    borderColor: colors.success,
    transform: 'rotate(-15deg)',
  },
  nopeStamp: {
    right: 20,
    color: colors.danger,
    borderColor: colors.danger,
    transform: 'rotate(15deg)',
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
    padding: '12px 24px',
    height: `${ACTION_BAR_HEIGHT}px`,
    flexShrink: 0,
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  nopeButton: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.bold,
    backgroundColor: colors.danger,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    width: 56,
    height: 56,
    padding: 0,
    cursor: 'pointer',
    minWidth: 56,
    minHeight: 56,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yumButton: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.bold,
    backgroundColor: colors.success,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    width: 56,
    height: 56,
    padding: 0,
    cursor: 'pointer',
    minWidth: 56,
    minHeight: 56,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    height: '100%',
  },
  message: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
    textAlign: 'center',
    alignSelf: 'center',
  },
  doneButton: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 40px',
    cursor: 'pointer',
    minHeight: 44,
    boxShadow: shadows.button,
    transition: 'all 0.2s ease',
  },
};
