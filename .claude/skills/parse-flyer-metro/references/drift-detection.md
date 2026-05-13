# Drift Detection — Metro

Run this diagnostic step **after navigating and switching to Grid View / Complete Flyer** but **before extracting products**. It catches problems early so you don't spend 15+ minutes clicking "Load More" on a page that's been redesigned.

## Structural Drift

These check whether the page's HTML still matches what the skill expects.

### Selector hit rate

The skill depends on 8 CSS selectors / data attributes. Run this single script after the grid loads (before clicking Load More):

```js
(function() {
  var selectors = {
    cardContainer: '.default-product-tile',
    dataProductName: '.default-product-tile[data-product-name]',
    dataMainPrice: '.default-product-tile [data-main-price]',
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
- **7-8/8 (88-100%)** — no structural drift, proceed normally
- **5-6/8 (63-75%)** — partial drift. Check which selectors returned 0. If `cardContainer` or `dataProductName` is 0, the card structure was completely redesigned — stop and alert. If a sub-selector like `unitDetails` is 0, that field may have been renamed but extraction can proceed with that field as null.
- **0-4/8 (<50%)** — hard drift. The page has been significantly redesigned. Do NOT proceed with the skill's selectors. Stop and report which selectors are broken so the skill can be updated.

**Data attribute vs CSS priority:** If CSS selectors break but data attributes still work (e.g., `dataProductName` hits > 0 but `title` is 0), extraction can still succeed using data attributes alone. This is a key advantage of Metro's rich data attributes.

### DOM path fingerprint

The expected path from the grid to a product card:

```
Stored fingerprint (2026-03-30):
body > div > ... > .default-product-tile.tile-product.plp-tile
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

**Expected range:** 30–70 cards on initial load. If 0, hard drift. If >500, the page may no longer paginate (which is fine — skip the Load More step).

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
- HTML: ~300-1500KB (varies heavily with loaded products — Metro has large catalogs)
- Scripts: ~60-100
- Stylesheets: ~5-15
- Iframes: ~15-25 (Flipp flipbook + analytics + reCAPTCHA + Criteo + DoubleClick + ad scripts)

## Content Drift

These catch cases where extraction "succeeds" but the data is wrong.

### Temporal coherence

Metro's Grid View does not display flyer dates prominently (dates appear in the Flipp flipbook sidebar, not in grid mode). Check the sidebar thumbnails or page text for date clues:

```js
(function() {
  var text = document.body.innerText;
  var dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\w*\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\w*\s*\d{1,2}\w*/i);
  return dateMatch ? dateMatch[0] : 'NO DATE FOUND (expected — Metro grid view lacks visible dates)';
})()
```

**Interpret:** "NO DATE FOUND" is normal for Metro's grid view. The pipeline's `calculateFlyerDates()` handles date calculation. If a date IS found and it's >2 weeks old, the site may be serving a stale flyer.

### Schema conformance (run after extraction)

After extracting products, check null rates for each field:

