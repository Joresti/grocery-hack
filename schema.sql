-- ============================================================
-- GroceryHack Database Schema v2
-- PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   TEXT NOT NULL UNIQUE,
    display_name            TEXT,
    postal_code             TEXT NOT NULL,
    lat                     DOUBLE PRECISION,
    lng                     DOUBLE PRECISION,
    budget                  NUMERIC(8,2),
    dietary_restrictions    TEXT[] DEFAULT '{}',
    max_stores              SMALLINT NOT NULL DEFAULT 1 CHECK (max_stores IN (1, 2)),
    household_size          SMALLINT NOT NULL DEFAULT 1,
    household_members       JSONB DEFAULT '[]',         -- [{name, age, dietary_restrictions}]
    household_names         TEXT[] DEFAULT '{}',         -- first names only, for Feeling Lucky spinner
    taste_profile           JSONB DEFAULT '{}',
    stripe_customer_id      TEXT,
    subscription_active     BOOLEAN NOT NULL DEFAULT false,
    push_token              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_postal_code ON users (postal_code);


-- ============================================================
-- 1b. PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,              -- 1 hour TTL
    used_at         TIMESTAMPTZ,                       -- set when token is consumed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens (token) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);


-- ============================================================
-- 2a. STORE BRANDS (chain-level — one per grocery chain/flyer)
-- ============================================================
CREATE TABLE store_brands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,                    -- "No Frills", "FreshCo", "Food Basics"
    flyer_url       TEXT,
    logo_url        TEXT,
    last_scraped_at TIMESTAMPTZ,
    scrape_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (scrape_status IN ('ok', 'failed', 'pending', 'disabled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 2b. STORE LOCATIONS (individual store addresses)
-- ============================================================
CREATE TABLE store_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_brand_id  UUID NOT NULL REFERENCES store_brands(id) ON DELETE CASCADE,
    address         TEXT NOT NULL,
    city            TEXT,
    region          TEXT,                                   -- province (CA) or state (US)
    postal_zip      TEXT,                                   -- postal code (CA) or zip code (US)
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (store_brand_id, address)
);

CREATE INDEX idx_store_locations_brand ON store_locations (store_brand_id);
CREATE INDEX idx_store_locations_latlng ON store_locations (lat, lng);


-- ============================================================
-- 3. DEALS
-- ============================================================
CREATE TABLE deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_brand_id      UUID NOT NULL REFERENCES store_brands(id) ON DELETE CASCADE,
    store_location_id   UUID REFERENCES store_locations(id) ON DELETE SET NULL,  -- set for user-reported (v2), null for flyer deals
    item_name           TEXT NOT NULL,
    category            TEXT,
    sale_price          NUMERIC(8,2) NOT NULL,
    regular_price       NUMERIC(8,2),
    unit                TEXT NOT NULL,
    deal_conditions     TEXT,
    valid_from          DATE NOT NULL,
    valid_to            DATE NOT NULL,
    source              TEXT NOT NULL DEFAULT 'flyer'
                        CHECK (source IN ('flyer', 'user_reported')),
    reported_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    report_photo_url    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_store_brand ON deals (store_brand_id);
CREATE INDEX idx_deals_store_location ON deals (store_location_id) WHERE store_location_id IS NOT NULL;
CREATE INDEX idx_deals_valid_dates ON deals (valid_from, valid_to);
CREATE INDEX idx_deals_item_name ON deals USING gin (item_name gin_trgm_ops);
CREATE INDEX idx_deals_category ON deals (category);


-- ============================================================
-- 4. MEALS (system-generated, shared across all users)
-- ============================================================
CREATE TABLE meals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    tagline                 TEXT,
    description             TEXT,
    instructions            TEXT,                        -- detailed cooking instructions (prose)
    images                  TEXT[] DEFAULT '{}',          -- URLs to meal images
    ingredients             JSONB NOT NULL,               -- [{name, quantity, unit}]
    steps                   TEXT[] NOT NULL,               -- 4-6 numbered steps
    prep_time_minutes       SMALLINT,
    cook_time_minutes       SMALLINT,
    servings                SMALLINT NOT NULL DEFAULT 4,
    difficulty              TEXT NOT NULL DEFAULT 'easy'
                            CHECK (difficulty IN ('easy', 'medium')),
    filter_tags             TEXT[] DEFAULT '{}',
    taste_tags              JSONB DEFAULT '{}',
    tips                    TEXT,
    ingredient_keywords     TEXT[] DEFAULT '{}',
    nutrition               JSONB,                        -- {calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, per_serving}
    swipe_right_count       INTEGER NOT NULL DEFAULT 0,
    swipe_left_count        INTEGER NOT NULL DEFAULT 0,
    approval_score          NUMERIC(5,4) DEFAULT NULL,    -- right / (right + left), null until 5+ swipes
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_filter_tags ON meals USING gin (filter_tags);
CREATE INDEX idx_meals_ingredient_keywords ON meals USING gin (ingredient_keywords);


-- ============================================================
-- 5. USER RECIPES (private unless shared publicly)
-- ============================================================
CREATE TABLE user_recipes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    tagline                 TEXT,
    description             TEXT,
    instructions            TEXT,
    images                  TEXT[] DEFAULT '{}',
    ingredients             JSONB NOT NULL,
    steps                   TEXT[],
    prep_time_minutes       SMALLINT,
    cook_time_minutes       SMALLINT,
    servings                SMALLINT DEFAULT 4,
    difficulty              TEXT DEFAULT 'easy'
                            CHECK (difficulty IN ('easy', 'medium')),
    dietary_tags            TEXT[] DEFAULT '{}',
    taste_tags              JSONB DEFAULT '{}',
    tips                    TEXT,
    ingredient_keywords     TEXT[] DEFAULT '{}',
    cost_drivers            TEXT[] DEFAULT '{}',
    nutrition               JSONB,
    is_public               BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_recipes_user_id ON user_recipes (user_id);
CREATE INDEX idx_user_recipes_ingredient_keywords ON user_recipes USING gin (ingredient_keywords);
CREATE INDEX idx_user_recipes_cost_drivers ON user_recipes USING gin (cost_drivers);
CREATE INDEX idx_user_recipes_public ON user_recipes (is_public) WHERE is_public = true;


-- ============================================================
-- 6. USER MEAL PREFERENCES (swipe data)
-- ============================================================
CREATE TABLE user_meal_preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_id     UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    liked       BOOLEAN NOT NULL,
    swiped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, meal_id)
);

