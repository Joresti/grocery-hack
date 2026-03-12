# Analytics Specification

Comprehensive event tracking for the GroceryHack MVP trial period. Every user interaction, backend operation, and email engagement is tracked to measure product-market fit.

## Event Architecture

### How events flow

```
Frontend (useTrack hook)  ──→  POST /events (batch)  ──→  events table
Backend (service layer)   ──→  insertEvent()          ──→  events table
Email (pixel/redirect)    ──→  GET /events/pixel       ──→  events table
                               GET /api/v1/r            ──→  events table
Public (no auth)          ──→  POST /events/public     ──→  events table
Pipeline (cron)           ──→  insertEvent()           ──→  events table
```

### Frontend tracking hook

```typescript
// frontend/src/hooks/useTrack.ts
function useTrack() {
  const queue: TrackEventPayload[] = [];

  function track(eventType: EventType, metadata?: Record<string, unknown>): void {
    queue.push({ eventType, metadata, sessionId: getSessionId(), createdAt: new Date().toISOString() });
  }

  // Flush queue every 5 seconds or on page unload (navigator.sendBeacon)
  // POST /events with batch payload
}
```

### Backend tracking utility

```typescript
// backend/src/lib/analytics.ts
async function trackEvent(
  eventType: EventType,
  userId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  // Fire-and-forget insert — never block the request
  pool.query(
    'INSERT INTO events (user_id, event_type, metadata) VALUES ($1, $2, $3)',
    [userId, eventType, metadata ?? {}]
  ).catch(err => logger.error({ err, eventType }, 'Failed to track event'));
}
```

---

## Event Metadata Schema

Every event type has a defined metadata shape. The `metadata` column is JSONB — these are the **expected** fields, not enforced by the database. Validation happens in the frontend hook and backend utility.

### Account lifecycle

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `user_registered` | `postal_code` | `has_budget`, `dietary_count`, `referrer_share_token` |
| `user_logged_in` | `method: 'email'` | |
| `onboarding_completed` | `budget_set: boolean`, `dietary_set: boolean`, `postal_set: boolean` | `household_size` |

### Email engagement

All email events require `email_type: EmailType` in metadata.

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `email_sent` | `email_type`, `recipient_user_id` | `share_token`, `plan_token` |
| `email_opened` | `email_type`, `user_id` (from pixel query) | `plan_token` |
| `email_clicked` | `email_type`, `link_target` | `plan_token` |
| `email_unsubscribed` | `email_type` | |

`EmailType` values: `welcome`, `weekly_plan`, `share_cook_for_me`, `share_make_for_you`, `share_plan`, `share_accepted`, `share_declined`, `share_calendar_confirmation`, `trial_reminder`

### Session tracking

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `session_start` | | `referrer`, `utm_source`, `utm_medium`, `utm_campaign` |
| `session_end` | `duration_seconds`, `page_views` | |
| `page_view` | `section` | |

`section` values: `hero`, `savings`, `absurd_deal`, `recipe_alerts`, `liked_meals`, `swipe_deck`, `shopping_list`, `notable_deals`, `feeling_lucky`

### Swipe engagement

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `swipe_mode_entered` | | |
| `swipe_mode_exited` | `swipe_count`, `right_count`, `left_count`, `duration_seconds` | |
| `meal_swiped_right` | `meal_id`, `meal_name` | `meal_source: 'meal'\|'user_recipe'` |
| `meal_swiped_left` | `meal_id`, `meal_name` | `meal_source: 'meal'\|'user_recipe'` |
| `recipe_modal_opened` | `meal_id`, `meal_name` | `source: 'swipe'\|'liked'\|'plan'\|'share'\|'alert'` |
| `recipe_modal_closed` | `meal_id`, `duration_seconds` | |

### Plan utility

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `shopping_list_viewed` | `plan_token` | `store_count: 1\|2` |
| `store_address_tapped` | `store_brand_name`, `store_location_id` | |
| `store_toggle_used` | `from: 1\|2`, `to: 1\|2` | |
| `plan_revisited` | `plan_token` | `days_since_generated` |

