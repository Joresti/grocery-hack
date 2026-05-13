# Drift Detection — Food Basics

Run this diagnostic step **after navigating and switching to Grid View / Complete Flyer** but **before extracting products**. It catches problems early so you don't spend 10 minutes clicking "Load More" on a page that's been redesigned.

## Structural Drift

These check whether the page's HTML still matches what the skill expects.

### Selector hit rate

The skill depends on 6 CSS selectors. Run this single script after the grid loads (before clicking Load More):

```js
(function() {
  var selectors = {
    cardContainer: '.default-product-tile',
    title: '.default-product-tile .head__title',
    unitDetails: '.default-product-tile .head__unit-details',
    regularPrice: '.default-product-tile .pricing__before-price',
    salePrice: '.default-product-tile .pricing__sale-price',
    unitPrice: '.default-product-tile .pricing__secondary-price'
  };
  var report = {};
  var total = Object.keys(selectors).length;
  var hits = 0;
  for (var key in selectors) {
    var count = document.querySelectorAll(selectors[key]).length;
    report[key] = count;
    if (count > 0) hits++;
  }
  report._hitRate = hits + '/' + total;
  report._hitPct = Math.round((hits / total) * 100);
  return JSON.stringify(report);
})()
```

**Interpret:**
- **6/6 (100%)** — no structural drift, proceed normally
- **4-5/6 (67-83%)** — partial drift. Check which selectors returned 0. If `cardContainer` is 0, the page was completely redesigned — stop and alert. If a sub-selector like `unitDetails` is 0, that field may have been renamed but extraction can proceed with that field as null.
- **0-3/6 (<50%)** — hard drift. The page has been significantly redesigned. Do NOT proceed with the skill's selectors. Stop and report which selectors are broken so the skill can be updated.

### DOM path fingerprint

The expected path from the grid to a product card:

```
Stored fingerprint (2026-03-30):
body > div > ... > .default-product-tile
```

Check that `.default-product-tile` elements are direct descendants of a grid/list container (not buried inside iframes or shadow DOM):

```js
(function() {
  var card = document.querySelector('.default-product-tile');
  if (!card) return 'DRIFT: No card found at all';
  var path = [];
  var el = card;
  for (var i = 0; i < 8; i++) {
    path.unshift(el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''));
    el = el.parentElement;
    if (!el) break;
  }
  return JSON.stringify({domPath: path.join(' > '), inIframe: window !== window.top});
})()
```

If `inIframe: true`, the grid content has moved inside an iframe and the skill needs to switch execution context.

### Element count stability

After the initial grid load (before clicking Load More), check how many cards are visible:

```js
document.querySelectorAll('.default-product-tile').length
```

**Expected range:** 10–50 cards on initial load. If 0, hard drift. If >200, the page may no longer paginate (which is fine — skip the Load More step).

### Page weight fingerprint

```js
(function() {
  return JSON.stringify({
    htmlSizeKB: Math.round(document.documentElement.outerHTML.length / 1024),
    scriptCount: document.querySelectorAll('script').length,
    stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]').length,
    iframeCount: document.querySelectorAll('iframe').length
  });
})()
```

**Baseline (2026-03-30):** Compare against these approximate values. A 3x+ change in any metric suggests a framework/platform change:
- HTML: ~200-800KB (varies with loaded products)
- Scripts: ~20-40
- Stylesheets: ~5-15
- Iframes: ~2-6 (Flipp, analytics)

## Content Drift

These catch cases where extraction "succeeds" but the data is wrong.

### Temporal coherence

The flyer page shows a date range (e.g., "March 26th - April 1st"). Extract and validate it's the current week:

```js
(function() {
  var text = document.body.innerText;
  // Look for date patterns like "March 26th - April 1st" or "Mar 26 - Apr 1"
  var dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\w*\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\w*\s*\d{1,2}\w*/i);
  return dateMatch ? dateMatch[0] : 'NO DATE FOUND';
})()
```

**Interpret:** If no date found, the page structure for displaying the flyer period has changed. If the date is >2 weeks old, the site may be serving a cached/stale flyer — that's a "not ready" state, not a scraper failure. Log it and skip this store for the week.

### Schema conformance (run after extraction)

After extracting products, check null rates for each field:

```js
// Run on the extracted JSON array (products)
(function(products) {
  var fields = ['name', 'salePrice', 'regularPrice', 'size', 'unitPrice'];
  var report = {};
  fields.forEach(function(f) {
    var nullCount = products.filter(function(p) { return !p[f]; }).length;
    report[f] = {
      nullCount: nullCount,
      nullPct: Math.round((nullCount / products.length) * 100),
      sample: products.find(function(p) { return p[f]; }) ? products.find(function(p) { return p[f]; })[f] : null
    };
  });
  report._totalProducts = products.length;
  return JSON.stringify(report);
})(products)
```

