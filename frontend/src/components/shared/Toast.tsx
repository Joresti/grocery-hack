import React, { useEffect, useRef } from 'react';
import { colors, fonts, fontWeights, radii } from '../../theme/tokens';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 3000;

const toastKeyframes = `
@keyframes gh-toast-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes gh-toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(16px);
  }
}
`;

let toastStyleInjected = false;

function injectToastStyle(): void {
  if (toastStyleInjected || typeof document === 'undefined') {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = toastKeyframes;
  document.head.appendChild(styleEl);
  toastStyleInjected = true;
}

function getBackgroundColor(type: 'success' | 'error' | 'info'): string {
  switch (type) {
    case 'success':
      return colors.success;
    case 'error':
      return colors.danger;
    case 'info':
      return colors.primary;
  }
}

export const Toast = React.memo(function Toast({
  message,
  type,
  visible,
  onDismiss,
}: ToastProps): React.ReactElement | null {
  injectToastStyle();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, onDismiss]);

  if (!visible) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10000,
    animation: 'gh-toast-in 0.3s ease-out forwards',
  };

  const toastStyle: React.CSSProperties = {
    backgroundColor: getBackgroundColor(type),
    color: colors.white,
    fontFamily: fonts.body,
    fontWeight: fontWeights.medium,
    fontSize: 14,
    padding: '12px 24px',
    borderRadius: radii.pill,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: '90vw',
    textAlign: 'center',
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <div
        style={toastStyle}
        onClick={onDismiss}
        role="alert"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
});
