---
name: parse-flyer-nofrills
description: Parse grocery deals from the No Frills flyer page using data-testid DOM selectors and page-number pagination via Chrome CDP. Built and tested against nofrills.ca/en/deals/flyer. Use this skill whenever parsing, scraping, or extracting deals from a No Frills flyer, or when someone mentions No Frills deals or flyer data.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (No Frills)

Extract deals from the No Frills flyer page by parsing structured HTML product tiles with `data-testid` selectors. No Frills is a Loblaw Digital property — it shares the same `data-testid` DOM pattern as RCSS, Fortinos, and Loblaws, and uses **page-number pagination** (`?page=N`, ~30-39 pages, ~1,500-1,900 products).

## Arguments

`$ARGUMENTS` — the flyer items page URL.

Example: `https://www.nofrills.ca/en/deals/flyer`

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

No Frills may show a **pickup location modal** ("Would you like to pick up here?") and a **cookie consent banner** on first visit. Dismiss both:

```bash
python3 backend/scripts/cdp.py eval "document.querySelectorAll('button').forEach(function(b){var t=b.textContent.trim();if(t==='Yes'||t==='Close')b.click();});'dismissed'"
```

Wait 2 seconds, then verify the modal is gone by checking that `[data-testid="product-title"]` elements are visible.

### 3. Run drift detection

Before extracting products, verify the page structure. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if `product-title` returns 0 elements, stop immediately. If hit rate is below 50%, the page has been redesigned and this skill's selectors need updating.

### 4. Extract products from all pages

No Frills uses **page-number pagination** (not infinite scroll). The URL parameter `?page=N` controls the page. There are typically ~30-39 pages with ~49 products each (roughly 1,500-1,900 total products).

**Strategy:** Use a single browser tab and navigate sequentially through each page. Wait **12 seconds** between page loads to avoid triggering rate limiting or bot detection. Pages returning ≤1 product title are treated as empty (No Frills shows a sticky sponsored card on every page, so count bottoms out at 1, never 0). Stop pagination when a page returns ≤1 product.

**Never open multiple tabs or make concurrent requests.** Always scrape one page at a time in the same tab.

For each page, extract all `.chakra-linkbox` cards using these `data-testid` attributes:

| data-testid | Contains | Example |
|---|---|---|
| `product-title` | Product name | "Strawberries 1LB" |
| `product-brand` | Brand name (may be absent) | "Farmer's Market" |
| `sale-price` | Sale price with prefix | "sale: $2.99", "sale$7.00" |
| `was-price` | Original price with prefix | ", formerly: $3.99" or "was$8.49" |
| `regular-price` | Regular price (non-sale items) | "$0.88" or "about $3.98" |
| `price-descriptor` | Savings description | "SAVE $1.00" |
| `product-package-size` | Size, weight, unit price | "454 g, $0.66/100g" |
| `product-badge` | Badge text (may be absent) | "Sponsored" |

**Pagination loop (single tab):**

For each page N from 1 to 45:

1. Navigate to `<flyer_url>?page=N` in the current tab:
   ```bash
   python3 backend/scripts/cdp.py goto "<flyer_url>?page=N"
   ```
2. Wait 5 seconds for the page to render.
3. Count product titles:
   ```bash
   python3 backend/scripts/cdp.py eval "document.querySelectorAll('[data-testid=\"product-title\"]').length"
   ```
4. If count ≤1, this is the last page — stop pagination.
5. Extract all product cards from this page using the extraction script (see below).
6. Append extracted products to a running collection.
7. **Wait 12 seconds** before navigating to the next page.

**Extraction script** (run once per page via `cdp.py eval`):

```js
(function(){var cards=document.querySelectorAll('.chakra-linkbox');var results=[];for(var i=0;i<cards.length;i++){var c=cards[i];var gt=function(sel){var el=c.querySelector('[data-testid="'+sel+'"]');return el?el.textContent.trim():null;};results.push({name:gt('product-title'),brand:gt('product-brand'),salePrice:gt('sale-price'),wasPrice:gt('was-price'),regularPrice:gt('regular-price'),priceDescriptor:gt('price-descriptor'),size:gt('product-package-size'),badge:gt('product-badge')});}return JSON.stringify(results);})()
```

After all pages are collected, write the combined JSON array to `/tmp/nofrills_raw.json`.

Expected: ~1,500-1,900 products across ~35 pages. Total scrape time: ~7-8 minutes (12s wait × ~35 pages).

**Sponsored card deduplication:** No Frills shows a sticky "Sponsored" ad card on every page. After collecting all pages, deduplicate by filtering out items where `badge === "Sponsored"` — or keep only the first occurrence.

### 5. Parse into deal records

For each product, parse the raw text into clean fields:

**item_name:** Combine brand + name. Append weight from `size` if present. Title Case.

**sale_price:** From `salePrice`. Strip "sale", "sale:", "about", "$", commas. Parse as number.

**regular_price:** From `wasPrice`. Strip "was", ", formerly:", "about", "$". Parse as number. If absent, use `regularPrice` field (some items show only a regular price). NULL if both absent.

**unit:** Derive from `size` field. If a package quantity appears before the comma (e.g. "454 g, $0.66/100g"), the item is sold as a unit — use "each". If no package quantity and only a per-weight price (e.g. "$2.07/1lb"), use that weight unit:
- Package weight + any unit price → each
- `/1lb` or `/lb` (no package) → lb
- `/1kg` or `/kg` (no package) → kg
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
- "1,000 PC Optimum Points" if `pcPoints` is present
- "Plus tax" if `plusTax` is true
- "limit N" or "buy N get N" if present in any text
- Otherwise NULL

**Skip rules:**
- Skip items with NO `salePrice` AND no meaningful deal (regular-price-only items that aren't on sale). Only keep items with a `salePrice` or a `priceDescriptor` (SAVE amount).
- Skip non-grocery items (clothing, kitchen tools, home decor)
- Skip "Sponsored" badge items (these are ads, not flyer deals)

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
  "deal_conditions": "SAVE $1.00"
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
| `[data-testid="product-badge"]` | HIGH | "Sponsored" |
| `.chakra-linkbox` | MEDIUM | Card container — Chakra UI class, stable but not a testid |

## Key differences from RCSS/Fortinos

No Frills, RCSS, and Fortinos are all Loblaw Digital with identical selectors, but differ operationally:

1. **Catalog size:** No Frills has ~30-39 pages (~1,500-1,900 products). RCSS has ~133 pages (~6,500). Fortinos has ~48 pages (~2,500).
2. **Sticky sponsored card:** Same as RCSS — a "Sponsored" ad card appears on every page. Deduplicate after collection. Stop at ≤1 product titles.
3. **URL structure:** `/en/deals/flyer?page=N`. The `/en/print-flyer` URL is the Flipp flipbook (image-only, no structured DOM) — do not scrape it.
4. **PC Optimum Points:** Present on some deals, same as RCSS/Fortinos.
5. **Plus tax:** Chips, candy, carbonated beverages flagged with "Plus tax".

## Tested against

- Domain: `nofrills.ca/en/deals/flyer`
- Date: 2026-03-31
- Products on page 1: 49
- Total pages: ~35 (bottoms out at 1 product around page 35-39)
- Estimated total products: ~1,700
- Selectors confirmed: all 7 data-testid selectors present (100% hit rate)
- Card container: `.chakra-linkbox`