**Thresholds:**
- `name` null >5%: title selector broke
- `salePrice` null >20%: price selector broke (some items legitimately lack a sale price)
- `regularPrice` null >80%: normal (many items don't show the regular price)
- `size` null >50%: unit details selector may have changed
- All fields null for same set of cards: those cards use a different template variant

### Content volume

**Expected range:** 80–400 deals per weekly flyer. If <20, extraction is probably broken. If >1000, the page may be showing all-time products rather than the weekly flyer.

### Content hash delta

After extraction, hash the sorted product names:

```js
// Simple hash of sorted names to detect stale data
(function(products) {
  var names = products.map(function(p) { return p.name; }).sort().join('|');
  var hash = 0;
  for (var i = 0; i < names.length; i++) {
    hash = ((hash << 5) - hash) + names.charCodeAt(i);
    hash |= 0;
  }
  return 'content_hash:' + hash;
})(products)
```

Store this hash. If 3 consecutive weekly runs return the same hash, the scraper is probably hitting a cached page or error page.

## Behavioral Drift

These catch changes in the interaction path to reach the data.

### Step completion verification

After each interaction step, verify it actually changed the page:

**After "Grid View" click:**
```js
// Grid View should have removed the Flipp iframes or made cards visible
var flippVisible = document.querySelector('iframe.flippiframe');
var gridVisible = document.querySelector('.default-product-tile');
JSON.stringify({
  flippStillVisible: !!(flippVisible && flippVisible.offsetParent),
  gridCardsVisible: !!gridVisible
});
```
If `flippStillVisible: true` and `gridCardsVisible: false`, the Grid View button didn't work — the click target changed or there's a new intermediate step.

**After "Complete Flyer" click:**
```js
// Verify product count is reasonable (Complete Flyer should show all categories)
document.querySelectorAll('.default-product-tile').length
```
If count is 0 or same as before the click, the tab didn't work.

**After "Load More" loop completes:**
```js
// Compare final count against "Found: N Deals" text if present
var foundText = document.body.innerText.match(/Found:\s*(\d+)\s*Deals/i);
var cardCount = document.querySelectorAll('.default-product-tile').length;
JSON.stringify({
  displayedTotal: foundText ? parseInt(foundText[1]) : null,
  loadedCards: cardCount,
  match: foundText ? cardCount >= parseInt(foundText[1]) * 0.9 : 'no_total_displayed'
});
```
If `match: false` and the loaded count is far below the displayed total, Load More stopped working partway through.

### Redirect tracking

After navigation, verify the actual URL:

```js
JSON.stringify({
  currentUrl: window.location.href,
  expectedPattern: '/flyer',
  urlMatch: window.location.href.includes('/flyer')
});
```

If the URL redirected to `/flyers/v2`, `/weekly-specials`, or a login page, the URL structure changed.

### Button label drift

Even when buttons work, log their actual text to detect impending drift:

```js
(function() {
  var labels = {};
  var gridBtn = [...document.querySelectorAll('button, div, a, span')].find(el => el.textContent.trim() === 'Grid View');
  labels.gridView = gridBtn ? gridBtn.textContent.trim() : 'NOT FOUND';

  var completeTab = [...document.querySelectorAll('button, a, div, span')].find(el => el.textContent.trim() === 'Complete Flyer');
  labels.completeFlyer = completeTab ? completeTab.textContent.trim() : 'NOT FOUND';

  var loadMore = [...document.querySelectorAll('button, a')].find(el => el.textContent.trim().toLowerCase().includes('load more'));
  labels.loadMore = loadMore ? loadMore.textContent.trim() : 'NOT FOUND (may be all loaded)';

  var acceptCookies = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Accept All');
  labels.acceptCookies = acceptCookies ? acceptCookies.textContent.trim() : 'NOT FOUND (may be already accepted)';

  return JSON.stringify(labels);
})()
```

If any label reads "NOT FOUND" unexpectedly, that's early warning — the skill's text-matching may break soon even if a fallback caught it this time.

### HTTP status / soft 404 detection

Check that the page isn't a soft error page:

```js
(function() {
  var text = document.body.innerText.toLowerCase();
  var errorSignals = ['page not found', '404', 'no flyer available', 'coming soon', 'under maintenance', 'we\'re sorry'];
  var found = errorSignals.filter(function(s) { return text.includes(s); });
  return JSON.stringify({
    isErrorPage: found.length > 0,
    matchedSignals: found,
    titleTag: document.title
  });
})()
```