```js
// Run on the extracted JSON array (products)
(function(products) {
  var fields = ['name', 'brand', 'category', 'salePrice', 'regularPrice', 'size'];
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

**Thresholds (Metro-specific):**
- `name` null >2%: data-product-name attribute broke (very unlikely — it's a core data attribute)
- `brand` null >30%: normal for Metro (many produce/deli items are unbranded)
- `category` null >10%: data-product-category-en attribute may have changed
- `salePrice` null >10%: data-main-price attribute broke or pricing structure changed
- `regularPrice` null >50%: normal (many items don't show a strikethrough price)
- `size` null >20%: head__unit-details selector may have changed

### Content volume

**Expected range:** 500–2,000 deals per weekly flyer. Metro's Complete Flyer tab is significantly larger than other stores in the pipeline. If <100, extraction is probably broken (may be stuck on "My Suggestions" tab instead of "Complete Flyer"). If >3,000, the page may be showing all products rather than the weekly flyer.

### Content hash delta

After extraction, hash the sorted product names:

```js
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
var flippIframe = document.getElementById('tc-flyer-iframe');
var gridVisible = document.querySelector('.default-product-tile');
JSON.stringify({
  flippStillVisible: !!(flippIframe && flippIframe.offsetParent),
  gridCardsVisible: !!gridVisible
});
```
If `flippStillVisible: true` and `gridCardsVisible: false`, the Grid View button didn't work — the click target changed or there's a new intermediate step.

**After "Complete Flyer" click:**
```js
document.querySelectorAll('.default-product-tile').length
```
If count is 0 or same as before the click, the tab didn't work. Metro shows ~54 cards initially on Complete Flyer vs fewer on "My Suggestions".

**After "Load More" loop completes:**
```js
var foundText = document.body.innerText.match(/Found:\s*([\d,]+)\s*Deals/i);
var cardCount = document.querySelectorAll('.default-product-tile').length;
JSON.stringify({
  displayedTotal: foundText ? parseInt(foundText[1].replace(',', '')) : null,
  loadedCards: cardCount,
  match: foundText ? cardCount >= parseInt(foundText[1].replace(',', '')) * 0.9 : 'no_total_displayed'
});
```
If `match: false` and the loaded count is far below the displayed total, Load More stopped working partway through. Note: Metro's "Found: N Deals" includes comma formatting (e.g., "1,564").

### Redirect tracking

After navigation, verify the actual URL:

```js
JSON.stringify({
  currentUrl: window.location.href,
  expectedPattern: '/en/flyer or /en/online-grocery/flyer',
  urlMatch: window.location.href.includes('/en/flyer') || window.location.href.includes('/en/online-grocery/flyer')
});
```

If the URL redirected to a login page, store selector, or different path structure, the URL routing changed. Note Metro uses a language prefix (`/en/` or `/fr/`) — ensure the English version is being loaded.

### Button label drift

Even when buttons work, log their actual text to detect impending drift:

```js
(function() {
  var labels = {};

  var gridLink = null;
  var links = document.getElementsByTagName('a');
  for (var i = 0; i < links.length; i++) {
    if (links[i].innerText.toLowerCase().indexOf('grid') >= 0) {
      gridLink = links[i];
      break;
    }
  }
  labels.gridView = gridLink ? gridLink.textContent.trim() : 'NOT FOUND';

  var completeTab = document.querySelector('a.complete-flyer');
  labels.completeFlyer = completeTab ? completeTab.textContent.trim() : 'NOT FOUND';

  var loadMore = document.querySelector('.load-more-btn');
  labels.loadMore = loadMore ? loadMore.textContent.trim() : 'NOT FOUND (may be all loaded)';

  var acceptCookies = null;
  var buttons = document.getElementsByTagName('button');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].textContent.trim() === 'Accept All') {
      acceptCookies = buttons[i];
      break;
    }
  }
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
  var errorSignals = ['page not found', '404', 'no flyer available', 'coming soon', 'under maintenance', "we're sorry"];
  var found = errorSignals.filter(function(s) { return text.includes(s); });
  return JSON.stringify({
    isErrorPage: found.length > 0,
    matchedSignals: found,
    titleTag: document.title
  });
})()
```

## Metro-Specific Drift Risks

### Data attribute removal
Metro's biggest advantage is rich `data-*` attributes (`data-product-name`, `data-main-price`, `data-product-category-en`, etc.). These are likely used by Metro's own analytics and e-commerce systems, which makes them relatively stable. However, a platform migration (e.g., moving from their current stack to a headless commerce platform) could remove them entirely. Monitor the `dataProductName` selector hit rate — if it drops to 0, all data attributes are likely gone and the skill must fall back to pure CSS text parsing (similar to the Food Basics approach).

### Moi loyalty program changes
Moi points badges use `.icon--m-points .promo-points[data-dimension-9]`. If Metro rebrands or restructures their loyalty program, these selectors will break. The points extraction is optional (deal_conditions field), so this won't break core deal extraction.

### Large catalog pagination
Metro's Complete Flyer shows 1,500+ deals — far more than other stores. The Load More loop takes many iterations (~100 clicks at ~16 items per page). If Metro switches to infinite scroll or server-side pagination, the current click-loop approach would need adjustment. Monitor whether the `.load-more-btn` selector continues to work and whether loaded card counts plateau correctly.

### French/English URL routing
Metro serves both English (`/en/flyer`) and French (`/fr/circulaire`) versions. If URL routing changes (e.g., dropping the language prefix, or redirecting based on geolocation/cookies), ensure the scraper lands on the English version. Check for unexpected redirects to `/fr/` paths.
