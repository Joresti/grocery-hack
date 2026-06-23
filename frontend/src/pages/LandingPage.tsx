import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Meal } from '@groceryhack/shared/types';
import { colors, fonts, spacing } from '../theme/tokens';
import { useLandingData } from '../hooks/useLandingData';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';
import { Header } from '../components/Header';
import { DealAlertBanner } from '../components/DealAlertBanner';
import { RecipesOnSale } from '../components/RecipesOnSale';
import { LikedMealsPreview } from '../components/LikedMealsPreview';
import { DreamMealMatching } from '../components/DreamMealMatching';
import { StoreMealDealList } from '../components/StoreMealDealList';
import { NotableDeals } from '../components/NotableDeals';
import { FeelingLuckyButton } from '../components/FeelingLuckyButton';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { RecipeModal } from '../modals/RecipeModal';
import { SwipeMode } from '../modals/SwipeMode';
import { FeelingLuckyModal } from '../modals/FeelingLuckyModal';
import { LikedMealsModal } from '../modals/LikedMealsModal';
import { OptimizerModal } from '../modals/OptimizerModal';
import { ImportantItemsModal } from '../modals/ImportantItemsModal';
import { ShareContactModal } from '../modals/ShareContactModal';
import { ReviewSuggestionsModal } from '../modals/ReviewSuggestionsModal';

const pageStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  minHeight: '100vh',
  fontFamily: fonts.body,
};

const containerStyle: React.CSSProperties = {
  maxWidth: spacing.containerMaxWidth,
  margin: '0 auto',
  padding: `0 ${spacing.containerPadding}`,
  paddingBottom: '80px',
};

const errorStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 24px',
  color: colors.textMuted,
  fontFamily: fonts.body,
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'center',
  padding: '20px 0',
  flexWrap: 'wrap',
};

const viewShoppingListButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 600,
  fontSize: '0.95rem',
  color: colors.primary,
  backgroundColor: colors.white,
  border: `1.5px solid ${colors.border}`,
  borderRadius: '99px',
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  transition: 'all 0.2s ease',
};

const sharePlanButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 600,
  fontSize: '0.95rem',
  color: colors.primary,
  backgroundColor: colors.white,
  border: `1.5px solid ${colors.border}`,
  borderRadius: '99px',
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  transition: 'all 0.2s ease',
};

const optimizeButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 600,
  fontSize: '0.95rem',
  color: colors.white,
  backgroundColor: colors.primary,
  border: 'none',
  borderRadius: '99px',
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  transition: 'all 0.2s ease',
};

const importantItemsButtonStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 600,
  fontSize: '0.95rem',
  color: colors.primary,
  backgroundColor: colors.white,
  border: `1.5px solid ${colors.border}`,
  borderRadius: '99px',
  padding: '12px 28px',
  cursor: 'pointer',
  minHeight: spacing.touchTargetMin,
  transition: 'all 0.2s ease',
};

