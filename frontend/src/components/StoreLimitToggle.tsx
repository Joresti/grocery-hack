import React from 'react';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';

interface StoreLimitToggleProps {
  value: 1 | 2;
  onChange: (val: 1 | 2) => void;
}

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  backgroundColor: colors.white,
  border: `2px solid ${colors.primary}`,
  borderRadius: radii.pill,
  overflow: 'hidden',
};

const segmentBaseStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  padding: '10px 22px',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  minHeight: spacing.touchTargetMin,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const activeSegmentStyle: React.CSSProperties = {
  ...segmentBaseStyle,
  backgroundColor: colors.primary,
  color: colors.white,
};

const inactiveSegmentStyle: React.CSSProperties = {
  ...segmentBaseStyle,
  backgroundColor: 'transparent',
  color: colors.textMuted,
};

export function StoreLimitToggle({ value, onChange }: StoreLimitToggleProps): React.ReactElement {
  return (
    <div style={containerStyle} role="group" aria-label="Store limit toggle">
      <button
        type="button"
        style={value === 1 ? activeSegmentStyle : inactiveSegmentStyle}
        onClick={() => onChange(1)}
        aria-pressed={value === 1}
      >
        1 Store
      </button>
      <button
        type="button"
        style={value === 2 ? activeSegmentStyle : inactiveSegmentStyle}
        onClick={() => onChange(2)}
        aria-pressed={value === 2}
      >
        2 Stores
      </button>
    </div>
  );
}
