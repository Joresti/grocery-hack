import React, { useState } from 'react';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { LikedMeal, Meal } from '@groceryhack/shared/types';

interface LikedMealsPreviewProps {
  meals: LikedMeal[];
  onViewAll: () => void;
  onMealTap: (meal: Meal) => void;
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

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: 0,
};

const viewAllStyle: React.CSSProperties = {
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

const mealNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '0.95rem',
  color: colors.text,
  margin: 0,
  lineHeight: 1.3,
};

const saleBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: colors.primaryLight,
  color: colors.primary,
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.75rem',
  padding: '4px 10px',
  borderRadius: radii.pill,
  whiteSpace: 'nowrap',
};

const costStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
  marginTop: 'auto',
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function LikedMealsPreview({ meals, onViewAll, onMealTap }: LikedMealsPreviewProps): React.ReactElement | null {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (meals.length === 0) {
    return null;
  }

  const displayMeals = meals.slice(0, 6);

  return (
    <section style={sectionStyle}>
      <div style={headerRowStyle}>
        <h2 style={headingStyle}>Liked Meals</h2>
        {meals.length > 6 && (
          <button type="button" style={viewAllStyle} onClick={onViewAll}>
            View All
          </button>
        )}
      </div>
      <div style={scrollContainerStyle}>
        {displayMeals.map((liked, index) => (
          <button
            key={liked.meal.id}
            type="button"
            style={{
              ...cardBaseStyle,
              boxShadow: hoveredIndex === index ? shadows.cardHover : shadows.card,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onMealTap(liked.meal)}
          >
            {liked.meal.images.length > 0 && (
              <div style={{
                width: '100%',
                height: '90px',
                borderRadius: '10px',
                backgroundImage: `url(${liked.meal.images[0]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                marginBottom: '8px',
              }} />
            )}
            <h3 style={mealNameStyle}>{liked.meal.name}</h3>
            {liked.ingredientsOnSaleCount > 0 && (
              <span style={saleBadgeStyle}>
                {liked.ingredientsOnSaleCount} ingredient{liked.ingredientsOnSaleCount !== 1 ? 's' : ''} on sale
              </span>
            )}
            {liked.estimatedCost !== null && (
              <span style={costStyle}>{formatPrice(liked.estimatedCost)}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
