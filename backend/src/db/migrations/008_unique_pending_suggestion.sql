-- One *pending* suggestion per (family member, plan, target meal). Accepted/dismissed
-- rows don't block a re-suggestion, so the uniqueness is partial on status = 'pending'.
-- This is the duplicate-suggestion rule Slice 2 deferred: the UI hides the "Suggest a
-- swap" button while a suggestion is pending, the service returns 409 DUPLICATE_SUGGESTION
-- on a pre-check, and this index is the final guard against a race past that pre-check.
CREATE UNIQUE INDEX idx_meal_suggestions_one_pending_per_meal
    ON meal_suggestions (suggester_id, weekly_plan_id, target_meal_id)
    WHERE status = 'pending';
