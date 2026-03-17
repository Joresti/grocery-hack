import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────
// Mock dependencies
// ────────────────────────────────────────────────────────────

vi.mock('../db/queries/admin.js', () => ({
  getAggregateMetrics: vi.fn(),
  getPerUserMetrics: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import { getTrialMetrics, calculateEngagementScore } from './admin.js';
import * as adminQueries from '../db/queries/admin.js';
import type { AggregateMetrics, PerUserData } from '../db/queries/admin.js';

// ────────────────────────────────────────────────────────────
// Test data factories
// ────────────────────────────────────────────────────────────

function makeAggregateMetrics(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return {
    totalUsers: 10,
    registrations: 10,
    onboardingCompletions: 8,
    emailsSent: 50,
    emailsOpened: 25,
    emailsClicked: 10,
    emailUnsubscribes: 2,
    emailBreakdown: [
      { emailType: 'welcome', sent: 10, opened: 8, clicked: 3 },
      { emailType: 'weekly_plan', sent: 40, opened: 17, clicked: 7 },
    ],
    week1Users: 10,
    week2Returners: 6,
    totalSessions: 50,
    avgSessionDurationSeconds: 120.5,
    usersWhoSwiped: 7,
    avgMealsSwipedPerSession: 5.3,
    avgSwipeRightRatio: 0.65,
    usersWhoViewedRecipe: 5,
    avgRecipeViewDurationSeconds: 30.2,
    usersWhoViewedShoppingList: 6,
    usersWhoTappedStoreAddress: 4,
    usersWhoRevisitedPlan: 3,
    usersWhoRanOptimizer: 2,
    usersWhoShared: 3,
    totalMealShares: 5,
    totalPlanShares: 2,
    shareLinksOpened: 4,
    shareSignups: 1,
    totalCookForMe: 4,
    acceptedCookForMe: 2,
    usersWhoHeartedDeal: 5,
    usersWhoCreatedRecipe: 2,
    usersWhoPublishedRecipe: 1,
    usersWhoUsedFeelingLucky: 3,
    usersWhoSubmittedFlyerRequest: 1,
    usersWhoAddedImportantItems: 6,
    lastScraperRun: '2026-03-11T22:00:00.000Z',
    lastPlannerRun: '2026-03-12T06:00:00.000Z',
    plannerUsersProcessed: 8,
    plannerUsersSkipped: 2,
    claudeSpendThisMonth: 3.45,
    ...overrides,
  };
}

function makePerUserData(overrides: Partial<PerUserData> = {}): PerUserData {
  return {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    displayName: 'Test User',
    email: 'test@example.com',
    signedUp: '2026-03-01T10:00:00.000Z',
    lastActive: '2026-03-12T15:00:00.000Z',
    totalSessions: 5,
    totalSwipes: 20,
    rightSwipes: 12,
    avgSwipeSessionDurationSeconds: 45.5,
    viewedShoppingList: true,
    tappedStoreAddress: true,
    sharedAnything: true,
    totalCookForMeSent: 3,
    cookForMeAccepted: 1,
    returnedWeek2: true,
    completedOnboarding: true,
    recipesCreated: 1,
    dealsHearted: 3,
    importantItemsCount: 5,
    optimizerRuns: 1,
    flyerRequestsSubmitted: 0,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// calculateEngagementScore
// ────────────────────────────────────────────────────────────

describe('calculateEngagementScore', () => {
  it('returns 0 for a user with no activity', () => {
    const user = makePerUserData({
      completedOnboarding: false,
      totalSwipes: 0,
      viewedShoppingList: false,
      tappedStoreAddress: false,
      sharedAnything: false,
      returnedWeek2: false,
      recipesCreated: 0,
      dealsHearted: 0,
      importantItemsCount: 0,
      optimizerRuns: 0,
    });

    expect(calculateEngagementScore(user)).toBe(0);
  });

  it('returns 100 for a fully engaged user', () => {
    const user = makePerUserData({
      completedOnboarding: true,   // +10
      totalSwipes: 15,             // +10 (any) + 5 (>10)
      viewedShoppingList: true,    // +15
      tappedStoreAddress: true,    // +10
      sharedAnything: true,        // +15
      returnedWeek2: true,         // +15
      recipesCreated: 1,           // +5
      dealsHearted: 1,             // +5
      importantItemsCount: 1,      // +5
      optimizerRuns: 1,            // +5
    });

    expect(calculateEngagementScore(user)).toBe(100);
  });

  it('caps at 100 even if all criteria exceeded', () => {
    const user = makePerUserData({
      completedOnboarding: true,
      totalSwipes: 100,
      viewedShoppingList: true,
      tappedStoreAddress: true,
      sharedAnything: true,
      returnedWeek2: true,
      recipesCreated: 5,
      dealsHearted: 10,
      importantItemsCount: 20,
      optimizerRuns: 3,
    });

    expect(calculateEngagementScore(user)).toBe(100);
  });

  it('calculates partial score correctly', () => {
    const user = makePerUserData({
      completedOnboarding: true,   // +10
      totalSwipes: 5,              // +10 (any), not >10
      viewedShoppingList: false,   // 0
      tappedStoreAddress: false,   // 0
      sharedAnything: false,       // 0
      returnedWeek2: false,        // 0
      recipesCreated: 0,           // 0
      dealsHearted: 0,             // 0
      importantItemsCount: 0,      // 0
      optimizerRuns: 0,            // 0
    });

    expect(calculateEngagementScore(user)).toBe(20);
  });

  it('gives +5 bonus for >10 swipes in addition to base +10', () => {
    const user = makePerUserData({
      completedOnboarding: false,
      totalSwipes: 11,
      viewedShoppingList: false,
      tappedStoreAddress: false,
      sharedAnything: false,
      returnedWeek2: false,
      recipesCreated: 0,
      dealsHearted: 0,
      importantItemsCount: 0,
      optimizerRuns: 0,
    });

    expect(calculateEngagementScore(user)).toBe(15);
  });
});

// ────────────────────────────────────────────────────────────
// getTrialMetrics — rate calculations
// ────────────────────────────────────────────────────────────

describe('getTrialMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates rates correctly', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics());
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([makePerUserData()]);

    const result = await getTrialMetrics();

    // Onboarding: 8/10 = 0.8
    expect(result.onboardingCompletionRate).toBe(0.8);
    // Email open: 25/50 = 0.5
    expect(result.emailOpenRate).toBe(0.5);
    // Email click: 10/50 = 0.2
    expect(result.emailClickRate).toBe(0.2);
    // Email unsub: 2/50 = 0.04
    expect(result.emailUnsubscribeRate).toBe(0.04);
    // Week 2 return: 6/10 = 0.6
    expect(result.week2ReturnRate).toBe(0.6);
    // Avg sessions per user: 50/10 = 5
    expect(result.avgSessionsPerUser).toBe(5);
    // Swipe to store: 4/7
    expect(result.swipeToStoreRate).toBeCloseTo(0.5714, 3);
    // Share accept: 2/4 = 0.5
    expect(result.shareAcceptRate).toBe(0.5);
    // Viral coefficient: 1/7
    expect(result.viralCoefficient).toBeCloseTo(0.1429, 3);
  });

  it('handles division by zero for all rates', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics({
      registrations: 0,
      totalUsers: 0,
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      emailUnsubscribes: 0,
      week1Users: 0,
      week2Returners: 0,
      totalSessions: 0,
      usersWhoSwiped: 0,
      usersWhoTappedStoreAddress: 0,
      totalCookForMe: 0,
      acceptedCookForMe: 0,
      totalMealShares: 0,
      totalPlanShares: 0,
      shareSignups: 0,
    }));
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([]);

    const result = await getTrialMetrics();

    expect(result.onboardingCompletionRate).toBe(0);
    expect(result.emailOpenRate).toBe(0);
    expect(result.emailClickRate).toBe(0);
    expect(result.emailUnsubscribeRate).toBe(0);
    expect(result.week2ReturnRate).toBe(0);
    expect(result.avgSessionsPerUser).toBe(0);
    expect(result.swipeToStoreRate).toBe(0);
    expect(result.shareAcceptRate).toBe(0);
    expect(result.viralCoefficient).toBe(0);
  });

  it('calculates email breakdown with rates', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics({
      emailBreakdown: [
        { emailType: 'welcome', sent: 10, opened: 8, clicked: 3 },
        { emailType: 'weekly_plan', sent: 0, opened: 0, clicked: 0 },
      ],
    }));
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([]);

    const result = await getTrialMetrics();

    expect(result.emailBreakdown).toHaveLength(2);

    const welcome = result.emailBreakdown[0];
    expect(welcome).toBeDefined();
    expect(welcome!.emailType).toBe('welcome');
    expect(welcome!.openRate).toBe(0.8);
    expect(welcome!.clickRate).toBe(0.3);

    const plan = result.emailBreakdown[1];
    expect(plan).toBeDefined();
    expect(plan!.emailType).toBe('weekly_plan');
    expect(plan!.openRate).toBe(0);
    expect(plan!.clickRate).toBe(0);
  });

  it('handles null pipeline health (no runs yet)', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics({
      lastScraperRun: null,
      lastPlannerRun: null,
      plannerUsersProcessed: 0,
      plannerUsersSkipped: 0,
    }));
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([]);

    const result = await getTrialMetrics();

    expect(result.lastScraperRun).toBeNull();
    expect(result.lastPlannerRun).toBeNull();
    expect(result.plannerUsersProcessed).toBe(0);
    expect(result.plannerUsersSkipped).toBe(0);
  });

  it('assembles per-user metrics with engagement scores', async () => {
    const activeUser = makePerUserData({
      userId: 'user-1',
      totalSwipes: 15,
      completedOnboarding: true,
      viewedShoppingList: true,
      tappedStoreAddress: true,
      sharedAnything: true,
      returnedWeek2: true,
      recipesCreated: 1,
      dealsHearted: 1,
      importantItemsCount: 1,
      optimizerRuns: 1,
    });

    const inactiveUser = makePerUserData({
      userId: 'user-2',
      totalSwipes: 0,
      rightSwipes: 0,
      completedOnboarding: false,
      viewedShoppingList: false,
      tappedStoreAddress: false,
      sharedAnything: false,
      returnedWeek2: false,
      recipesCreated: 0,
      dealsHearted: 0,
      importantItemsCount: 0,
      optimizerRuns: 0,
      totalCookForMeSent: 0,
      cookForMeAccepted: 0,
    });

    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics());
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([activeUser, inactiveUser]);

    const result = await getTrialMetrics();

    expect(result.users).toHaveLength(2);

    const active = result.users[0];
    expect(active).toBeDefined();
    expect(active!.engagementScore).toBe(100);
    expect(active!.userId).toBe('user-1');

    const inactive = result.users[1];
    expect(inactive).toBeDefined();
    expect(inactive!.engagementScore).toBe(0);
    expect(inactive!.userId).toBe('user-2');
  });

  it('computes per-user swipe right ratio correctly', async () => {
    const user = makePerUserData({
      totalSwipes: 20,
      rightSwipes: 12,
    });

    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics());
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([user]);

    const result = await getTrialMetrics();
    const userMetrics = result.users[0];
    expect(userMetrics).toBeDefined();
    // 12/20 = 0.6
    expect(userMetrics!.swipeRightRatio).toBe(0.6);
  });

  it('returns null share accept rate when user has no cook_for_me shares', async () => {
    const user = makePerUserData({
      totalCookForMeSent: 0,
      cookForMeAccepted: 0,
    });

    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics());
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([user]);

    const result = await getTrialMetrics();
    const userMetrics = result.users[0];
    expect(userMetrics).toBeDefined();
    expect(userMetrics!.shareAcceptRate).toBeNull();
  });

  it('returns numeric share accept rate when user has cook_for_me shares', async () => {
    const user = makePerUserData({
      totalCookForMeSent: 4,
      cookForMeAccepted: 1,
    });

    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics());
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([user]);

    const result = await getTrialMetrics();
    const userMetrics = result.users[0];
    expect(userMetrics).toBeDefined();
    expect(userMetrics!.shareAcceptRate).toBe(0.25);
  });

  it('passes through pipeline and claude spend data', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics({
      claudeSpendThisMonth: 12.34,
      plannerUsersProcessed: 15,
      plannerUsersSkipped: 3,
    }));
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([]);

    const result = await getTrialMetrics();

    expect(result.claudeSpendThisMonth).toBe(12.34);
    expect(result.plannerUsersProcessed).toBe(15);
    expect(result.plannerUsersSkipped).toBe(3);
  });

  it('rounds avgSessionDurationSeconds to 2 decimal places', async () => {
    vi.mocked(adminQueries.getAggregateMetrics).mockResolvedValue(makeAggregateMetrics({
      avgSessionDurationSeconds: 120.5678,
    }));
    vi.mocked(adminQueries.getPerUserMetrics).mockResolvedValue([]);

    const result = await getTrialMetrics();

    expect(result.avgSessionDurationSeconds).toBe(120.57);
  });
});
