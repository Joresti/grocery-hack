# GroceryHack — Component Tree (MVP)

## Access Modes

The app renders for all visitors. Auth state determines interaction, not visibility.

| Mode | Route | Data Source | Behavior |
|------|-------|-------------|----------|
| **Logged in** | `/` | `GET /landing` (personalized) | Full interaction: swipe, optimize, share, important items, heart deals |
| **Shared plan** | `/plans/{token}` | `GET /plans/{token}` (no auth) | View plan. All interactive features visible but prompt sign-up on tap. |
| **Anonymous** | `/` | `GET /landing` (generic, non-personalized) | All sections visible. Interactive features prompt sign-up on tap. |

**Key principle:** Every feature is visible to every user. Anonymous users see the full UI — optimizer button, heart buttons, feeling lucky, share actions, important items — but tapping any interactive feature shows a sign-up prompt ("Sign up to save your liked deals", "Create an account to optimize your list", etc.). This shows anonymous users exactly what they're missing.

App.tsx does NOT redirect to login. AuthProvider supplies context; components check auth to either perform the action or show a sign-up prompt.

---

## App Shell

```
App.tsx
├── AuthProvider                      # JWT context — does NOT gate/redirect
│   └── Router
│       ├── "/" → LandingPage
│       ├── "/plans/:token" → SharedPlanPage
│       ├── "/login" → LoginPage
│       └── "/register" → RegisterPage
```

---

## LandingPage

Single-scroll page. One API call (`GET /landing`) loads everything. Sections appear in fixed order. Conditional sections hide when their data is empty (not based on auth — based on data).

### Header

```
Header
├── Logo
├── SavingsSummary
└── AuthButtons
```

**How it works:** Logo sits left or centered. SavingsSummary shows "Savings This Week: $xx.xx" and "YTD Savings: $xx.xx" with an animated count-up (ease-out cubic, ~500ms). When anonymous, savings show $0.00. AuthButtons show Login/Register for anonymous users, or a user menu (profile, logout) for logged-in users.

### Primary Actions

```
PrimaryActions
├── GoToSmartListButton
└── OptimizeSmartListButton
```

**How it works:** Always visible. "Go to My Smart List" scrolls to or opens the user's active important items list (logged in) or prompts sign-up (anonymous). "Optimize My Smart List" opens the OptimizerModal (logged in) or prompts sign-up (anonymous). Both buttons use the primary teal color with glow shadow on hover.

### Absurd Deal Alert

```
AbsurdDealAlert
└── DealAlertBanner
```

**How it works:** Visible when `watchlistAlerts` is non-empty (logged-in users with alerts this week). Does not render for anonymous users (no watchlist data). Renders an eye-catching banner with a pulsing red glow animation (`dangerGlow`). Shows the deal item name, store, sale price vs regular price. Tapping the banner scrolls to the deal in NotableDeals or opens a detail view.

### Recipes on Sale

```
RecipesOnSale
└── RecipeAlertCard[]
```

**How it works:** Visible when `recipeAlerts` is non-empty (logged-in users whose recipes match deals). Does not render for anonymous users (no recipe data). Each card shows: recipe name, number of ingredients on sale, estimated cost this week, regular cost, and savings amount. Tapping a card opens the RecipeModal with ingredients highlighted with deal prices.

### My Liked Meals (preview)

```
LikedMealsPreview
├── LikedMealCard[]
└── ViewAllLink
```

**How it works:** Visible when `likedMealsPreview` is non-empty (logged-in users who have swiped right on at least one meal). Does not render for anonymous users (no swipe data). Shows up to 6 most recently liked meals as compact horizontal-scroll cards. Each card shows meal image, meal name, and a teal badge "X ingredients on sale this week" when `ingredientsOnSaleCount > 0` (tapping the badge shows ingredient names in a tooltip). Cards without any sale ingredients display normally without a badge. Tapping a card opens RecipeModal with deal-enriched pricing. If the user has more than 6 liked meals, "View All" appears and opens the LikedMealsModal.

### Dream Meal Matching

```
DreamMealMatching
└── MealCard[]
```

