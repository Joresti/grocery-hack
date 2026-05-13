---
name: parse-flyer-rcss
description: Parse grocery deals from the Real Canadian Superstore flyer page using data-testid DOM selectors and page-number pagination via Chrome CDP. Built and tested against realcanadiansuperstore.ca/en/deals/flyer. Use this skill whenever parsing, scraping, or extracting deals from a Real Canadian Superstore flyer, or when someone mentions RCSS, Real Canadian Superstore, or Superstore deals or flyer data.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (Real Canadian Superstore)

Extract deals from the Real Canadian Superstore (RCSS) flyer page by parsing structured HTML product tiles with `data-testid` selectors. RCSS is a Loblaw Digital property — it shares the same `data-testid` DOM pattern as No Frills, Fortinos, and Loblaws, but has a **much larger catalog** (~133 pages, ~6,500 products) with **page-number pagination**.

## Arguments

`$ARGUMENTS` — the flyer items page URL.

Example: `https://www.realcanadiansuperstore.ca/en/deals/flyer`

**Important:** The URL must be the `/en/deals/flyer` grid view, NOT `/en/print-flyer` (which shows an image-based Flipp flipbook with no structured DOM).

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

RCSS shows a **pickup location modal** ("Would you like to pick up here?") and may show a **cookie consent banner** on first visit. Dismiss both:

```bash
python3 backend/scripts/cdp.py eval "document.querySelectorAll('button').forEach(function(b){var t=b.textContent.trim();if(t==='Yes'||t==='Close')b.click();});'dismissed'"
```

Wait 2 seconds, then verify the modal is gone by checking that `[data-testid="product-title"]` elements are visible and clickable. RCSS may take a moment to load products after dismissing the modal.

### 3. Run drift detection

Before extracting products, verify the page structure. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if `product-title` returns 0 elements, stop immediately. If hit rate is below 50%, the page has been redesigned and this skill's selectors need updating.

### 4. Extract products from all pages

RCSS uses **page-number pagination** (not infinite scroll). The URL parameter `?page=N` controls the page. There are typically ~133 pages with ~49 products each (roughly 6,000-6,500 total products). This is significantly more than Fortinos (~48 pages) because RCSS includes its full flyer catalog plus many regular-price items.

**Strategy:** Iterate through pages by navigating to `<flyer_url>?page=N` for N = 1, 2, 3, ... until a page returns 0 products.

For each page, extract all `.chakra-linkbox` cards using these `data-testid` attributes:

| data-testid | Contains | Example |
|---|---|---|
| `product-title` | Product name | "Strawberries 1LB" |
| `product-brand` | Brand name (may be absent) | "Farmer's Market" |
| `sale-price` | Sale price with prefix | "sale: $2.00", "sale$7.00", "sale: $3.00 MIN 2" |
| `was-price` | Original price with prefix | ", formerly: $3.98" or "was$8.49" |
| `regular-price` | Regular price (non-sale items) | "$5.49" or "about $2.77" |
| `price-descriptor` | Savings description | "SAVE $1.98" |
| `product-package-size` | Size, weight, unit price | "454 g, $0.44/100g" |
| `product-badge` | Badge text (may be absent) | "Sponsored", "Prepared in Canada" |

**Extraction script per page:**

```bash
python3 backend/scripts/cdp.py eval "(function(){var cards=document.querySelectorAll('.chakra-linkbox');var r=[];for(var i=0;i<cards.length;i++){var c=cards[i];var g=function(s){var e=c.querySelector('[data-testid=\"'+s+'\"]');return e?e.textContent.trim():null;};var title=g('product-title');if(!title)continue;var pcPts=c.textContent.indexOf('PC Optimum Points');var ptsMatch=pcPts>-1?c.textContent.match(/(\d[\d,]*)\s*PC Optimum Points/):null;r.push({brand:g('product-brand'),name:title,salePrice:g('sale-price'),wasPrice:g('was-price'),regularPrice:g('regular-price'),priceDesc:g('price-descriptor'),size:g('product-package-size'),badge:g('product-badge'),pcPoints:ptsMatch?ptsMatch[1]:null,plusTax:c.textContent.indexOf('Plus tax')>-1});}return JSON.stringify(r);})()"
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
  if [ "$COUNT" -le 1 ]; then break; fi
  # Run extraction script and append results
  python3 backend/scripts/cdp.py eval "<extraction_script>"
  PAGE=$((PAGE + 1))
done
```

Stop when a page returns **1 or fewer** product titles. The sticky sponsored card (e.g., Minute Rice) appears on every page including empty ones, so the count never reaches 0 — it bottoms out at 1. Accumulate results across all pages before parsing.

**Sponsored card deduplication:** RCSS shows a sticky "Sponsored" ad card (e.g., Minute Rice) on every page. It has `badge: "Sponsored"` and appears at the same position. After collecting all pages, deduplicate by filtering out items where `badge === "Sponsored"` — or keep only the first occurrence.

