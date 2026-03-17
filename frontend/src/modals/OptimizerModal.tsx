import React, { useState, useCallback } from 'react';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { MapPinIcon } from '../theme/icons/MapPinIcon';
import { ModalOverlay } from './ModalOverlay';
import { useOptimize } from '../hooks/useOptimize';
import { useAuth } from '../hooks/useAuth';
import { useTrack } from '../hooks/useTrack';
import type { MaxStores } from '@groceryhack/shared/types';

interface OptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizerModal({
  isOpen,
  onClose,
}: OptimizerModalProps): React.ReactElement {
  const { user } = useAuth();
  const optimizeMutation = useOptimize();
  const { track } = useTrack();

  const [postalCode, setPostalCode] = useState(user?.postalCode ?? '');
  const [maxStores, setMaxStores] = useState<MaxStores>(user?.maxStores ?? 1);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setUseCurrentLocation(true);
        setLocationError(null);
      },
      () => {
        setLocationError('Unable to get your location. Please enter a postal code.');
      }
    );
  }, []);

  const handleOptimize = useCallback(() => {
    const request = useCurrentLocation && coords
      ? { lat: coords.lat, lng: coords.lng, maxStores }
      : { postalCode, maxStores };

    track('optimizer_run', {
      store_count: maxStores,
      store_location_ids: [],
    });

    optimizeMutation.mutate(request, {
      onSuccess: () => {
        onClose();
      },
    });
  }, [
    useCurrentLocation,
    coords,
    postalCode,
    maxStores,
    optimizeMutation,
    onClose,
    track,
  ]);

  const canOptimize =
    (postalCode.trim().length > 0 || (useCurrentLocation && coords !== null)) &&
    !optimizeMutation.isPending;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Optimize My Smart List">
      <div style={styles.container}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="postal-code">
            Postal Code
          </label>
          <div style={styles.locationRow}>
            <input
              id="postal-code"
              type="text"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value);
                setUseCurrentLocation(false);
              }}
              placeholder="Enter postal code"
              style={{
                ...styles.input,
                ...(useCurrentLocation ? { opacity: 0.5 } : {}),
              }}
              disabled={useCurrentLocation}
            />
            <button
              onClick={handleUseLocation}
              style={styles.locationButton}
              type="button"
              aria-label="Use current location"
            >
              <MapPinIcon size={16} color={colors.white} />
            </button>
          </div>
          {useCurrentLocation && (
            <span style={styles.locationConfirm}>
              Using current location
            </span>
          )}
          {locationError && (
            <span style={styles.errorText}>{locationError}</span>
          )}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Store Limit</label>
          <div style={styles.toggleContainer}>
            <button
              onClick={() => setMaxStores(1)}
              style={{
                ...styles.toggleButton,
                ...(maxStores === 1 ? styles.toggleActive : styles.toggleInactive),
              }}
              type="button"
            >
              1 Store
            </button>
            <button
              onClick={() => setMaxStores(2)}
              style={{
                ...styles.toggleButton,
                ...(maxStores === 2 ? styles.toggleActive : styles.toggleInactive),
              }}
              type="button"
            >
              2 Stores
            </button>
          </div>
        </div>

        <button
          onClick={handleOptimize}
          disabled={!canOptimize}
          style={{
            ...styles.optimizeButton,
            opacity: canOptimize ? 1 : 0.5,
            cursor: canOptimize ? 'pointer' : 'not-allowed',
          }}
          type="button"
        >
          {optimizeMutation.isPending ? 'Optimizing...' : 'Optimize My Plan'}
        </button>

        {optimizeMutation.isError && (
          <p style={styles.errorText}>
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </ModalOverlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  locationRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '12px 16px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  locationButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: radii.input,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  locationConfirm: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.medium,
    color: colors.success,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: '0.8rem',
    fontWeight: fontWeights.medium,
    color: colors.danger,
    margin: 0,
  },
  toggleContainer: {
    display: 'flex',
    backgroundColor: colors.white,
    border: `2px solid ${colors.primary}`,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    border: 'none',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: 44,
  },
  toggleActive: {
    backgroundColor: colors.primary,
    color: colors.white,
  },
  toggleInactive: {
    backgroundColor: 'transparent',
    color: colors.textMuted,
  },
  optimizeButton: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '14px 32px',
    boxShadow: shadows.button,
    minHeight: 44,
    transition: 'all 0.2s ease',
    marginTop: '8px',
  },
};
