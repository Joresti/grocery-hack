import { z } from 'zod';

// Known event types from the spec (packages/shared/types.ts EventType union)
const eventTypes = [
  'user_registered', 'user_logged_in', 'onboarding_completed',
  'email_sent', 'email_opened', 'email_clicked', 'email_unsubscribed',
  'session_start', 'session_end', 'page_view',
  'swipe_mode_entered', 'swipe_mode_exited', 'meal_swiped_right', 'meal_swiped_left',
  'recipe_modal_opened', 'recipe_modal_closed',
  'shopping_list_viewed', 'store_address_tapped', 'store_toggle_used', 'plan_revisited',
  'share_meal_tapped', 'share_meal_sent', 'share_meal_accepted', 'share_meal_declined',
  'share_plan_tapped', 'share_plan_sent', 'share_important_items_sent',
  'share_link_opened', 'share_recipient_signed_up', 'shared_plan_viewed',
  'calendar_link_tapped',
  'deal_hearted', 'deal_unhearted', 'watchlist_alert_viewed', 'absurd_deal_viewed',
  'recipe_form_opened', 'recipe_created', 'recipe_published', 'recipe_deleted', 'recipe_alert_viewed',
  'important_item_added', 'important_item_toggled', 'important_items_list_viewed',
  'optimizer_modal_opened', 'optimizer_run', 'flyer_request_submitted',
  'liked_meals_viewed', 'liked_meal_tapped',
  'feeling_lucky_spun',
  'pipeline_scraper_completed', 'pipeline_planner_completed', 'pipeline_planner_user_skipped', 'pipeline_spend_limit_hit',
] as const;

const singleEventSchema = z.object({
  event_type: z.enum(eventTypes),
  metadata: z.record(z.unknown()).optional().default({}),
  session_id: z.string().optional(),
  created_at: z.string().optional(),
});

const batchEventSchema = z.object({
  events: z.array(singleEventSchema).min(1).max(100),
});

// Accept either single event or batch
export const trackEventsBody = z.union([batchEventSchema, singleEventSchema]);

const publicEventTypes = ['share_link_opened', 'share_recipient_signed_up', 'shared_plan_viewed'] as const;

export const publicEventBody = z.object({
  event_type: z.enum(publicEventTypes),
  metadata: z.record(z.unknown()).refine(
    (m) => typeof m.token === 'string' && m.token.length > 0,
    { message: 'Invalid or missing token.' }
  ),
});
