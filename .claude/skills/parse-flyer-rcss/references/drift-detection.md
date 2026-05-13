# Drift Detection — Real Canadian Superstore

Run this diagnostic step **after navigating to the flyer page** and **dismissing popups** but **before iterating through pages**. It catches problems early so you don't waste time paginating through 133 pages of a redesigned site.

## Structural Drift

### Selector hit rate

The skill depends on 8 `data-testid` selectors plus the `.chakra-linkbox` card container. Run this single script after the page loads:

```js
(function() {
  var selectors = {
    title: '[data-testid="product-title"]',
    brand: '[data-testid="product-brand"]',
    salePrice: '[data-testid="sale-price"]',
    wasPrice: '[data-testid="was-price"]',
    regularPrice: '[data-testid="regular-price"]',
    priceDescriptor: '[data-testid="price-descriptor"]',
    packageSize: '[data-testid="product-package-size"]',
    badge: '[data-testid="product-badge"]'
  };
  var report = {};
  var total = Object.keys(selectors).length;
  var hits = 0;
  for (var key in selectors) {
    var count = document.querySelectorAll(selectors[key]).length;
    report[key] = count;
    if (count > 0) hits++;
  }
  report._cardContainer = document.querySelectorAll('.chakra-linkbox').length;
  report._pcoBadge = document.querySelectorAll('[data-testid="product-pco-badge"]').length;
  report._hitRate = hits + '/' + total;
  report._hitPct = Math.round((hits / total) * 100);
  return JSON.stringify(report);
})()
```

**Interpret:**
- **7-8/8 (88-100%)** — proceed normally. `brand` and `badge` are often absent on some products, so 6/8 is acceptable.
- **5-6/8 (63-75%)** — partial drift. Some `data-testid` attributes are being removed or renamed. Check which ones are missing and whether the data lives elsewhere.
- **0-4/8 (<50%)** — hard drift. Loblaw Digital likely redesigned the page or dropped `data-testid` attributes. Stop and investigate.
- **`title` specifically is 0** — this is the anchor selector. If this breaks, nothing works. Stop immediately.
- **`_cardContainer` is 0** — the `.chakra-linkbox` class has changed. Try walking up from `product-title` to find the new card container.

### DOM depth fingerprint

The skill uses `.chakra-linkbox` directly (no walk-up needed). But if `.chakra-linkbox` breaks, you need to find the card container by walking up from `product-title`. The expected depth is 4 levels:

```js
(function() {
  var title = document.querySelector('[data-testid="product-title"]');
  if (!title) return JSON.stringify({drift: true, reason: 'No product-title element found'});

  var el = title;
  var levels = [];
  for (var i = 0; i < 8; i++) {
    el = el.parentElement;
    if (!el) break;
    var hasSalePrice = !!el.querySelector('[data-testid="sale-price"]');
    var hasSize = !!el.querySelector('[data-testid="product-package-size"]');
    var hasBrand = !!el.querySelector('[data-testid="product-brand"]');
    var titleCount = el.querySelectorAll('[data-testid="product-title"]').length;
    levels.push({
      level: i + 1,
      tag: el.tagName,
      firstClass: el.className ? el.className.split(' ')[0] : '',
      containsSalePrice: hasSalePrice,
      containsSize: hasSize,
      containsBrand: hasBrand,
      titleCount: titleCount
    });
  }

  // The correct container has exactly 1 title and contains sale-price + size
  var correctLevel = levels.find(function(l) {
    return l.titleCount === 1 && l.containsSize;
  });
  return JSON.stringify({
    expectedContainerClass: 'chakra-linkbox',
    actualContainerLevel: correctLevel ? correctLevel.level : 'NOT_FOUND',
    actualContainerClass: correctLevel ? correctLevel.firstClass : 'NOT_FOUND',
    levels: levels
  });
})()
```

**Interpret:** If `actualContainerClass` is not `chakra-linkbox`, Chakra UI was swapped out. Use the `actualContainerLevel` to determine the new walk-up depth.

### Element count stability

