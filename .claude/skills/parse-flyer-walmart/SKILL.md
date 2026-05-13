---
name: parse-flyer-walmart
description: Parse grocery deals from the Walmart Canada flyer using the Flipp API (backflipp.wishabi.com). No browser required. Use this skill whenever parsing, scraping, or extracting deals from a Walmart flyer, or when someone mentions Walmart deals or flyer data.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (Walmart Canada)

Extract deals from the Walmart Canada weekly flyer via the Flipp API. Unlike other store scrapers that parse DOM elements from a browser, this skill calls Flipp's HTTP API directly — no Chrome, no CAPTCHA, no iframe navigation.

Walmart's flyer page (walmart.ca/en/flyer) renders deals inside a Flipp iframe protected by PerimeterX bot detection. The Flipp API serves the same data without those barriers.

## Arguments

`$ARGUMENTS` — the flyer page URL (used for context only; data comes from the API).

Example: `https://www.walmart.ca/en/flyer`

## Prerequisites

- `curl` must be available
- `python3` with `json` module (stdlib)
- No browser required

## Instructions

### 1. Run drift detection

Before fetching deals, verify the API is still responding and the data shape hasn't changed. Read and follow `references/drift-detection.md`. If any check fails, stop and report the failure — do not proceed with stale or broken data.

### 2. Get the current flyer ID

Walmart Canada's Flipp merchant ID is **234**. Fetch the active flyers list:

```bash
curl -s "https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=234" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
flyers = [f for f in data.get('flyers', []) if f.get('merchant_id') == 234]
for f in flyers:
    print(json.dumps({'id': f['id'], 'name': f['name'], 'valid_from': f['valid_from'], 'valid_to': f['valid_to'], 'categories': f.get('categories_csv', '')}, indent=2))
"
```

Pick the flyer where `categories` includes "Groceries" and `valid_to` is in the future. If multiple match, use the one with the most recent `valid_from`. Save the flyer ID.

### 3. Fetch all flyer items

```bash
curl -s "https://backflipp.wishabi.com/flipp/flyers/<FLYER_ID>?locale=en-ca&postal_code=L9A0A1" | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
items = data.get('items', [])
# Filter to actual products (display_type=1), skip banners (display_type=5)
products = [i for i in items if i.get('display_type') == 1 and i.get('price')]
print(json.dumps(products))
" > /tmp/walmart-flyer-raw.json
```

Verify the count: `python3 -c "import json; d=json.load(open('/tmp/walmart-flyer-raw.json')); print(len(d), 'products')"`

Expected range: **400-900 products**. If below 100, something is wrong — stop and check.

### 4. Parse into deal records

The Flipp API returns these fields per item:

| API field | Maps to | Notes |
|---|---|---|
| `name` | `item_name` | Often includes brand + product + size. Title Case it. |
| `brand` | (prefix for item_name) | NULL for ~45% of items. Only prepend if not already in `name`. |
| `price` | `sale_price` | String like "2.97". Parse as float. |
| `discount` | (used to estimate regular_price) | Integer percentage, e.g. 25 means 25% off. NULL if no discount. |
| `display_type` | (filter) | 1 = product, 5 = banner. Only keep 1. |
| `valid_from` / `valid_to` | (flyer date range) | For temporal validation. |

**item_name:** Use `name` as-is, converted to Title Case. If `brand` is present and not already a prefix of `name`, prepend it. Example: brand="Colgate", name="360 Advanced toothbrushes" -> "Colgate 360 Advanced Toothbrushes".

**sale_price:** Parse `price` string as float. Skip items where `price` is empty or zero.

**regular_price:** If `discount` is not null, calculate: `sale_price / (1 - discount/100)`, rounded to 2 decimal places. Otherwise NULL.

**unit:** Default to "each". The Flipp API does not provide unit/weight data consistently. Parse from `name` if it contains weight patterns (e.g., "454g", "1.5L", "2-pack").

**category:** Classify from product name using this canonical list: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**deal_conditions:** Parse from `name` if it contains multi-buy patterns ("2-pack", "buy 2"). Otherwise NULL. The Flipp API does not provide structured deal conditions.

**Skip rules:**
- Skip items with no `price` or price of 0
- Skip `display_type` != 1 (banners, headers)
- Skip non-grocery items (furniture, mattresses, electronics, clothing, jewelry, automotive, toys, sporting goods). Use the product name and price as signals — items over $50 are rarely grocery.

### 5. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Cracker Barrel Cheese Slices",
  "product_type": "cheese slices",
  "category": "dairy",
  "sale_price": 5.98,
  "regular_price": null,
  "unit": "each",
  "deal_conditions": null
}
```

Report total deals extracted and count per category.

## Key differences from other store skills

| Aspect | Walmart | Other stores |
|---|---|---|
| **Data source** | Flipp HTTP API | Chrome CDP DOM scraping |
| **Browser required** | No | Yes (headed Chrome on port 9222) |
| **Pagination** | None — single API call returns all items | Scroll or Load More button loops |
| **Category data** | Not provided by API — must classify from name | Not provided by DOM — must classify from name |
| **Anti-bot** | None on API (PerimeterX on website) | Varies |
| **Fragility** | API could be removed/auth-gated at any time | DOM selectors drift with redesigns |

## API reference

| Endpoint | Purpose |
|---|---|
| `GET /flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=234` | List active Walmart flyers with IDs and date ranges |
| `GET /flipp/flyers/:id?locale=en-ca&postal_code=L9A0A1` | Get all items for a specific flyer |

Both endpoints return JSON. No authentication required (as of 2026-03-30). The `postal_code` parameter affects which store's flyer is returned — use the user's postal code or a default Ontario one.

## Tested against

- Domain: backflipp.wishabi.com (Flipp API for walmart.ca/en/flyer)
- Date: 2026-03-30
- Flyer ID: 7847887 (valid 2026-03-26 to 2026-04-01)
- Results: 686 products (display_type=1), 78 banners filtered out, 33 pages
