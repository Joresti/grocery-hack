import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Raw row types for query results
// ────────────────────────────────────────────────────────────

interface CountRow {
  count: string;
}

interface EmailAggRow {
  sent: string;
  opened: string;
  clicked: string;
  unsubscribes: string;
}

interface EmailBreakdownRow {
  email_type: string;
  sent: string;
  opened: string;
  clicked: string;
}

interface SessionAggRow {
  total_sessions: string;
  avg_duration: string | null;
}

interface SwipeAggRow {
  users_who_swiped: string;
  avg_per_session: string | null;
  avg_right_ratio: string | null;
}

interface RecipeViewAggRow {
  users_who_viewed: string;
  avg_duration: string | null;
}

interface ShareAggRow {
  users_who_shared: string;
  total_meal_shares: string;
  total_plan_shares: string;
  share_links_opened: string;
  share_signups: string;
}

interface CookForMeRow {
  total_cook: string;
  accepted_cook: string;
}

interface PipelineScraperRow {
  brands: string | null;
  created_at: string;
}

interface PipelinePlannerRow {
  processed: string | null;
  skipped: string | null;
  created_at: string;
}

interface CostRow {
  total_cost: string;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string;
  signed_up: string;
}

interface UserEventCountRow {
  user_id: string;
  cnt: string;
}

interface UserSwipeRow {
  user_id: string;
  total_swipes: string;
  right_count: string;
}

interface UserSwipeSessionRow {
  user_id: string;
  avg_duration: string | null;
}

interface UserBoolEventRow {
  user_id: string;
}

interface UserLastActiveRow {
  user_id: string;
  last_active: string;
}

interface UserShareAcceptRow {
  user_id: string;
  total_sent: string;
  accepted: string;
}

// ────────────────────────────────────────────────────────────
// Aggregate metrics queries
// ────────────────────────────────────────────────────────────

