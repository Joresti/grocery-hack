import React from 'react';
import { fonts, fontWeights, colors } from '../tokens';

interface LogoIconProps {
  size?: number;
  color?: string;
}

export const LogoIcon = React.memo(function LogoIcon({
  size = 24,
  color,
}: LogoIconProps): React.ReactElement {
  const fontSize = size * 0.65;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontFamily: fonts.heading,
        fontWeight: fontWeights.bold,
        fontSize,
        color: color ?? colors.primary,
        lineHeight: 1,
        userSelect: 'none',
      }}
      aria-label="GroceryHack"
    >
      GH
    </span>
  );
});
