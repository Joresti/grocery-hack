---
name: parse-flyer-fortinos
description: Parse grocery deals from the Fortinos flyer page using data-testid DOM selectors and page-number pagination via Chrome CDP. Built and tested against fortinos.ca/en/deals/flyer. Use this skill whenever parsing, scraping, or extracting deals from a Fortinos flyer, or when someone mentions Fortinos deals or flyer data.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (Fortinos)

Extract deals from the Fortinos flyer page by parsing structured HTML product tiles with `data-testid` selectors. Fortinos is a Loblaw Digital property — it shares the same `data-testid` DOM pattern as No Frills and Loblaws, but uses **page-number pagination** (up to ~48 pages) instead of infinite scroll.

## Arguments

`$ARGUMENTS` — the flyer items page URL.

Example: `https://www.fortinos.ca/en/deals/flyer`

## Prerequisites

Chrome must be running in **headed mode** (not headless) with `--remote-debugging-port=9222`:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run --no-default-browser-check &
```

Never use `--headless`. A visible browser is required for inspecting flyer layouts and debugging extraction.

## Instructions

### 1. Navigate to the flyer items page

```bash
python3 backend/scripts/cdp.py goto "<flyer_url>"
```

### 2. Dismiss popups

Fortinos shows a **pickup location modal** and a **cookie consent banner** on first visit. Dismiss both:

```bash
python3 backend/scripts/cdp.py eval "document.querySelectorAll('button').forEach(function(b){var t=b.textContent.trim();if(t==='Yes'||t==='Close')b.click();});'dismissed'"
```

Wait 1 second, then verify the modal is gone by checking that `[data-testid="product-title"]` elements are visible and clickable.

### 3. Run drift detection

Before extracting products, verify the page structure. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if `product-title` returns 0 elements, stop immediately. If hit rate is below 50%, the page has been redesigned and this skill's selectors need updating.

### 4. Extract products from all pages

Fortinos uses **page-number pagination** (not infinite scroll). The URL parameter `?page=N` controls the page. There are typically 40-50 pages with ~49 products each (roughly 2,000-2,500 total products).

**Strategy:** Iterate through pages by navigating to `<flyer_url>?page=N` for N = 1, 2, 3, ... until a page returns 0 products.

For each page, extract all `.chakra-linkbox` cards using these `data-testid` attributes:

| data-testid | Contains | Example |
|---|---|---|
| `product-title` | Product name | "Strawberries 1LB" |
| `product-brand` | Brand name (may be absent) | "Farmer's Market" |
| `sale-price` | Sale price with prefix | "sale: $2.99" or "sale$7.00" |
| `was-price` | Original price with prefix | ", formerly: $5.99" or "was$8.49" |
| `regular-price` | Regular price (non-sale items) | "$5.49" or "about $2.77" |
| `price-descriptor` | Savings description | "SAVE $3.00" |
| `product-package-size` | Size, weight, unit price | "454 g, $0.66/100g" |
| `product-badge` | Badge text (may be absent) | "Sponsored", "Prepared in Canada" |

**Extraction script per page:**

```bash
python3 backend/scripts/cdp.py eval "(function(){var cards=document.querySelectorAll('.chakra-linkbox');var r=[];for(var i=0;i<cards.length;i++){var c=cards[i];var g=function(s){var e=c.querySelector('[data-testid=\"'+s+'\"]');return e?e.textContent.trim():null;};var pcPts=c.textContent.indexOf('PC Optimum Points');var ptsMatch=pcPts>-1?c.textContent.match(/(\d+)\s*PC Optimum Points/):null;r.push({brand:g('product-brand'),name:g('product-title'),salePrice:g('sale-price'),wasPrice:g('was-price'),regularPrice:g('regular-price'),priceDesc:g('price-descriptor'),size:g('product-package-size'),badge:g('product-badge'),pcPoints:ptsMatch?ptsMatch[1]:null,plusTax:c.textContent.indexOf('Plus tax')>-1});}return JSON.stringify(r);})()"
```

**Page iteration loop:**

```bash
PAGE=1
while true; do
  python3 backend/scripts/cdp.py goto "<flyer_url>?page=$PAGE"
  sleep 2
  # Dismiss popups on first page
  if [ $PAGE -eq 1 ]; then
    python3 backend/scripts/cdp.py eval "document.querySelectorAll('button').forEach(function(b){var t=b.textContent.trim();if(t==='Yes'||t==='Close')b.click();});'ok'"
    sleep 1
  fi
  COUNT=$(python3 backend/scripts/cdp.py eval "document.querySelectorAll('[data-testid=\"product-title\"]').length")
  if [ "$COUNT" = "0" ]; then break; fi
  # Run extraction script and append results
  python3 backend/scripts/cdp.py eval "<extraction_script>"
  PAGE=$((PAGE + 1))
