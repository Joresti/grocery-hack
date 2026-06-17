import React, { useState, useCallback } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { CloseIcon } from '../theme/icons/CloseIcon';
import { InitialsAvatar } from '../components/shared';
import { getMealHeaderGradient } from '../utils/mealCardHeader';
import { getMealIcon } from '../utils/mealCardIcons';
import { useSwipe } from '../hooks/useSwipe';
import { useTrack } from '../hooks/useTrack';
import type { SwipeableMeal } from '@groceryhack/shared/types';

interface SwipeModeProps {
  isOpen: boolean;
  onClose: () => void;
  meals: SwipeableMeal[];
}

const SWIPE_THRESHOLD = 120;
/** Height reserved for the top counter/close bar */
const HEADER_HEIGHT = 50;
/** Height reserved for the bottom action buttons */
const ACTION_BAR_HEIGHT = 80;

export function SwipeMode({
  isOpen,
  onClose,
  meals,
}: SwipeModeProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const swipeMutation = useSwipe();
  const { track } = useTrack();
  const [exitDirection, setExitDirection] = useState<number>(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [leftCount, setLeftCount] = useState(0);

  const handleSwipe = useCallback(
    (liked: boolean) => {
      const meal = meals[currentIndex];
      if (!meal) return;

      setExitDirection(liked ? 1 : -1);
      setSwipeCount((c) => c + 1);
      if (liked) {
        setRightCount((c) => c + 1);
      } else {
        setLeftCount((c) => c + 1);
      }

      swipeMutation.mutate({ mealId: meal.id, liked });
      track(liked ? 'meal_swiped_right' : 'meal_swiped_left', {
        meal_id: meal.id,
        meal_name: meal.name,
        meal_source: 'meal' as const,
      });

      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setExitDirection(0);
      }, 300);
    },
    [currentIndex, meals, swipeMutation, track]
  );

  const handleClose = useCallback(() => {
    track('swipe_mode_exited', {
      swipe_count: swipeCount,
      right_count: rightCount,
      left_count: leftCount,
      duration_seconds: 0,
    });
    onClose();
    setCurrentIndex(0);
    setSwipeCount(0);
    setRightCount(0);
    setLeftCount(0);
  }, [onClose, track, swipeCount, rightCount, leftCount]);

  const isFinished = currentIndex >= meals.length;

  if (!isOpen) {
    return <></>;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={styles.fullScreen}
        >
          <div style={styles.header}>
            <span style={styles.counter}>
              {isFinished
                ? `${meals.length} of ${meals.length}`
                : `${currentIndex + 1} of ${meals.length}`}
            </span>
            <button
              onClick={handleClose}
              style={styles.exitButton}
              aria-label="Exit swipe mode"
              type="button"
            >
              <CloseIcon size={20} color={colors.textMuted} />
            </button>
          </div>

          <div style={styles.cardArea}>
            {isFinished ? (
              <div style={styles.finishedMessage}>
                <p style={styles.finishedText}>
                  You've swiped through all available meals!
                </p>
                <button
                  onClick={handleClose}
                  style={styles.doneButton}
                  type="button"
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={styles.cardStack}>
                {meals
                  .slice(currentIndex, currentIndex + 2)
                  .reverse()
                  .map((meal, reverseIdx) => {
                    const stackIdx =
                      meals.slice(currentIndex, currentIndex + 2).length -
                      1 -
                      reverseIdx;
                    const isTop = stackIdx === 0;
                    return (
                      <SwipeCard
                        key={meal.id}
                        meal={meal}
                        isTop={isTop}
                        stackOffset={stackIdx}
                        onSwipe={handleSwipe}
                        exitDirection={isTop ? exitDirection : 0}
                      />
                    );
                  })}
              </div>
            )}
          </div>

          {!isFinished && (
            <div style={styles.actionBar}>
              <button
                onClick={() => handleSwipe(false)}
                style={styles.nopeButton}
                disabled={swipeMutation.isPending}
                aria-label="Skip this meal"
                type="button"
              >
                NOPE
              </button>
              <button
                onClick={() => handleSwipe(true)}
                style={styles.yumButton}
                disabled={swipeMutation.isPending}
                aria-label="Like this meal"
                type="button"
              >
                YUM
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SwipeCardProps {
  meal: SwipeableMeal;
  isTop: boolean;
  stackOffset: number;
  onSwipe: (liked: boolean) => void;
  exitDirection: number;
}

function formatDifficulty(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function SwipeCard({
  meal,
  isTop,
  stackOffset,
  onSwipe,
  exitDirection,
}: SwipeCardProps): React.ReactElement {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const yumOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
        onSwipe(info.offset.x > 0);
      }
    },
    [onSwipe]
  );

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    transform: `scale(${1 - stackOffset * 0.04}) translateY(${stackOffset * 6}px)`,
    zIndex: 10 - stackOffset,
    pointerEvents: isTop ? 'auto' : 'none',
  };

  const animateProps = exitDirection !== 0
    ? { x: exitDirection * 500, opacity: 0 }
    : { x: 0 };

  return (
    <motion.div
      style={{
        ...cardStyle,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: isTop ? x : undefined,
        rotate: isTop ? rotate : undefined,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={isTop ? handleDragEnd : undefined}
      animate={isTop ? animateProps : undefined}
      transition={{
        type: 'spring',
        damping: 25,
        stiffness: 300,
      }}
    >
      {/* YUM stamp — overlays on top of card content */}
      <motion.div
        style={{
          ...styles.stamp,
          ...styles.yumStamp,
          opacity: isTop ? yumOpacity : 0,
        }}
      >
        YUM
      </motion.div>
      {/* NOPE stamp — overlays on top of card content */}
      <motion.div
        style={{
          ...styles.stamp,
          ...styles.nopeStamp,
          opacity: isTop ? nopeOpacity : 0,
        }}
      >
        NOPE
      </motion.div>

      {/* Visual header: real image or gradient+emoji fallback — 40% of card */}
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
        <div
          style={{
            ...styles.cardHeader,
            background: getMealHeaderGradient(meal.name),
          }}
        >
          <div style={styles.headerIcon}>
            {(() => {
              const Icon = getMealIcon(meal.name, meal.filterTags);
              return <Icon size={120} color="#FFFFFF" />;
            })()}
          </div>
        </div>
      )}

      {/* Card body with meal info */}
      <div style={styles.cardContent}>
        <h3 style={styles.mealName}>{meal.name}</h3>
        {meal.tagline && (
          <p style={styles.mealTagline}>{meal.tagline}</p>
        )}
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
                  index === arr.length - 1
                    ? 'none'
                    : `1px solid ${colors.borderSubtle}`,
              }}
            >
              {ingredient.quantity} {ingredient.unit} {ingredient.name}
            </li>
          ))}
        </ul>
        {meal.sharedByName != null && (
          <div style={styles.attribution}>
            <InitialsAvatar name={meal.sharedByName} />
            <span style={styles.attributionText}>
              Shared by {meal.sharedByName}
            </span>
          </div>
        )}
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
    padding: '8px 16px',
    height: `${HEADER_HEIGHT}px`,
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
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
  attribution: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px',
    flexShrink: 0,
  },
  attributionText: {
    fontFamily: fonts.body,
    fontSize: '0.75rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
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
  finishedText: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
    textAlign: 'center',
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
