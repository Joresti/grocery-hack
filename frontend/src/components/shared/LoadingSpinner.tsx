import React from 'react';
import { SpinnerIcon } from '../../theme/icons';
import { colors } from '../../theme/tokens';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  fullPage?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(250, 249, 246, 0.8)',
  zIndex: 9999,
};

const inlineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

export const LoadingSpinner = React.memo(function LoadingSpinner({
  size = 32,
  color,
  fullPage = false,
}: LoadingSpinnerProps): React.ReactElement {
  const spinnerColor = color ?? colors.primary;

  if (fullPage) {
    return (
      <div style={overlayStyle}>
        <SpinnerIcon size={size} color={spinnerColor} />
      </div>
    );
  }

  return (
    <div style={inlineStyle}>
      <SpinnerIcon size={size} color={spinnerColor} />
    </div>
  );
});