done
```

Stop when a page returns 0 product titles. Accumulate results across all pages before parsing.

### 5. Parse into deal records

For each product, parse the raw text into clean fields:

**item_name:** Combine brand + name. Append weight from `size` if present. Title Case.

**sale_price:** From `salePrice`. Strip "sale", "sale:", "about", "$", commas. Parse as number.

**regular_price:** From `wasPrice`. Strip "was", ", formerly:", "about", "$". Parse as number. If absent, use `regularPrice` field (some items show only a regular price). NULL if both absent.

**unit:** Derive from `size` field:
- `/1ea` or `X ea` → each
- `/1lb` or `/lb` → lb
- `/1kg` or `/kg` → kg
- `/100g` → 100g
- `/100ml` → 100ml
- Default: each

**category:** Classify from product name into one of: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**deal_conditions:** Build from available data:
- "SAVE $X.XX" from `priceDescriptor`
- "500 PC Optimum Points" if `pcPoints` is present
- "Plus tax" if `plusTax` is true
- "limit N" or "buy N get N" if present in any text
- Otherwise NULL

**Skip rules:**
- Skip items with NO `salePrice` AND no meaningful deal (regular-price-only items that aren't on sale)
- Skip non-grocery items (clothing, kitchen tools, home decor)
- Skip "Sponsored" badge items (these are ads, not flyer deals) — or flag them separately

### 6. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Farmer's Market Strawberries 1LB 454g",
  "product_type": "strawberries",
  "category": "produce",
  "sale_price": 2.99,
  "regular_price": 5.99,
  "unit": "each",
  "deal_conditions": "SAVE $3.00"
}
```

Report total deals extracted, count per category, and count of PC Optimum Points deals.

## Selector reference

| Selector | Stability | Notes |
|---|---|---|
| `[data-testid="product-title"]` | HIGH | Loblaw Digital standard; anchor for extraction |
| `[data-testid="product-brand"]` | HIGH | Absent on unbranded products (~40% null) |
| `[data-testid="sale-price"]` | HIGH | Present only on sale items |
| `[data-testid="was-price"]` | HIGH | Pairs with sale-price |
| `[data-testid="regular-price"]` | HIGH | Present on non-sale items |
| `[data-testid="price-descriptor"]` | HIGH | "SAVE $X.XX" text |
| `[data-testid="product-package-size"]` | HIGH | Size + unit price combined |
| `[data-testid="product-badge"]` | HIGH | "Sponsored", "Prepared in Canada" |
| `.chakra-linkbox` | MEDIUM | Card container — Chakra UI class, stable but not a testid |
| `[aria-label="Next Page"]` | HIGH | Pagination next button |
| `[aria-label="Page N"]` | HIGH | Individual page links |

## Key differences from No Frills

Fortinos and No Frills are both Loblaw Digital but differ in important ways:

1. **Pagination vs scroll:** Fortinos uses page numbers (`?page=N`, ~48 pages). No Frills uses infinite scroll. This is the biggest operational difference — you must iterate pages, not scroll.
2. **PC Optimum Points:** Fortinos cards can include "500 PC Optimum Points" promotions. Capture these in `deal_conditions`.
3. **Plus tax:** Carbonated beverages and candy show "Plus tax". Include in `deal_conditions`.
4. **Card container:** `.chakra-linkbox` at depth 4 from title (No Frills uses depth 5).
5. **Volume:** Fortinos has ~2,000-2,500 products across all pages vs No Frills ~50-300.
6. **Sponsored items:** Fortinos shows "Sponsored" products mixed in with flyer deals.

## Tested against

- Domain: `fortinos.ca/en/deals/flyer`
- Date: 2026-03-30
- Products on page 1: 49
- Total pages: 48
- Selectors confirmed: all 8 data-testid selectors present
