import React, { useEffect, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';
import { CloseIcon } from '../theme/icons/CloseIcon';

const DESKTOP_BREAKPOINT = 600;

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );

  useEffect(() => {
    function handleResize(): void {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isDesktop;
}

export function ModalOverlay({
  isOpen,
  onClose,
  title,
  children,
}: ModalOverlayProps): React.ReactElement {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  const backdropStyle = isDesktop
    ? styles.backdropDesktop as React.CSSProperties
    : styles.backdropMobile as React.CSSProperties;

  const contentStyle = isDesktop
    ? styles.contentDesktop as React.CSSProperties
    : styles.contentMobile as React.CSSProperties;

  const mobileContentAnimation = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  };

  const desktopContentAnimation = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: 'easeOut' },
  };

  const contentAnimation = isDesktop
    ? desktopContentAnimation
    : mobileContentAnimation;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Modal'}
          tabIndex={-1}
          style={backdropStyle}
        >
          <motion.div
            initial={contentAnimation.initial}
            animate={contentAnimation.animate}
            exit={contentAnimation.exit}
            transition={contentAnimation.transition}
            style={contentStyle}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {title !== undefined && (
              <div style={styles.header}>
                <h2 style={styles.title}>{title}</h2>
                <button
                  onClick={onClose}
                  style={styles.closeButton}
                  aria-label="Close modal"
                  type="button"
                >
                  <CloseIcon size={20} color={colors.textMuted} />
                </button>
              </div>
            )}
            {title === undefined && (
              <button
                onClick={onClose}
                style={styles.floatingClose}
                aria-label="Close modal"
                type="button"
              >
                <CloseIcon size={20} color={colors.textMuted} />
              </button>
            )}
            <div style={styles.body}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const backdropBase: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 1000,
};

const styles: Record<string, React.CSSProperties> = {
  backdropMobile: {
    ...backdropBase,
    alignItems: 'flex-end',
  },
  backdropDesktop: {
    ...backdropBase,
    alignItems: 'center',
  },
  contentMobile: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    width: '100%',
    maxWidth: spacing.containerMaxWidth,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  contentDesktop: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    width: '100%',
    maxWidth: '520px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: '1.25rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: 0,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
    padding: 0,
    flexShrink: 0,
  },
  floatingClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '50%',
    padding: 0,
    zIndex: 10,
  },
  body: {
    overflowY: 'auto',
    flex: 1,
    padding: '24px',
  },
};