export interface AggregateMetrics {
  totalUsers: number;
  registrations: number;
  onboardingCompletions: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailUnsubscribes: number;
  emailBreakdown: {
    emailType: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
  week1Users: number;
  week2Returners: number;
  totalSessions: number;
  avgSessionDurationSeconds: number;
  usersWhoSwiped: number;
  avgMealsSwipedPerSession: number;
  avgSwipeRightRatio: number;
  usersWhoViewedRecipe: number;
  avgRecipeViewDurationSeconds: number;
  usersWhoViewedShoppingList: number;
  usersWhoTappedStoreAddress: number;
  usersWhoRevisitedPlan: number;
  usersWhoRanOptimizer: number;
  usersWhoShared: number;
  totalMealShares: number;
  totalPlanShares: number;
  shareLinksOpened: number;
  shareSignups: number;
  totalCookForMe: number;
  acceptedCookForMe: number;
  usersWhoHeartedDeal: number;
  usersWhoCreatedRecipe: number;
  usersWhoPublishedRecipe: number;
  usersWhoUsedFeelingLucky: number;
  usersWhoSubmittedFlyerRequest: number;
  usersWhoAddedImportantItems: number;
  lastScraperRun: string | null;
  lastPlannerRun: string | null;
  plannerUsersProcessed: number;
  plannerUsersSkipped: number;
  claudeSpendThisMonth: number;
}

export async function getAggregateMetrics(): Promise<AggregateMetrics> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [
    usersResult,
    onboardingResult,
    emailAggResult,
    emailBreakdownResult,
    trialStartResult,
    sessionAggResult,
    swipeAggResult,
    recipeViewResult,
    shoppingListResult,
    storeAddressResult,
    revisitedPlanResult,
    optimizerResult,
    shareAggResult,
    cookForMeResult,
    heartedDealResult,
    createdRecipeResult,
    publishedRecipeResult,
    feelingLuckyResult,
    flyerRequestResult,
    importantItemsResult,
    scraperResult,
    plannerResult,
    claudeSpendResult,
  ] = await Promise.all([
    // Total users / registrations
    pool.query<CountRow>('SELECT COUNT(*) FROM users'),

    // Onboarding completions
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'onboarding_completed'`,
    ),

    // Email aggregates
    pool.query<EmailAggRow>(
      `SELECT
        COUNT(*) FILTER (WHERE event_type = 'email_sent') as sent,
        COUNT(*) FILTER (WHERE event_type = 'email_opened') as opened,
        COUNT(*) FILTER (WHERE event_type = 'email_clicked') as clicked,
        COUNT(*) FILTER (WHERE event_type = 'email_unsubscribed') as unsubscribes
      FROM events
      WHERE event_type IN ('email_sent', 'email_opened', 'email_clicked', 'email_unsubscribed')`,
    ),

    // Email breakdown by type
    pool.query<EmailBreakdownRow>(
      `SELECT
        metadata->>'email_type' as email_type,
        COUNT(*) FILTER (WHERE event_type = 'email_sent') as sent,
        COUNT(*) FILTER (WHERE event_type = 'email_opened') as opened,
        COUNT(*) FILTER (WHERE event_type = 'email_clicked') as clicked
      FROM events
      WHERE event_type IN ('email_sent', 'email_opened', 'email_clicked')
        AND metadata->>'email_type' IS NOT NULL
      GROUP BY metadata->>'email_type'`,
    ),

    // Trial start date (earliest user registration)
    pool.query<{ trial_start: string | null }>(
      `SELECT MIN(created_at) as trial_start FROM users`,
    ),

    // Session aggregates
    pool.query<SessionAggRow>(
      `SELECT
        COUNT(*) as total_sessions,
        AVG((metadata->>'duration_seconds')::numeric) as avg_duration
      FROM events
      WHERE event_type = 'session_end'`,
    ),

    // Swipe aggregates
    pool.query<SwipeAggRow>(
      `SELECT
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type IN ('meal_swiped_right', 'meal_swiped_left')) as users_who_swiped,
        (SELECT AVG((metadata->>'swipe_count')::numeric) FROM events WHERE event_type = 'swipe_mode_exited' AND metadata->>'swipe_count' IS NOT NULL) as avg_per_session,
        (SELECT
          CASE WHEN SUM(total) = 0 THEN 0
          ELSE SUM(rights)::numeric / SUM(total)::numeric
          END
        FROM (
          SELECT
            user_id,
            COUNT(*) FILTER (WHERE event_type = 'meal_swiped_right') as rights,
            COUNT(*) as total
          FROM events
          WHERE event_type IN ('meal_swiped_right', 'meal_swiped_left')
          GROUP BY user_id
        ) sub) as avg_right_ratio`,
    ),

    // Recipe modal views
    pool.query<RecipeViewAggRow>(
      `SELECT
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'recipe_modal_opened') as users_who_viewed,
        (SELECT AVG((metadata->>'duration_seconds')::numeric) FROM events WHERE event_type = 'recipe_modal_closed' AND metadata->>'duration_seconds' IS NOT NULL) as avg_duration`,
    ),

    // Shopping list views
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'shopping_list_viewed'`,
    ),

    // Store address taps
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'store_address_tapped'`,
    ),

    // Plan revisits
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'plan_revisited'`,
    ),

    // Optimizer runs
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'optimizer_run'`,
    ),

    // Share aggregates
    pool.query<ShareAggRow>(
      `SELECT
        (SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type IN ('share_meal_sent', 'share_plan_sent')) as users_who_shared,
        (SELECT COUNT(*) FROM events WHERE event_type = 'share_meal_sent') as total_meal_shares,
        (SELECT COUNT(*) FROM events WHERE event_type = 'share_plan_sent') as total_plan_shares,
        (SELECT COUNT(*) FROM events WHERE event_type = 'share_link_opened') as share_links_opened,
        (SELECT COUNT(*) FROM events WHERE event_type = 'share_recipient_signed_up') as share_signups`,
    ),

    // Cook-for-me accept rate from meal_shares table
    pool.query<CookForMeRow>(
      `SELECT
        COUNT(*) FILTER (WHERE share_type = 'cook_for_me') as total_cook,
        COUNT(*) FILTER (WHERE share_type = 'cook_for_me' AND status = 'accepted') as accepted_cook
      FROM meal_shares`,
    ),

    // Advanced: deal hearted
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'deal_hearted'`,
    ),

    // Advanced: recipe created
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'recipe_created'`,
    ),

    // Advanced: recipe published
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'recipe_published'`,
    ),

    // Advanced: feeling lucky
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'feeling_lucky_spun'`,
    ),

    // Advanced: flyer requests
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'flyer_request_submitted'`,
    ),

    // Advanced: important items
    pool.query<CountRow>(
      `SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type = 'important_item_added'`,
    ),

    // Pipeline: last scraper run
    pool.query<PipelineScraperRow>(
      `SELECT metadata->>'brands_scraped' as brands, created_at
      FROM events
      WHERE event_type = 'pipeline_scraper_completed'
      ORDER BY created_at DESC
      LIMIT 1`,
    ),

    // Pipeline: last planner run
    pool.query<PipelinePlannerRow>(
      `SELECT
        metadata->>'users_processed' as processed,
        metadata->>'users_skipped' as skipped,
        created_at
      FROM events
      WHERE event_type = 'pipeline_planner_completed'
      ORDER BY created_at DESC
      LIMIT 1`,
    ),

    // Claude spend this month
    pool.query<CostRow>(
      `SELECT COALESCE(SUM(estimated_cost), 0) as total_cost
      FROM usage_tracking
      WHERE service = 'claude' AND period = 'monthly' AND period_key = $1`,
      [monthKey],
    ),
  ]);

  // Parse trial start for week calculations
  const trialStart = trialStartResult.rows[0]?.trial_start
    ? new Date(trialStartResult.rows[0].trial_start)
    : null;

  let week1Users = 0;
  let week2Returners = 0;

  if (trialStart) {
    const day8 = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const day15 = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [week1Result, week2Result] = await Promise.all([
      // Week 1 users: signed up in first 7 days
      pool.query<CountRow>(
        `SELECT COUNT(*) FROM users WHERE created_at < $1`,
        [day8.toISOString()],
      ),
      // Week 2 returners: had session_start in days 8-14
      pool.query<CountRow>(
        `SELECT COUNT(DISTINCT user_id) FROM events
        WHERE event_type = 'session_start'
          AND created_at >= $1
          AND created_at < $2`,
        [day8.toISOString(), day15.toISOString()],
      ),
    ]);

    week1Users = Number(week1Result.rows[0]?.count ?? 0);
    week2Returners = Number(week2Result.rows[0]?.count ?? 0);
  }

  const totalUsers = Number(usersResult.rows[0]?.count ?? 0);
  const emailRow = emailAggResult.rows[0];
  const sessionRow = sessionAggResult.rows[0];
  const swipeRow = swipeAggResult.rows[0];
  const recipeViewRow = recipeViewResult.rows[0];
  const shareRow = shareAggResult.rows[0];
  const cookRow = cookForMeResult.rows[0];
  const scraperRow = scraperResult.rows[0];
  const plannerRow = plannerResult.rows[0];
  const claudeRow = claudeSpendResult.rows[0];

  return {
    totalUsers,
    registrations: totalUsers,
    onboardingCompletions: Number(onboardingResult.rows[0]?.count ?? 0),
    emailsSent: Number(emailRow?.sent ?? 0),
    emailsOpened: Number(emailRow?.opened ?? 0),
    emailsClicked: Number(emailRow?.clicked ?? 0),
    emailUnsubscribes: Number(emailRow?.unsubscribes ?? 0),
    emailBreakdown: emailBreakdownResult.rows.map((row) => ({
      emailType: row.email_type,
      sent: Number(row.sent),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
    })),
    week1Users,
    week2Returners,
    totalSessions: Number(sessionRow?.total_sessions ?? 0),
    avgSessionDurationSeconds: Number(sessionRow?.avg_duration ?? 0),
    usersWhoSwiped: Number(swipeRow?.users_who_swiped ?? 0),
    avgMealsSwipedPerSession: Number(swipeRow?.avg_per_session ?? 0),
    avgSwipeRightRatio: Number(swipeRow?.avg_right_ratio ?? 0),
    usersWhoViewedRecipe: Number(recipeViewRow?.users_who_viewed ?? 0),
    avgRecipeViewDurationSeconds: Number(recipeViewRow?.avg_duration ?? 0),
    usersWhoViewedShoppingList: Number(shoppingListResult.rows[0]?.count ?? 0),
    usersWhoTappedStoreAddress: Number(storeAddressResult.rows[0]?.count ?? 0),
    usersWhoRevisitedPlan: Number(revisitedPlanResult.rows[0]?.count ?? 0),
    usersWhoRanOptimizer: Number(optimizerResult.rows[0]?.count ?? 0),
    usersWhoShared: Number(shareRow?.users_who_shared ?? 0),
    totalMealShares: Number(shareRow?.total_meal_shares ?? 0),
    totalPlanShares: Number(shareRow?.total_plan_shares ?? 0),
    shareLinksOpened: Number(shareRow?.share_links_opened ?? 0),
    shareSignups: Number(shareRow?.share_signups ?? 0),
    totalCookForMe: Number(cookRow?.total_cook ?? 0),
    acceptedCookForMe: Number(cookRow?.accepted_cook ?? 0),
    usersWhoHeartedDeal: Number(heartedDealResult.rows[0]?.count ?? 0),
    usersWhoCreatedRecipe: Number(createdRecipeResult.rows[0]?.count ?? 0),
    usersWhoPublishedRecipe: Number(publishedRecipeResult.rows[0]?.count ?? 0),
    usersWhoUsedFeelingLucky: Number(feelingLuckyResult.rows[0]?.count ?? 0),
    usersWhoSubmittedFlyerRequest: Number(flyerRequestResult.rows[0]?.count ?? 0),
    usersWhoAddedImportantItems: Number(importantItemsResult.rows[0]?.count ?? 0),
    lastScraperRun: scraperRow?.created_at ?? null,
    lastPlannerRun: plannerRow?.created_at ?? null,
    plannerUsersProcessed: Number(plannerRow?.processed ?? 0),
    plannerUsersSkipped: Number(plannerRow?.skipped ?? 0),
    claudeSpendThisMonth: Number(claudeRow?.total_cost ?? 0),
  };
}

