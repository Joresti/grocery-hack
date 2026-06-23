-- Family-member meal suggestions.
-- A family member proposes replacing a meal in the account holder's current-week
-- plan with another meal from the shared pool. The holder reviews / accepts / dismisses
-- (later slices). target_meal_id is a PlanMeal.mealId from the holder's plan JSONB
-- (no FK to meals); replacement_meal_id is a real meal from the pool.
CREATE TABLE meal_suggestions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggester_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_holder_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekly_plan_id      UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
    target_meal_id      UUID NOT NULL,           -- PlanMeal.mealId (meal from the holder's plan)
    replacement_meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'dismissed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_suggestions_suggester ON meal_suggestions (suggester_id);
CREATE INDEX idx_meal_suggestions_holder    ON meal_suggestions (account_holder_id);
CREATE INDEX idx_meal_suggestions_plan      ON meal_suggestions (weekly_plan_id);
