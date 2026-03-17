import React from 'react';
import { SavingsCounter } from './shared';
import { colors, fonts, fontWeights, radii } from '../theme/tokens';

interface SavingsSummaryProps {
  savingsThisWeek: number;
  savingsYtd: number;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: colors.primaryLight,
  borderRadius: radii.pill,
  padding: '8px 18px',
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
  whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.85rem',
  color: colors.textMuted,
};

export function SavingsSummary({ savingsThisWeek, savingsYtd }: SavingsSummaryProps): React.ReactElement {
  return (
    <div style={containerStyle}>
      <div style={badgeStyle}>
        <span style={labelStyle}>This week:</span>
        <SavingsCounter value={savingsThisWeek} />
      </div>
      <div style={badgeStyle}>
        <span style={labelStyle}>This year:</span>
        <SavingsCounter value={savingsYtd} />
      </div>
    </div>
  );
}
