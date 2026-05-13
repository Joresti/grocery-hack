---
name: parse-flyer-foodbasics
description: Parse grocery deals from the Food Basics flyer page using .default-product-tile CSS selectors and "Load More Deals" button auto-clicking via Chrome CDP. Built and tested against foodbasics.ca/flyer.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (Food Basics)

Extract deals from the Food Basics flyer page, which paginates products behind a "Load More Deals" button. Uses `.default-product-tile` CSS class selectors tested against `foodbasics.ca/flyer`.

## Arguments

`$ARGUMENTS` — the flyer page URL.

Example: `https://www.foodbasics.ca/flyer`

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

Accept cookie banners and close any tour/onboarding overlays:

```js
// Accept cookies
var acceptBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Accept All');
if (acceptBtn) acceptBtn.click();

// Skip tour
var skipBtn = [...document.querySelectorAll('a, button, span')].find(el => el.textContent.trim().includes('Skip'));
if (skipBtn) skipBtn.click();
```

### 3. Switch to Grid View + Complete Flyer

Some flyer pages default to a visual flipbook view. Switch to the structured grid:

```js
// Click Grid View
var gridBtn = [...document.querySelectorAll('button, div, a, span')].find(el => el.textContent.trim() === 'Grid View');
if (gridBtn) gridBtn.click();
```

Wait 2-3 seconds for the grid to load, then switch to the Complete Flyer tab:

```js
// Click Complete Flyer tab
var tab = [...document.querySelectorAll('button, a, div, span')].find(el => el.textContent.trim() === 'Complete Flyer');
if (tab) tab.click();
```

Wait 2-3 seconds for products to load.

### 4. Run drift detection

Before investing time in Load More clicks, verify the page structure hasn't changed. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if below 50%, stop and report. If between 50-100%, note which selectors broke and proceed with degraded extraction.

### 5. Auto-click "Load More Deals" until all items are loaded

Inject a **single script** that clicks the load-more button in a loop. This avoids multiple round-trips:

```js
(function() {
  return new Promise(function(resolve) {
    var maxAttempts = 100;
    var attempts = 0;
    var interval = setInterval(function() {
      var btn = [...document.querySelectorAll('button, a')].find(function(el) {
        var t = el.textContent.trim().toLowerCase();
        return t.includes('load more') && el.offsetParent !== null;
      });
      attempts++;
      if (btn) {
        btn.click();
      } else if (attempts > 3) {
        // No button found for 3 consecutive checks — all loaded
        clearInterval(interval);
        var cards = document.querySelectorAll('.default-product-tile');
        resolve('Done. ' + cards.length + ' products loaded.');
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        var cards = document.querySelectorAll('.default-product-tile');
        resolve('Max attempts reached. ' + cards.length + ' products loaded.');
      }
    }, 2000);
  });
})()
```

Wait for the script to resolve before proceeding. Verify the loaded count matches the "Found: N Deals" total.

### 6. Extract all products in one pass

Once all products are in the DOM, extract everything in a single script call:

```js
(function() {
  var cards = document.querySelectorAll('.default-product-tile');
  var results = [];
  cards.forEach(function(card) {
    var get = function(cls) {
      var el = card.querySelector('.' + cls);
      return el ? el.textContent.trim() : null;
    };
    results.push({
      name: get('head__title'),
      size: get('head__unit-details'),
      regularPrice: get('pricing__before-price'),
      salePrice: get('pricing__sale-price'),
      unitPrice: get('pricing__secondary-price')
    });
  });
  return JSON.stringify(results);
})()
```

If the output is too large, extract in batches using array slicing on the NodeList.

### 7. Parse into deal records

For each product, clean the raw text:

**item_name:** Product name from `name`. Append size if present. Title Case.

**sale_price:** From `salePrice`. Strip "$", "ea.", "+tx", whitespace. Parse as number.

**regular_price:** From `regularPrice`. Strip "Regular price", "$", "ea.", whitespace. Parse as number. NULL if absent.

**unit:** From `unitPrice` field: "/100g" -> 100g, "/100ml" -> 100ml, "/un" -> each, "/lb" -> lb, "/kg" -> kg. Default: each.

**category:** Classify from product name: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**deal_conditions:** "2 / $X", "limit N", "buy one get one" if present in price text. Otherwise NULL.

**Skip rules:**
- Skip items with no sale price
- Skip non-grocery items (clothing, kitchen tools, home decor)

### 8. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Strawberries 454g",
  "product_type": "strawberries",
  "category": "produce",
  "sale_price": 3.99,
  "regular_price": 4.98,
  "unit": "each",
  "deal_conditions": null
}
```

Report total deals extracted and count per category.

## Tested against

- Food Basics (`foodbasics.ca/flyer`)
