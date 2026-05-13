-- Match verdicts: permanent cache of ingredient↔product validation results
CREATE TABLE IF NOT EXISTS match_verdicts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_keyword  TEXT NOT NULL,
    product_type        TEXT NOT NULL,
    is_valid            BOOLEAN NOT NULL,
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (ingredient_keyword, product_type)
);

CREATE INDEX IF NOT EXISTS idx_match_verdicts_lookup
    ON match_verdicts (ingredient_keyword, product_type);

-- Pre-seed known bad matches
INSERT INTO match_verdicts (ingredient_keyword, product_type, is_valid, reason) VALUES
  ('butter',    'peanut butter',    false, 'Peanut butter is a spread, not dairy butter'),
  ('eggs',      'candy',            false, 'Candy eggs are confectionery, not real eggs'),
  ('lemon',     'iced tea',         false, 'Lemon iced tea is a beverage, not a lemon'),
  ('salt',      'potato chips',     false, 'Chips contain salt but are not salt'),
  ('garlic',    'pasta sauce',      false, 'Pasta sauce contains garlic but is not garlic'),
  ('cream',     'ice cream',        false, 'Ice cream is a dessert, not cooking cream'),
  ('lime',      'soda',             false, 'Lime soda is a beverage, not a lime'),
  ('water',     'coconut water',    false, 'Coconut water is a specialty beverage, not water'),
  ('mushrooms', 'condensed soup',   false, 'Mushroom soup is not a substitute for mushrooms'),
  ('honey',     'salad dressing',   false, 'Honey dressing is a condiment, not honey'),
  ('bread',     'granola bar',      false, 'Granola bars are snacks, not bread'),
  ('chicken',   'condensed soup',   false, 'Chicken soup is not a substitute for chicken'),
  ('beef',      'canned gravy',     false, 'Beef gravy is a condiment, not beef'),
  ('salmon',    'cream cheese',     false, 'Salmon cream cheese is a spread, not salmon'),
  ('dill',      'pickles',          false, 'Dill pickles are pickled cucumbers, not the herb dill')
ON CONFLICT (ingredient_keyword, product_type) DO NOTHING;
