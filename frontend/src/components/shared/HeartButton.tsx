import React, { useState, useCallback } from 'react';
import { HeartIcon } from '../../theme/icons';
import { colors, spacing } from '../../theme/tokens';

interface HeartButtonProps {
  active: boolean;
  onToggle: () => void;
  size?: number;
}

const heartKeyframes = `
@keyframes gh-heart-pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}
`;

let heartStyleInjected = false;

function injectHeartStyle(): void {
  if (heartStyleInjected || typeof document === 'undefined') {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = heartKeyframes;
  document.head.appendChild(styleEl);
  heartStyleInjected = true;
}

export const HeartButton = React.memo(function HeartButton({
  active,
  onToggle,
  size = 24,
}: HeartButtonProps): React.ReactElement {
  injectHeartStyle();

  const [animating, setAnimating] = useState(false);

  const handleClick = useCallback(() => {
    setAnimating(true);
    onToggle();
    setTimeout(() => {
      setAnimating(false);
    }, 400);
  }, [onToggle]);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    animation: animating ? 'gh-heart-pop 0.4s ease-out' : 'none',
  };

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={handleClick}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={active}
    >
      <HeartIcon
        size={size}
        color={active ? colors.danger : colors.textMuted}
        filled={active}
      />
    </button>
  );
});