// ────────────────────────────────────────────────────────────
// Per-user metrics
// ────────────────────────────────────────────────────────────

export interface PerUserData {
  userId: string;
  displayName: string | null;
  email: string;
  signedUp: string;
  lastActive: string;
  totalSessions: number;
  totalSwipes: number;
  rightSwipes: number;
  avgSwipeSessionDurationSeconds: number;
  viewedShoppingList: boolean;
  tappedStoreAddress: boolean;
  sharedAnything: boolean;
  totalCookForMeSent: number;
  cookForMeAccepted: number;
  returnedWeek2: boolean;
  completedOnboarding: boolean;
  recipesCreated: number;
  dealsHearted: number;
  importantItemsCount: number;
  optimizerRuns: number;
  flyerRequestsSubmitted: number;
}

export async function getPerUserMetrics(): Promise<PerUserData[]> {
  // Get trial start for week 2 calculation
  const trialStartResult = await pool.query<{ trial_start: string | null }>(
    `SELECT MIN(created_at) as trial_start FROM users`,
  );
  const trialStart = trialStartResult.rows[0]?.trial_start
    ? new Date(trialStartResult.rows[0].trial_start)
    : null;

  const day8 = trialStart
    ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const day15 = trialStart
    ? new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const [
    usersResult,
    lastActiveResult,
    sessionsResult,
    swipesResult,
    swipeSessionDurationResult,
    shoppingListResult,
    storeAddressResult,
    sharedResult,
    shareAcceptResult,
    onboardingResult,
    recipesResult,
    dealsHeartedResult,
    importantItemsResult,
    optimizerResult,
    flyerRequestsResult,
    week2Result,
  ] = await Promise.all([
    // All users
    pool.query<UserRow>(
      `SELECT id as user_id, display_name, email, created_at as signed_up FROM users ORDER BY created_at`,
    ),

    // Last active per user
    pool.query<UserLastActiveRow>(
      `SELECT user_id, MAX(created_at) as last_active FROM events WHERE user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Total sessions per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'session_start' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Swipes per user
    pool.query<UserSwipeRow>(
      `SELECT
        user_id,
        COUNT(*) as total_swipes,
        COUNT(*) FILTER (WHERE event_type = 'meal_swiped_right') as right_count
      FROM events
      WHERE event_type IN ('meal_swiped_right', 'meal_swiped_left') AND user_id IS NOT NULL
      GROUP BY user_id`,
    ),

    // Avg swipe session duration per user
    pool.query<UserSwipeSessionRow>(
      `SELECT
        user_id,
        AVG((metadata->>'duration_seconds')::numeric) as avg_duration
      FROM events
      WHERE event_type = 'swipe_mode_exited' AND user_id IS NOT NULL AND metadata->>'duration_seconds' IS NOT NULL
      GROUP BY user_id`,
    ),

    // Users who viewed shopping list
    pool.query<UserBoolEventRow>(
      `SELECT DISTINCT user_id FROM events WHERE event_type = 'shopping_list_viewed' AND user_id IS NOT NULL`,
    ),

    // Users who tapped store address
    pool.query<UserBoolEventRow>(
      `SELECT DISTINCT user_id FROM events WHERE event_type = 'store_address_tapped' AND user_id IS NOT NULL`,
    ),

    // Users who shared anything
    pool.query<UserBoolEventRow>(
      `SELECT DISTINCT user_id FROM events WHERE event_type IN ('share_meal_sent', 'share_plan_sent') AND user_id IS NOT NULL`,
    ),

    // Per-user cook_for_me accept rate
    pool.query<UserShareAcceptRow>(
      `SELECT
        sender_id as user_id,
        COUNT(*) FILTER (WHERE share_type = 'cook_for_me') as total_sent,
        COUNT(*) FILTER (WHERE share_type = 'cook_for_me' AND status = 'accepted') as accepted
      FROM meal_shares
      GROUP BY sender_id`,
    ),

    // Users who completed onboarding
    pool.query<UserBoolEventRow>(
      `SELECT DISTINCT user_id FROM events WHERE event_type = 'onboarding_completed' AND user_id IS NOT NULL`,
    ),

    // Recipes created per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'recipe_created' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Deals hearted per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'deal_hearted' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Important items per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'important_item_added' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Optimizer runs per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'optimizer_run' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Flyer requests per user
    pool.query<UserEventCountRow>(
      `SELECT user_id, COUNT(*) as cnt FROM events WHERE event_type = 'flyer_request_submitted' AND user_id IS NOT NULL GROUP BY user_id`,
    ),

    // Week 2 returners (users with session_start in days 8-14)
    day8 && day15
      ? pool.query<UserBoolEventRow>(
          `SELECT DISTINCT user_id FROM events
          WHERE event_type = 'session_start'
            AND created_at >= $1
            AND created_at < $2
            AND user_id IS NOT NULL`,
          [day8.toISOString(), day15.toISOString()],
        )
      : Promise.resolve({ rows: [] as UserBoolEventRow[] }),
  ]);

  // Build lookup maps for per-user data
  const lastActiveMap = new Map(lastActiveResult.rows.map((r) => [r.user_id, r.last_active]));
  const sessionsMap = new Map(sessionsResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const swipesMap = new Map(swipesResult.rows.map((r) => [r.user_id, { total: Number(r.total_swipes), right: Number(r.right_count) }]));
  const swipeDurationMap = new Map(swipeSessionDurationResult.rows.map((r) => [r.user_id, Number(r.avg_duration ?? 0)]));
  const shoppingListSet = new Set(shoppingListResult.rows.map((r) => r.user_id));
  const storeAddressSet = new Set(storeAddressResult.rows.map((r) => r.user_id));
  const sharedSet = new Set(sharedResult.rows.map((r) => r.user_id));
  const shareAcceptMap = new Map(shareAcceptResult.rows.map((r) => [r.user_id, { totalSent: Number(r.total_sent), accepted: Number(r.accepted) }]));
  const onboardingSet = new Set(onboardingResult.rows.map((r) => r.user_id));
  const recipesMap = new Map(recipesResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const dealsHeartedMap = new Map(dealsHeartedResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const importantItemsMap = new Map(importantItemsResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const optimizerMap = new Map(optimizerResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const flyerRequestsMap = new Map(flyerRequestsResult.rows.map((r) => [r.user_id, Number(r.cnt)]));
  const week2Set = new Set(week2Result.rows.map((r) => r.user_id));

  return usersResult.rows.map((user) => {
    const swipeData = swipesMap.get(user.user_id);
    const shareAcceptData = shareAcceptMap.get(user.user_id);

    return {
      userId: user.user_id,
      displayName: user.display_name,
      email: user.email,
      signedUp: user.signed_up,
      lastActive: lastActiveMap.get(user.user_id) ?? user.signed_up,
      totalSessions: sessionsMap.get(user.user_id) ?? 0,
      totalSwipes: swipeData?.total ?? 0,
      rightSwipes: swipeData?.right ?? 0,
      avgSwipeSessionDurationSeconds: swipeDurationMap.get(user.user_id) ?? 0,
      viewedShoppingList: shoppingListSet.has(user.user_id),
      tappedStoreAddress: storeAddressSet.has(user.user_id),
      sharedAnything: sharedSet.has(user.user_id),
      totalCookForMeSent: shareAcceptData?.totalSent ?? 0,
      cookForMeAccepted: shareAcceptData?.accepted ?? 0,
      returnedWeek2: week2Set.has(user.user_id),
      completedOnboarding: onboardingSet.has(user.user_id),
      recipesCreated: recipesMap.get(user.user_id) ?? 0,
      dealsHearted: dealsHeartedMap.get(user.user_id) ?? 0,
      importantItemsCount: importantItemsMap.get(user.user_id) ?? 0,
      optimizerRuns: optimizerMap.get(user.user_id) ?? 0,
      flyerRequestsSubmitted: flyerRequestsMap.get(user.user_id) ?? 0,
    };
  });
}
