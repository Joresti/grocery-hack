import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFamilyPlan } from '../hooks/useFamilyPlan';
import { StoreMealDealList } from '../components/StoreMealDealList';
import { SuggestSwapModal } from '../modals/SuggestSwapModal';
import { PendingSuggestionModal } from '../modals/PendingSuggestionModal';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { Toast } from '../components/shared';
import { ApiError } from '../services/api';
import { colors, fonts, fontWeights, radii, spacing } from '../theme/tokens';
import type { PlanMeal, MealSuggestion } from '@groceryhack/shared/types';

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  minHeight: '100vh',
  fontFamily: fonts.body,
};

const containerStyle: React.CSSProperties = {
  maxWidth: spacing.containerMaxWidth,
  margin: '0 auto',
  padding: `28px ${spacing.containerPadding} 80px`,
};

const rolePillStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: fonts.body,
  fontWeight: fontWeights.semibold,
  fontSize: '0.78rem',
  color: colors.primary,
  backgroundColor: colors.primaryLight,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.pill,
  padding: '4px 14px',
  marginBottom: '16px',
  letterSpacing: '0.3px',
};

const bannerStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  padding: '16px 20px',
  marginBottom: '24px',
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  lineHeight: 1.5,
};

const errorCardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  borderRadius: radii.card,
  padding: '40px 32px',
  textAlign: 'center',
  maxWidth: '480px',
  margin: '60px auto',
};

const errorHeadingStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: fontWeights.bold,
  fontSize: '1.2rem',
  color: colors.text,
  marginBottom: '12px',
};

const errorBodyStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: fontWeights.regular,
  fontSize: '0.9rem',
  color: colors.textMuted,
  lineHeight: 1.5,
};

// ────────────────────────────────────────────────────────────
// Error states
// ────────────────────────────────────────────────────────────

function NotAFamilyMemberError(): React.ReactElement {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={errorCardStyle}>
          <p style={errorHeadingStyle}>Not a family member</p>
          <p style={errorBodyStyle}>
            This view is for family members linked to an account holder. Your account isn't linked to anyone's plan.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoPlanError({ holderName }: { holderName: string }): React.ReactElement {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={errorCardStyle}>
          <p style={errorHeadingStyle}>No plan yet</p>
          <p style={errorBodyStyle}>
            {holderName} hasn't generated a meal plan for this week yet. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}

function GenericError(): React.ReactElement {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={errorCardStyle}>
          <p style={errorHeadingStyle}>Something went wrong</p>
          <p style={errorBodyStyle}>
            Couldn't load the meal plan. Please refresh and try again.
          </p>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// FamilyPlanPage
// ────────────────────────────────────────────────────────────

export default function FamilyPlanPage(): React.ReactElement {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useFamilyPlan();
  const [storeLimit, setStoreLimit] = useState<1 | 2>(1);
  const [suggestingFor, setSuggestingFor] = useState<PlanMeal | null>(null);
  const [viewingSuggestion, setViewingSuggestion] = useState<MealSuggestion | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);

  // mealIds in the holder's plan that already have a pending suggestion from me.
  const pendingSuggestionMealIds = useMemo(
    () => new Set((data?.pendingSuggestions ?? []).map((s) => s.targetMealId)),
    [data],
  );

  // targetMealId → my pending suggestion, so tapping a "pending" marker can reveal it.
  const suggestionByMealId = useMemo(
    () => new Map((data?.pendingSuggestions ?? []).map((s) => [s.targetMealId, s])),
    [data],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (error && error instanceof ApiError && error.status === 401) {
      logout();
      navigate('/login');
    }
  }, [error, logout, navigate]);

  if (!isAuthenticated) {
    return <></>;
  }

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.code : null;
    if (code === 'NOT_A_FAMILY_MEMBER') return <NotAFamilyMemberError />;
    if (code === 'NO_PLAN') {
      return <NoPlanError holderName="your account holder" />;
    }
    return <GenericError />;
  }

  if (!data) return <></>;

  const holderName = data.holderDisplayName ?? 'your account holder';

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <span style={rolePillStyle}>Family member</span>
        <div style={bannerStyle}>
          Same plan {holderName} sees. You can suggest a swap on any meal — only {holderName} can change the plan directly.
        </div>
        <StoreMealDealList
          plan={data.plan}
          onStoreLimitChange={setStoreLimit}
          storeLimit={storeLimit}
          onSuggestSwap={(meal) => setSuggestingFor(meal)}
          pendingSuggestionMealIds={pendingSuggestionMealIds}
          onViewPendingSuggestion={(meal) =>
            setViewingSuggestion(suggestionByMealId.get(meal.mealId) ?? null)
          }
        />
      </div>

      {suggestingFor && (
        <SuggestSwapModal
          isOpen={true}
          targetMeal={suggestingFor}
          onClose={() => setSuggestingFor(null)}
          onSubmitted={() => {
            setSuggestingFor(null);
            setSuccessVisible(true);
          }}
        />
      )}

      {viewingSuggestion && (
        <PendingSuggestionModal
          isOpen={true}
          suggestion={viewingSuggestion}
          holderName={holderName}
          onClose={() => setViewingSuggestion(null)}
        />
      )}

      <Toast
        message="Suggestion sent!"
        type="success"
        visible={successVisible}
        onDismiss={() => setSuccessVisible(false)}
      />
    </div>
  );
}
