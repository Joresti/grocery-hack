// ============================================================
// GroceryHack — Shared Domain Types
// Source of truth for both frontend and backend.
// Derived from schema.sql and api-contract.yaml.
// ============================================================

// ────────────────────────────────────────────────────────────
// ENUMS & LITERALS
// ────────────────────────────────────────────────────────────

export type MaxStores = 1 | 2;
export type UserRole = 'account_holder' | 'family_member';
export type Difficulty = 'easy' | 'medium';
export type DealSource = 'flyer' | 'user_reported';
export type ScrapeStatus = 'ok' | 'failed' | 'pending' | 'disabled';
export type PriceTier = 'staple' | 'premium' | 'luxury';
export type FlyerRequestStatus = 'pending' | 'approved' | 'rejected';
export type ShareType = 'cook_for_me' | 'make_for_you';
export type MealSource = 'meal' | 'user_recipe';
export type ShareChannel = 'email' | 'sms';
export type ShareStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type ShareAction = 'accept' | 'decline';
export type TrackedService = 'claude' | 'twilio' | 'email' | 'geocode';
export type UsagePeriod = 'daily' | 'monthly';
export type MemberAgeBracket = 'under_2' | 'picky_2_5' | 'expanding_6_12' | 'teen_13_plus' | 'adult';
export type KidAgeBracket = 'under_2' | 'picky_2_5' | 'expanding_6_12' | 'teen_13_plus';
export type CookingEffort = 'quick' | 'moderate' | 'ambitious';

