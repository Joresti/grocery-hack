import React, { useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../../theme/tokens';
import { CloseIcon } from '../../theme/icons';

interface AuthGateProps {
  children: React.ReactNode;
  onAuthRequired?: () => void;
}

export const AuthGate = React.memo(function AuthGate({
  children,
  onAuthRequired,
}: AuthGateProps): React.ReactElement {
  const { isAuthenticated } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  const handleInteraction = useCallback(
    (e: React.MouseEvent) => {
      if (isAuthenticated) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (onAuthRequired) {
        onAuthRequired();
      } else {
        setShowPrompt(true);
      }
    },
    [isAuthenticated, onAuthRequired]
  );

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: colors.white,
    borderRadius: radii.modal,
    padding: '32px',
    maxWidth: '400px',
    width: '90vw',
    boxShadow: shadows.card,
    textAlign: 'center',
    position: 'relative',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.bold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: fonts.body,
    fontWeight: fontWeights.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 1.5,
    marginBottom: 24,
  };

  const ctaStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: fonts.body,
    fontWeight: fontWeights.semibold,
    fontSize: 16,
    padding: '12px 32px',
    borderRadius: radii.pill,
    border: 'none',
    cursor: 'pointer',
    boxShadow: shadows.button,
    minHeight: spacing.touchTargetMin,
    transition: 'all 0.2s ease',
  };

  return (
    <>
      {isAuthenticated ? (
        children
      ) : (
        <div
          onClick={handleInteraction}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleInteraction(e as unknown as React.MouseEvent);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {children}
        </div>
      )}
      {showPrompt ? (
        <div style={overlayStyle} onClick={handleDismiss}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={closeButtonStyle}
              onClick={handleDismiss}
              aria-label="Close"
            >
              <CloseIcon size={20} color={colors.textMuted} />
            </button>
            <h2 style={titleStyle}>Sign up to continue</h2>
            <p style={bodyStyle}>
              Create a free account to save your favorites, build meal plans, and start saving on groceries.
            </p>
            <button type="button" style={ctaStyle}>
              Get Started
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
});