CREATE INDEX idx_user_meal_prefs_user_id ON user_meal_preferences (user_id);
CREATE INDEX idx_user_meal_prefs_liked ON user_meal_preferences (user_id, liked) WHERE liked = true;


-- ============================================================
-- 7. DEAL WATCHLIST
-- ============================================================
CREATE TABLE deal_watchlist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_keyword        TEXT NOT NULL,
    product_name        TEXT NOT NULL,
    category            TEXT,
    subcategory         TEXT,
    product_metadata    JSONB DEFAULT '{}',
    price_tier          TEXT NOT NULL DEFAULT 'staple'
                        CHECK (price_tier IN ('staple', 'premium', 'luxury')),
    benchmark_price     NUMERIC(8,2) NOT NULL,
    benchmark_unit      TEXT NOT NULL,
    store_brand_id      UUID REFERENCES store_brands(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_watchlist_user_id ON deal_watchlist (user_id);
CREATE INDEX idx_deal_watchlist_item ON deal_watchlist (item_keyword);
CREATE INDEX idx_deal_watchlist_category ON deal_watchlist (category, subcategory);


-- ============================================================
-- 8. IMPORTANT ITEMS (user's recurring staples — milk, eggs, etc.)
--    One row per item per user. Never deleted, only toggled active/inactive.
-- ============================================================
CREATE TABLE important_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    quantity        TEXT,                                    -- e.g. "2L", "1 dozen", "1 loaf"
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at  TIMESTAMPTZ,                            -- when toggled off (for tracking behavior changes)

    UNIQUE (user_id, name)
);

CREATE INDEX idx_important_items_user_id ON important_items (user_id);
CREATE INDEX idx_important_items_active ON important_items (user_id, is_active) WHERE is_active = true;


-- ============================================================
-- 10. MEAL SHARES (cook-for-me / make-for-you requests with accept/decline)
-- ============================================================
CREATE TABLE meal_shares (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token               TEXT NOT NULL UNIQUE,              -- URL-safe token for unauthenticated respond link
    meal_id             UUID NOT NULL,                     -- references meals or user_recipes depending on meal_source
    meal_source         TEXT NOT NULL DEFAULT 'meal'
                        CHECK (meal_source IN ('meal', 'user_recipe')),
    share_type          TEXT NOT NULL
                        CHECK (share_type IN ('cook_for_me', 'make_for_you')),
    recipient_name      TEXT,
    recipient_contact   TEXT NOT NULL,                     -- email or phone
    channel             TEXT NOT NULL
                        CHECK (channel IN ('email', 'sms')),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    date                DATE,                              -- optional: when to cook
    time                TEXT,                              -- optional: HH:MM
    responded_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,              -- shares expire after 7 days
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_shares_sender ON meal_shares (sender_id);
CREATE INDEX idx_meal_shares_token ON meal_shares (token);
CREATE INDEX idx_meal_shares_status ON meal_shares (status) WHERE status = 'pending';


-- ============================================================
-- 11. WEEKLY PLANS (generated plans)
-- ============================================================
CREATE TABLE weekly_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token               TEXT NOT NULL UNIQUE,
    one_store_optimized JSONB NOT NULL,
    two_store_optimized JSONB,
    watchlist_alerts    JSONB DEFAULT '[]',
    recipe_alerts       JSONB DEFAULT '[]',
    week_of             DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_plans_user_id ON weekly_plans (user_id);
CREATE INDEX idx_weekly_plans_token ON weekly_plans (token);
CREATE INDEX idx_weekly_plans_week_of ON weekly_plans (user_id, week_of);


-- ============================================================
-- 12. FLYER REQUESTS
-- ============================================================
CREATE TABLE flyer_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flyer_url       TEXT NOT NULL,
    store_name      TEXT,                                   -- user-provided name, e.g. "No Frills"
    store_brand_id  UUID REFERENCES store_brands(id) ON DELETE SET NULL,  -- set when approved and matched to a brand
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    review_message  TEXT,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flyer_requests_user_id ON flyer_requests (user_id);
CREATE INDEX idx_flyer_requests_status ON flyer_requests (status);


-- ============================================================
-- 13. USAGE TRACKING (spend limits & rate control)
-- ============================================================
CREATE TABLE usage_tracking (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service         TEXT NOT NULL
                    CHECK (service IN ('claude', 'twilio', 'email', 'geocode')),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    period          TEXT NOT NULL
                    CHECK (period IN ('daily', 'monthly')),
    period_key      TEXT NOT NULL,                              -- e.g. '2026-03' for monthly, '2026-03-10' for daily
    request_count   INTEGER NOT NULL DEFAULT 0,
    estimated_cost  NUMERIC(10,4) NOT NULL DEFAULT 0,           -- USD, tracked per-call from model pricing
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (service, user_id, period, period_key)
);

-- Global counters (no user — pipeline-level or system-wide)
-- Use user_id = NULL for system-wide tracking (e.g. pipeline runs, global monthly spend)
CREATE INDEX idx_usage_tracking_service_period ON usage_tracking (service, period, period_key);
CREATE INDEX idx_usage_tracking_user ON usage_tracking (user_id, service, period, period_key);


-- ============================================================
-- 14. EVENTS (trial analytics)
-- ============================================================
CREATE TABLE events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id  TEXT,
    event_type  TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_user_id ON events (user_id, created_at);
CREATE INDEX idx_events_type ON events (event_type, created_at);
CREATE INDEX idx_events_session ON events (session_id, created_at);


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Haversine distance in kilometers
CREATE OR REPLACE FUNCTION haversine(
    lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    R CONSTANT DOUBLE PRECISION := 6371;
    dlat DOUBLE PRECISION;
    dlng DOUBLE PRECISION;
    a DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    a := sin(dlat / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;
    RETURN R * 2 * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_store_brands_updated_at
    BEFORE UPDATE ON store_brands FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_user_recipes_updated_at
    BEFORE UPDATE ON user_recipes FOR EACH ROW EXECUTE FUNCTION update_timestamp();


CREATE TRIGGER trg_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking FOR EACH ROW EXECUTE FUNCTION update_timestamp();
