import React from 'react';
import { AlertIcon } from '../theme/icons';
import { DiscountBadge } from './shared';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { WatchlistAlert } from '@groceryhack/shared/types';

interface DealAlertBannerProps {
  alerts: WatchlistAlert[];
}

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
};

const headerBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  backgroundColor: colors.primary,
  color: colors.white,
  borderRadius: `${radii.card} ${radii.card} 0 0`,
  padding: '14px 20px',
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1rem',
};

const alertListStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: `0 0 ${radii.card} ${radii.card}`,
  boxShadow: shadows.card,
  overflow: 'hidden',
};

const alertRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '8px',
  padding: '16px 20px',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const alertItemNameStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.95rem',
  color: colors.text,
};

const alertStoreStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  marginTop: '2px',
};

const priceGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const salePriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '1.02rem',
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

function calcPercentOff(regular: number, sale: number): number {
  if (regular <= 0) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}

export function DealAlertBanner({ alerts }: DealAlertBannerProps): React.ReactElement | null {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <div style={headerBarStyle}>
        <AlertIcon />
        <span>{alerts.length} deal{alerts.length !== 1 ? 's' : ''} on your watchlist!</span>
      </div>
      <div style={alertListStyle}>
        {alerts.map((alert, index) => {
          const percentOff = calcPercentOff(alert.regularPrice, alert.salePrice);
          return (
            <div
              key={`${alert.item}-${alert.store}-${index}`}
              style={{
                ...alertRowStyle,
                borderBottom: index === alerts.length - 1 ? 'none' : alertRowStyle.borderBottom,
              }}
            >
              <div>
                <div style={alertItemNameStyle}>{alert.item}</div>
                <div style={alertStoreStyle}>{alert.store}</div>
              </div>
              <div style={priceGroupStyle}>
                <span style={regularPriceStyle}>{formatPrice(alert.regularPrice)}</span>
                <span style={salePriceStyle}>{formatPrice(alert.salePrice)}</span>
                {percentOff > 0 && <DiscountBadge percentOff={percentOff} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
