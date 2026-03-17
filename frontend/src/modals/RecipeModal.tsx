import React, { useState, useCallback } from 'react';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import { ShareIcon } from '../theme/icons/ShareIcon';
import { ModalOverlay } from './ModalOverlay';
import { ShareContactModal } from './ShareContactModal';
import { useTrack } from '../hooks/useTrack';
import type { Meal, ShareType, Nutrition } from '@groceryhack/shared/types';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: Meal | null;
  dealsContext?: string[];
}

export function RecipeModal({
  isOpen,
  onClose,
  meal,
  dealsContext = [],
}: RecipeModalProps): React.ReactElement {
  const { track } = useTrack();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState<ShareType>('cook_for_me');

  const handleOpenShare = useCallback(
    (type: ShareType) => {
      setShareType(type);
      setShareOpen(true);
      if (meal) {
        track('share_meal_tapped', { meal_id: meal.id, share_type: type });
      }
    },
    [meal, track]
  );

  const handleCloseShare = useCallback(() => {
    setShareOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (meal) {
      track('recipe_modal_closed', { meal_id: meal.id, duration_seconds: 0 });
    }
    onClose();
  }, [meal, onClose, track]);

  if (!meal) {
    return <ModalOverlay isOpen={false} onClose={onClose}><div /></ModalOverlay>;
  }

  const onSaleSet = new Set(dealsContext.map((d) => d.toLowerCase()));

  const isIngredientOnSale = (ingredientName: string): boolean => {
    const lower = ingredientName.toLowerCase();
    return onSaleSet.size > 0 && Array.from(onSaleSet).some(
      (deal) => lower.includes(deal) || deal.includes(lower)
    );
  };

  const difficultyLabel = meal.difficulty === 'easy' ? 'Easy' : 'Medium';

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={handleClose} title={meal.name}>
        <div style={styles.container}>
          {meal.tagline && (
            <p style={styles.tagline}>{meal.tagline}</p>
          )}

          <div style={styles.infoRow}>
            {meal.difficulty && (
              <span style={styles.infoBadge}>{difficultyLabel}</span>
            )}
            {meal.prepTimeMinutes !== null && (
              <span style={styles.infoText}>Prep: {meal.prepTimeMinutes}min</span>
            )}
            {meal.cookTimeMinutes !== null && (
              <span style={styles.infoText}>Cook: {meal.cookTimeMinutes}min</span>
            )}
            <span style={styles.infoText}>{meal.servings} servings</span>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Ingredients</h3>
            <div style={styles.ingredientList}>
              {meal.ingredients.map((ingredient, index) => (
                <div
                  key={`${ingredient.name}-${index}`}
                  style={styles.ingredientRow}
                >
                  <span style={styles.ingredientName}>
                    {ingredient.quantity} {ingredient.unit} {ingredient.name}
                  </span>
                  {isIngredientOnSale(ingredient.name) && (
                    <span style={styles.saleBadge}>On Sale!</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {meal.steps.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Steps</h3>
              <ol style={styles.stepsList}>
                {meal.steps.map((step, index) => (
                  <li key={index} style={styles.stepItem}>
                    <span style={styles.stepNumber}>{index + 1}</span>
                    <span style={styles.stepText}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {meal.tips && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Tips</h3>
              <p style={styles.tipsText}>{meal.tips}</p>
            </div>
          )}

          {meal.nutrition && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Nutrition</h3>
              <NutritionGrid nutrition={meal.nutrition} />
            </div>
          )}

          <div style={styles.shareActions}>
            <button
              style={styles.shareButton}
              onClick={() => handleOpenShare('cook_for_me')}
              type="button"
            >
              <ShareIcon size={16} color={colors.white} />
              <span>Cook this for me?</span>
            </button>
            <button
              style={styles.shareButtonOutline}
              onClick={() => handleOpenShare('make_for_you')}
              type="button"
            >
              <ShareIcon size={16} color={colors.primary} />
              <span>I'll make this for you!</span>
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ShareContactModal
        isOpen={shareOpen}
        onClose={handleCloseShare}
        mealId={meal.id}
        mealSource="meal"
        shareType={shareType}
      />
    </>
  );
}

function NutritionGrid({ nutrition }: { nutrition: Nutrition }): React.ReactElement {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Calories', value: `${nutrition.calories}` },
    { label: 'Protein', value: `${nutrition.proteinG}g` },
    { label: 'Carbs', value: `${nutrition.carbsG}g` },
    { label: 'Fat', value: `${nutrition.fatG}g` },
    { label: 'Fiber', value: `${nutrition.fiberG}g` },
    { label: 'Sodium', value: `${nutrition.sodiumMg}mg` },
  ];

  return (
    <div style={nutritionStyles.grid}>
      {items.map((item) => (
        <div key={item.label} style={nutritionStyles.cell}>
          <span style={nutritionStyles.value}>{item.value}</span>
          <span style={nutritionStyles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const nutritionStyles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    backgroundColor: colors.bg,
    borderRadius: radii.card,
  },
  value: {
    fontFamily: fonts.heading,
    fontSize: '1rem',
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '0.75rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
    marginTop: 4,
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.5,
  },
  infoRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  },
  infoBadge: {
    fontFamily: fonts.heading,
    fontSize: '0.75rem',
    fontWeight: fontWeights.semibold,
    color: colors.greenBadgeText,
    backgroundColor: colors.greenBadgeBg,
    padding: '4px 12px',
    borderRadius: radii.pill,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: '1.1rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: 0,
  },
  ingredientList: {
    display: 'flex',
    flexDirection: 'column',
  },
  ingredientRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.ingredientRowPadding,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  ingredientName: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  saleBadge: {
    fontFamily: fonts.heading,
    fontSize: '0.7rem',
    fontWeight: fontWeights.semibold,
    color: colors.greenBadgeText,
    backgroundColor: colors.greenBadgeBg,
    padding: '2px 8px',
    borderRadius: radii.pill,
    whiteSpace: 'nowrap',
  },
  stepsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  stepItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontFamily: fonts.heading,
    fontSize: '0.85rem',
    fontWeight: fontWeights.bold,
    color: colors.white,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: {
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    lineHeight: 1.65,
    flex: 1,
  },
  tipsText: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.regular,
    color: colors.textMuted,
    margin: 0,
    lineHeight: 1.65,
    fontStyle: 'italic',
  },
  shareActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '8px',
  },
  shareButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 32px',
    cursor: 'pointer',
    boxShadow: shadows.button,
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
  },
  shareButtonOutline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: colors.white,
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    border: `2px solid ${colors.primary}`,
    borderRadius: radii.pill,
    padding: '14px 32px',
    cursor: 'pointer',
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
  },
};
