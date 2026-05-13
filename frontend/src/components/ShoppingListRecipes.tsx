import React from 'react';
import { DiscountBadge } from './shared';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { ShoppingListResponse } from '@groceryhack/shared/types';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface ShoppingListRecipesProps {
  data: ShoppingListResponse;
  onRecipeTap?: (mealId: string) => void;
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
};

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: 0,
  textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  textAlign: 'center',
  marginTop: '4px',
  marginBottom: '20px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  marginBottom: '16px',
  overflow: 'hidden',
  transition: 'box-shadow 0.3s ease',
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '20px 24px 12px',
};

const recipeNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.text,
  margin: 0,
};

const taglineStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  margin: '2px 0 0',
};

const badgeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  padding: '0 24px 14px',
};

const onSaleBadgeStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.8rem',
  color: colors.greenBadgeText,
  backgroundColor: colors.greenBadgeBg,
  borderRadius: radii.pill,
  padding: '4px 12px',
};

const storePillStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.75rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  borderRadius: radii.pill,
  padding: '3px 10px',
};

const dealsListStyle: React.CSSProperties = {
  padding: '0 24px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
};

const dealRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const dealIngredientStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.9rem',
  color: colors.text,
  flex: 1,
};

const dealItemNameStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.8rem',
  color: colors.textMuted,
};

const dealPriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.95rem',
  color: colors.primary,
};

const dealRegularPriceStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.8rem',
  color: colors.textMuted,
  textDecoration: 'line-through',
};

const viewRecipeBtnStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.pill,
  padding: '10px 20px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  width: '100%',
  transition: 'all 0.2s ease',
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function ShoppingListRecipes({
  data,
  onRecipeTap,
}: ShoppingListRecipesProps): React.ReactElement | null {
  if (data.recipes.length === 0) return null;

  return (
    <section style={sectionStyle}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={headingStyle}>This Week&apos;s Best Deals</h2>
        <p style={subtitleStyle}>
          {data.pagination.total} recipe{data.pagination.total !== 1 ? 's' : ''} matched to deals near you
        </p>
      </div>

      {data.recipes.map(recipe => (
        <div key={recipe.id} style={cardStyle}>
          {/* Header: name + tagline */}
          <div style={cardHeaderStyle}>
            <h3 style={recipeNameStyle}>{recipe.name}</h3>
            {recipe.tagline && <p style={taglineStyle}>{recipe.tagline}</p>}
          </div>

          {/* Badges: on-sale count + store pills */}
          <div style={badgeRowStyle}>
            <span style={onSaleBadgeStyle}>
              {recipe.ingredientsOnSaleCount} of {recipe.totalIngredients} ingredients on sale
            </span>
            {recipe.storesUsed.map(store => (
              <span key={store.storeBrandId} style={storePillStyle}>
                {store.storeBrandName}
              </span>
            ))}
          </div>

          {/* Deal rows */}
          <div style={dealsListStyle}>
            {recipe.matchingDeals.map((deal, index) => (
              <div
                key={deal.dealId}
                style={{
                  ...dealRowStyle,
                  borderBottom:
                    index === recipe.matchingDeals.length - 1
                      ? 'none'
                      : dealRowStyle.borderBottom,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={dealIngredientStyle}>{deal.matchedIngredient}</span>
                  <div style={dealItemNameStyle}>
                    {deal.itemName} @ {deal.storeBrandName}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {deal.regularPrice !== null && (
                    <span style={dealRegularPriceStyle}>
                      {formatPrice(deal.regularPrice)}
                    </span>
                  )}
                  <span style={dealPriceStyle}>{formatPrice(deal.salePrice)}</span>
                  {deal.percentOff !== null && deal.percentOff > 0 && (
                    <DiscountBadge percentOff={deal.percentOff} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* View Recipe button */}
          {recipe.source === 'meal' && onRecipeTap && (
            <div style={{ padding: '0 24px 16px' }}>
              <button
                type="button"
                style={viewRecipeBtnStyle}
                onClick={() => onRecipeTap(recipe.id)}
              >
                View Recipe
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