**How it works:** Always visible. Section titled "Match Your Dream Meals" with a heart icon. Shows meal cards from `swipeableMeals` — each card displays meal image, recipe name, and price per serving. If `sharedByName` is not null, a small attribution line appears below the deal badge: a colored initials circle (24x24px, deterministic color from name) + "Shared by Jessica" in textMuted, Inter 12px. Tapping a card opens the RecipeModal for any user. For logged-in users, entering SwipeMode from here enables full swipe-to-like/skip. Anonymous users who try to enter SwipeMode get a sign-up prompt.

### Store Meal Deal List + Shopping List

```
StoreMealDealList
├── StoreLimitToggle
└── StoreSection[]
    ├── StoreHeader
    ├── StoreMealRow[]
    └── ShoppingList
        └── ShoppingListItem[]
```

**How it works:** Renders from the current plan's stops. Always visible when plan data exists. The StoreLimitToggle sits at the top — a 1-store / 2-store toggle that switches between `oneStoreOptimized` and `twoStoreOptimized`. Both plans are pre-computed by the optimizer, so toggling is instant with no API call.

**1-store mode (`oneStoreOptimized`):** Each meal appears under exactly one store. All ingredients for that meal are sourced from that store.

**2-store mode (`twoStoreOptimized`):** A meal may have ingredients split across two stores. In this case, the same meal appears under **both** store sections. Within each store's ShoppingList:
- Ingredients sourced from **this** store render normally (sale price strikethrough styling if on sale, pantry styling if not).
- Ingredients sourced from the **other** store get a distinct visual indicator (OtherStoreBadge — muted style with other store's name) and an anchor link that jumps to that same meal under the other store's section.

This lets users see the full picture at each store while making it clear which items to grab where.

StoreHeader shows store name and address — address is a tappable Google Maps link (`https://www.google.com/maps/search/?api=1&query={encoded_address}`). StoreMealRow shows meal name, cost per serving, total cost, and savings — tapping opens RecipeModal.

### Feeling Lucky

```
FeelingLuckyButton
```

**How it works:** Always visible. A gold-colored button between the store deals and notable deals sections. Logged-in: opens the FeelingLuckyModal. Anonymous: prompts sign-up.

### Notable Deals

```
NotableDeals
└── NotableDealCard[]
```

**How it works:** Always visible. Shows up to 10 deals from `notableDeals`. Each card shows: product name, store name, store address (Google Maps link), regular price (strikethrough), and sale price. Heart button on every card — logged-in users tap to like the deal (`POST /watchlist` with `deal_id`, server extracts product metadata and stores it for prediction). Anonymous users who tap the heart get a sign-up prompt.

### Share Plan

```
SharePlanButton
```

**How it works:** Visible when `currentPlan` exists. Opens ShareContactModal configured for plan sharing (logged in) or prompts sign-up (anonymous). Sends via `POST /share/plan` with the plan's token. Recipient gets a link to `/plans/{token}` — no account needed to view.

### Add Recipe

```
AddRecipeButton
```

**How it works:** Always visible. Opens RecipeFormModal in create mode (logged in) or prompts sign-up (anonymous).

### Sign Up CTA

```
SignUpCta
```

**How it works:** Only visible when anonymous. Appears at the bottom of the page. "Want personalized deals and meal plans? Sign up free." Links to RegisterPage.

---

## SharedPlanPage

```
SharedPlanPage
├── SharedPlanHeader
├── StoreMealDealList                 # Same component, read-only
├── SignUpCta
└── AdoptPlanPrompt
```

**How it works:** Loads via `GET /plans/{token}` — no auth required. SharedPlanHeader shows the sharer's name (if provided), week, total cost, and savings. Reuses StoreMealDealList — the StoreLimitToggle still works if both `oneStoreOptimized` and `twoStoreOptimized` exist. All interactive features (heart, share, optimize) are visible but prompt sign-up for anonymous users. SignUpCta at the bottom: "Want your own personalized plan? Sign up free." If the user logs in from this page, AdoptPlanPrompt asks "Use this plan as a starting point?" — they can adopt it (clone the important items list) or dismiss and go to their own landing page.

---

## Full-Screen Modals

Modals replace the page (slide up from bottom, 250ms ease-out, 20px top border radius). The previous page is hidden, not overlaid.

### SwipeMode

```
SwipeMode
├── SwipeCardStack
│   └── SwipeMealCard[]
├── SwipeStamps
└── ExitButton
```

**How it works:** Entered by tapping a meal card in DreamMealMatching. Logged-in only (anonymous users get sign-up prompt before entering). Card stack fills the screen. Swipe right = like (YUM stamp in green), swipe left = skip (NOPE stamp in red). Each swipe calls `POST /meals/{meal_id}/swipe` with `{liked: true/false}`. Cards animate with spring physics (`cubic-bezier(.175, .885, .32, 1.275)`). If `sharedByName` is not null, the swipe card shows the initials avatar + "Shared by Jessica" below the meal tagline. Tapping a card (not swiping) opens RecipeModal on top. ExitButton returns to LandingPage at the same scroll position. When cards run out, shows a message and returns to scroll.

### RecipeModal

```
RecipeModal
├── RecipeHeader
├── AttributionLine
├── IngredientList
│   └── IngredientRow[]
├── StepsList
├── TipsSection
├── MatchCountLine
├── ShareActions
│   ├── CookForMeButton
│   └── MakeForYouButton
└── CloseButton
```

**How it works:** Opens for both meals and user recipes, for all users. RecipeHeader shows name, tagline, image, prep/cook time, servings, and difficulty badge. AttributionLine appears below the tagline when `sharedByName` is not null — shows initials avatar (24x24px colored circle) + "Shared by Jessica" in textMuted. IngredientList renders each ingredient with quantity and unit. Ingredients on sale show regular price strikethrough + sale price in teal. Non-sale ingredients are styled as pantry items (muted, no price). StepsList shows 4-6 numbered cooking steps. TipsSection shows optional tips text. MatchCountLine appears below tips when `weeklyMatchCount > 0` — shows "{count} people matched with this recipe this week" in textMuted. ShareActions always visible — "Cook this for me?" and "I'll make this for you!" buttons open ShareContactModal (logged in) or prompt sign-up (anonymous). CloseButton returns to the previous view.

### FeelingLuckyModal

```
FeelingLuckyModal
├── NameManager
│   ├── NameChip[]
│   └── AddNameInput
├── SlotMachine
├── SpinButton
├── SpinResult
├── ConfettiAnimation
└── CloseButton
```

**How it works:** Logged-in only (anonymous users get sign-up prompt before entering). On first use, shows "Who's cooking this week?" with a text field to add names one at a time. Names save to the user's `householdNames` via `PATCH /users/me`. On return visits, names appear pre-filled as chips with X to delete. "Spin!" triggers a slot-machine animation across two columns — meals (from user's liked pool only) and names — slowing down and landing on a random combination. Selection is client-side (`Math.random()`). Result displays: "TONIGHT: Marcus is making Black Bean Taco Bowls" with confetti (CSS keyframes). No backend call for the spin itself.