### 5. Parse into deal records

For each product, parse the raw text into clean fields:

**item_name:** Combine brand + name. Append weight from `size` if present. Title Case.

**sale_price:** From `salePrice`. Strip "sale", "sale:", "about", "$", "MIN N" suffix, commas. Parse as number. Multi-buy items show `"sale: $3.00 MIN 2"` — the price is per-item, and "MIN 2" goes into `deal_conditions`.

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
- "MIN N" if the sale price text contains "MIN 2", "MIN 3", etc. (minimum purchase quantity for multi-buy deals)
- "1,000 PC Optimum Points" if `pcPoints` is present
- "Plus tax" if `plusTax` is true
- "limit N" or "buy N get N" if present in any text
- Otherwise NULL

**Skip rules:**
- Skip items with NO `salePrice` AND no meaningful deal (regular-price-only items that aren't on sale). RCSS shows many regular-price items in its flyer — only keep items with a `salePrice` or a `priceDescriptor` (SAVE amount).
- Skip non-grocery items (clothing, kitchen tools, home decor)
- Skip "Sponsored" badge items (these are ads, not flyer deals)

### 6. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Farmer's Market Strawberries 1LB 454g",
  "product_type": "strawberries",
  "category": "produce",
  "sale_price": 2.00,
  "regular_price": 3.98,
  "unit": "each",
  "deal_conditions": "SAVE $1.98"
}
```

Report total deals extracted, count per category, count of PC Optimum Points deals, and count of Plus Tax items.

## Selector reference

| Selector | Stability | Notes |
|---|---|---|
| `[data-testid="product-title"]` | HIGH | Loblaw Digital standard; anchor for extraction |
| `[data-testid="product-brand"]` | HIGH | Absent on unbranded products (~40% null) |
| `[data-testid="sale-price"]` | HIGH | Present only on sale items (~50% of flyer items) |
| `[data-testid="was-price"]` | HIGH | Pairs with sale-price |
| `[data-testid="regular-price"]` | HIGH | Present on non-sale items |
| `[data-testid="price-descriptor"]` | HIGH | "SAVE $X.XX" text |
| `[data-testid="product-package-size"]` | HIGH | Size + unit price combined |
| `[data-testid="product-badge"]` | HIGH | "Sponsored", "Prepared in Canada" |
| `[data-testid="product-pco-badge"]` | HIGH | "1,000 PC Optimum Points" (dedicated selector) |
| `.chakra-linkbox` | MEDIUM | Card container — Chakra UI class, stable but not a testid |
| `[data-testid="pagination"]` | HIGH | Pagination container |

## Key differences from Fortinos

RCSS and Fortinos are both Loblaw Digital with identical selectors, but differ operationally:

1. **Catalog size:** RCSS has ~133 pages (~6,500 products) vs Fortinos ~48 pages (~2,500). RCSS includes many regular-price items alongside sale items, so aggressive filtering by `salePrice` presence is essential.
2. **Sticky sponsored card:** RCSS displays the same "Sponsored" ad card on every page. Deduplicate after collection.
3. **URL structure:** RCSS uses `/en/deals/flyer?page=N`. The `/en/print-flyer` URL is the Flipp flipbook (image-only, no structured DOM) — do not scrape it.
4. **PC Optimum Points:** Both stores have them. RCSS also has a dedicated `[data-testid="product-pco-badge"]` selector.
5. **Multi-buy "MIN N":** RCSS sale prices can include `"sale: $3.00 MIN 2"` indicating a minimum purchase quantity. Extract the price and put "MIN 2" into `deal_conditions`.
6. **Plus tax:** Chips, candy, carbonated beverages flagged with "Plus tax" — same as Fortinos.
7. **Termination condition:** The sticky sponsored card means page count never reaches 0 — stop at ≤1 product titles.
8. **Card container:** `.chakra-linkbox` at depth 4 from `product-title` — same as Fortinos.

## Key differences from No Frills

1. **Pagination vs scroll:** RCSS uses page numbers (`?page=N`). No Frills uses infinite scroll.
2. **Card container depth:** 4 levels up from `product-title` (No Frills is 5).
3. **Volume:** ~6,500 products vs ~50-300 for No Frills.

## Tested against

- Domain: `realcanadiansuperstore.ca/en/deals/flyer`
- Date: 2026-03-31
- Products on page 1: 49 (plus 1 sponsored ad card)
- Total pages: 133
- Estimated total products: ~6,500
- Selectors confirmed: all 8 data-testid selectors present
- PC Optimum Points deals: present (1,000 and 1,500 point offers observed)
- Plus Tax items: present (chips, candy, tortilla chips)
- Badges: "Sponsored", "Prepared in Canada"
