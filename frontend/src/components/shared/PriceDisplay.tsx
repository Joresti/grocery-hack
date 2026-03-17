import React from 'react';
import { colors, fonts, fontWeights } from '../../theme/tokens';

interface PriceDisplayProps {
  price: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { priceFontSize: 16, labelFontSize: 11 },
  md: { priceFontSize: 24, labelFontSize: 12 },
  lg: { priceFontSize: 36, labelFontSize: 14 },
} as const;

export const PriceDisplay = React.memo(function PriceDisplay({
  price,
  label,
  size = 'md',
}: PriceDisplayProps): React.ReactElement {
  const config = sizeConfig[size];

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  };

  const priceStyle: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.bold,
    fontSize: config.priceFontSize,
    color: colors.primary,
    lineHeight: 1.2,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: config.labelFontSize,
    color: colors.textMuted,
    lineHeight: 1.4,
    marginTop: 2,
  };

  return (
    <span style={containerStyle}>
      <span style={priceStyle}>${price.toFixed(2)}</span>
      {label ? <span style={labelStyle}>{label}</span> : null}
    </span>
  );
});