export default function LandingPage(): React.ReactElement {
  const { data, isLoading, error } = useLandingData();
  const { isAuthenticated, logout, setUser } = useAuth();
  const navigate = useNavigate();

  // Hydrate user from landing response
  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    }
  }, [data?.user, setUser]);

  // Auto-redirect to login on 401
  useEffect(() => {
    if (error && error instanceof ApiError && error.status === 401) {
      logout();
      navigate('/login');
    }
  }, [error, logout, navigate]);

  // Modal state
  const [recipeModalMeal, setRecipeModalMeal] = useState<Meal | null>(null);
  const [swipeModeOpen, setSwipeModeOpen] = useState(false);
  const [feelingLuckyOpen, setFeelingLuckyOpen] = useState(false);
  const [likedMealsOpen, setLikedMealsOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [importantItemsOpen, setImportantItemsOpen] = useState(false);
  const [reviewSuggestionsOpen, setReviewSuggestionsOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareContext, setShareContext] = useState<{
    mealId?: string;
    planToken?: string;
    shareType?: 'cook_for_me' | 'make_for_you';
  }>({});
  const [storeLimit, setStoreLimit] = useState<1 | 2>(2);

  const handleMealTap = useCallback((meal: Meal) => {
    setRecipeModalMeal(meal);
  }, []);

  const handleSharePlan = useCallback(() => {
    if (data?.currentPlan) {
      setShareContext({ planToken: data.currentPlan.token });
      setShareModalOpen(true);
    }
  }, [data?.currentPlan]);

  const handleScrollToShoppingPlan = useCallback((): void => {
    document.getElementById('shopping-plan')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (!isAuthenticated) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={errorStyle}>
            <h1 style={{ fontFamily: fonts.heading, color: colors.primary, marginBottom: '12px' }}>
              GroceryHack
            </h1>
            <p>Sign in to see your personalized meal deals and shopping plan.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <LoadingSpinner fullPage />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={errorStyle}>
            <p>Something went wrong loading your data.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                fontFamily: fonts.body,
                fontWeight: 600,
                color: colors.white,
                backgroundColor: colors.primary,
                border: 'none',
                borderRadius: '99px',
                padding: '12px 28px',
                cursor: 'pointer',
                marginTop: '16px',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Header
        savingsThisWeek={
          data.currentPlan
            ? (storeLimit === 2 && data.currentPlan.twoStoreOptimized
                ? data.currentPlan.twoStoreOptimized.estimatedSavings
                : data.currentPlan.oneStoreOptimized.estimatedSavings)
            : data.savingsThisWeek
        }
        savingsYtd={data.savingsYtd}
      />

      <div className="gh-page-container" style={containerStyle}>

        {/* Action bar — sits right below header, above all content */}
        <div className="gh-actions-row" style={actionsRowStyle}>
          <button
            type="button"
            style={optimizeButtonStyle}
            onClick={() => setOptimizerOpen(true)}
          >
            Optimize My Plan
          </button>
          <FeelingLuckyButton onClick={() => setFeelingLuckyOpen(true)} />
          <button
            type="button"
            style={viewShoppingListButtonStyle}
            onClick={handleScrollToShoppingPlan}
          >
            View Shopping List
          </button>
          <button
            type="button"
            style={importantItemsButtonStyle}
            onClick={() => setImportantItemsOpen(true)}
          >
            My Staples
          </button>
          {data.pendingSuggestionCount > 0 && (
            <button
              type="button"
              style={importantItemsButtonStyle}
              onClick={() => setReviewSuggestionsOpen(true)}
            >
              Suggestions ({data.pendingSuggestionCount})
            </button>
          )}
        </div>

        <DealAlertBanner alerts={data.watchlistAlerts} />

        <RecipesOnSale
          alerts={data.recipeAlerts}
          onRecipeTap={(alert) => {
            // RecipeAlert doesn't have full meal data, so we just track the tap
            // In a full implementation, this would fetch the recipe and open the modal
          }}
        />

        <DreamMealMatching
          meals={data.swipeableMeals}
          onEnterSwipeMode={() => setSwipeModeOpen(true)}
          onMealTap={handleMealTap}
        />

        <LikedMealsPreview
          meals={data.likedMealsPreview}
          onViewAll={() => setLikedMealsOpen(true)}
          onMealTap={handleMealTap}
        />

        {data.currentPlan && (
          <div id="shopping-plan">
            <StoreMealDealList
              plan={data.currentPlan}
              storeLimit={storeLimit}
              onStoreLimitChange={setStoreLimit}
            />
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
              <button
                type="button"
                style={sharePlanButtonStyle}
                onClick={handleSharePlan}
              >
                Share Plan
              </button>
            </div>
          </div>
        )}

        <NotableDeals deals={data.notableDeals} />
      </div>

      {/* Modals */}
      <RecipeModal
        isOpen={recipeModalMeal !== null}
        onClose={() => setRecipeModalMeal(null)}
        meal={recipeModalMeal}
      />

      <SwipeMode
        isOpen={swipeModeOpen}
        onClose={() => setSwipeModeOpen(false)}
        meals={data.swipeableMeals}
      />

      <FeelingLuckyModal
        isOpen={feelingLuckyOpen}
        onClose={() => setFeelingLuckyOpen(false)}
        meals={data.swipeableMeals}
        householdNames={data.user.householdNames}
      />

      <LikedMealsModal
        isOpen={likedMealsOpen}
        onClose={() => setLikedMealsOpen(false)}
        onMealTap={(meal) => {
          setLikedMealsOpen(false);
          setRecipeModalMeal(meal);
        }}
      />

      <OptimizerModal
        isOpen={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      />

      <ImportantItemsModal
        isOpen={importantItemsOpen}
        onClose={() => setImportantItemsOpen(false)}
      />

      <ReviewSuggestionsModal
        isOpen={reviewSuggestionsOpen}
        onClose={() => setReviewSuggestionsOpen(false)}
        holderName={data.user.displayName ?? 'you'}
      />

      <ShareContactModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareContext({});
        }}
        mealId={shareContext.mealId}
        shareType={shareContext.shareType}
        planToken={shareContext.planToken}
      />
    </div>
  );
}