After initial page load (page 1):

```js
document.querySelectorAll('[data-testid="product-title"]').length
```

**Expected range:** 40-55 products per page. If 0, hard drift or popup blocking content. If >200, the page may have switched to loading all products at once (skip pagination).

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

**Baseline (2026-03-31):**
- HTML: ~600-700KB
- Scripts: ~40-50
- Stylesheets: ~15-20
- Iframes: ~2-4

A 3x+ change in any metric suggests a platform rewrite.

RCSS is a Loblaw Digital property. Loblaw tends to do platform-wide redesigns that affect realcanadiansuperstore.ca, nofrills.ca, fortinos.ca, and loblaws.com simultaneously. If you detect drift here, check the other Loblaw stores too.

## Content Drift

### Temporal coherence

Check whether the flyer data is current. The deals/flyer grid view does not always show a date range directly. Check the print-flyer page or look for date text:

```js
(function() {
  var text = document.body.innerText;
  var dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\w*\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\w*\s*\d{1,2}\w*/i);
  return dateMatch ? dateMatch[0] : 'NO DATE FOUND - check /en/print-flyer for date range';
})()
```

If stale or missing from the grid view, navigate briefly to `/en/print-flyer` to check the flyer date range (visible in the flipbook header). Log and skip if stale.

### Schema conformance (run after extraction)

After extracting products from all pages, check null rates:

```js
(function(products) {
  var fields = ['name', 'salePrice', 'wasPrice', 'brand', 'size'];
  var report = {};
  fields.forEach(function(f) {
    var nullCount = products.filter(function(p) { return !p[f]; }).length;
    report[f] = {
      nullCount: nullCount,
      nullPct: Math.round((nullCount / products.length) * 100)
    };
  });
  report._totalProducts = products.length;
  return JSON.stringify(report);
})(products)
```

**Thresholds:**
- `name` null >2%: title selector broke
- `salePrice` null >70%: expected — RCSS shows many regular-price-only items in its flyer alongside sale items. A much higher null rate than Fortinos (~60%) because RCSS has a larger non-sale catalog.
- `wasPrice` null >80%: normal — not all sale items show the "was" price
- `brand` null >50%: normal — many products don't list a separate brand (store brand, produce)
- `size` null >10%: package-size testid changed

**Price format validation:** Sale price text should match patterns like `sale$2.99`, `sale: $2.99`, `sale: about $0.92`. If all extracted sale prices fail to contain a `$` followed by digits, the text format changed.

### Content volume

**Expected range:** 5,000–8,000 products across all pages (~49 per page, ~130 pages). If total is <500, pagination is broken. If >15,000, the page may be showing all store products, not just flyer items.

After filtering to sale-only items (those with a `salePrice`), expect roughly 2,000–4,000 deals.

### Content hash delta

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

Store this hash. 3 identical consecutive weekly hashes = stale data.

## Behavioral Drift

### Pagination verification

After navigating to page 2, verify new products loaded (not the same ones):

```js
(function() {
  return JSON.stringify({
    currentUrl: window.location.href,
    hasPageParam: window.location.search.includes('page='),
    productCount: document.querySelectorAll('[data-testid="product-title"]').length,
    firstProductName: document.querySelector('[data-testid="product-title"]') ?
      document.querySelector('[data-testid="product-title"]').textContent.trim() : null
  });
})()
```

**Note on the sticky sponsored card:** The first `.chakra-linkbox` on every page is a "Sponsored" ad card (no `product-title`). The first *product* may also be a sponsored product (with `badge: "Sponsored"` and a `product-title`). This sponsored product appears on every page — it's not a sign that pagination is broken. Compare the *second* product title between pages to verify new content loaded.

**If pagination breaks:**
- Products don't change between pages → URL parameter no longer works
- 0 products on page 2 → pagination removed, all items may be on page 1
- Check for infinite scroll or "Load More" button as a fallback:

