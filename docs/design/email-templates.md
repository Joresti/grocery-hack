# Email Templates

All emails are HTML rendered server-side using string templates (no templating library for MVP). Plain text fallback included for all emails. Every email follows the design system colors and typography.

## Shared Layout

All emails share a wrapper:

```html
<!-- 600px max-width, centered, warm off-white background (#FAF9F6) -->
<table width="100%" style="background:#FAF9F6; padding:24px 0;">
  <tr><td align="center">
    <table width="600" style="background:#FFFFFF; border-radius:16px; padding:32px;">
      <!-- LOGO -->
      <tr><td style="text-align:center; padding-bottom:24px;">
        <img src="{APP_URL}/logo.png" alt="GroceryHack" height="32">
      </td></tr>

      <!-- CONTENT SLOT -->
      {content}

      <!-- FOOTER -->
      <tr><td style="text-align:center; padding-top:32px; border-top:1px solid rgba(61,123,123,0.12); color:#5A5A5A; font-family:Inter,sans-serif; font-size:12px;">
        <p>GroceryHack — Deals first, meals second.</p>
        <p><a href="{APP_URL}/unsubscribe?t={token}" style="color:#5A5A5A;">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>

<!-- TRACKING PIXEL -->
<img src="{APP_URL}/api/v1/events/pixel?t={token}&user={user_id}" width="1" height="1" style="display:none;">
```

All links in the email body use the redirect endpoint for click tracking:
```
{APP_URL}/api/v1/r?url={encoded_target}&t={token}&user={user_id}
```

---

## 1. Weekly Plan Email

**Trigger:** Planner pipeline (Step 13), sent every Wednesday morning.

**Subject line logic:**
- If watchlist alert exists: "🔔 {item} is on sale at {store} — plus your weekly plan"
- If savings > $20: "You're saving ${savings} this week — here's your plan"
- Default: "Your weekly meal plan is ready"

### Content

```
HERO SECTION (conditional — only if watchlist alerts exist)
┌─────────────────────────────────────────┐
│  🔔 DEAL ALERT                          │
│  {item_name} — ${sale_price} at {store} │
│  Was ${regular_price} (save ${savings}) │
│  [View Deal →]                          │
└─────────────────────────────────────────┘

SAVINGS SUMMARY
┌─────────────────────────────────────────┐
│  This Week's Savings: ${estimated_savings} │
│  Budget Remaining: ${budget_remaining}     │
└─────────────────────────────────────────┘

MEAL PREVIEWS (first 3 primary meals)
┌─────────────────────────────────────────┐
│  🍳 Honey Garlic Chicken Stir-Fry      │
│  $2.35/serving · 3 ingredients on sale  │
│  [Great Value] or [Worth the Splurge]   │
│                                         │
│  🐟 One-Pan Lemon Herb Salmon          │
│  $3.75/serving · 2 ingredients on sale  │
│                                         │
│  🌮 Veggie Black Bean Tacos            │
│  $1.90/serving · 4 ingredients on sale  │
│                                         │
│  + 2 more meals in your plan            │
└─────────────────────────────────────────┘

RECIPE ALERTS (conditional — only if user recipes match deals)
┌─────────────────────────────────────────┐
│  📖 Your Recipes on Sale                │
│  {recipe_name} — {count} ingredients    │
│  on sale, ~${estimated_cost} this week  │
└─────────────────────────────────────────┘

CTA
┌─────────────────────────────────────────┐
│  [See Your Full Plan →]                 │
│  (big teal button, links to app)        │
└─────────────────────────────────────────┘
```

### Budget tier badges in email