### LikedMealsModal

```
LikedMealsModal
├── LikedMealCard[]
└── CloseButton
```

**How it works:** Logged-in only. Shows all meals the user has liked, loaded via `GET /meals/liked`. Each card displays meal image, name, liked date, and a teal badge "X ingredients on sale this week" when ingredients are currently on sale. Tapping a badge reveals the list of sale ingredient names. Tapping a card opens RecipeModal on top. Sorted by most recently liked first. Cards without any sale ingredients are styled normally without a badge but still fully tappable.

### OptimizerModal

```
OptimizerModal
├── LocationInput
├── StoreSelector
├── StoreLimitToggle
├── FlyerRequestSection
│   ├── FlyerUrlInput
│   └── FlyerRequestList
│       └── FlyerRequestRow[]
├── OptimizeButton
└── CloseButton
```

**How it works:** Logged-in only (anonymous users get sign-up prompt before entering). LocationInput shows the user's saved postal code with option to override or "Use Current Location" (triggers browser geolocation). StoreSelector fetches nearby stores via `GET /stores/nearby` and shows checkboxes — user picks which stores to include. StoreLimitToggle sets the user's preference for 1 or 2 stores — but the optimizer always generates both plans so the user can toggle freely on the results page. FlyerRequestSection lets users submit flyer URLs (`POST /flyer-requests`) and shows their past requests with status badges (pending yellow, approved green, rejected gray with reason). OptimizeButton calls `POST /optimize` — shows a loading state while Claude generates the plan, then returns to LandingPage with the new plan rendered.

