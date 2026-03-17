import type { TrialMetrics, TrialUserMetrics, EmailType } from '@groceryhack/shared/types.js';
import * as adminQueries from '../db/queries/admin.js';
import type { PerUserData } from '../db/queries/admin.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

export function calculateEngagementScore(metrics: PerUserData): number {
  let score = 0;
  // Completed onboarding: +10
  if (metrics.completedOnboarding) score += 10;
  // Swiped any meals: +10
  if (metrics.totalSwipes > 0) score += 10;
  // Swiped > 10 meals: +5
  if (metrics.totalSwipes > 10) score += 5;
  // Viewed shopping list: +15
  if (metrics.viewedShoppingList) score += 15;
  // Tapped store address: +10
  if (metrics.tappedStoreAddress) score += 10;
  // Shared anything: +15
  if (metrics.sharedAnything) score += 15;
  // Returned week 2: +15
  if (metrics.returnedWeek2) score += 15;
  // Created recipe: +5
  if (metrics.recipesCreated > 0) score += 5;
  // Hearted deal: +5
  if (metrics.dealsHearted > 0) score += 5;
  // Added important items: +5
  if (metrics.importantItemsCount > 0) score += 5;
  // Ran optimizer: +5
  if (metrics.optimizerRuns > 0) score += 5;
  return Math.min(score, 100);
}

function mapUserMetrics(userData: PerUserData): TrialUserMetrics {
  const swipeRightRatio = safeRate(userData.rightSwipes, userData.totalSwipes);
  const shareAcceptRate = userData.totalCookForMeSent > 0
    ? safeRate(userData.cookForMeAccepted, userData.totalCookForMeSent)
    : null;

  return {
    userId: userData.userId,
    displayName: userData.displayName,
    email: userData.email,
    signedUp: userData.signedUp,
    lastActive: userData.lastActive,
    totalSessions: userData.totalSessions,
    totalSwipes: userData.totalSwipes,
    swipeRightRatio,
    avgSwipeSessionDurationSeconds: Math.round(userData.avgSwipeSessionDurationSeconds * 100) / 100,
    viewedShoppingList: userData.viewedShoppingList,
    tappedStoreAddress: userData.tappedStoreAddress,
    sharedAnything: userData.sharedAnything,
    shareAcceptRate,
    returnedWeek2: userData.returnedWeek2,
    completedOnboarding: userData.completedOnboarding,
    recipesCreated: userData.recipesCreated,
    dealsHearted: userData.dealsHearted,
    importantItemsCount: userData.importantItemsCount,
    optimizerRuns: userData.optimizerRuns,
    flyerRequestsSubmitted: userData.flyerRequestsSubmitted,
    engagementScore: calculateEngagementScore(userData),
  };
}

// ────────────────────────────────────────────────────────────
// Main service function
// ────────────────────────────────────────────────────────────

export async function getTrialMetrics(): Promise<TrialMetrics> {
  const [agg, perUserData] = await Promise.all([
    adminQueries.getAggregateMetrics(),
    adminQueries.getPerUserMetrics(),
  ]);

  const users = perUserData.map(mapUserMetrics);

  // Calculate rates
  const onboardingCompletionRate = safeRate(agg.onboardingCompletions, agg.registrations);
  const emailOpenRate = safeRate(agg.emailsOpened, agg.emailsSent);
  const emailClickRate = safeRate(agg.emailsClicked, agg.emailsSent);
  const emailUnsubscribeRate = safeRate(agg.emailUnsubscribes, agg.emailsSent);
  const week2ReturnRate = safeRate(agg.week2Returners, agg.week1Users);
  const avgSessionsPerUser = agg.totalUsers > 0
    ? Math.round((agg.totalSessions / agg.totalUsers) * 100) / 100
    : 0;
  const swipeToStoreRate = safeRate(agg.usersWhoTappedStoreAddress, agg.usersWhoSwiped);
  const shareAcceptRate = safeRate(agg.acceptedCookForMe, agg.totalCookForMe);
  const totalShares = agg.totalMealShares + agg.totalPlanShares;
  const viralCoefficient = safeRate(agg.shareSignups, totalShares);

  // Email breakdown with rates
  const emailBreakdown = agg.emailBreakdown.map((item) => ({
    emailType: item.emailType as EmailType,
    sent: item.sent,
    opened: item.opened,
    openRate: safeRate(item.opened, item.sent),
    clicked: item.clicked,
    clickRate: safeRate(item.clicked, item.sent),
  }));

  return {
    totalUsers: agg.totalUsers,
    registrations: agg.registrations,
    onboardingCompletions: agg.onboardingCompletions,
    onboardingCompletionRate,
    emailsSent: agg.emailsSent,
    emailsOpened: agg.emailsOpened,
    emailOpenRate,
    emailsClicked: agg.emailsClicked,
    emailClickRate,
    emailUnsubscribes: agg.emailUnsubscribes,
    emailUnsubscribeRate,
    emailBreakdown,
    week1Users: agg.week1Users,
    week2Returners: agg.week2Returners,
    week2ReturnRate,
    avgSessionsPerUser,
    avgSessionDurationSeconds: Math.round(agg.avgSessionDurationSeconds * 100) / 100,
    usersWhoSwiped: agg.usersWhoSwiped,
    avgMealsSwipedPerSession: Math.round(agg.avgMealsSwipedPerSession * 100) / 100,
    avgSwipeRightRatio: Math.round(agg.avgSwipeRightRatio * 10000) / 10000,
    usersWhoViewedRecipe: agg.usersWhoViewedRecipe,
    avgRecipeViewDurationSeconds: Math.round(agg.avgRecipeViewDurationSeconds * 100) / 100,
    usersWhoViewedShoppingList: agg.usersWhoViewedShoppingList,
    usersWhoTappedStoreAddress: agg.usersWhoTappedStoreAddress,
    swipeToStoreRate,
    usersWhoRevisitedPlan: agg.usersWhoRevisitedPlan,
    usersWhoRanOptimizer: agg.usersWhoRanOptimizer,
    usersWhoShared: agg.usersWhoShared,
    totalMealShares: agg.totalMealShares,
    totalPlanShares: agg.totalPlanShares,
    shareAcceptRate,
    shareLinksOpened: agg.shareLinksOpened,
    shareSignups: agg.shareSignups,
    viralCoefficient,
    usersWhoHeartedDeal: agg.usersWhoHeartedDeal,
    usersWhoCreatedRecipe: agg.usersWhoCreatedRecipe,
    usersWhoPublishedRecipe: agg.usersWhoPublishedRecipe,
    usersWhoUsedFeelingLucky: agg.usersWhoUsedFeelingLucky,
    usersWhoSubmittedFlyerRequest: agg.usersWhoSubmittedFlyerRequest,
    usersWhoAddedImportantItems: agg.usersWhoAddedImportantItems,
    lastScraperRun: agg.lastScraperRun,
    lastPlannerRun: agg.lastPlannerRun,
    plannerUsersProcessed: agg.plannerUsersProcessed,
    plannerUsersSkipped: agg.plannerUsersSkipped,
    claudeSpendThisMonth: agg.claudeSpendThisMonth,
    users,
  };
}
