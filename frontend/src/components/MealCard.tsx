import React, { useState } from 'react';
import { InitialsAvatar } from './shared';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { SwipeableMeal } from '@groceryhack/shared/types';

interface MealCardProps {
  meal: SwipeableMeal;
  onTap?: () => void;
  style?: React.CSSProperties;
}

const cardBaseStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: spacing.cardPadding,
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  border: 'none',
  textAlign: 'left',
  width: '100%',
  maxWidth: '340px',
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
  margin: '0 0 16px 0',
};

const ingredientItemStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.875rem',
  color: colors.text,
  padding: '4px 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const viewRecipeLinkStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  color: colors.primary,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  marginBottom: '12px',
  display: 'inline-block',
};

const attributionStyle: React.CSSProperties = {
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

export function MealCard({ meal, onTap, style }: MealCardProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const ingredientPreview = meal.ingredients.slice(0, 5);
  const hasAttribution = meal.sharedByName !== null && meal.sharedByName !== undefined;

  return (
    <button
      type="button"
      style={{
        ...cardBaseStyle,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onTap}
    >
      <h3 style={mealNameStyle}>{meal.name}</h3>

      {meal.tagline && <p style={taglineStyle}>{meal.tagline}</p>}

      <div style={metaRowStyle}>
        <span style={metaItemStyle}>{meal.servings} servings</span>
        <span style={metaItemStyle}>{formatDifficulty(meal.difficulty)}</span>
        {meal.prepTimeMinutes !== null && (
          <span style={metaItemStyle}>{meal.prepTimeMinutes} min prep</span>
        )}
      </div>

      <ul style={ingredientListStyle}>
        {ingredientPreview.map((ingredient, index) => (
          <li
            key={`${ingredient.name}-${index}`}
            style={{
              ...ingredientItemStyle,
              borderBottom:
                index === ingredientPreview.length - 1 ? 'none' : ingredientItemStyle.borderBottom,
            }}
          >
            {ingredient.quantity} {ingredient.unit} {ingredient.name}
          </li>
        ))}
      </ul>

      <span style={viewRecipeLinkStyle}>View full recipe</span>

      {hasAttribution && (
        <div style={attributionStyle}>
          <InitialsAvatar name={meal.sharedByName as string} />
          <span style={attributionTextStyle}>
            Shared by {meal.sharedByName}
          </span>
        </div>
      )}
    </button>
  );
}
