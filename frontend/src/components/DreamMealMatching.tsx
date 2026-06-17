import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { InitialsAvatar } from './shared';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import { getMealHeaderGradient } from '../utils/mealCardHeader';
import { getMealIcon } from '../utils/mealCardIcons';
import type { SwipeableMeal, Meal } from '@groceryhack/shared/types';

interface DreamMealMatchingProps {
  meals: SwipeableMeal[];
  onEnterSwipeMode: () => void;
  onMealTap: (meal: Meal) => void;
  onSwipe?: (mealId: string, liked: boolean) => void;
}

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const headingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '24px',
  alignSelf: 'flex-start',
};

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: 0,
};

const heartIconStyle: React.CSSProperties = {
  color: colors.primary,
  display: 'flex',
  alignItems: 'center',
};

const cardWrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  marginBottom: '24px',
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '24px',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '16px',
};

const actionButtonBaseStyle: React.CSSProperties = {
  width: spacing.touchTargetMin,
  height: spacing.touchTargetMin,
  minWidth: spacing.touchTargetMin,
  minHeight: spacing.touchTargetMin,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  boxShadow: shadows.button,
};

const nopeButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  backgroundColor: colors.white,
  color: colors.danger,
  border: `2px solid ${colors.danger}`,
};

const yumButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  backgroundColor: colors.white,
  color: colors.success,
  border: `2px solid ${colors.success}`,
};

const swipeModeLinkStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 16px',
  minHeight: spacing.touchTargetMin,
  display: 'flex',
  alignItems: 'center',
};

const emptyStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.95rem',
  color: colors.textMuted,
  textAlign: 'center',
  padding: '40px 20px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  overflow: 'hidden',
  width: '100%',
  maxWidth: '340px',
  textAlign: 'left',
};

const headerAreaStyle: React.CSSProperties = {
  height: '180px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: `${radii.card} ${radii.card} 0 0`,
};

const headerIconStyle: React.CSSProperties = {
  color: '#FFFFFF',
  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))',
  opacity: 0.95,
};

const cardBodyStyle: React.CSSProperties = {
  padding: spacing.cardPadding,
};

const mealNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.25rem',
  color: colors.text,
  margin: '0 0 6px 0',
  lineHeight: 1.3,
};

const taglineStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  margin: '0 0 14px 0',
  lineHeight: 1.5,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
  marginBottom: '16px',
};

const metaItemStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.8rem',
  color: colors.textMuted,
};

const ingredientListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 12px 0',
};

const ingredientItemStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.875rem',
  color: colors.text,
  padding: '4px 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const attributionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '12px',
};

const attributionTextStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.75rem',
  color: colors.textMuted,
};

function formatDifficulty(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

// Inject gentleSway keyframes into document once
let swayInjected = false;
function injectSwayKeyframes(): void {
  if (swayInjected || typeof document === 'undefined') return;
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes gentleSway {
      0%   { transform: rotate(0deg) translateX(0); }
      15%  { transform: rotate(1.2deg) translateX(4px); }
      30%  { transform: rotate(0deg) translateX(0); }
      45%  { transform: rotate(-1.2deg) translateX(-4px); }
      60%  { transform: rotate(0deg) translateX(0); }
      100% { transform: rotate(0deg) translateX(0); }
    }
    .groceryhack-sway {
      animation: gentleSway 4s ease-in-out infinite;
    }
    .groceryhack-sway:hover {
      animation-play-state: paused;
    }
  `;
  document.head.appendChild(styleEl);
  swayInjected = true;
}

export function DreamMealMatching({
  meals,
  onEnterSwipeMode,
  onMealTap,
  onSwipe,
}: DreamMealMatchingProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    injectSwayKeyframes();
  }, []);

  const handleNope = useCallback(() => {
    if (currentIndex >= meals.length) return;
    const meal = meals[currentIndex] as SwipeableMeal | undefined;
    if (!meal) return;
    onSwipe?.(meal.id, false);
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, meals, onSwipe]);

  const handleYum = useCallback(() => {
    if (currentIndex >= meals.length) return;
    const meal = meals[currentIndex] as SwipeableMeal | undefined;
    if (!meal) return;
    onSwipe?.(meal.id, true);
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, meals, onSwipe]);

  const currentMeal = currentIndex < meals.length ? (meals[currentIndex] ?? null) : null;

  return (
    <section style={sectionStyle}>
      <div style={headingRowStyle}>
        <span style={heartIconStyle}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={colors.primary}
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
        <h2 style={headingStyle}>Dream Meal Matching</h2>
      </div>

      {currentMeal ? (
        <>
          <div style={cardWrapperStyle}>
            <motion.div
              key={currentMeal.id}
              className="groceryhack-sway"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{ cursor: 'pointer' }}
              onClick={() => onMealTap(currentMeal)}
            >
              <div className="gh-swipe-card" style={cardStyle}>
                {/* Visual header: real image or gradient+emoji fallback */}
                {currentMeal.images.length > 0 ? (
                  <div
                    className="gh-swipe-header"
                    style={{
                      ...headerAreaStyle,
                      backgroundImage: `url(${currentMeal.images[0]})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      ...headerAreaStyle,
                      background: getMealHeaderGradient(currentMeal.name),
                    }}
                  >
                    <div style={headerIconStyle}>
                      {(() => {
                        const Icon = getMealIcon(currentMeal.name, currentMeal.filterTags);
                        return <Icon size={96} color="#FFFFFF" />;
                      })()}
                    </div>
                  </div>
                )}

                {/* Card body with meal info */}
                <div className="gh-swipe-body" style={cardBodyStyle}>
                  <h3 className="gh-swipe-name" style={mealNameStyle}>{currentMeal.name}</h3>

                  {currentMeal.tagline && (
                    <p style={taglineStyle}>{currentMeal.tagline}</p>
                  )}

                  <div style={metaRowStyle}>
                    <span style={metaItemStyle}>
                      {currentMeal.servings} servings
                    </span>
                    <span style={metaItemStyle}>
                      {formatDifficulty(currentMeal.difficulty)}
                    </span>
                    {currentMeal.prepTimeMinutes !== null && (
                      <span style={metaItemStyle}>
                        {currentMeal.prepTimeMinutes} min prep
                      </span>
                    )}
                  </div>

                  <ul style={ingredientListStyle}>
                    {currentMeal.ingredients.slice(0, 4).map((ingredient, index, arr) => (
                      <li
                        key={`${ingredient.name}-${index}`}
                        style={{
                          ...ingredientItemStyle,
                          borderBottom:
                            index === arr.length - 1
                              ? 'none'
                              : ingredientItemStyle.borderBottom,
                        }}
                      >
                        {ingredient.quantity} {ingredient.unit} {ingredient.name}
                      </li>
                    ))}
                  </ul>

                  {currentMeal.sharedByName != null && (
                    <div style={attributionRowStyle}>
                      <InitialsAvatar name={currentMeal.sharedByName} />
                      <span style={attributionTextStyle}>
                        Shared by {currentMeal.sharedByName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="gh-swipe-actions" style={actionsRowStyle}>
            <button
              type="button"
              style={nopeButtonStyle}
              onClick={handleNope}
              aria-label="Nope - skip this meal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <button
              type="button"
              style={yumButtonStyle}
              onClick={handleYum}
              aria-label="Yum - like this meal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            style={swipeModeLinkStyle}
            onClick={onEnterSwipeMode}
          >
            Enter full-screen swipe mode
          </button>
        </>
      ) : (
        <p style={emptyStyle}>
          No more meals to match right now. Check back after your next plan generates!
        </p>
      )}
    </section>
  );
}
