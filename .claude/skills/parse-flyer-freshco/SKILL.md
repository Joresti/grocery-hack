---
name: parse-flyer-freshco
description: Parse grocery deals from the FreshCo flyer page using Tailwind-based CSS class selectors and "Load More" button auto-clicking via Chrome CDP. Built and tested against freshco.com/flyer. Use this skill whenever parsing, scraping, or extracting deals from a FreshCo flyer.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (FreshCo)

Extract deals from the FreshCo flyer page. The page uses a grid view with Tailwind CSS classes (no `data-testid` attributes). Products paginate behind a "Load More" button. Built and tested against `freshco.com/flyer`.

## Arguments

`$ARGUMENTS` — the flyer page URL.

Example: `https://www.freshco.com/flyer/`

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

### 2. Dismiss cookie banner

Accept cookies so the banner doesn't block interaction:

```js
var acceptBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Accept All');
if (acceptBtn) acceptBtn.click();
```

### 3. Switch to Grid View

The page defaults to a flipbook (Flipp iframe) view. Click the grid icon button to switch to the structured product grid:

```js
var gridBtn = document.querySelector('button.icon-grid');
if (gridBtn) gridBtn.click();
```

Wait 3 seconds for the grid to load.

### 4. Run drift detection

Before investing time in Load More clicks, verify the page structure. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check — if below 50%, stop and report. FreshCo uses Tailwind utility classes which are the most drift-prone of the three stores — a single Tailwind config change can break multiple selectors simultaneously.

### 5. Auto-click "Load More" until all items are loaded

The grid initially shows ~15 products per page. Inject a single script that clicks the "Load More" button in a loop until no button remains. The loop exits when the button is absent for 3 consecutive checks — `maxAttempts` is just a safety valve against infinite loops, not a prediction of flyer size:

```js
(function() {
  return new Promise(function(resolve) {
    var maxAttempts = 500;
    var attempts = 0;
    var missCount = 0;
    var interval = setInterval(function() {
      var btn = [...document.querySelectorAll('button')].find(function(el) {
        return el.textContent.trim() === 'Load More' && el.offsetParent !== null;
      });
      attempts++;
      if (btn) {
        missCount = 0;
        btn.click();
      } else {
        missCount++;
        if (missCount >= 3) {
          clearInterval(interval);
          var cards = document.querySelectorAll('.grid.grid-cols-1 > *');
          resolve('Done. ' + cards.length + ' products loaded.');
          return;
        }
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        var cards = document.querySelectorAll('.grid.grid-cols-1 > *');
        resolve('Safety limit reached. ' + cards.length + ' products loaded.');
      }
    }, 2000);
  });
})()
```

Wait for the promise to resolve before proceeding.

### 6. Extract all products in one pass

Once all products are in the DOM, extract everything in a single script call. The cards live inside a `.grid.grid-cols-1` container. Each card uses these Tailwind-based selectors:

| Selector | Contains | Example |
|---|---|---|
| `.text-red400.font-bold.text-body` | Sale price | "$5.49" |
| `.line-through.opacity-50` | Regular (was) price | "$7.19" |
| `.bg-yellow150` (parent text) | SAVE + amount | "SAVE $1.70" |
| `p.text-sm` | Size and unit price | "165 G ($3.33 per 100g)" |
| `.card-title span.text-grey900` | Product name | "Castello Sliced Cheese..." |
| `#Scene_Card_exclusive_offers` | Scene+ / Member Price badge | "SCENE+ OFFER" or "Member Price $2.99" |
| `.bg-red200` inside Scene badge | Member-only price | "$2.99" |
| `button` with `underline` class containing "PTS" | Scene+ points offer | "Buy 2 and get 100 PTS" |

Extraction script:

