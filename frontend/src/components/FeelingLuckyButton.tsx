import React, { useState } from 'react';
import { StarIcon } from '../theme/icons';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';

interface FeelingLuckyButtonProps {
  onClick: () => void;
}

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  backgroundColor: colors.accent,
  color: colors.white,
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  border: 'none',
  borderRadius: radii.pill,
  padding: '14px 32px',
  cursor: 'pointer',
  boxShadow: shadows.button,
  transition: 'all 0.2s ease',
  minHeight: spacing.touchTargetMin,
  minWidth: spacing.touchTargetMin,
};

export function FeelingLuckyButton({ onClick }: FeelingLuckyButtonProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      style={{
        ...buttonBaseStyle,
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? shadows.buttonHover : shadows.button,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <StarIcon />
      Feeling Lucky
    </button>
  );
}
