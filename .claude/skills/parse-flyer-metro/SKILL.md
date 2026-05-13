---
name: parse-flyer-metro
description: Parse grocery deals from the Metro flyer page using .default-product-tile CSS selectors, rich data-* attributes, and "Load More Deals" button auto-clicking via Chrome CDP. Built and tested against metro.ca/en/flyer. Use this skill whenever parsing, scraping, or extracting deals from a Metro flyer, even if the user just says "scrape Metro" or "get Metro deals".
user-invocable: true
---

# Parse Grocery Flyer (Metro)

Extract deals from the Metro flyer page. Metro is a Metro Inc. brand sharing the `.default-product-tile` DOM pattern with Food Basics, but Metro cards carry **rich `data-*` attributes** (`data-product-name`, `data-product-brand`, `data-product-category-en`, `data-main-price`, `data-discount-percent`, `data-is-weighted`) that make extraction more reliable than CSS text parsing alone.

## Arguments

`$ARGUMENTS` — the flyer page URL.

Example: `https://www.metro.ca/en/flyer`

## Prerequisites

Chrome must be running in **headed mode** (not headless) with `--remote-debugging-port=9222`:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run --no-default-browser-check &
```

Never use `--headless`.

## Instructions

### 1. Navigate to the flyer page

```bash
python3 backend/scripts/cdp.py goto "<flyer_url>"
```

### 2. Dismiss popups

Accept the cookie consent banner and close any tour/onboarding overlays:

```js
// Accept cookies — Metro uses a standard cookie banner
var buttons = document.getElementsByTagName('button');
for (var i = 0; i < buttons.length; i++) {
  if (buttons[i].textContent.trim() === 'Accept All') {
    buttons[i].click();
    break;
  }
}

// Dismiss tour popup if present (may appear inside Flipp iframe area)
var allEls = document.querySelectorAll('button, a, span');
for (var i = 0; i < allEls.length; i++) {
  if (allEls[i].textContent.trim().indexOf('Skip Tour') >= 0) {
    allEls[i].click();
    break;
  }
}
```

Wait 2 seconds after dismissing.

### 3. Switch to Grid View + Complete Flyer

Metro defaults to a Flipp flipbook view (`#tc-flyer-iframe`). Switch to the structured grid:

```js
// Click Grid View — it's an <a> tag, not a button
var links = document.getElementsByTagName('a');
for (var i = 0; i < links.length; i++) {
  if (links[i].innerText.toLowerCase().indexOf('grid') >= 0) {
    links[i].click();
    break;
  }
}
```