```js
(function() {
  var loadMore = Array.from(document.querySelectorAll('button, a')).find(function(el) {
    var t = el.textContent.trim().toLowerCase();
    return t.includes('load more') || t.includes('show more');
  });
  return JSON.stringify({
    loadMoreButton: loadMore ? loadMore.textContent.trim() : null,
    totalProducts: document.querySelectorAll('[data-testid="product-title"]').length
  });
})()
```

### Redirect tracking

```js
JSON.stringify({
  currentUrl: window.location.href,
  expectedPattern: '/deals/flyer',
  urlMatch: window.location.href.includes('/deals/flyer') || window.location.href.includes('/flyer')
});
```

If redirected to `/login`, `/select-store`, or a completely different path, the navigation path changed.

**RCSS-specific:** If the URL redirects to `/en/print-flyer` (the Flipp flipbook), the grid view may have been removed. This would be a major structural change requiring a different scraping approach.

### Button label drift

Log the text of interactive elements the skill depends on:

```js
(function() {
  return JSON.stringify({
    nextPage: document.querySelector('[aria-label="Next Page"]') ? 'present' : 'MISSING',
    prevPage: document.querySelector('[aria-label="Previous Page"]') ? 'present' : 'MISSING',
    pageLinks: document.querySelectorAll('[aria-label^="Page "]').length,
    paginationContainer: document.querySelector('[data-testid="pagination"]') ? 'present' : 'MISSING',
    closeButtons: Array.from(document.querySelectorAll('button')).filter(function(b) {
      return b.textContent.trim() === 'Close' || b.textContent.trim() === 'Yes';
    }).length
  });
})()
```

### HTTP status / soft 404 detection

```js
(function() {
  var text = document.body.innerText.toLowerCase();
  var errorSignals = ['page not found', '404', 'no flyer', 'coming soon', 'under maintenance', "we're sorry", 'select a store', 'choose your store'];
  var found = errorSignals.filter(function(s) { return text.includes(s); });
  return JSON.stringify({
    isErrorPage: found.length > 0,
    matchedSignals: found,
    titleTag: document.title
  });
})()
```

Note: "select a store" is a common soft failure — the page loads but shows no products because no store is set. This isn't a site redesign; it's a session/cookie issue. If detected, try clicking "Yes" on the pickup modal or navigating to a specific store URL.

## RCSS-Specific Drift Risks

1. **Grid view removal:** RCSS has two flyer views: `/en/deals/flyer` (structured grid, what we scrape) and `/en/print-flyer` (Flipp flipbook images). If the grid view is removed or redirects to the flipbook, the structured DOM extraction breaks entirely. The flipbook would require OCR-based extraction instead.

2. **Pagination removal:** Loblaw Digital could switch RCSS to infinite scroll (like No Frills) or a "Load More" button. If `[data-testid="pagination"]` disappears, check for these alternatives before reporting drift.

3. **Chakra UI swap:** The `.chakra-linkbox` card container is a Chakra UI class. If Loblaw migrates to a different component library, this selector breaks — but the `data-testid` selectors should survive since they're framework-agnostic.

4. **PC Optimum restructuring:** The points text ("1,000 PC Optimum Points") is extracted via both free text search and the dedicated `[data-testid="product-pco-badge"]` selector. If the points UI changes to an icon-only badge, the text match will miss it — but the testid should still work.

5. **Loblaw-wide platform redesign:** Loblaw Digital maintains a shared platform. A redesign that affects No Frills or Fortinos will likely also affect RCSS. Check all Loblaw stores when drift is detected at any one of them.

6. **Store selection gating:** RCSS may start requiring a store to be selected before showing flyer items. The pickup modal dismissal step handles the current implementation, but a hard gate (no products until store is selected) would require adding store selection logic.

7. **Catalog size fluctuation:** The ~133 pages is based on the current flyer. Page count may vary significantly week to week (100-150+ pages). Do not treat a page count change alone as drift — only flag if it drops below 50 or exceeds 200.

8. **Sticky sponsored card changes:** The sponsored ad card that appears on every page currently has no `product-title` (just an image and "Sponsored" text). If this changes to include structured product data, it could introduce duplicates across all pages.