### RecipeFormModal

```
RecipeFormModal
├── RecipeNameInput
├── IngredientEditor
│   └── IngredientFieldRow[]
├── StepsEditor
│   └── StepFieldRow[]
├── OptionalFields
│   ├── PrepTimeInput
│   ├── CookTimeInput
│   ├── ServingsInput
│   ├── DietaryTagPicker
│   └── NotesInput
├── PublishSection
│   ├── PublishToggle
│   └── MatchCountDisplay
├── SaveButton
├── DeleteButton
└── CloseButton
```

**How it works:** Logged-in only (anonymous users get sign-up prompt before entering). User fills in RecipeNameInput and adds ingredients (name, quantity, unit per row — add/remove rows). Steps are numbered text fields. OptionalFields include prep time, cook time, servings, dietary tags (multi-select), and notes. PublishSection contains a "Share with the community" toggle — toggling ON shows "Your name will appear on this recipe and other users can cook it", toggling OFF shows "This recipe will be removed from the shared pool". Toggle calls `POST /recipes/{id}/publish`. Below the toggle, when public, MatchCountDisplay shows "{count} people matched with your recipe this week" in primary teal — loaded via `GET /recipes/{id}/stats`. This is the reward visible right next to the action. PublishSection only appears in edit mode (after the recipe is saved). SaveButton calls `POST /recipes` (create) or `PATCH /recipes/{id}` (edit). DeleteButton only appears in edit mode, shows confirmation dialog, calls `DELETE /recipes/{id}`. Minimum required: name + at least one ingredient.

### ShareContactModal

```
ShareContactModal
├── RecipientContactInput
├── RecipientNameInput
├── DatePicker
├── TimePicker
└── SendButton
```

**How it works:** Reusable modal for three sharing flows — configured by the opener. RecipientContactInput accepts email or phone number (auto-detects channel). RecipientNameInput is optional. DatePicker and TimePicker only appear for meal sharing (`cook_for_me` / `make_for_you`). SendButton calls the appropriate endpoint: `POST /share/meal`, `POST /share/plan`, or `POST /share/important-items`. Shows a Toast on success ("Sent!") with the channel used (email/SMS).

### ImportantItemsModal

```
ImportantItemsModal
├── ListSelector
├── ListNameInput
├── ImportantItemList
│   └── ImportantItemRow[]
├── AddItemInput
├── ActivateButton
├── ShareListButton
└── CloseButton
```

**How it works:** Logged-in only (anonymous users get sign-up prompt before entering). ListSelector shows all user's lists from `importantItems` — tap to switch. ListNameInput lets user rename the current list. ImportantItemList shows items with name, quantity, and a checkbox for marking as purchased. Items can be swiped to delete. AddItemInput is a quick-add field at the bottom. ActivateButton sets this list as the active list (`POST /important-items/{id}/activate`). ShareListButton opens ShareContactModal — recipient gets a view-only link. If recipient wants to edit, they sign up and the system clones the list (`POST /important-items/{id}/clone`). New lists are created via `POST /important-items`.

---

## Shared UI Components

```
components/
├── MealCard                  # Image, name, price/serving. Reused across sections.
├── DealCard                  # Product, store, prices. Reused in NotableDeals + Alert.
├── PriceDisplay              # Sale price in teal + strikethrough regular price.
├── HeartButton               # Like a deal. Outline/filled toggle. POST/DELETE /watchlist.
├── SavingsCounter            # Animated count-up, ease-out cubic, ~500ms.
├── ConfettiEffect            # CSS keyframes. Triggers on savings > $5 per meal match.
├── OtherStoreBadge           # Badge for cross-store ingredients in 2-store mode. Shows store name.
├── StoreLimitToggle          # 1-store / 2-store pill toggle. Reused in plan view + optimizer.
├── StatusBadge               # Colored pill: pending (yellow), approved (green), rejected (gray).
├── GoogleMapsLink            # Wraps text, opens maps search URL on tap.
├── InitialsAvatar            # 24x24px colored circle with 1-2 letter initials. Color deterministic from name string.
├── AuthGate                  # Wraps interactive elements. Logged in: renders children. Anonymous: shows sign-up prompt on tap.
├── Toast                     # Fade in + slight Y translation, 1.5s total duration.
├── LoadingSpinner            # Shown during API calls.
└── SignUpCta                 # "Want personalized deals?" with Register button. Bottom of page for anonymous.
```

