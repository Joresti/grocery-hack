-- Add unit_size and price_type columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS unit_size TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'per_weight', 'multi_buy', 'bogo'));

-- Backfill price_type for existing per-weight deals
UPDATE deals SET price_type = 'per_weight' WHERE unit IN ('lb', 'kg', '100g') AND price_type = 'fixed';
