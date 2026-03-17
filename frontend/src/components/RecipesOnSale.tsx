import React, { useState } from 'react';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { RecipeAlert } from '@groceryhack/shared/types';

interface RecipesOnSaleProps {
  alerts: RecipeAlert[];
  onRecipeTap?: (recipeId: string) => void;
}

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
};

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: '0 0 20px 0',
};

const cardListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: spacing.cardMarginBottom,
};

const cardBaseStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: spacing.cardPadding,
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  border: 'none',
  width: '100%',
  textAlign: 'left',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
};

const recipeNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.text,
  margin: 0,
};

const savingsBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: colors.greenBadgeBg,
  color: colors.greenBadgeText,
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.75rem',
  padding: '4px 12px',
  borderRadius: radii.pill,
  whiteSpace: 'nowrap',
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'center',
};

const detailLabelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.85rem',
  color: colors.textMuted,
};

const detailValueStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.95rem',
  color: colors.primary,
};

const ingredientCountStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.85rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  padding: '3px 10px',
  borderRadius: radii.pill,
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function RecipesOnSale({ alerts, onRecipeTap }: RecipesOnSaleProps): React.ReactElement | null {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Your Recipes on Sale</h2>
      <div style={cardListStyle}>
        {alerts.map((alert, index) => (
          <button
            key={alert.recipeId}
            type="button"
            style={{
              ...cardBaseStyle,
              boxShadow: hoveredIndex === index ? shadows.cardHover : shadows.card,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onRecipeTap?.(alert.recipeId)}
          >
            <div style={cardHeaderStyle}>
              <h3 style={recipeNameStyle}>{alert.recipeName}</h3>
              <span style={savingsBadgeStyle}>Save {formatPrice(alert.savings)}</span>
            </div>
            <div style={detailRowStyle}>
              <span style={ingredientCountStyle}>
                {alert.ingredientsOnSale} ingredient{alert.ingredientsOnSale !== 1 ? 's' : ''} on sale
              </span>
              <span style={detailLabelStyle}>
                Est. cost: <span style={detailValueStyle}>{formatPrice(alert.estimatedCost)}</span>
              </span>
              <span style={detailLabelStyle}>
                Regular: <span style={{ ...detailLabelStyle, textDecoration: 'line-through' }}>{formatPrice(alert.regularCost)}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
