---
name: parse-flyer-nofrills-print
description: Parse grocery deals from the No Frills print-flyer page using data-testid DOM selectors and scroll-based loading via Chrome CDP. Built and tested against nofrills.ca/en/print-flyer. Use this skill when scraping the No Frills print flyer view specifically.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (No Frills — Print Flyer)

Extract deals from the No Frills **print-flyer** page by parsing structured HTML product tiles with `data-testid` selectors. This is the `/en/print-flyer` view which loads all products on a single page via scrolling — unlike the paginated `/en/deals/flyer` grid view.

## Arguments

`$ARGUMENTS` — the print-flyer page URL.

Example: `https://www.nofrills.ca/en/print-flyer`

## Prerequisites

Chrome must be running in **headed mode** (not headless) with `--remote-debugging-port=9222`:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run --no-default-browser-check &
```

Never use `--headless`. A visible browser is required for inspecting flyer layouts and debugging extraction.

## Instructions

### 1. Navigate to the print-flyer page

```bash
python3 backend/scripts/cdp.py goto "<flyer_url>"
```

### 2. Run drift detection

Before scrolling to load all products, verify the page structure. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if `product-title` returns 0 elements, stop immediately. If hit rate is below 50%, the page has been redesigned and this skill's selectors need updating.

### 3. Scroll to bottom to load all products

The page lazy-loads products. Scroll to the bottom repeatedly until all products are loaded:

```bash
python3 backend/scripts/cdp.py eval "window.scrollTo(0, document.body.scrollHeight); document.querySelectorAll('[data-testid=\"product-title\"]').length;"
```

Wait 2 seconds between scrolls. Stop when the count stops increasing or after 20 attempts.

### 4. Extract all products via DOM selectors

Each product tile uses these `data-testid` attributes:

| data-testid | Contains | Example |
|---|---|---|
| `product-brand` | Brand name (may be absent) | "Farmer's Market" |
| `product-title` | Product name | "Strawberries 1LB" |
| `sale-price` | Sale price | "sale$2.99" or "sale: $2.99" |
| `was-price` | Original price | "was$3.99" or ", formerly: $3.99" |
| `regular-price` | Regular price (non-sale items) | "$0.88" or "about $3.98" |
| `price-descriptor` | Savings description | "SAVE $1.00" |
| `product-package-size` | Size, weight, unit price | "454 g, $0.66/100g" |

Extract using `product-title` as anchor — walk up to the nearest `.chakra-linkbox` container (or walk up 3 parent levels if `.chakra-linkbox` is absent), then query within it:

```bash
python3 backend/scripts/cdp.py eval "(function(){var t=document.querySelectorAll('[data-testid=\"product-title\"]');var r=[];for(var i=0;i<t.length;i++){var c=t[i].parentElement;for(var j=0;j<3;j++){if(c.parentElement)c=c.parentElement;}var g=function(s){var e=c.querySelector('[data-testid=\"'+s+'\"]');return e?e.textContent.trim():null;};r.push({brand:g('product-brand'),name:g('product-title'),salePrice:g('sale-price'),wasPrice:g('was-price'),regularPrice:g('regular-price'),priceDesc:g('price-descriptor'),size:g('product-package-size')});}return JSON.stringify(r);})()"
```

If output is too large, extract in batches of 50 using array slicing.

### 5. Parse into deal records

For each product, parse the raw text into clean fields:

**item_name:** Combine brand + name. Append weight from `size` if present. Title Case.

**sale_price:** From `salePrice`. Strip "sale", "sale:", "$", "about". Parse as number.

**regular_price:** From `wasPrice`. Strip "was", "formerly:", "$". Parse as number. NULL if absent.

**unit:** Derive from `size` field. If a package quantity appears before the comma (e.g. "454 g, $0.66/100g"), the item is sold as a unit — use "each". If no package quantity and only a per-weight price (e.g. "$2.07/1lb"), use that weight unit:
- Package weight + any unit price → each
- `/1lb` or `/lb` (no package) → lb
- `/1kg` or `/kg` (no package) → kg
- Default: each

**category:** Classify from product name: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**deal_conditions:** "limit N", "2 for $X", "buy one get one" if present. Otherwise NULL.

**Skip rules:**
- Skip items with NO `salePrice` (only `regularPrice` = not on sale)
- Skip non-grocery items (clothing, kitchen tools, home decor)

### 6. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Farmer's Market Strawberries 1LB 454g",
  "product_type": "strawberries",
  "category": "produce",
  "sale_price": 2.99,
  "regular_price": 3.99,
  "unit": "each",
  "deal_conditions": null
}
```

Report total deals extracted and count per category.