### Social / sharing

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `share_meal_tapped` | `meal_id` | `share_type: ShareType` |
| `share_meal_sent` | `meal_id`, `share_type`, `channel` | `share_token` |
| `share_meal_accepted` | `share_token`, `meal_id` | |
| `share_meal_declined` | `share_token`, `meal_id` | |
| `share_plan_tapped` | `plan_token` | |
| `share_plan_sent` | `plan_token`, `channel` | |
| `share_important_items_sent` | `channel`, `item_count` | |
| `share_link_opened` | `share_type: 'meal'\|'plan'`, `token` | |
| `share_recipient_signed_up` | `referrer_user_id`, `share_type` | |
| `shared_plan_viewed` | `plan_token`, `referrer_user_id` | |
| `calendar_link_tapped` | `share_token` | `party: 'sender'\|'recipient'` |

### Deal engagement

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `deal_hearted` | `deal_id`, `item_name`, `store_brand_name` | `price_tier: PriceTier` |
| `deal_unhearted` | `watchlist_id`, `item_keyword` | |
| `watchlist_alert_viewed` | `item_keyword`, `store_brand_name`, `sale_price` | |
| `absurd_deal_viewed` | `deal_id`, `item_name` | `percent_off` |

### Recipe engagement

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `recipe_form_opened` | `mode: 'create'\|'edit'` | `recipe_id` (edit mode) |
| `recipe_created` | `recipe_id`, `ingredient_count` | `is_public` |
| `recipe_published` | `recipe_id` | |
| `recipe_deleted` | `recipe_id` | |
| `recipe_alert_viewed` | `recipe_id`, `recipe_name` | `ingredients_on_sale` |

### Important items

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `important_item_added` | `item_name` | |
| `important_item_toggled` | `item_id`, `is_active` | |
| `important_items_list_viewed` | | |

### Optimizer

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `optimizer_modal_opened` | | |
| `optimizer_run` | `store_count: 1\|2` | `store_location_ids` |
| `flyer_request_submitted` | `flyer_url` | `store_name` |

### Liked meals

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `liked_meals_viewed` | | |
| `liked_meal_tapped` | `meal_id`, `meal_name` | `ingredients_on_sale_count` |

### Fun features

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `feeling_lucky_spun` | `result_meal_id`, `result_name` | |

### Pipeline (server-side only)

Pipeline events use `user_id = NULL` (system-level).

| Event | Required metadata | Optional metadata |
|-------|-------------------|-------------------|
| `pipeline_scraper_completed` | `brands_scraped`, `deals_found` | `errors`, `duration_seconds` |
| `pipeline_planner_completed` | `users_processed`, `users_skipped`, `meals_generated`, `total_cost_usd` | `collaborative_recommendations`, `duration_seconds` |
| `pipeline_planner_user_skipped` | `user_id`, `reason` | |
| `pipeline_spend_limit_hit` | `service`, `percentage`, `period_key` | |

`reason` values for user skip: `no_nearby_stores`, `no_active_deals`, `no_liked_meals`, `spend_limit`, `optimizer_failed`, `db_error`

---

## Engagement Score Calculation

Per-user composite score (0-100) computed server-side from events:

| Signal | Points | Event source |
|--------|--------|-------------|
| Week 2 return | 25 | `session_start` in week 2 |
| Store address tap | 15 | `store_address_tapped` |
| Share meal or plan | 15 | `share_meal_sent` or `share_plan_sent` |
| Shopping list viewed | 10 | `shopping_list_viewed` |
| Recipe created | 10 | `recipe_created` |
| Swipe mode entered | 5 | `swipe_mode_entered` |
| 5+ meals swiped in a session | 5 | `swipe_mode_exited` where `swipe_count >= 5` |
| Recipe modal viewed | 5 | `recipe_modal_opened` |
| Deal hearted | 5 | `deal_hearted` |
| Feeling Lucky used | 5 | `feeling_lucky_spun` |

