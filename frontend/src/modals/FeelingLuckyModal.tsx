import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, fonts, fontWeights, radii, shadows } from '../theme/tokens';
import { CloseIcon } from '../theme/icons/CloseIcon';
import { PlusIcon } from '../theme/icons/PlusIcon';
import { ModalOverlay } from './ModalOverlay';
import { useTrack } from '../hooks/useTrack';
import type { Meal } from '@groceryhack/shared/types';

interface FeelingLuckyModalProps {
  isOpen: boolean;
  onClose: () => void;
  meals: Meal[];
  householdNames: string[];
}

const SPIN_DURATION_MS = 2500;
const CYCLE_INTERVAL_START_MS = 50;

export function FeelingLuckyModal({
  isOpen,
  onClose,
  meals,
  householdNames: initialNames,
}: FeelingLuckyModalProps): React.ReactElement {
  const { track } = useTrack();
  const [names, setNames] = useState<string[]>(initialNames);
  const [newName, setNewName] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinComplete, setSpinComplete] = useState(false);
  const [displayMealName, setDisplayMealName] = useState('');
  const [displayPersonName, setDisplayPersonName] = useState('');
  const [resultMeal, setResultMeal] = useState<Meal | null>(null);
  const [resultPerson, setResultPerson] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNames(initialNames);
  }, [initialNames]);

  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setSpinComplete(false);
      setDisplayMealName('');
      setDisplayPersonName('');
      setResultMeal(null);
      setResultPerson('');
      setShowConfetti(false);
    }
  }, [isOpen]);

  const handleAddName = useCallback(() => {
    const trimmed = newName.trim();
    if (trimmed && !names.includes(trimmed)) {
      setNames((prev) => [...prev, trimmed]);
      setNewName('');
    }
  }, [newName, names]);

  const handleRemoveName = useCallback((name: string) => {
    setNames((prev) => prev.filter((n) => n !== name));
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddName();
      }
    },
    [handleAddName]
  );

  const handleSpin = useCallback(() => {
    if (meals.length === 0) return;

    setIsSpinning(true);
    setSpinComplete(false);
    setShowConfetti(false);

    const finalMealIdx = Math.floor(Math.random() * meals.length);
    const finalMeal = meals[finalMealIdx]!;
    const finalPerson =
      names.length > 0
        ? names[Math.floor(Math.random() * names.length)] ?? ''
        : '';

    const startTime = Date.now();
    let cycleSpeed = CYCLE_INTERVAL_START_MS;

    const cycle = (): void => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= SPIN_DURATION_MS) {
        setDisplayMealName(finalMeal.name);
        setDisplayPersonName(finalPerson);
        setResultMeal(finalMeal);
        setResultPerson(finalPerson);
        setIsSpinning(false);
        setSpinComplete(true);
        setShowConfetti(true);

        track('feeling_lucky_spun', {
          result_meal_id: finalMeal.id,
          result_name: finalPerson,
        });

        setTimeout(() => setShowConfetti(false), 3000);
        return;
      }

      const randomMeal = meals[Math.floor(Math.random() * meals.length)]!;
      setDisplayMealName(randomMeal.name);
      if (names.length > 0) {
        const randomPerson = names[Math.floor(Math.random() * names.length)] ?? '';
        setDisplayPersonName(randomPerson);
      }

      const progress = elapsed / SPIN_DURATION_MS;
      cycleSpeed = CYCLE_INTERVAL_START_MS + progress * 200;

      intervalRef.current = setTimeout(cycle, cycleSpeed);
    };

    cycle();
  }, [meals, names, track]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} title="Feeling Lucky">
      <div style={styles.container}>
        <div style={styles.namesSection}>
          <p style={styles.prompt}>
            {names.length === 0
              ? "Who's cooking this week?"
              : 'Household members'}
          </p>
          <div style={styles.chipContainer}>
            {names.map((name) => (
              <div key={name} style={styles.chip}>
                <span style={styles.chipText}>{name}</span>
                <button
                  onClick={() => handleRemoveName(name)}
                  style={styles.chipRemove}
                  aria-label={`Remove ${name}`}
                  type="button"
                >
                  <CloseIcon size={14} color={colors.textMuted} />
                </button>
              </div>
            ))}
          </div>
          <div style={styles.addNameRow}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              placeholder="Add a name..."
              style={styles.nameInput}
              aria-label="Add household member name"
            />
            <button
              onClick={handleAddName}
              style={styles.addButton}
              disabled={!newName.trim()}
              aria-label="Add name"
              type="button"
            >
              <PlusIcon size={18} color={colors.white} />
            </button>
          </div>
        </div>

        <div style={styles.slotMachine}>
          <div style={styles.slotWindow}>
            <motion.div
              key={displayMealName}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.1 }}
              style={styles.slotMealName}
            >
              {displayMealName || '???'}
            </motion.div>
          </div>
          {names.length > 0 && (
            <div style={styles.slotWindow}>
              <motion.div
                key={displayPersonName}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.1 }}
                style={styles.slotPersonName}
              >
                {displayPersonName || '???'}
              </motion.div>
            </div>
          )}
        </div>

        {!spinComplete && (
          <button
            onClick={handleSpin}
            disabled={isSpinning || meals.length === 0}
            style={{
              ...styles.spinButton,
              opacity: isSpinning || meals.length === 0 ? 0.7 : 1,
            }}
            type="button"
          >
            {isSpinning ? 'Spinning...' : 'SPIN!'}
          </button>
        )}

        <AnimatePresence>
          {spinComplete && resultMeal && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              style={styles.result}
            >
              <p style={styles.resultLabel}>TONIGHT:</p>
              <p style={styles.resultText}>
                {resultPerson
                  ? `${resultPerson} is making`
                  : "You're making"}
              </p>
              <p style={styles.resultMealName}>{resultMeal.name}</p>

              <button
                onClick={onClose}
                style={styles.viewRecipeButton}
                type="button"
              >
                View Recipe
              </button>

              <button
                onClick={() => {
                  setSpinComplete(false);
                  setDisplayMealName('');
                  setDisplayPersonName('');
                }}
                style={styles.spinAgainButton}
                type="button"
              >
                Spin Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {showConfetti && <ConfettiDisplay />}
      </div>
    </ModalOverlay>
  );
}

