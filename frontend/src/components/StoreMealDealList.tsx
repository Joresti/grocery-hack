import React, { useState, useCallback, useMemo } from 'react';
import { StoreLimitToggle } from './StoreLimitToggle';
import { DiscountBadge } from './shared';
import { MapPinIcon } from '../theme/icons/MapPinIcon';
import { CheckIcon } from '../theme/icons/CheckIcon';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import type { WeeklyPlan, GroceryPlan, PlanStop, PlanShoppingItem, PlanMeal } from '@groceryhack/shared/types';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface StoreMealDealListProps {
  plan: WeeklyPlan;
  onStoreLimitChange: (stores: 1 | 2) => void;
  storeLimit: 1 | 2;
  /** When provided, each meal shows a "Suggest a swap" affordance (family-member view). */
  onSuggestSwap?: (meal: PlanMeal) => void;
  /** Set of PlanMeal.mealId values that already have a pending suggestion from the viewer. */
  pendingSuggestionMealIds?: Set<string>;
  /** When provided, tapping a "Suggestion pending" marker reveals the existing suggestion. */
  onViewPendingSuggestion?: (meal: PlanMeal) => void;
}

type ViewMode = 'byMeal' | 'viewAll';

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  padding: `${spacing.sectionPadding} 0`,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
  marginBottom: '24px',
};

const headingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.4rem',
  color: colors.text,
  margin: 0,
};

const weekSubtitleStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  marginTop: '4px',
};

const storeCardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  marginBottom: spacing.cardMarginBottom,
  overflow: 'hidden',
};

const storeHeaderStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
};

const storeNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.text,
  margin: '0 0 4px 0',
};

const storeAddressLinkStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  color: colors.primary,
  textDecoration: 'underline',
  textDecorationColor: 'rgba(61, 123, 123, 0.3)',
  textUnderlineOffset: '3px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  minHeight: '44px',
  padding: '4px 0',
};

const viewToggleBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 24px',
  borderBottom: `1px solid ${colors.border}`,
};

const viewToggleButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.pill,
  padding: '8px 18px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  minWidth: spacing.touchTargetMin,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
};

const mealTabsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '14px 24px',
  borderBottom: `1px solid ${colors.border}`,
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
};

const mealPillBaseStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.85rem',
  padding: '8px 16px',
  borderRadius: radii.pill,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '180px',
  minHeight: spacing.touchTargetMin,
  minWidth: spacing.touchTargetMin,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const mealsSectionTitleStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.8rem',
  color: colors.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px 0',
};

const mealRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const mealNameListStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '0.95rem',
  color: colors.text,
};

const mealCostStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.primary,
};

// ── Suggest-a-swap affordances (family-member view) ──

const mealRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
};

const suggestSwapButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.8rem',
  padding: '8px 14px',
  borderRadius: radii.pill,
  border: `1.5px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.primary,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minHeight: spacing.touchTargetMin,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  flexShrink: 0,
};

const pillPendingStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.72rem',
  backgroundColor: '#FBEEDB',
  color: '#9A6A12',
  padding: '5px 11px',
  borderRadius: radii.pill,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

// Same amber pill, rendered as a button so it can reveal the existing suggestion.
const pillPendingButtonStyle: React.CSSProperties = {
  ...pillPendingStyle,
  border: 'none',
  cursor: 'pointer',
};

const mealActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: '14px',
  padding: '14px 18px',
  marginBottom: '16px',
};

const maLabelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.7rem',
  fontWeight: fontWeights.bold,
  letterSpacing: '0.1em',
  color: colors.textMuted,
  textTransform: 'uppercase' as const,
};

const maNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.05rem',
  color: colors.text,
  marginTop: '3px',
};

const dotPendingStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  backgroundColor: '#CF9A2E',
  marginLeft: '7px',
  flexShrink: 0,
};

const shoppingTitleStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.8rem',
  color: colors.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px 0',
};

const shoppingListSectionStyle: React.CSSProperties = {
  padding: '16px 24px',
};

const shoppingItemRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: spacing.ingredientRowPadding,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const checkboxOuterStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  minWidth: '24px',
  borderRadius: '6px',
  border: `2px solid ${colors.primary}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const checkboxOuterCheckedStyle: React.CSSProperties = {
  ...checkboxOuterStyle,
  backgroundColor: colors.primary,
  borderColor: colors.primary,
};

const shoppingItemNameStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.medium,
  fontSize: '0.95rem',
  color: colors.text,
  flex: 1,
};

const shoppingItemQtyStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
};

const shoppingItemPriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.semibold,
  fontSize: '1.02rem',
  color: colors.primary,
};

const shoppingItemRegularPriceStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.regular,
  fontSize: '0.85rem',
  color: colors.textMuted,
  textDecoration: 'line-through',
};

const subtotalRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  borderTop: `1px solid ${colors.border}`,
};

const subtotalLabelStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.9rem',
  color: colors.text,
};

const subtotalValueStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
  color: colors.primary,
};

const unmatchedCardStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  borderRadius: radii.card,
  border: `1.5px dashed ${colors.border}`,
  padding: '20px 24px',
  marginBottom: '16px',
};

const unmatchedHeadingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '0.95rem',
  color: colors.textMuted,
  margin: '0 0 4px 0',
};

const unmatchedSubtextStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.8rem',
  color: colors.textMuted,
  margin: '0 0 16px 0',
  lineHeight: 1.5,
};

const totalCardStyle: React.CSSProperties = {
  backgroundColor: colors.primaryLight,
  borderRadius: radii.card,
  padding: '20px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '8px',
};

const totalLabelStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.15rem',
  color: colors.text,
};

const totalValueStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.25rem',
  color: colors.primary,
};

const savingsValueStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.15rem',
  color: colors.primary,
};

const noItemsStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  padding: '16px 0',
  textAlign: 'center',
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function calcPercentOff(regular: number, sale: number): number {
  if (regular <= 0) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ────────────────────────────────────────────────────────────
// ShoppingItemRow
// ────────────────────────────────────────────────────────────

function ShoppingItemRow({
  item,
  isChecked,
  isLast,
  onToggle,
}: {
  item: PlanShoppingItem;
  isChecked: boolean;
  isLast: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const percentOff =
    item.isOnSale && item.regularPrice !== null && item.salePrice !== null
      ? calcPercentOff(item.regularPrice, item.salePrice)
      : 0;

  return (
    <div
      style={{
        ...shoppingItemRowStyle,
        borderBottom: isLast ? 'none' : shoppingItemRowStyle.borderBottom,
        opacity: isChecked ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          minWidth: '44px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        aria-label={`Mark ${item.name} as purchased`}
        aria-pressed={isChecked}
      >
        <span
          style={{
            ...(isChecked ? checkboxOuterCheckedStyle : checkboxOuterStyle),
            background: isChecked ? colors.primary : 'transparent',
          }}
        >
          {isChecked && <CheckIcon size={14} color={colors.white} />}
        </span>
      </button>
      <span
        style={{
          ...shoppingItemNameStyle,
          textDecoration: isChecked ? 'line-through' : 'none',
        }}
      >
        {item.name}
      </span>
      <span style={shoppingItemQtyStyle}>{item.quantity}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {item.isOnSale && item.regularPrice !== null && (
          <span style={shoppingItemRegularPriceStyle}>
            {formatPrice(item.regularPrice)}
          </span>
        )}
        {item.salePrice !== null && (
          <span style={shoppingItemPriceStyle}>
            {formatPrice(item.salePrice)}
          </span>
        )}
        {percentOff > 0 && <DiscountBadge percentOff={percentOff} />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// StoreSection (with meal tabs / view all toggle)
// ────────────────────────────────────────────────────────────

function StoreSection({
  stop,
  viewMode,
  selectedMealName,
  planToken,
  onSuggestSwap,
  pendingSuggestionMealIds,
  onViewPendingSuggestion,
}: {
  stop: PlanStop;
  viewMode: ViewMode;
  selectedMealName: string;
  planToken: string;
  onSuggestSwap?: (meal: PlanMeal) => void;
  pendingSuggestionMealIds?: Set<string>;
  onViewPendingSuggestion?: (meal: PlanMeal) => void;
}): React.ReactElement {
  const storageKey = `gh-checked-${planToken}-${stop.storeLocationId}`;

  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  const toggleItem = useCallback((itemKey: string): void => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  const mealNames = useMemo(
    () => stop.meals.map((m) => m.name),
    [stop.meals]
  );

  const filteredItems = useMemo((): PlanShoppingItem[] => {
    if (viewMode === 'viewAll') {
      return stop.items;
    }
    return stop.items.filter((item) => item.forMeal === selectedMealName);
  }, [viewMode, selectedMealName, stop.items]);

  const hasMeals = stop.meals.length > 0;

  return (
    <div style={storeCardStyle}>
      {/* Store header with name + address */}
      <div style={storeHeaderStyle}>
        <MapPinIcon size={18} color={colors.primary} style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <h3 style={storeNameStyle}>{stop.storeBrandName}</h3>
          <a
            href={buildGoogleMapsUrl(stop.storeAddress)}
            target="_blank"
            rel="noopener noreferrer"
            style={storeAddressLinkStyle}
          >
            {stop.storeAddress}
          </a>
        </div>
      </div>

      {/* Meal tabs removed — shared meal selection is at the top level */}

      {/* View All mode: meals summary section */}
      {viewMode === 'viewAll' && hasMeals && (
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}` }}>
          <p style={mealsSectionTitleStyle}>Meals</p>
          {stop.meals.map((meal, index) => {
            const hasPending = pendingSuggestionMealIds?.has(meal.mealId) ?? false;
            return (
              <div
                key={meal.mealId}
                style={{
                  ...mealRowStyle,
                  borderBottom:
                    index === stop.meals.length - 1 ? 'none' : mealRowStyle.borderBottom,
                }}
              >
                <span style={mealNameListStyle}>{meal.name}</span>
                <div style={mealRightStyle}>
                  {onSuggestSwap &&
                    (hasPending ? (
                      <button
                        type="button"
                        style={pillPendingButtonStyle}
                        onClick={() => onViewPendingSuggestion?.(meal)}
                        aria-label={`View pending suggestion for ${meal.name}`}
                      >
                        Suggestion pending
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={suggestSwapButtonStyle}
                        onClick={() => onSuggestSwap(meal)}
                        aria-label={`Suggest a swap for ${meal.name}`}
                      >
                        Suggest a swap
                      </button>
                    ))}
                  <span style={mealCostStyle}>
                    {formatPrice(meal.costPerServing)}/serving
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shopping items */}
      {filteredItems.length > 0 ? (
        <div style={shoppingListSectionStyle}>
          {viewMode === 'viewAll' && (
            <p style={shoppingTitleStyle}>All Items</p>
          )}
          {filteredItems.map((item, index) => {
            const itemKey = `${item.name}-${item.forMeal ?? 'general'}-${index}`;
            return (
              <ShoppingItemRow
                key={itemKey}
                item={item}
                isChecked={checkedItems.has(itemKey)}
                isLast={index === filteredItems.length - 1}
                onToggle={() => toggleItem(itemKey)}
              />
            );
          })}
        </div>
      ) : (
        <div style={shoppingListSectionStyle}>
          <p style={noItemsStyle}>No items for this meal at this store.</p>
        </div>
      )}

      {/* Subtotal */}
      <div style={subtotalRowStyle}>
        <span style={subtotalLabelStyle}>Subtotal</span>
        <span style={subtotalValueStyle}>{formatPrice(stop.subtotal)}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// StoreMealDealList (main export)
// ────────────────────────────────────────────────────────────

export function StoreMealDealList({
  plan,
  onStoreLimitChange,
  storeLimit,
  onSuggestSwap,
  pendingSuggestionMealIds,
  onViewPendingSuggestion,
}: StoreMealDealListProps): React.ReactElement | null {
  const [viewMode, setViewMode] = useState<ViewMode>('byMeal');

  const activePlan: GroceryPlan | null =
    storeLimit === 2 && plan.twoStoreOptimized !== null
      ? plan.twoStoreOptimized
      : plan.oneStoreOptimized;

  // Collect all unique meal names across all stops
  const allMealNames = useMemo((): string[] => {
    if (!activePlan) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const stop of activePlan.stops) {
      for (const meal of stop.meals) {
        if (!seen.has(meal.name)) {
          seen.add(meal.name);
          names.push(meal.name);
        }
      }
    }
    return names;
  }, [activePlan]);

  // Map each unique meal name → its PlanMeal (first occurrence) so the by-meal
  // affordances (action panel, pending dots) can resolve a name to a mealId.
  const mealByName = useMemo((): Map<string, PlanMeal> => {
    const map = new Map<string, PlanMeal>();
    if (!activePlan) return map;
    for (const stop of activePlan.stops) {
      for (const meal of stop.meals) {
        if (!map.has(meal.name)) map.set(meal.name, meal);
      }
    }
    return map;
  }, [activePlan]);

  const [selectedMealName, setSelectedMealName] = useState<string>('');

  // Auto-select first meal when plan changes
  const firstMealName = allMealNames[0] ?? '';
  if (selectedMealName === '' && firstMealName !== '') {
    setSelectedMealName(firstMealName);
  }

  const toggleViewMode = useCallback((): void => {
    setViewMode((prev) => (prev === 'byMeal' ? 'viewAll' : 'byMeal'));
  }, []);

  if (!activePlan) {
    return null;
  }

  const showToggle = plan.twoStoreOptimized !== null;
  const hasMealsInAnyStop = activePlan.stops.some((s) => s.meals.length > 0);

  const selectedMeal = mealByName.get(selectedMealName) ?? null;
  const selectedMealHasPending = selectedMeal
    ? (pendingSuggestionMealIds?.has(selectedMeal.mealId) ?? false)
    : false;

  return (
    <section style={sectionStyle}>
      <div style={headerRowStyle}>
        <div>
          <h2 style={headingStyle}>Your Shopping Plan</h2>
          <p style={weekSubtitleStyle}>Week of {plan.weekOf}</p>
        </div>
        {showToggle && (
          <StoreLimitToggle value={storeLimit} onChange={onStoreLimitChange} />
        )}
      </div>

      {/* Single view mode toggle for all stores */}
      {hasMealsInAnyStop && (
        <div style={viewToggleBarStyle}>
          <span
            style={{
              fontFamily: fonts.body,
              fontWeight: fontWeights.semibold,
              fontSize: '0.8rem',
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Shopping List
          </span>
          <button
            type="button"
            style={viewToggleButtonStyle}
            onClick={toggleViewMode}
            aria-label={
              viewMode === 'byMeal'
                ? 'Switch to view all items'
                : 'Switch to view by meal'
            }
          >
            {viewMode === 'byMeal' ? 'View All' : 'By Meal'}
          </button>
        </div>
      )}

      {/* Shared meal pills — same selection across all stores */}
      {hasMealsInAnyStop && viewMode === 'byMeal' && (
        <div style={mealTabsRowStyle} role="tablist" aria-label="Meal filter">
          {allMealNames.map((name) => {
            const isActive = name === selectedMealName;
            const pillMeal = mealByName.get(name);
            const pillHasPending = pillMeal
              ? (pendingSuggestionMealIds?.has(pillMeal.mealId) ?? false)
              : false;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedMealName(name)}
                style={{
                  ...mealPillBaseStyle,
                  backgroundColor: isActive ? colors.primary : colors.primaryLight,
                  color: isActive ? colors.white : colors.primary,
                }}
              >
                {name}
                {pillHasPending && (
                  <span style={dotPendingStyle} aria-label="Suggestion pending" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* By-meal action panel — suggest a swap for the selected meal */}
      {hasMealsInAnyStop && viewMode === 'byMeal' && onSuggestSwap && selectedMeal && (
        <div style={mealActionStyle}>
          <div>
            <div style={maLabelStyle}>Showing ingredients for</div>
            <div style={maNameStyle}>{selectedMealName}</div>
          </div>
          {selectedMealHasPending ? (
            <button
              type="button"
              style={pillPendingButtonStyle}
              onClick={() => onViewPendingSuggestion?.(selectedMeal)}
              aria-label={`View pending suggestion for ${selectedMealName}`}
            >
              Suggestion pending
            </button>
          ) : (
            <button
              type="button"
              style={suggestSwapButtonStyle}
              onClick={() => onSuggestSwap(selectedMeal)}
              aria-label={`Suggest a swap for ${selectedMealName}`}
            >
              Suggest a swap
            </button>
          )}
        </div>
      )}

      {activePlan.stops.map((stop) => (
        <StoreSection
          key={stop.storeLocationId}
          stop={stop}
          viewMode={viewMode}
          selectedMealName={selectedMealName}
          planToken={plan.token}
          onSuggestSwap={onSuggestSwap}
          pendingSuggestionMealIds={pendingSuggestionMealIds}
          onViewPendingSuggestion={onViewPendingSuggestion}
        />
      ))}

      {/* Unmatched items — not assigned to any store */}
      {activePlan.unmatchedItems && activePlan.unmatchedItems.length > 0 && (
        <div style={unmatchedCardStyle}>
          <h3 style={unmatchedHeadingStyle}>Also needed (any store)</h3>
          <p style={unmatchedSubtextStyle}>
            These ingredients aren't on sale this week. Pick them up wherever is convenient.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(viewMode === 'byMeal'
              ? activePlan.unmatchedItems.filter((item) => item.forMeal === selectedMealName)
              : activePlan.unmatchedItems
            ).map((item, index, arr) => (
              <div
                key={`${item.name}-${index}`}
                style={{
                  ...shoppingItemRowStyle,
                  borderBottom: index === arr.length - 1 ? 'none' : shoppingItemRowStyle.borderBottom,
                }}
              >
                <span style={shoppingItemNameStyle}>{item.name}</span>
                <span style={shoppingItemQtyStyle}>{item.quantity}</span>
                {item.dealNote && (
                  <span style={{
                    fontFamily: fonts.body,
                    fontSize: '0.75rem',
                    fontWeight: fontWeights.medium,
                    color: colors.primary,
                    backgroundColor: colors.primaryLight,
                    padding: '2px 8px',
                    borderRadius: radii.pill,
                    whiteSpace: 'nowrap',
                  }}>
                    {item.dealNote}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={totalCardStyle}>
        <div>
          <span style={totalLabelStyle}>Plan Total</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={savingsValueStyle}>
            Savings: {formatPrice(activePlan.estimatedSavings)}
          </span>
          <span style={totalValueStyle}>{formatPrice(activePlan.total)}</span>
        </div>
      </div>
    </section>
  );
}
