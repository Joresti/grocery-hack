import React, { useCallback } from 'react';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';
import { HeartIcon } from '../theme/icons/HeartIcon';
import { ModalOverlay } from './ModalOverlay';
import { useLikedMeals } from '../hooks/useLikedMeals';
import { useTrack } from '../hooks/useTrack';
import type { Meal, LikedMeal } from '@groceryhack/shared/types';

interface LikedMealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealTap: (meal: Meal) => void;
}

export function LikedMealsModal({
  isOpen,
  onClose,
  onMealTap,
}: LikedMealsModalProps): React.ReactElement {
  const { data: likedMeals } = useLikedMeals();
  const { track } = useTrack();

  const handleMealTap = useCallback(
    (likedMeal: LikedMeal) => {
      track('liked_meal_tapped', {
        meal_id: likedMeal.meal.id,
        meal_name: likedMeal.meal.name,
        ingredients_on_sale_count: likedMeal.ingredientsOnSaleCount,
      });
      onMealTap(likedMeal.meal);
    },
    [onMealTap, track]
  );

  const meals = likedMeals ?? [];

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="My Liked Meals">
      <div style={styles.container}>
        {meals.length === 0 ? (
          <div style={styles.emptyState}>
            <HeartIcon size={48} color={colors.border} />
            <p style={styles.emptyText}>
              No liked meals yet. Start swiping to find meals you love!
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {meals.map((likedMeal) => (
              <button
                key={likedMeal.meal.id}
                onClick={() => handleMealTap(likedMeal)}
                style={styles.card}
                type="button"
              >
                <div style={styles.cardContent}>
                  <div style={styles.cardInfo}>
                    <h4 style={styles.mealName}>{likedMeal.meal.name}</h4>
                    {likedMeal.ingredientsOnSaleCount > 0 && (
                      <span style={styles.saleBadge}>
                        {likedMeal.ingredientsOnSaleCount} ingredient
                        {likedMeal.ingredientsOnSaleCount !== 1 ? 's' : ''} on
                        sale
                      </span>
                    )}
                    {likedMeal.estimatedCost !== null && (
                      <span style={styles.cost}>
                        ${likedMeal.estimatedCost.toFixed(2)} estimated
                      </span>
                    )}
                  </div>
                  <div style={styles.cardArrow}>
                    <span style={styles.arrowIcon}>&rsaquo;</span>
                  </div>
                </div>
              </button>
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
    gap: '12px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '48px 24px',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.65,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    display: 'block',
    width: '100%',
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.card,
    padding: '16px 20px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'box-shadow 0.3s ease',
    boxShadow: 'none',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  mealName: {
    fontFamily: fonts.heading,
    fontSize: '1rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: 0,
  },
  saleBadge: {
    fontFamily: fonts.heading,
    fontSize: '0.7rem',
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    padding: '3px 10px',
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    whiteSpace: 'nowrap',
  },
  cost: {
    fontFamily: fonts.heading,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  cardArrow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  arrowIcon: {
    fontFamily: fonts.heading,
    fontSize: '1.5rem',
    color: colors.textMuted,
    lineHeight: 1,
  },
};
