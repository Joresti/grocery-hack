import React, { useState } from 'react';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { UserRecipe, RecipeAlert } from '@groceryhack/shared/types';

interface MyRecipesProps {
  recipes: UserRecipe[];
  recipeAlerts: RecipeAlert[];
  isLoading: boolean;
  onAddRecipe: () => void;
  onRecipeTap: (recipe: UserRecipe) => void;
}

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: 0,
};

const countBadgeStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.85rem',
  color: colors.textMuted,
};

const addBtnStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  minHeight: spacing.touchTargetMin,
  display: 'flex',
  alignItems: 'center',
};

const scrollContainerStyle: React.CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  gap: '16px',
  scrollSnapType: 'x mandatory',
  paddingBottom: '8px',
  WebkitOverflowScrolling: 'touch',
};

const cardBaseStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: '180px',
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: '20px',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  scrollSnapAlign: 'start',
  border: 'none',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const recipeNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '0.95rem',
  color: colors.text,
  margin: 0,
  lineHeight: 1.3,
};

const ingredientCountStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.8rem',
  color: colors.textMuted,
};

const dealBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: colors.greenBadgeBg,
  color: colors.greenBadgeText,
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.7rem',
  padding: '3px 10px',
  borderRadius: radii.pill,
  whiteSpace: 'nowrap',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 20px',
  textAlign: 'center',
  gap: '12px',
};

const emptyIconStyle: React.CSSProperties = {
  color: colors.textMuted,
  marginBottom: '4px',
};

const emptyTitleStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '1rem',
  color: colors.text,
  margin: 0,
};

const emptyTextStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  margin: 0,
  lineHeight: 1.5,
};

const emptyCTAStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.white,
  backgroundColor: colors.primary,
  border: 'none',
  borderRadius: radii.pill,
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  marginTop: '8px',
};

export function MyRecipes({
  recipes,
  recipeAlerts,
  isLoading,
  onAddRecipe,
  onRecipeTap,
}: MyRecipesProps): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getAlertForRecipe = (recipeId: string): RecipeAlert | undefined =>
    recipeAlerts.find(a => a.recipeId === recipeId);

  if (isLoading) {
    return <section className="gh-my-recipes" style={sectionStyle} />;
  }

  return (
    <section className="gh-my-recipes" style={sectionStyle}>
      <div style={headerRowStyle}>
        <div style={titleRowStyle}>
          <h2 className="gh-my-recipes-title" style={headingStyle}>My Recipes</h2>
          <span className="gh-my-recipes-count" style={countBadgeStyle}>
            ({recipes.length})
          </span>
        </div>
        <button
          type="button"
          className="gh-my-recipes-add-btn"
          onClick={onAddRecipe}
          style={addBtnStyle}
        >
          + Add
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="gh-my-recipes-empty" style={emptyStateStyle}>
          <div style={emptyIconStyle}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </div>
          <h3 style={emptyTitleStyle}>Save your favorites</h3>
          <p style={emptyTextStyle}>
            Add your own recipes and we&apos;ll alert you when deals on your ingredients go live.
          </p>
          <button
            type="button"
            onClick={onAddRecipe}
            style={emptyCTAStyle}
          >
            Add a Recipe
          </button>
        </div>
      ) : (
        <div className="gh-my-recipes-scroll" style={scrollContainerStyle}>
          {recipes.map((recipe, index) => {
            const alert = getAlertForRecipe(recipe.id);
            return (
              <button
                key={recipe.id}
                type="button"
                className="gh-my-recipe-card"
                style={{
                  ...cardBaseStyle,
                  boxShadow: hoveredIndex === index ? shadows.cardHover : shadows.card,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onRecipeTap(recipe)}
              >
                <h3 className="gh-my-recipe-card-name" style={recipeNameStyle}>
                  {recipe.name}
                </h3>
                <span className="gh-my-recipe-card-ingredients" style={ingredientCountStyle}>
                  {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                </span>
                {alert && alert.ingredientsOnSale > 0 && (
                  <span className="gh-my-recipe-card-deal-badge" style={dealBadgeStyle}>
                    {alert.ingredientsOnSale} on sale
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
