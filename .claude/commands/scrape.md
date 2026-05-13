---
allowed-tools:
  - Bash
  - Read
  - Grep
  - Write
  - Skill
---

# Scrape Store Flyer

Scrape deals from a single grocery store flyer and insert them into the database.

## Arguments

`$ARGUMENTS` — store name (required). Must match a `store_brands.name` value (case-insensitive).

Examples: `No Frills`, `Metro`, `Walmart`, `Fortinos`, `RCSS`, `FreshCo`, `Food Basics`, `Highland Packers`

## Instructions

### 1. Look up the store

```bash
PGPASSWORD=dev psql -U dev -d groceryhack -t -A -F'|' -c \
  "SELECT id, name, flyer_url FROM store_brands
   WHERE scrape_status != 'disabled' AND flyer_url IS NOT NULL
   AND lower(name) LIKE lower('%$ARGUMENTS%')
   LIMIT 1;"
```

Stop if no match. Print the matched store name.

### 2. Calculate flyer dates

Canadian grocery flyers run Thursday-Wednesday. Calculate:
- `valid_from` = this Thursday (or today if Thursday)
- `valid_to` = valid_from + 6 days

### 3. Run the store's parse-flyer skill

Invoke the matching skill by name:

| Store name pattern | Skill |
|---|---|
| No Frills | `/parse-flyer-nofrills` |
| Metro | `/parse-flyer-metro` |
| Walmart | `/parse-flyer-walmart` |
| Fortinos | `/parse-flyer-fortinos` |
| Real Canadian Superstore, RCSS | `/parse-flyer-rcss` |
| FreshCo | `/parse-flyer-freshco` |
| Food Basics | `/parse-flyer-foodbasics` |
| Highland Packers | `/parse-flyer-highlandpackers` |

Pass the store's `flyer_url` as the skill argument.

### 4. Insert deals

Delete existing flyer deals for this store/week, then multi-row INSERT into `deals` (columns: store_brand_id, item_name, product_type, category, sale_price, regular_price, unit, unit_size, price_type, deal_conditions, valid_from, valid_to, source='flyer').

- `unit_size`: package size as shown on flyer (e.g. "454 g", "2 kg", "1 L", "6 ea"). NULL if not shown.
- `price_type`: one of 'fixed', 'per_weight', 'multi_buy', 'bogo'. Use 'per_weight' when unit is lb/kg/100g, 'multi_buy' for "2 for $5" type deals, 'bogo' for buy-one-get-one, 'fixed' otherwise.

### 5. Update store and deduplicate

```bash
PGPASSWORD=dev psql -U dev -d groceryhack -c \
  "UPDATE store_brands SET scrape_status = 'ok', last_scraped_at = now(), updated_at = now() WHERE id = 'STORE_UUID';"
```

```bash
PGPASSWORD=dev psql -U dev -d groceryhack -c \
  "DELETE FROM deals a USING deals b
   WHERE a.id > b.id AND a.store_brand_id = b.store_brand_id
   AND lower(a.item_name) = lower(b.item_name)
   AND a.sale_price = b.sale_price AND a.valid_from = b.valid_from;"
```

If scraping fails, set `scrape_status = 'failed'`.

### 6. Report

```bash
PGPASSWORD=dev psql -U dev -d groceryhack -c \
  "SELECT sb.name, COUNT(d.id) as deals, sb.scrape_status, sb.last_scraped_at
   FROM store_brands sb
   LEFT JOIN deals d ON d.store_brand_id = sb.id AND d.valid_from >= CURRENT_DATE - INTERVAL '7 days'
   WHERE sb.id = 'STORE_UUID'
   GROUP BY sb.id;"
```