- **Great Value**: green badge (#E6F4EA background, #1A7F37 text)
- **Worth the Splurge**: gold badge (rgba(201,168,76,0.15) background, #C9A84C text)
- Sweet spot meals: no badge

### Data needed

```typescript
interface WeeklyPlanEmailData {
  user: { displayName: string; email: string };
  token: string;
  estimatedSavings: number;
  budgetRemaining: number | null;
  watchlistAlerts: WatchlistAlert[];   // may be empty
  recipeAlerts: RecipeAlert[];         // may be empty
  meals: {
    name: string;
    costPerServing: number;
    ingredientsOnSale: number;
    budgetTier: 'value' | 'sweet_spot' | 'splurge';
    emoji: string;     // from taste_tags.protein → emoji mapping
  }[];
  totalMealCount: number;
  appUrl: string;
}
```

---

## 2. Share Meal Email — "Cook this for me?"

**Trigger:** `POST /share/meal` with `share_type: cook_for_me`

**Subject:** "{sender_name} has a humble request regarding {meal_name}"

### Content

```
┌─────────────────────────────────────────┐
│  Dear {recipient_name},                 │
│                                         │
│  {sender_name} kindly requests that you │
│  prepare {meal_name} for them           │
│  {date_clause}.                         │
│                                         │
│  The ingredients have been sourced at   │
│  ${cost_per_serving}/serving.           │
│                                         │
│  {meal_tagline}                         │
│                                         │
│  ⏱ {prep_time + cook_time} min         │
│  🍽 Serves {servings}                  │
│  💰 {ingredients_on_sale} ingredients   │
│     on sale this week                   │
│                                         │
│  Your prompt response to this matter    │
│  would be greatly appreciated.          │
│                                         │
│  [Accept the Assignment →]             │
│  [Respectfully Decline →]              │
│                                         │
│  [Review the Brief →]                  │
│                                         │
│  {if date/time:}                        │
│  📅 {date} at {time}                   │
└─────────────────────────────────────────┘
```

**Accept button** links to: `{APP_URL}/api/v1/share/{token}/respond?action=accept`
**Decline button** links to: `{APP_URL}/api/v1/share/{token}/respond?action=decline`

Calendar links are NOT included in the initial email — they go out to both parties only after the recipient accepts.

### Data needed

```typescript
interface ShareMealEmailData {
  senderName: string;
  recipientName: string | null;
  shareToken: string;             // for accept/decline links
  meal: {
    name: string;
    tagline: string | null;
    costPerServing: number;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
    servings: number;
    ingredientsOnSale: number;
  };
  mealUrl: string;                // deep link to meal in app
  date: string | null;            // ISO date
  time: string | null;            // HH:MM
  appUrl: string;
}
```

---

## 3. Share Meal Email — "I'll make this for you!"

**Trigger:** `POST /share/meal` with `share_type: make_for_you`

**Subject:** "{sender_name} wants to make {meal_name} for you"

### Content

```
┌─────────────────────────────────────────┐
│  Dear {recipient_name},                 │
│                                         │
│  Please be advised that {sender_name}   │
│  intends to prepare {meal_name} for     │
│  you{date_clause}. No action is required│
│  on your part — just arrive hungry.     │
│                                         │
│  {meal_tagline}                         │
│                                         │
│  Ingredients secured at                 │
│  ${cost_per_serving}/serving.           │
│                                         │
│  [Review the Menu →]                   │
│                                         │
│  {if date/time:}                        │
│  📅 {date} at {time}                   │
│  [Add to Calendar →]                   │
└─────────────────────────────────────────┘
```

No accept/decline needed — sender is the one cooking. Calendar link included directly if date provided.

Uses same `ShareMealEmailData` interface but without the accept/decline buttons.

---

## 3a. Share Response Email — Accepted

**Trigger:** Recipient clicks "Accept" on a cook_for_me share.

**Subject:** "Good news — {recipient_name} will cook {meal_name}"

### Content

```
┌─────────────────────────────────────────┐
│  Dear {sender_name},                    │
│                                         │
│  We are pleased to inform you that      │
│  {recipient_name} has accepted your     │
│  request to prepare {meal_name}         │
│  {date_clause}.                         │
│                                         │
│  All parties may now consider this      │
│  matter settled.                        │
│                                         │
│  {if date/time:}                        │
│  📅 {date} at {time}                   │
│  [Add to Calendar →]                   │
│                                         │
│  [View Recipe →]                       │
└─────────────────────────────────────────┘
```

A matching calendar email is also sent to the **recipient** upon acceptance:

```
┌─────────────────────────────────────────┐
│  It's official — you're cooking         │
│  {meal_name}{date_clause}.              │
│                                         │
│  📅 {date} at {time}                   │
│  [Add to Calendar →]                   │
│  [View Recipe →]                       │
└─────────────────────────────────────────┘
```

### Data needed

```typescript
interface ShareResponseEmailData {
  senderName: string;
  recipientName: string;
  meal: {
    name: string;
  };
  mealUrl: string;
  date: string | null;
  time: string | null;
  calendarUrl: string | null;     // Google Calendar link (only if date provided)
  appUrl: string;
}
```

---

## 3b. Share Response Email — Declined

**Trigger:** Recipient clicks "Decline" on a cook_for_me share.

**Subject:** "Update on your {meal_name} request"

### Content

```
┌─────────────────────────────────────────┐
│  Dear {sender_name},                    │
│                                         │
│  Unfortunately, {recipient_name} is     │
│  unable to fulfill your request to      │
│  prepare {meal_name} at this time.      │
│                                         │
│  We trust you'll find alternative       │
│  arrangements. Perhaps you could make   │
│  it yourself? The recipe is quite good. │
│                                         │
│  [View Recipe →]                       │
└─────────────────────────────────────────┘
```

### Data needed

Same `ShareResponseEmailData` interface (calendarUrl will be null).

---

## 4. Share Plan Email

**Trigger:** `POST /share/plan`

**Subject:** "{sender_name} shared a meal plan with you — saving ${savings} this week"

### Content

```
┌─────────────────────────────────────────┐
│  👋 Hey {recipient_name},              │
│                                         │
│  {sender_name} shared their GroceryHack │
│  meal plan with you.                    │
│                                         │
│  📊 {meal_count} meals · ${total} total │
│  💰 Saving ${savings} this week         │
│                                         │
│  Meals:                                 │
│  • {meal_1_name} — ${cost}/serving     │
│  • {meal_2_name} — ${cost}/serving     │
│  • {meal_3_name} — ${cost}/serving     │
│  {+ N more}                             │
│                                         │
│  [See the Full Plan →]                 │
│  (links to /plans/{token})              │
│                                         │
│  ─────────────────────────────────────  │
│  Want your own personalized plan?       │
│  [Sign Up Free →]                      │
└─────────────────────────────────────────┘
```

### Data needed

```typescript
interface SharePlanEmailData {
  senderName: string;
  recipientName: string | null;
  plan: {
    mealCount: number;
    total: number;
    savings: number;
    meals: { name: string; costPerServing: number }[];
  };
  planUrl: string;                // /plans/{token}
  signUpUrl: string;
  appUrl: string;
}
```

---

## 5. Welcome Email

**Trigger:** `POST /auth/register` — sent immediately after registration.

**Subject:** "Welcome to GroceryHack — your first plan is on the way"

### Content

```
┌─────────────────────────────────────────┐
│  👋 Hey {display_name},               │
│                                         │
│  Welcome to GroceryHack!                │
│                                         │
│  Here's what happens next:              │
│                                         │
│  📅 Every Wednesday morning, you'll get │
│  a personalized meal plan built around  │
│  what's actually on sale near you.      │
│                                         │
│  Meanwhile, you can:                    │
│  • Swipe through meals to tell us what  │
│    you like                             │
│  • Add your important items (milk,      │
│    eggs, etc.) so we include them       │
│  • Heart deals you want to track        │
│                                         │
│  The more you swipe, the better your    │
│  plan gets.                             │
│                                         │
│  [Start Swiping →]                     │
└─────────────────────────────────────────┘
```

---

## 6. Password Reset Email

**Trigger:** `POST /auth/forgot-password` — only sent if the email exists. Never reveal whether the email was found.

**Subject:** "Reset your GroceryHack password"

### Content

```
┌─────────────────────────────────────────┐
│  Hey {display_name},                    │
│                                         │
│  We received a request to reset your    │
│  password. Click the button below to    │
│  choose a new one.                      │
│                                         │
│  [Reset Password →]                    │
│                                         │
│  This link expires in 1 hour. If you    │
│  didn't request this, you can safely    │
│  ignore this email — your password      │
│  won't change.                          │
└─────────────────────────────────────────┘
```

**Reset button** links to: `{APP_URL}/reset-password?token={token}`

The frontend at that URL shows a "new password" form that submits to `POST /auth/reset-password`.

### Data needed

```typescript
interface PasswordResetEmailData {
  displayName: string | null;
  resetUrl: string;             // {APP_URL}/reset-password?token={token}
  appUrl: string;
}
```

---

## 7. Trial Reminder Email (Week 2)

**Trigger:** Cron job, sent to users who registered 7 days ago and have not opened the app since day 3.

**Subject:** "Your deals are waiting — this week's plan is ready"

### Content

```
┌─────────────────────────────────────────┐
│  Hey {display_name},                    │
│                                         │
│  We built your plan for this week and   │
│  found ${savings} in savings near you.  │
│                                         │
│  {top_deal_highlight}                   │
│  {e.g. "Chicken thighs are 43% off     │
│  at No Frills this week"}              │
│                                         │
│  [See Your Plan →]                     │
│                                         │
│  ─────────────────────────────────────  │
│  Not useful? Just unsubscribe below —   │
│  no hard feelings.                      │
└─────────────────────────────────────────┘
```

---

## SMS Templates

SMS messages are short — 160 chars max for a single segment. No HTML, no tracking pixel. Include a link.

### Share Meal SMS

**cook_for_me:**
```
{sender_name} kindly requests you prepare {meal_name} for them. Accept or decline: {respond_url}
```

**make_for_you:**
```
{sender_name} is making {meal_name} for you! ${cost}/serving. Details: {short_url}
```

**cook_for_me — accepted (to sender):**
```
Great news! {recipient_name} accepted your request to cook {meal_name}. View recipe: {short_url}
```

**cook_for_me — declined (to sender):**
```
{recipient_name} can't make {meal_name} this time. Maybe cook it yourself? Recipe: {short_url}
```

### Share Plan SMS

```
{sender_name} shared a meal plan with you — {meal_count} meals, saving ${savings}. See it: {short_url}
```

---

## Implementation Notes

### Rendering approach

Plain string interpolation for MVP. No template engine dependency.

```typescript
// backend/src/lib/email.ts
function renderWeeklyPlanEmail(data: WeeklyPlanEmailData): { html: string; text: string } {
  const mealRows = data.meals.slice(0, 3).map(m =>
    `<tr><td>${m.emoji} ${m.name}</td><td>$${m.costPerServing.toFixed(2)}/serving</td></tr>`
  ).join('');

  const html = wrapLayout(data.token, data.user.userId, `
    ${data.watchlistAlerts.length > 0 ? renderAlertHero(data.watchlistAlerts[0]) : ''}
    ${renderSavingsSummary(data.estimatedSavings, data.budgetRemaining)}
    <table>${mealRows}</table>
    ${data.totalMealCount > 3 ? `<p>+ ${data.totalMealCount - 3} more meals</p>` : ''}
    ${renderCta('See Your Full Plan', `${data.appUrl}/plans/${data.token}`)}
  `);

  const text = [
    `Your weekly plan is ready!`,
    `Savings: $${data.estimatedSavings.toFixed(2)}`,
    data.meals.map(m => `- ${m.name} ($${m.costPerServing.toFixed(2)}/serving)`).join('\n'),
    `See your plan: ${data.appUrl}/plans/${data.token}`,
  ].join('\n\n');

  return { html, text };
}
```

### Tracking

- Every email includes a 1x1 tracking pixel for open detection
- Every link uses the `/api/v1/r` redirect for click tracking
- Deduplication: only first open/click per token per user is recorded

### Calendar links

Google Calendar URL format for meal sharing with dates:

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text={meal_name}
  &dates={start_iso}/{end_iso}
  &details={recipe_url}
```

No Google API needed — this is a static URL that opens Google Calendar's "create event" page.

**When calendar links are sent:**
- **cook_for_me:** Calendar links go to BOTH sender and recipient, but ONLY after the recipient accepts. Not included in the initial request email.
- **make_for_you:** Calendar link goes to the recipient immediately (if date provided), since no acceptance is needed.

### Accept/Decline flow

The `GET /api/v1/share/{token}/respond?action=accept|decline` endpoint:

1. Validates the token and checks the share hasn't expired (7-day TTL)
2. Updates `meal_shares.status` to `accepted` or `declined`, sets `responded_at`
3. Sends the appropriate response email/SMS to the sender
4. If accepted + date provided: sends calendar confirmation to both parties
5. Returns a simple branded HTML confirmation page ("You accepted!" / "Request declined")
6. Tracks `share_meal_accepted` or `share_meal_declined` event

The HTML confirmation page is a self-contained page (not the app) since the recipient may not be a GroceryHack user. It includes:
- The GroceryHack logo
- Confirmation message
- Calendar link (on accept, if date provided)
- "Want your own meal plans?" CTA → sign-up link

### Share expiration

Shares expire after 7 days (`expires_at` = `created_at + 7 days`). A cron job runs daily to mark expired pending shares:

```sql
UPDATE meal_shares SET status = 'expired'
WHERE status = 'pending' AND expires_at < now();
```

No notification is sent on expiration — the request simply becomes unavailable.

### Emoji mapping for meal previews

```typescript
const PROTEIN_EMOJI: Record<string, string> = {
  chicken: '🍗',
  beef: '🥩',
  pork: '🥓',
  salmon: '🐟',
  fish: '🐟',
  shrimp: '🦐',
  tofu: '🫘',
  none: '🥬',  // vegetarian
};

function getMealEmoji(tasteTags: TasteProfile): string {
  return PROTEIN_EMOJI[tasteTags.protein ?? 'none'] ?? '🍳';
}
```
