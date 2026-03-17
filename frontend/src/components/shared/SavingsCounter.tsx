import React, { useEffect, useState, useRef } from 'react';
import { colors, fonts, fontWeights } from '../../theme/tokens';

interface SavingsCounterProps {
  value: number;
  prefix?: string;
  duration?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const SavingsCounter = React.memo(function SavingsCounter({
  value,
  prefix = '$',
  duration = 700,
}: SavingsCounterProps): React.ReactElement {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number): void => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = easedProgress * value;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  const style: React.CSSProperties = {
    fontFamily: fonts.heading,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    lineHeight: 1.2,
  };

  return (
    <span style={style}>
      {prefix}{displayValue.toFixed(2)}
    </span>
  );
});