Wait 3 seconds for the grid to load (Metro's grid can be slow due to large product catalogs), then switch to the Complete Flyer tab:

```js
// Click Complete Flyer tab — has class "complete-flyer" (may be <a> or <button>)
var tab = document.querySelector('.complete-flyer');
if (tab) {
  tab.click();
} else {
  // Fallback: text match
  var els = document.querySelectorAll('a, button');
  for (var i = 0; i < els.length; i++) {
    if (els[i].textContent.trim() === 'Complete Flyer') {
      els[i].click();
      break;
    }
  }
}
```

Wait 3 seconds for products to load.

### 4. Run drift detection

Before investing time in Load More clicks, verify the page structure hasn't changed. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if below 50%, stop and report. If between 50-100%, note which selectors broke and proceed with degraded extraction.

### 5. Auto-click "Load More Deals" until all items are loaded

Metro shows **1,000+ deals** in its Complete Flyer tab, so this takes many clicks. Inject a single script that clicks the load-more button in a loop:

```js
(function() {
  return new Promise(function(resolve) {
    var maxAttempts = 200;
    var attempts = 0;
    var missCount = 0;

    function clickNext() {
      var countBefore = document.querySelectorAll('.default-product-tile').length;
      var btn = document.querySelector('.load-more-btn');
      attempts++;

      if (btn && btn.offsetParent !== null) {
        btn.click();
        missCount = 0;
        // Poll until new content loads (count changes) or 10s timeout
        var pollStart = Date.now();
        var poll = setInterval(function() {
          var countNow = document.querySelectorAll('.default-product-tile').length;
          var elapsed = Date.now() - pollStart;
          if (countNow > countBefore || elapsed > 10000) {
            clearInterval(poll);
            // Wait 3s after content loaded before next click
            setTimeout(function() {
              if (attempts >= maxAttempts) {
                resolve('Max attempts reached. ' + countNow + ' products loaded.');
              } else {
                clickNext();
              }
            }, 3000);
          }
        }, 500);
      } else {
        missCount++;
        var countNow = document.querySelectorAll('.default-product-tile').length;
        if (missCount >= 3) {
          resolve('Done. ' + countNow + ' products loaded after ' + attempts + ' attempts.');
        } else {
          setTimeout(clickNext, 3000);
        }
      }
    }

    clickNext();
  });
})()
```

Wait for the script to resolve. The "Found: N Deals" counter on the page shows the total — verify loaded count is within 90% of that number.

### 6. Extract all products in one pass

Metro cards have rich `data-*` attributes that provide structured data directly, reducing reliance on CSS text parsing. Use data attributes as primary source, CSS selectors as fallback:

```js
(function() {
  var cards = document.querySelectorAll('.default-product-tile');
  var results = [];
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var priceDiv = c.querySelector('[data-main-price]');
    var beforePrice = c.querySelector('.pricing__before-price');
    var saleEl = c.querySelector('.pricing__sale-price');
    var secondaryEl = c.querySelector('.pricing__secondary-price');
    var unitDetails = c.querySelector('.head__unit-details');
    var isWeighted = c.getAttribute('data-is-weighted') === 'true';

    // Primary: data-main-price attribute (reliable)
    var mainPrice = priceDiv ? parseFloat(priceDiv.getAttribute('data-main-price')) : null;

    // For weighted items, extract per-lb price from secondary text
    var unit = 'each';
    var salePrice = mainPrice;
    if (isWeighted && secondaryEl) {
      var lbMatch = secondaryEl.textContent.match(/\$(\d+\.?\d*)\s*\/\s*lb/i);
      if (lbMatch) {
        salePrice = parseFloat(lbMatch[1]);
        unit = 'lb';
      }
    }

    // Regular price: from before-price text
    var regText = beforePrice ? beforePrice.textContent.replace(/Regular price/i, '').trim() : '';
    var regMatch = isWeighted
      ? regText.match(/\$(\d+\.?\d*)\s*\/\s*lb/i)
      : regText.match(/\$(\d+\.?\d*)/);
    var regularPrice = regMatch ? parseFloat(regMatch[1]) : null;

    // Multi-buy detection (e.g., "2 / $7.00")
    var salePriceText = saleEl ? saleEl.textContent.trim() : '';
    var multiBuyMatch = salePriceText.match(/(\d+)\s*\/\s*\$(\d+\.?\d*)/);

    // Moi loyalty points
    var pointsEl = c.querySelector('.promo-points[data-dimension-9]');
    var moiPoints = pointsEl ? pointsEl.getAttribute('data-dimension-9') : null;

    // Deal conditions
    var conditions = [];
    if (multiBuyMatch) conditions.push(multiBuyMatch[1] + ' for $' + multiBuyMatch[2]);
    if (moiPoints) conditions.push(moiPoints + ' Moi points');

    results.push({
      name: c.getAttribute('data-product-name'),
      brand: c.getAttribute('data-product-brand') || null,
      category: c.getAttribute('data-product-category-en'),
      salePrice: salePrice,
      regularPrice: regularPrice,
      unit: unit,
      size: unitDetails ? unitDetails.textContent.trim() : null,
      discountPercent: parseInt(c.getAttribute('data-discount-percent')) || null,
      isWeighted: isWeighted,
      priceType: multiBuyMatch ? 'multi_buy' : (isWeighted ? 'per_weight' : 'fixed'),
      dealConditions: conditions.length > 0 ? conditions.join('; ') : null,
      productCode: c.getAttribute('data-product-code')
    });
  }
  return JSON.stringify(results);
})()
```

If the output is too large (Metro can have 1,500+ deals), extract in batches:

```js
// Batch 1: first 500
var cards = document.querySelectorAll('.default-product-tile');
var batch = Array.prototype.slice.call(cards, 0, 500);
// ... same extraction logic on batch
```

### 7. Parse into deal records

For each product, map to the pipeline's deal schema:

**item_name:** From `data-product-name`. Title case. Prepend brand if present (e.g., "Dr. Oetker Frozen Pepperoni Thin Crust Pizza").

**brand:** From `data-product-brand`. NULL for unbranded items (common for produce).

**sale_price:** From `data-main-price` for fixed/multi-buy. From secondary price per-lb text for weighted items. Must be > 0.

**regular_price:** From `.pricing__before-price` text. Match per-lb for weighted items, per-ea for others. NULL if absent.

**unit:** `lb` if weighted with /lb price found, otherwise `each`. Check secondary price for `/100g`, `/100ml`, `/kg` patterns if more specificity needed.

**unit_size:** From `.head__unit-details` text (e.g., "320 g", "2 L", "6 un").

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**category:** From `data-product-category-en`. Map Metro categories to pipeline categories:
| Metro category | Pipeline category |
|---|---|
| Fruits & Vegetables | produce |
| Meat & Poultry | meat |
| Fish & Seafood | seafood |
| Dairy & Eggs | dairy |
| Bread & Bakery Products | bakery |
| Frozen | frozen |
| Pantry | pantry |
| Beverages, Beer & Wine | beverages |
| Snacks | snacks |
| Household Products | household |
| Personal Care | personal_care |
| Baby | baby |
| Pet Care | pet |
| Deli & Prepared Meals | deli |
| Everything else | other |

**deal_conditions:** Multi-buy format ("2 for $7.00"), Moi points ("125 Moi points"), or NULL.

**price_type:** `multi_buy` if "/" detected in sale price text, `per_weight` if `data-is-weighted="true"`, otherwise `fixed`.

**Skip rules:**
- Skip items with no sale price (salePrice is null or 0)
- Skip non-grocery items (gift cards, kitchenware, clothing)

### 8. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Dr. Oetker Frozen Pepperoni Thin Crust Pizza",
  "product_type": "frozen pizza",
  "brand": "Dr. Oetker",
  "category": "frozen",
  "sale_price": 5.99,
  "regular_price": 7.49,
  "unit": "each",
  "unit_size": "320 g",
  "deal_conditions": null,
  "price_type": "fixed"
}
```

Report total deals extracted, count per category, and null rates for each field.

## Selector Reference

| Selector / Attribute | What it provides | Stability | Notes |
|---|---|---|---|
| `.default-product-tile` | Card container | MEDIUM | Semantic class, shared with Food Basics |
| `data-product-name` | Product name | HIGH | Data attribute on card element |
| `data-product-brand` | Brand | HIGH | Data attribute, null for unbranded |
| `data-product-category-en` | Category (English) | HIGH | Data attribute on card element |
| `data-main-price` | Sale price (numeric) | HIGH | Attribute on inner div, avoids text parsing |
| `data-discount-percent` | Discount % | HIGH | Data attribute on card element |
| `data-is-weighted` | Per-weight flag | HIGH | Data attribute on card element |
| `data-variant-price` | Multi-buy unit price | HIGH | Present only on multi-buy items |
| `.head__brand` | Brand (display text) | MEDIUM | Fallback for data-product-brand |
| `.head__title` | Product title (display) | MEDIUM | Fallback for data-product-name |
| `.head__unit-details` | Size/weight text | MEDIUM | e.g., "320 g", "2 L" |
| `.pricing__before-price` | Regular price text | MEDIUM | Includes "Regular price" screen-reader text |
| `.pricing__sale-price` | Sale price text | MEDIUM | Contains multi-buy format "2 / $7.00" |
| `.pricing__secondary-price` | Unit price / per-lb | MEDIUM | Per-weight items show $/kg and $/lb here |
| `.promo-points[data-dimension-9]` | Moi loyalty points | MEDIUM | e.g., data-dimension-9="125" |
| `.load-more-btn` | Load More button | MEDIUM | Class-based selector |
| `.complete-flyer` | Complete Flyer tab | MEDIUM | Tag-agnostic class selector (was `<a>`, now `<button>`) |

## Key differences from Food Basics

1. **Rich data attributes** — Metro exposes product name, brand, category, discount, and weighted status directly as `data-*` attributes on the card element, making extraction more reliable than text parsing.
2. **`data-main-price` attribute** — provides the numeric sale price without needing to parse "$5.99 ea." text.
3. **Much larger deal count** — Metro shows 1,000-1,600+ deals in Complete Flyer vs 80-400 for Food Basics. The Load More loop needs more iterations and batch extraction may be needed.
4. **Moi loyalty points** — Metro uses `.icon--m-points .promo-points[data-dimension-9]` for loyalty point badges (vs no loyalty program in Food Basics).
5. **URL structure** — Metro uses `/en/flyer` (language prefix) vs Food Basics `/flyer`.
6. **Complete Flyer tab** — has a specific `a.complete-flyer` class selector (more reliable than text matching).
7. **Load More button** — has `.load-more-btn` class (same name as Food Basics).

## Tested against

- Metro (`metro.ca/en/flyer`) — 2026-03-30
- Metro Fennell Plaza store selected (Hamilton, ON)
- Grid View → Complete Flyer → 1,564 deals loaded
- Extraction validated: name 0% null, brand 17% null (produce), category 3% null, salePrice 3% null, regularPrice 6% null
