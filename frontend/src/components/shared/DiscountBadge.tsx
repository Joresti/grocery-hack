import React from 'react';
import { colors, fonts, fontWeights, radii } from '../../theme/tokens';

interface DiscountBadgeProps {
  percentOff: number;
}

export const DiscountBadge = React.memo(function DiscountBadge({
  percentOff,
}: DiscountBadgeProps): React.ReactElement {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenBadgeBg,
    color: colors.greenBadgeText,
    fontFamily: fonts.heading,
    fontWeight: fontWeights.semibold,
    fontSize: 12,
    lineHeight: 1,
    padding: '4px 10px',
    borderRadius: radii.pill,
    whiteSpace: 'nowrap',
  };

  return (
    <span style={style}>
      {Math.round(percentOff)}% off
    </span>
  );
});