export type EventType =
  // ── Account lifecycle ──
  | 'user_registered'                 // {postal_code, has_budget, dietary_count}
  | 'user_logged_in'                  // {method: 'email'}
  | 'onboarding_completed'            // {budget_set, dietary_set, postal_set}

  // ── Email engagement ──
  | 'email_sent'                      // {email_type: EmailType, recipient_user_id?}
  | 'email_opened'                    // {email_type: EmailType}
  | 'email_clicked'                   // {email_type: EmailType, link_target}
  | 'email_unsubscribed'              // {email_type: EmailType}

  // ── Session tracking ──
  | 'session_start'                   // {referrer?, utm_source?, utm_medium?, utm_campaign?}
  | 'session_end'                     // {duration_seconds, page_views}
  | 'page_view'                       // {section: string}

  // ── Swipe engagement ──
  | 'swipe_mode_entered'              // {}
  | 'swipe_mode_exited'               // {swipe_count, right_count, left_count, duration_seconds}
  | 'meal_swiped_right'               // {meal_id, meal_name, meal_source: MealSource}
  | 'meal_swiped_left'                // {meal_id, meal_name, meal_source: MealSource}
  | 'recipe_modal_opened'             // {meal_id, meal_name, source: 'swipe'|'liked'|'plan'|'share'|'alert'}
  | 'recipe_modal_closed'             // {meal_id, duration_seconds}

  // ── Plan utility ──
  | 'shopping_list_viewed'            // {plan_token, store_count: 1|2}
  | 'store_address_tapped'            // {store_brand_name, store_location_id}
  | 'store_toggle_used'               // {from: 1|2, to: 1|2}
  | 'plan_revisited'                  // {plan_token, days_since_generated}

  // ── Social / sharing ──
  | 'share_meal_tapped'               // {meal_id, share_type: ShareType}
  | 'share_meal_sent'                 // {meal_id, share_type: ShareType, channel: ShareChannel}
  | 'share_meal_accepted'             // {share_token, meal_id}
  | 'share_meal_declined'             // {share_token, meal_id}
  | 'share_plan_tapped'               // {plan_token}
  | 'share_plan_sent'                 // {plan_token, channel: ShareChannel}
  | 'share_important_items_sent'      // {channel: ShareChannel, item_count}
  | 'share_link_opened'               // {share_type: 'meal'|'plan', token}
  | 'share_recipient_signed_up'       // {referrer_user_id, share_type: 'meal'|'plan'}
  | 'shared_plan_viewed'              // {plan_token, referrer_user_id}
  | 'calendar_link_tapped'            // {share_token, party: 'sender'|'recipient'}

  // ── Deal engagement ──
  | 'deal_hearted'                    // {deal_id, item_name, store_brand_name, price_tier: PriceTier}
  | 'deal_unhearted'                  // {watchlist_id, item_keyword}
  | 'watchlist_alert_viewed'          // {item_keyword, store_brand_name, sale_price}
  | 'absurd_deal_viewed'              // {deal_id, item_name, percent_off}

  // ── Recipe engagement ──
  | 'recipe_form_opened'              // {mode: 'create'|'edit', recipe_id?}
  | 'recipe_created'                  // {recipe_id, ingredient_count, is_public}
  | 'recipe_published'                // {recipe_id}
  | 'recipe_deleted'                  // {recipe_id}
  | 'recipe_alert_viewed'             // {recipe_id, recipe_name, ingredients_on_sale}

  // ── Important items ──
  | 'important_item_added'            // {item_name}
  | 'important_item_toggled'          // {item_id, is_active: boolean}
  | 'important_items_list_viewed'     // {}

  // ── Optimizer ──
  | 'optimizer_modal_opened'          // {}
  | 'optimizer_run'                   // {store_count: 1|2, store_location_ids}
  | 'flyer_request_submitted'         // {flyer_url, store_name?}

  // ── Liked meals ──
  | 'liked_meals_viewed'              // {}
  | 'liked_meal_tapped'               // {meal_id, meal_name, ingredients_on_sale_count}

  // ── Fun features ──
  | 'feeling_lucky_spun'              // {result_meal_id, result_name}

  // ── Pipeline (server-side only) ──
  | 'pipeline_scraper_completed'      // {brands_scraped, deals_found, errors}
  | 'pipeline_planner_completed'      // {users_processed, users_skipped, meals_generated, total_cost_usd}
  | 'pipeline_planner_user_skipped'   // {user_id, reason}
  | 'pipeline_spend_limit_hit'        // {service: TrackedService, percentage, period_key}

  // ── Settings ──
  | 'settings_opened'                 // {}
  | 'household_member_added'          // {age_bracket: MemberAgeBracket}
  | 'household_member_removed'        // {age_bracket: MemberAgeBracket}
  | 'dietary_restriction_toggled'     // {restriction: string, enabled: boolean}
  | 'cooking_effort_changed'          // {effort: CookingEffort}
  | 'max_stores_changed';             // {max_stores: MaxStores}

// Email subtypes for metadata.email_type
export type EmailType =
  | 'welcome'
  | 'weekly_plan'
  | 'password_reset'
  | 'share_cook_for_me'
  | 'share_make_for_you'
  | 'share_plan'
  | 'share_accepted'
  | 'share_declined'
  | 'share_calendar_confirmation'
  | 'trial_reminder';

// ────────────────────────────────────────────────────────────
// EMBEDDED / JSONB TYPES
// ────────────────────────────────────────────────────────────

export interface HouseholdMember {
  name: string;
  age?: number;
  ageBracket?: MemberAgeBracket;
  dietaryRestrictions: string[];
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  perServing: boolean;
}

export interface ImportantItem {
  id: string;
  userId: string;
  name: string;
  quantity: string | null;
  isActive: boolean;
  createdAt: string;
  deactivatedAt: string | null;
}

export type TasteProfile = Record<string, number>;

// ────────────────────────────────────────────────────────────
// DOMAIN OBJECTS (match database tables)
// ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  budget: number | null;
  dietaryRestrictions: string[];
  maxStores: MaxStores;
  householdSize: number;
  householdMembers: HouseholdMember[];
  householdNames: string[];
  kidAgeBrackets?: KidAgeBracket[];
  cookingEffort?: CookingEffort;
  tasteProfile: TasteProfile;
  subscriptionActive: boolean;
  accountHolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreBrand {
  id: string;
  name: string;
  flyerUrl: string | null;
  logoUrl: string | null;
  scrapeStatus: ScrapeStatus;
  lastScrapedAt: string | null;
}

