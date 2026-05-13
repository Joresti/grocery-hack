import React from 'react';
import { ModalOverlay } from './ModalOverlay';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';
import type { UserRecipe, RecipeAlert, Ingredient, Deal } from '@groceryhack/shared/types';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: UserRecipe | null;
  recipeAlert?: RecipeAlert | null;
  onEdit?: (recipe: UserRecipe) => void;
  deals?: Deal[];
}

interface IngredientDealMatch {
  deal: Deal;
}

function findDealForIngredient(ingredient: Ingredient, deals: Deal[]): IngredientDealMatch | null {
  const ingredientName = ingredient.name.toLowerCase().trim();
  if (!ingredientName) return null;
  for (const deal of deals) {
    if (deal.itemName.toLowerCase().includes(ingredientName)) {
      return { deal };
    }
  }
  return null;
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.75rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  borderRadius: radii.pill,
  padding: '4px 12px',
  marginBottom: '16px',
};

const ingredientListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 16px 0',
};

const ingredientRowBase: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: `1px solid ${colors.borderSubtle}`,
  fontFamily: fonts.body,
  fontSize: '0.9rem',
};

const ingredientOnSaleStyle: React.CSSProperties = {
  ...ingredientRowBase,
  backgroundColor: colors.primaryLight,
  borderRadius: radii.input,
  marginBottom: '4px',
  borderBottom: 'none',
};

const ingredientNameStyle: React.CSSProperties = {
  fontWeight: fontWeights.medium,
  color: colors.text,
  flex: 1,
};

const dealPriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
  marginLeft: '8px',
};

const regularPriceStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.8rem',
  color: colors.textMuted,
  textDecoration: 'line-through',
  marginLeft: '6px',
};

const storeNameStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.75rem',
  color: colors.textMuted,
  marginLeft: '8px',
};

const pantryLabelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.75rem',
  color: colors.textMuted,
  fontStyle: 'italic',
};

const savingsSummaryStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  backgroundColor: colors.greenBadgeBg,
  borderRadius: radii.card,
  fontFamily: fonts.body,
  fontSize: '0.9rem',
  marginBottom: '20px',
};

const stepsHeaderStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.text,
  margin: '0 0 12px 0',
};

const stepRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
  marginBottom: '10px',
};

const stepNumberStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: colors.primaryLight,
  color: colors.primary,
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const stepTextStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.9rem',
  color: colors.text,
  lineHeight: 1.5,
  paddingTop: '3px',
};

const pillRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '20px',
};

const pillStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.8rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  borderRadius: radii.pill,
  padding: '6px 14px',
};

const notesBlockStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.9rem',
  color: colors.textMuted,
  backgroundColor: colors.bg,
  padding: '14px 16px',
  borderRadius: radii.input,
  lineHeight: 1.5,
  marginBottom: '20px',
};

const editBtnStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.95rem',
  color: colors.primary,
  backgroundColor: colors.white,
  border: `1.5px solid ${colors.primary}`,
  borderRadius: radii.pill,
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  width: '100%',
  transition: 'all 0.2s ease',
  marginTop: '8px',
};

const nameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.3rem',
  color: colors.text,
  margin: '0 0 8px 0',
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function RecipeDetailModal({
  isOpen,
  onClose,
  recipe,
  recipeAlert,
  onEdit,
  deals = [],
}: RecipeDetailModalProps): React.ReactElement {
  if (!recipe) {
    return <ModalOverlay isOpen={false} onClose={onClose}><div /></ModalOverlay>;
  }

  const hasPills = recipe.prepTimeMinutes != null || recipe.cookTimeMinutes != null || recipe.servings != null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      {/* Recipe Name */}
      <h2 className="gh-recipe-detail-name" style={nameStyle}>{recipe.name}</h2>

      {/* Source Badge */}
      <span className="gh-recipe-detail-source-badge" style={badgeStyle}>Your Recipe</span>

      {/* Detail Pills */}
      {hasPills && (
        <div style={pillRowStyle}>
          {recipe.prepTimeMinutes != null && (
            <span className="gh-recipe-detail-pill" style={pillStyle}>
              {recipe.prepTimeMinutes} min prep
            </span>
          )}
          {recipe.cookTimeMinutes != null && (
            <span className="gh-recipe-detail-pill" style={pillStyle}>
              {recipe.cookTimeMinutes} min cook
            </span>
          )}
          {recipe.servings != null && (
            <span className="gh-recipe-detail-pill" style={pillStyle}>
              Serves {recipe.servings}
            </span>
          )}
        </div>
      )}

      {/* Ingredients */}
      <ul style={ingredientListStyle}>
        {recipe.ingredients.map((ingredient: Ingredient, index: number) => {
          const match = deals.length > 0 ? findDealForIngredient(ingredient, deals) : null;
          const isOnSale = match !== null;
          return (
            <li
              key={`${ingredient.name}-${index}`}
              className={`gh-recipe-detail-ingredient${isOnSale ? ' on-sale' : ''}`}
              style={isOnSale ? ingredientOnSaleStyle : ingredientRowBase}
            >
              <span className="gh-recipe-detail-ingredient-name" style={ingredientNameStyle}>
                {ingredient.quantity} {ingredient.unit} {ingredient.name}
              </span>
              {isOnSale ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="gh-recipe-detail-deal-price" style={dealPriceStyle}>
                    {formatPrice(match.deal.salePrice)}
                  </span>
                  {match.deal.regularPrice != null && (
                    <span className="gh-recipe-detail-regular-price" style={regularPriceStyle}>
                      {formatPrice(match.deal.regularPrice)}
                    </span>
                  )}
                  <span className="gh-recipe-detail-store" style={storeNameStyle}>
                    {match.deal.storeBrandName}
                  </span>
                </span>
              ) : (
                <span className="gh-recipe-detail-pantry-label" style={pantryLabelStyle}>
                  pantry
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Savings Summary */}
      {recipeAlert && (
        <div className="gh-recipe-detail-savings-summary" style={savingsSummaryStyle}>
          <span style={{ color: colors.text, fontWeight: fontWeights.medium }}>
            Total this week
          </span>
          <span style={{ color: colors.greenBadgeText, fontWeight: fontWeights.bold }}>
            {formatPrice(recipeAlert.estimatedCost)}
          </span>
        </div>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <div className="gh-recipe-detail-steps" style={{ marginBottom: '20px' }}>
          <h3 style={stepsHeaderStyle}>Steps</h3>
          {recipe.steps.map((step: string, index: number) => (
            <div key={index} className="gh-recipe-detail-step" style={stepRowStyle}>
              <span className="gh-step-number" style={stepNumberStyle}>{index + 1}</span>
              <span style={stepTextStyle}>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {recipe.tips && (
        <div style={notesBlockStyle}>
          {recipe.tips}
        </div>
      )}

      {/* Edit Button */}
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(recipe)}
          style={editBtnStyle}
        >
          Edit Recipe
        </button>
      )}
    </ModalOverlay>
  );
}
