-- Enforce one weekly_plans row per (user_id, week_of) so re-running the optimizer
-- updates the existing plan instead of accumulating duplicates.

-- Collapse any existing duplicates first: keep only the newest row per (user_id, week_of).
DELETE FROM weekly_plans wp
 WHERE EXISTS (
   SELECT 1
     FROM weekly_plans wp2
    WHERE wp2.user_id    = wp.user_id
      AND wp2.week_of    = wp.week_of
      AND wp2.created_at > wp.created_at
 );

ALTER TABLE weekly_plans
  ADD CONSTRAINT weekly_plans_user_week_unique UNIQUE (user_id, week_of);