function ConfettiDisplay(): React.ReactElement {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: [colors.primary, colors.accent, colors.success, colors.danger][
      i % 4
    ],
    size: 6 + Math.random() * 6,
  }));

  return (
    <div style={styles.confettiContainer}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: 400,
            opacity: 0,
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 1.5,
            delay: p.delay,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    alignItems: 'center',
    position: 'relative',
  },
  namesSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  prompt: {
    fontFamily: fonts.heading,
    fontSize: '1.1rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: 0,
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    padding: '6px 12px',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  chipRemove: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  addNameRow: {
    display: 'flex',
    gap: '8px',
  },
  nameInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: '0.95rem',
    fontWeight: fontWeights.regular,
    color: colors.text,
    backgroundColor: colors.white,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radii.input,
    padding: '10px 14px',
    outline: 'none',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
  },
  slotMachine: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    alignItems: 'center',
  },
  slotWindow: {
    backgroundColor: colors.bg,
    borderRadius: radii.card,
    padding: '20px 24px',
    width: '100%',
    maxWidth: 320,
    textAlign: 'center',
    overflow: 'hidden',
    minHeight: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${colors.border}`,
  },
  slotMealName: {
    fontFamily: fonts.heading,
    fontSize: '1.15rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  slotPersonName: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  spinButton: {
    fontFamily: fonts.heading,
    fontSize: '1.1rem',
    fontWeight: fontWeights.bold,
    backgroundColor: colors.accent,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '16px 56px',
    cursor: 'pointer',
    boxShadow: shadows.button,
    minHeight: 44,
    transition: 'all 0.2s ease',
    letterSpacing: '1px',
  },
  result: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px',
    backgroundColor: colors.white,
    borderRadius: radii.card,
    boxShadow: shadows.card,
    width: '100%',
    maxWidth: 320,
  },
  resultLabel: {
    fontFamily: fonts.heading,
    fontSize: '0.75rem',
    fontWeight: fontWeights.semibold,
    color: colors.accent,
    margin: 0,
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  resultText: {
    fontFamily: fonts.body,
    fontSize: '1rem',
    fontWeight: fontWeights.medium,
    color: colors.textMuted,
    margin: 0,
  },
  resultMealName: {
    fontFamily: fonts.heading,
    fontSize: '1.4rem',
    fontWeight: fontWeights.bold,
    color: colors.text,
    margin: '4px 0 16px',
    textAlign: 'center',
  },
  viewRecipeButton: {
    fontFamily: fonts.body,
    fontSize: '0.9rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: radii.pill,
    padding: '12px 32px',
    cursor: 'pointer',
    boxShadow: shadows.button,
    minHeight: 44,
    transition: 'all 0.2s ease',
    width: '100%',
  },
  spinAgainButton: {
    fontFamily: fonts.body,
    fontSize: '0.85rem',
    fontWeight: fontWeights.semibold,
    backgroundColor: 'transparent',
    color: colors.primary,
    border: `2px solid ${colors.primary}`,
    borderRadius: radii.pill,
    padding: '10px 24px',
    cursor: 'pointer',
    minHeight: 44,
    transition: 'all 0.2s ease',
    width: '100%',
    marginTop: 4,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
};
