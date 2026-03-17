import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { colors, fonts, fontWeights, radii, shadows, spacing } from '../theme/tokens';
import { MapPinIcon } from '../theme/icons/MapPinIcon';
import { CheckIcon } from '../theme/icons/CheckIcon';

interface SharedPlanData {
  weekOf: string;
  senderName: string | null;
  stops: Array<{
    storeBrandName: string;
    storeAddress: string;
    meals: Array<{ name: string; costPerServing: number; totalCost: number }>;
    items: Array<{ name: string; quantity: string; salePrice: number | null; isOnSale: boolean }>;
    subtotal: number;
  }>;
  total: number;
  estimatedSavings: number;
}

const pageStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  minHeight: '100vh',
  fontFamily: fonts.body,
};

const containerStyle: React.CSSProperties = {
  maxWidth: spacing.containerMaxWidth,
  margin: '0 auto',
  padding: `32px ${spacing.containerPadding}`,
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '32px',
};

const logoStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '1.65rem',
  fontWeight: fontWeights.bold,
  color: colors.primary,
  marginBottom: '8px',
};

const sharedByStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.95rem',
  color: colors.textMuted,
  marginBottom: '4px',
};

const weekStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '1.1rem',
  fontWeight: fontWeights.semibold,
  color: colors.text,
};

const storeCardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: '24px',
  marginBottom: '20px',
};

const storeNameStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '1.15rem',
  fontWeight: fontWeights.bold,
  color: colors.text,
  marginBottom: '4px',
};

const addressLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: fonts.body,
  fontSize: '0.85rem',
  color: colors.primary,
  textDecoration: 'none',
  marginBottom: '16px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '0.85rem',
  fontWeight: fontWeights.semibold,
  color: colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '8px',
};

const itemRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${colors.borderSubtle}`,
  fontFamily: fonts.body,
  fontSize: '0.9rem',
};

const saleBadgeStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '0.7rem',
  fontWeight: fontWeights.semibold,
  color: colors.greenBadgeText,
  backgroundColor: colors.greenBadgeBg,
  padding: '2px 8px',
  borderRadius: radii.pill,
  marginLeft: '8px',
};

const totalRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 0',
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.1rem',
};

const savingsBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1rem',
  color: colors.greenBadgeText,
  backgroundColor: colors.greenBadgeBg,
  padding: '10px 20px',
  borderRadius: radii.pill,
};

const ctaStyle: React.CSSProperties = {
  textAlign: 'center',
  marginTop: '32px',
  padding: '24px',
  backgroundColor: colors.white,
  borderRadius: radii.card,
  boxShadow: shadows.card,
};

const ctaButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: '0.95rem',
  fontWeight: fontWeights.semibold,
  color: colors.white,
  backgroundColor: colors.primary,
  border: 'none',
  borderRadius: radii.pill,
  padding: '14px 32px',
  cursor: 'pointer',
  boxShadow: shadows.button,
  textDecoration: 'none',
  display: 'inline-block',
  minHeight: spacing.touchTargetMin,
};

const loadingStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '80px 24px',
  color: colors.textMuted,
};

const errorBoxStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '80px 24px',
  color: colors.textMuted,
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export default function SharedPlanPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [plan, setPlan] = useState<SharedPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    fetch(`/api/v1/plans/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Plan not found');
        }
        const data = await res.json() as SharedPlanData;
        setPlan(data);

        // Track public event
        fetch('/api/v1/events/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'shared_plan_viewed',
            metadata: { plan_token: token },
          }),
        }).catch(() => { /* fire and forget */ });
      })
      .catch(() => {
        setError('This plan link is no longer available.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={loadingStyle}>Loading plan...</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={headerStyle}>
            <h1 style={logoStyle}>GroceryHack</h1>
          </div>
          <div style={errorBoxStyle}>
            <p>{error || 'Plan not found.'}</p>
          </div>
          <div style={ctaStyle}>
            <p style={{ ...sharedByStyle, marginBottom: '16px' }}>
              Want personalized meal deals and shopping plans?
            </p>
            <a href="/register" style={ctaButtonStyle}>
              Sign Up Free
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={logoStyle}>GroceryHack</h1>
          {plan.senderName && (
            <p style={sharedByStyle}>{plan.senderName} shared their shopping plan</p>
          )}
          <p style={weekStyle}>Week of {plan.weekOf}</p>
        </div>

        {plan.stops.map((stop, i) => (
          <div key={i} style={storeCardStyle}>
            <h2 style={storeNameStyle}>{stop.storeBrandName}</h2>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.storeAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={addressLinkStyle}
            >
              <MapPinIcon size={14} color={colors.primary} />
              {stop.storeAddress}
            </a>

            {stop.meals.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={sectionLabelStyle}>Meals</p>
                {stop.meals.map((meal, j) => (
                  <div key={j} style={itemRowStyle}>
                    <span style={{ color: colors.text }}>{meal.name}</span>
                    <span style={{ fontFamily: fonts.heading, fontWeight: fontWeights.semibold, color: colors.primary }}>
                      {formatPrice(meal.costPerServing)}/serving
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p style={sectionLabelStyle}>Shopping List</p>
              {stop.items.map((item, j) => (
                <div key={j} style={itemRowStyle}>
                  <span>
                    {item.quantity} {item.name}
                    {item.isOnSale && <span style={saleBadgeStyle}>On Sale</span>}
                  </span>
                  {item.salePrice !== null && (
                    <span style={{ fontFamily: fonts.heading, fontWeight: fontWeights.semibold, color: colors.primary }}>
                      {formatPrice(item.salePrice)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ ...totalRowStyle, borderTop: `2px solid ${colors.border}`, marginTop: '8px' }}>
              <span style={{ color: colors.textMuted }}>Store Total</span>
              <span style={{ color: colors.primary }}>{formatPrice(stop.subtotal)}</span>
            </div>
          </div>
        ))}

        <div style={{ ...storeCardStyle, textAlign: 'center' }}>
          <div style={totalRowStyle}>
            <span>Total</span>
            <span style={{ color: colors.primary, fontSize: '1.3rem' }}>{formatPrice(plan.total)}</span>
          </div>
          {plan.estimatedSavings > 0 && (
            <div style={{ marginTop: '8px' }}>
              <span style={savingsBadgeStyle}>
                <CheckIcon size={16} color={colors.greenBadgeText} />
                Saving {formatPrice(plan.estimatedSavings)} this week
              </span>
            </div>
          )}
        </div>

        <div style={ctaStyle}>
          <p style={{ ...sharedByStyle, marginBottom: '16px' }}>
            Want your own personalized meal deals?
          </p>
          <a href="/register" style={ctaButtonStyle}>
            Sign Up Free
          </a>
        </div>
      </div>
    </div>
  );
}