---

## Hooks

```
hooks/
├── useLandingData      # GET /landing via TanStack Query. Single source of truth for the page.
├── useAuth             # Login, register, refresh, logout. Provides isAuthenticated boolean.
├── useSwipe            # Swipe gesture tracking + POST /meals/:id/swipe mutation.
├── useOptimize         # POST /optimize mutation. Invalidates landing data on success.
├── useRecipes          # GET/POST/PATCH/DELETE /recipes. TanStack Query + mutations.
├── useRecipeStats     # GET /recipes/:id/stats. Match count for public recipes.
├── useImportantItems   # CRUD + clone + activate for important items.
├── useLikedMeals      # GET /meals/liked. Full list of liked meals with deal context.
├── useLikedDeals       # Heart (POST /watchlist) and unheart (DELETE /watchlist/:id). Stores metadata for prediction.
├── useShare            # POST /share/meal, /share/plan, /share/important-items mutations.
├── useGeolocation      # Browser Geolocation API wrapper. Returns {lat, lng, error}.
└── useTrack            # Analytics event tracking. See below.
```

---

## useTrack Hook (trial analytics)

```typescript
const { track } = useTrack();
track('swipe_mode_entered');
track('meal_swiped_right', { meal_id: '...', meal_name: '...' });
```

**How it works:**
- Generates a `sessionId` (uuid) on first render, held in React state
- Batches events in memory, flushes every 5 seconds or on page visibility change (`visibilitychange` event)
- Sends via `POST /api/v1/events` in batch format
- Never throws or blocks UI — fire and forget, errors silently logged to console
- Automatically tracks `session_start` on mount with `{referrer, device_type, screen_width}`
- Automatically tracks `session_end` on `beforeunload` / visibility hidden with `{duration_seconds}`

**Every interactive component calls `track()`:**
- LandingPage: `page_view` with `{section}` as user scrolls into each section
- SwipeMode: `swipe_mode_entered` on open, `swipe_mode_exited` on close with counts + duration
- Each swipe: `meal_swiped_right` / `meal_swiped_left` with meal info
- RecipeModal: `recipe_modal_opened` with `{from}` source, `recipe_modal_closed` with duration
- StoreMealDealList: `shopping_list_viewed` when section scrolls into view
- StoreHeader address: `store_address_tapped` on tap
- StoreLimitToggle: `store_toggle_used` with `{from, to}`
- Share buttons: `share_meal_tapped` / `share_plan_tapped` on tap, `_sent` on success
- HeartButton: `deal_hearted` / `deal_unhearted`
- RecipeFormModal: `recipe_created` on save
- OptimizerModal: `optimizer_run` on optimize
- FeelingLuckyModal: `feeling_lucky_spun` with result
- AbsurdDealAlert: `absurd_deal_viewed` when visible (IntersectionObserver)
- RecipesOnSale cards: `recipe_alert_viewed` when visible

**Engagement score weights (computed server-side):**

| Action | Points |
|--------|--------|
| Returned for week 2 | 25 |
| Tapped store address | 15 |
| Shared a meal or plan | 15 |
| Viewed shopping list | 10 |
| Created a recipe | 10 |
| Entered swipe mode | 5 |
| Swiped 5+ meals | 5 |
| Viewed recipe detail | 5 |
| Hearted a deal | 5 |
| Used Feeling Lucky | 5 |

Max 100. Score 60+ = likely to pay. Score < 20 = not engaged.

---

## Icons (custom SVG, 2px stroke, rounded caps and joins)

```
theme/icons/
├── LogoIcon
├── HeartIcon             # Filled (teal) + outline (textMuted) states
├── SwipeLeftIcon
├── SwipeRightIcon
├── SpinnerIcon           # Feeling Lucky slot machine
├── ShareIcon
├── MapPinIcon
├── ChefHatIcon
├── ListIcon
├── StarIcon
├── AlertIcon
├── CloseIcon
├── PlusIcon
├── TrashIcon
└── CheckIcon
```