```js
(function() {
  var grid = document.querySelector('.grid.grid-cols-1');
  var cards = grid ? [...grid.children] : [];
  var results = [];
  cards.forEach(function(card) {
    var salePriceEl = card.querySelector('.text-red400.font-bold.text-body');
    var regPriceEl = card.querySelector('.line-through.opacity-50');
    var saveEl = card.querySelector('.bg-yellow150');
    var sizeEl = card.querySelector('p.text-sm');
    var titleEl = card.querySelector('.card-title span.text-grey900');
    if (!titleEl) titleEl = card.querySelector('.card-title');

    var sceneBadge = card.querySelector('#Scene_Card_exclusive_offers');
    var badgeType = null;
    var memberPrice = null;
    if (sceneBadge) {
      var badgeText = sceneBadge.textContent.trim();
      if (badgeText.includes('Member Price')) {
        badgeType = 'member_price';
        var mpEl = sceneBadge.querySelector('.bg-red200');
        memberPrice = mpEl ? mpEl.textContent.trim() : null;
      } else if (badgeText.includes('SCENE+ OFFER')) {
        badgeType = 'scene_offer';
      }
    }

    var ptsBtn = [...card.querySelectorAll('button')].find(function(b) {
      return b.textContent.includes('PTS');
    });

    results.push({
      name: titleEl ? titleEl.textContent.trim() : null,
      salePrice: salePriceEl ? salePriceEl.textContent.trim() : null,
      regularPrice: regPriceEl ? regPriceEl.textContent.trim() : null,
      saveAmount: saveEl && saveEl.parentElement ? saveEl.parentElement.textContent.trim().replace('SAVE', '').trim() : null,
      size: sizeEl ? sizeEl.textContent.trim() : null,
      badgeType: badgeType,
      memberPrice: memberPrice,
      ptsOffer: ptsBtn ? ptsBtn.textContent.trim() : null
    });
  });
  return JSON.stringify(results);
})()
```

If the output is too large, extract in batches using array slicing:

```js
// Batch 1: first 200
var cards = [...document.querySelector('.grid.grid-cols-1').children];
// ... use cards.slice(0, 200), cards.slice(200, 400), etc.
```

### 7. Parse into deal records

For each product, clean the raw text:

**item_name:** Product name from `name`. Title Case.

**sale_price:** From `salePrice`. Strip "$". Parse as number. For Member Price cards, prefer `memberPrice` value if present.

**regular_price:** From `regularPrice`. Strip "$". Parse as number. NULL if absent.

**unit:** From `size` field — parse the parenthetical unit price:
- "per 100g" -> 100g
- "per 100ml" -> 100ml
- "per lb" -> lb
- "per kg" -> kg
- No unit info -> each

**category:** Classify from product name: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Ritz Crackers with Olive Oil" → "crackers" (NOT "olive oil")
- "Pedigree Beef Flavour Dog Food 8kg" → "dog food" (NOT "beef")
- "Bertolli Extra Virgin Olive Oil 1L" → "olive oil"
- "AAA Beef Striploin Steak" → "beef steak"
- "PC Chicken Broth 900ml" → "chicken broth"
- "Coconut Cream Cookies" → "cookies" (NOT "coconut")
If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product, product_type is the actual product.

**deal_conditions:** Build from multiple signals:
- `ptsOffer` if present (e.g., "Buy 2 and get 100 PTS")
- `badgeType` — note "scene_offer" or "member_price"
- Multi-buy patterns in product name or price text
- Otherwise NULL

**Skip rules:**
- Skip items with no sale price
- Skip non-grocery items (clothing, kitchen tools, home decor)

### 8. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Castello Sliced Cheese Havarti Jalapeno 8 Slices 165g",
  "product_type": "sliced cheese",
  "category": "dairy",
  "sale_price": 5.49,
  "regular_price": 7.19,
  "unit": "100g",
  "deal_conditions": "Buy 2 and get 100 PTS"
}
```

Report total deals extracted and count per category.

## Key differences from other store skills

- **No `data-testid` attributes** — FreshCo uses Tailwind utility classes, not semantic test IDs
- **Flipp iframe flipbook** is the default view — must explicitly click `button.icon-grid` to get parseable grid
- **Scene+ / Member Price badges** — some items have loyalty member prices in `.bg-red200` that differ from the displayed sale price
- **Scene+ PTS offers** — some items have "Buy N and get X PTS" bonus point deals
- **Large flyer size** — FreshCo flyers can have many hundreds of items; batch extraction may be needed if output is too large for a single pass

## Tested against

- FreshCo (`freshco.com/flyer`)