export interface StoreLocation {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  city: string | null;
  region: string | null;
  postalZip: string | null;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface Deal {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  storeLocationId: string | null;
  itemName: string;
  category: string | null;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  dealConditions: string | null;
  percentOff: number | null;
  validFrom: string;
  validTo: string;
  source: DealSource;
}

export interface Meal {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  instructions: string | null;
  images: string[];
  ingredients: Ingredient[];
  steps: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  difficulty: Difficulty;
  filterTags: string[];
  tasteTags: TasteProfile;
  tips: string | null;
  nutrition: Nutrition | null;
  createdAt: string;
}

export interface MealAttribution {
  sharedByName: string | null;
  sharedByInitials: string | null;
  weeklyMatchCount: number;
}

export interface RecipeStats {
  recipeId: string;
  isPublic: boolean;
  weeklyMatchCount: number;
  totalMatchCount: number;
}

export interface LikedMeal {
  meal: Meal;
  likedAt: string;
  ingredientsOnSaleCount: number;
  ingredientsOnSale: string[];
  estimatedCost: number | null;
}

export interface UserRecipe {
  id: string;
  userId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  instructions: string | null;
  images: string[];
  ingredients: Ingredient[];
  steps: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  difficulty: Difficulty;
  dietaryTags: string[];
  tasteTags: TasteProfile;
  tips: string | null;
  ingredientKeywords: string[];
  costDrivers: string[];
  nutrition: Nutrition | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserMealPreference {
  id: string;
  userId: string;
  mealId: string;
  liked: boolean;
  swipedAt: string;
}

export interface WatchlistItem {
  id: string;
  itemKeyword: string;
  productName: string;
  category: string | null;
  subcategory: string | null;
  productMetadata: Record<string, unknown>;
  priceTier: PriceTier;
  benchmarkPrice: number;
  benchmarkUnit: string;
  storeBrandId: string | null;
  createdAt: string;
}



export interface FlyerRequest {
  id: string;
  userId: string;
  flyerUrl: string;
  storeName: string | null;
  storeBrandId: string | null;
  status: FlyerRequestStatus;
  reviewMessage: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface MealShare {
  id: string;
  senderId: string;
  token: string;
  mealId: string;
  mealSource: MealSource;
  shareType: ShareType;
  recipientName: string | null;
  recipientContact: string;
  channel: ShareChannel;
  status: ShareStatus;
  date: string | null;
  time: string | null;
  respondedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  userId: string | null;
  sessionId: string | null;
  eventType: EventType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UsageTracking {
  id: string;
  service: TrackedService;
  userId: string | null;
  period: UsagePeriod;
  periodKey: string;
  requestCount: number;
  estimatedCost: number;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// WEEKLY PLAN & PLAN DATA
// ────────────────────────────────────────────────────────────

export interface PlanMeal {
  mealId: string;
  name: string;
  costPerServing: number;
  totalCost: number;
  savings: number;
}

export interface PlanShoppingItem {
  name: string;
  quantity: string;
  salePrice: number | null;
  regularPrice: number | null;
  isOnSale: boolean;
  dealNote: string | null;
  forMeal: string | null;
}

export interface PlanStop {
  storeBrandName: string;
  storeLocationId: string;
  storeAddress: string;
  storeBrandId: string;
  meals: PlanMeal[];
  items: PlanShoppingItem[];
  subtotal: number;
}

export interface GroceryPlan {
  stops: PlanStop[];
  total: number;
  budgetRemaining: number;
  estimatedSavings: number;
  unmatchedItems?: PlanShoppingItem[];
}

export interface WatchlistAlert {
  item: string;
  store: string;
  storeAddress?: string;
  salePrice: number;
  regularPrice: number;
  benchmarkPrice: number;
  priceTier: PriceTier;
}

export interface RecipeAlert {
  recipeId: string;
  recipeName: string;
  ingredientsOnSale: number;
  estimatedCost: number;
  regularCost: number;
  savings: number;
}

export interface WeeklyPlan {
  id: string;
  token: string;
  weekOf: string;
  oneStoreOptimized: GroceryPlan;
  twoStoreOptimized: GroceryPlan | null;
  watchlistAlerts: WatchlistAlert[];
  recipeAlerts: RecipeAlert[];
  createdAt: string;
}

export interface WeeklyPlanSummary {
  id: string;
  token: string;
  weekOf: string;
  total: number;
  savings: number;
  mealCount: number;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────
// LANDING PAGE (single API response)
// ────────────────────────────────────────────────────────────

export type SwipeableMeal = Meal & MealAttribution;

export interface LandingPage {
  user: User;
  savingsThisWeek: number;
  savingsYtd: number;
  watchlistAlerts: WatchlistAlert[];
  recipeAlerts: RecipeAlert[];
  swipeableMeals: SwipeableMeal[];
  likedMealsPreview: LikedMeal[];
  currentPlan: WeeklyPlan | null;
  notableDeals: Deal[];
  importantItems: ImportantItem[];
}

// ────────────────────────────────────────────────────────────
// API REQUEST BODIES
// ────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  postalCode: string;
  displayName?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: MaxStores;
  householdSize?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  postalCode?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  maxStores?: MaxStores;
  householdSize?: number;
  householdMembers?: HouseholdMember[];
  householdNames?: string[];
  kidAgeBrackets?: KidAgeBracket[];
  cookingEffort?: CookingEffort;
}

export interface ShoppingListRecipeDeal {
  dealId: string;
  matchedIngredient: string;
  itemName: string;
  storeBrandName: string;
  regularPrice: number | null;
  salePrice: number;
  percentOff: number | null;
}

export interface ShoppingListRecipe {
  id: string;
  name: string;
  tagline?: string | null;
  source: MealSource;
  ingredientsOnSaleCount: number;
  totalIngredients: number;
  storesUsed: Array<{ storeBrandId: string; storeBrandName: string }>;
  matchingDeals: ShoppingListRecipeDeal[];
}

export interface ShoppingListResponse {
  recipes: ShoppingListRecipe[];
  pagination: { total: number };
}

export interface CreateStoreBrandRequest {
  name: string;
  flyerUrl?: string;
}

export interface UserRecipeCreate {
  name: string;
  ingredients: Ingredient[];
  tagline?: string;
  description?: string;
  instructions?: string;
  steps?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  difficulty?: Difficulty;
  dietaryTags?: string[];
  tips?: string;
  nutrition?: Nutrition;
  isPublic?: boolean;
}

export interface SwipeRequest {
  liked: boolean;
}

export interface HeartDealRequest {
  dealId: string;
}

export interface AddImportantItemRequest {
  name: string;
  quantity?: string;
}

export interface UpdateImportantItemRequest {
  name?: string;
  quantity?: string;
  isActive?: boolean;
}


export interface OptimizeRequest {
  postalCode?: string;
  lat?: number;
  lng?: number;
  storeLocationIds?: string[];
  maxStores?: MaxStores;
}

export interface CreateFlyerRequestBody {
  flyerUrl: string;
  storeName?: string;
}

export interface ShareMealRequest {
  mealId: string;
  mealSource?: MealSource;
  recipientName?: string;
  recipientContact: string;
  shareType: ShareType;
  date?: string;
  time?: string;
}

export interface SharePlanRequest {
  planToken: string;
  recipientName?: string;
  recipientContact: string;
}


export interface TrackEventPayload {
  eventType: EventType;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  createdAt?: string;
}

export interface TrackEventBatchPayload {
  events: TrackEventPayload[];
}

export interface TrackEventResponse {
  received: number;
}

export interface PublicEventPayload {
  eventType: 'share_link_opened' | 'share_recipient_signed_up' | 'shared_plan_viewed';
  metadata: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────
// TRIAL METRICS (admin dashboard)
// ────────────────────────────────────────────────────────────

export interface TrialUserMetrics {
  userId: string;
  displayName: string | null;
  email: string;
  signedUp: string;
  lastActive: string;
  totalSessions: number;
  totalSwipes: number;
  swipeRightRatio: number;
  avgSwipeSessionDurationSeconds: number;
  viewedShoppingList: boolean;
  tappedStoreAddress: boolean;
  sharedAnything: boolean;
  shareAcceptRate: number | null;       // accepted / total cook_for_me sent (null if none sent)
  returnedWeek2: boolean;
  completedOnboarding: boolean;
  recipesCreated: number;
  dealsHearted: number;
  importantItemsCount: number;
  optimizerRuns: number;
  flyerRequestsSubmitted: number;
  engagementScore: number;
}

export interface TrialMetrics {
  totalUsers: number;

  // Signup funnel
  registrations: number;
  onboardingCompletions: number;
  onboardingCompletionRate: number;

  // Email funnel (broken down by email type)
  emailsSent: number;
  emailsOpened: number;
  emailOpenRate: number;
  emailsClicked: number;
  emailClickRate: number;
  emailUnsubscribes: number;
  emailUnsubscribeRate: number;
  emailBreakdown: {
    emailType: EmailType;
    sent: number;
    opened: number;
    openRate: number;
    clicked: number;
    clickRate: number;
  }[];

  // Retention
  week1Users: number;
  week2Returners: number;
  week2ReturnRate: number;
  avgSessionsPerUser: number;
  avgSessionDurationSeconds: number;

  // Swipe engagement
  usersWhoSwiped: number;
  avgMealsSwipedPerSession: number;
  avgSwipeRightRatio: number;
  usersWhoViewedRecipe: number;
  avgRecipeViewDurationSeconds: number;

  // Plan utility
  usersWhoViewedShoppingList: number;
  usersWhoTappedStoreAddress: number;
  swipeToStoreRate: number;
  usersWhoRevisitedPlan: number;
  usersWhoRanOptimizer: number;

  // Social
  usersWhoShared: number;
  totalMealShares: number;
  totalPlanShares: number;
  shareAcceptRate: number;              // accepted / total cook_for_me shares
  shareLinksOpened: number;
  shareSignups: number;
  viralCoefficient: number;             // share_recipient_signed_up / total shares

  // Advanced
  usersWhoHeartedDeal: number;
  usersWhoCreatedRecipe: number;
  usersWhoPublishedRecipe: number;
  usersWhoUsedFeelingLucky: number;
  usersWhoSubmittedFlyerRequest: number;
  usersWhoAddedImportantItems: number;

  // Pipeline health
  lastScraperRun: string | null;
  lastPlannerRun: string | null;
  plannerUsersProcessed: number;
  plannerUsersSkipped: number;
  claudeSpendThisMonth: number;

  // Per-user breakdown
  users: TrialUserMetrics[];
}

// ────────────────────────────────────────────────────────────
// API RESPONSE WRAPPERS
// ────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface TokenRefreshResponse {
  token: string;
  refreshToken: string;
}

export interface ShareMealResponse {
  sent: boolean;
  channel: ShareChannel;
  shareToken: string;
}

export interface SharePlanResponse {
  sent: boolean;
  channel: ShareChannel;
}

export interface ShareRespondResult {
  status: ShareStatus;
  mealName: string;
  senderName: string | null;
  date: string | null;
  time: string | null;
  calendarUrl: string | null;
}

export interface FamilyPlanResponse {
  holderDisplayName: string | null;
  holderSavingsThisWeek: number;
  plan: WeeklyPlan;
}

export interface ApiError {
  error: true;
  code: string;
  message: string;
}