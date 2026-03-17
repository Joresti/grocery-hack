import React, { useState, useCallback } from 'react';
import { HeartButton, DiscountBadge } from './shared';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { Deal } from '@groceryhack/shared/types';

interface NotableDealsProps {
  deals: Deal[];
  onHeartDeal?: (dealId: string) => void;
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
  width: '220px',
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: '20px',
  scrollSnapAlign: 'start',
  transition: 'box-shadow 0.3s ease',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const heartPositionStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
};

const itemNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1rem',
  color: colors.text,
  margin: '0 0 4px 0',
  paddingRight: '36px',
  lineHeight: 1.3,
};

const storeBrandStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.85rem',
  color: colors.textMuted,
  margin: '0 0 12px 0',
};

const priceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginTop: 'auto',
};

const salePriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.25rem',
  color: colors.primary,
};

const regularPriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  textDecoration: 'line-through',
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function NotableDeals({ deals, onHeartDeal }: NotableDealsProps): React.ReactElement | null {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [heartedDeals, setHeartedDeals] = useState<Set<string>>(new Set());

  const handleHeartToggle = useCallback((dealId: string) => {
    setHeartedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
    onHeartDeal?.(dealId);
  }, [onHeartDeal]);

  if (deals.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Notable Deals This Week</h2>
      <div style={scrollContainerStyle}>
        {deals.map((deal, index) => (
          <div
            key={deal.id}
            style={{
              ...cardBaseStyle,
              boxShadow: hoveredIndex === index ? shadows.cardHover : shadows.card,
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div style={heartPositionStyle}>
              <HeartButton
                active={heartedDeals.has(deal.id)}
                onToggle={() => handleHeartToggle(deal.id)}
              />
            </div>
            <h3 style={itemNameStyle}>{deal.itemName}</h3>
            <p style={storeBrandStyle}>{deal.storeBrandName}</p>
            <div style={priceRowStyle}>
              <span style={salePriceStyle}>{formatPrice(deal.salePrice)}</span>
              {deal.regularPrice !== null && (
                <span style={regularPriceStyle}>{formatPrice(deal.regularPrice)}</span>
              )}
              {deal.percentOff !== null && deal.percentOff > 0 && (
                <DiscountBadge percentOff={deal.percentOff} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