**Max: 100 points.** Interpretation:
- 60+ = likely to convert to paid
- 30-59 = engaged but not committed
- <30 = at risk of churning

---

## Trial Dashboard Queries

Key queries the admin dashboard runs against the events table:

### Signup funnel
```sql
-- Registration → onboarding → first swipe → first plan view → first store tap
SELECT
  COUNT(DISTINCT CASE WHEN event_type = 'user_registered' THEN user_id END) AS registrations,
  COUNT(DISTINCT CASE WHEN event_type = 'onboarding_completed' THEN user_id END) AS onboarded,
  COUNT(DISTINCT CASE WHEN event_type = 'swipe_mode_entered' THEN user_id END) AS first_swipe,
  COUNT(DISTINCT CASE WHEN event_type = 'shopping_list_viewed' THEN user_id END) AS viewed_list,
  COUNT(DISTINCT CASE WHEN event_type = 'store_address_tapped' THEN user_id END) AS tapped_store
FROM events
WHERE created_at >= :trial_start;
```

### Email performance by type
```sql
SELECT
  metadata->>'email_type' AS email_type,
  COUNT(*) FILTER (WHERE event_type = 'email_sent') AS sent,
  COUNT(*) FILTER (WHERE event_type = 'email_opened') AS opened,
  COUNT(*) FILTER (WHERE event_type = 'email_clicked') AS clicked,
  COUNT(*) FILTER (WHERE event_type = 'email_unsubscribed') AS unsubscribed
FROM events
WHERE event_type IN ('email_sent', 'email_opened', 'email_clicked', 'email_unsubscribed')
GROUP BY metadata->>'email_type';
```

### Viral coefficient
```sql
SELECT
  COUNT(*) FILTER (WHERE event_type IN ('share_meal_sent', 'share_plan_sent')) AS total_shares,
  COUNT(*) FILTER (WHERE event_type = 'share_link_opened') AS links_opened,
  COUNT(*) FILTER (WHERE event_type = 'share_recipient_signed_up') AS signups,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'share_recipient_signed_up')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE event_type IN ('share_meal_sent', 'share_plan_sent')), 0),
    3
  ) AS viral_coefficient
FROM events;
```

### Share accept/decline rate
```sql
SELECT
  COUNT(*) FILTER (WHERE event_type = 'share_meal_sent' AND metadata->>'share_type' = 'cook_for_me') AS requests_sent,
  COUNT(*) FILTER (WHERE event_type = 'share_meal_accepted') AS accepted,
  COUNT(*) FILTER (WHERE event_type = 'share_meal_declined') AS declined
FROM events;
```

### Recipe modal drop-off (opened vs. time spent)
```sql
SELECT
  metadata->>'source' AS opened_from,
  COUNT(*) AS opens,
  AVG((metadata->>'duration_seconds')::numeric) AS avg_duration_seconds
FROM events
WHERE event_type = 'recipe_modal_closed'
GROUP BY metadata->>'source';
```

### Pipeline health
```sql
SELECT
  event_type,
  metadata->>'users_processed' AS users_processed,
  metadata->>'users_skipped' AS users_skipped,
  metadata->>'meals_generated' AS meals_generated,
  metadata->>'total_cost_usd' AS cost,
  created_at
FROM events
WHERE event_type IN ('pipeline_scraper_completed', 'pipeline_planner_completed')
ORDER BY created_at DESC
LIMIT 10;
```

---

## What We Don't Track

- **Personal content**: never log message text, recipe ingredients, dietary restrictions, or contact info in event metadata
- **PII in metadata**: `user_id` is in the events table column, not in metadata. Metadata contains IDs (meal_id, deal_id) but never names or emails
- **Client-side errors**: not tracking JS errors in MVP. Add Sentry in v1 if needed.
- **Performance metrics**: not tracking API latency, page load times, or Lighthouse scores in MVP
