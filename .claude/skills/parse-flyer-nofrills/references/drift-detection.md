# Drift Detection — No Frills

Run this diagnostic step **after navigating to page 1 of the flyer** but **before iterating through all pages**. It catches problems early so you don't waste time paginating through a redesigned site.

## Structural Drift

### Selector hit rate

The skill depends on 7 `data-testid` selectors. Run this single script after the page loads:

```js
(function() {
  var selectors = {
    title: '[data-testid="product-title"]',
    brand: '[data-testid="product-brand"]',
    salePrice: '[data-testid="sale-price"]',
    wasPrice: '[data-testid="was-price"]',
    regularPrice: '[data-testid="regular-price"]',
    priceDescriptor: '[data-testid="price-descriptor"]',
    packageSize: '[data-testid="product-package-size"]'
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
- **6-7/7 (86-100%)** — proceed normally. `brand` is often absent on some products, so 6/7 is fine.
- **4-5/7 (57-71%)** — partial drift. The `data-testid` attributes are being removed or renamed. Check which ones are missing and whether the data lives elsewhere now.
- **0-3/7 (<43%)** — hard drift. Loblaw Digital (the parent company) likely redesigned the page or dropped `data-testid` attributes entirely. This is the highest-risk drift scenario for No Frills because `data-testid` attributes are typically added for testing purposes and are commonly removed in production builds.
- **`title` specifically is 0** — this is the anchor selector the entire extraction walks up from. If this breaks, nothing works. Stop immediately.

### Card container check

The skill uses `.chakra-linkbox` as the card container (a Chakra UI class). Verify it's still present and contains the expected data:

```js
(function() {
  var cards = document.querySelectorAll('.chakra-linkbox');
  if (cards.length === 0) return JSON.stringify({drift: true, reason: 'No .chakra-linkbox elements found — card container class changed'});
  var card = cards[0];
  var hasTitle = !!card.querySelector('[data-testid="product-title"]');
  var hasPrice = !!card.querySelector('[data-testid="sale-price"]') || !!card.querySelector('[data-testid="regular-price"]');
  var hasSize = !!card.querySelector('[data-testid="product-package-size"]');
  return JSON.stringify({
    cardCount: cards.length,
    firstCardHasTitle: hasTitle,
    firstCardHasPrice: hasPrice,
    firstCardHasSize: hasSize,
    allGood: hasTitle && hasPrice && hasSize
  });
})()
```

**Interpret:** If `.chakra-linkbox` returns 0, Loblaw Digital likely migrated away from Chakra UI. Check for alternative card container classes. If cards exist but lack expected children, the `data-testid` attributes may have moved outside the card boundary.

### Element count stability

After initial page load (before scrolling):

```js
document.querySelectorAll('[data-testid="product-title"]').length
```

**Expected range:** 10–40 products on initial load (before scroll). If 0, hard drift. If >200, the page may no longer lazy-load (good — skip the scroll step).

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

**Baseline (2026-03-30):** Compare against approximate values. A 3x+ change suggests a platform rewrite.
- HTML: ~300-1000KB (varies with loaded products)
- Scripts: ~20-50
- Stylesheets: ~5-15
- Iframes: ~1-5 (analytics)

No Frills is a Loblaw Digital property. Loblaw tends to do platform-wide redesigns that affect nofrills.ca, loblaws.com, and other banners simultaneously. If you detect drift here, check the other Loblaw stores too.

## Content Drift

### Temporal coherence

The No Frills flyer page typically shows a date range. Extract and validate:

```js
(function() {
  var text = document.body.innerText;
  var dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\w*\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\w*\s*\d{1,2}\w*/i);
  return dateMatch ? dateMatch[0] : 'NO DATE FOUND';
})()
```

If stale or missing, the flyer may not have updated yet. Log and skip.

### Schema conformance (run after extraction)

After extracting products, check null rates:

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
- `name` null >2%: title selector broke — this should almost never be null
- `salePrice` null >40%: sale-price testid changed or format changed
- `wasPrice` null >80%: normal — not all sale items show the "was" price
- `brand` null >60%: normal — many products don't list a separate brand
- `size` null >30%: package-size testid changed

**Price format validation:** Sale price text should match patterns like `sale$2.99`, `sale: $2.99`, `$2.99`. If all extracted sale prices fail to match `\$\d+\.\d{2}`, the text format changed:

```js
(function(products) {
  var pricePattern = /\$\d+\.?\d*/;
  var badPrices = products.filter(function(p) {
    return p.salePrice && !pricePattern.test(p.salePrice);
  });
  return JSON.stringify({
    totalWithSalePrice: products.filter(function(p) { return p.salePrice; }).length,
    badFormatCount: badPrices.length,
    samples: badPrices.slice(0, 3).map(function(p) { return p.salePrice; })
  });
})(products)
```

### Content volume

**Expected range:** 50–300 deals per weekly flyer. If <15, extraction is broken. If >800, the page may be showing all products, not just flyer deals.

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

The skill uses `?page=N` pagination. Verify it works by checking that page 2 returns products:

```js
// Run after navigating to ?page=2
document.querySelectorAll('[data-testid="product-title"]').length
```

**Expected:** ~49 products on page 2. If 0 or 1, pagination may have changed. Check for:

```js
(function() {
  var pagination = document.querySelector('[class*="pagination"], [class*="Pagination"], nav[aria-label*="page"]');
  var loadMore = [...document.querySelectorAll('button, a')].find(function(el) {
    var t = el.textContent.trim().toLowerCase();
    return t.includes('load more') || t.includes('show more') || t.includes('view more');
  });
  return JSON.stringify({
    paginationElement: !!pagination,
    loadMoreButton: loadMore ? loadMore.textContent.trim() : null,
    totalProductsOnPage: document.querySelectorAll('[data-testid="product-title"]').length
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

### HTTP status / soft 404 detection

```js
(function() {
  var text = document.body.innerText.toLowerCase();
  var errorSignals = ['page not found', '404', 'no flyer', 'coming soon', 'under maintenance', 'we\'re sorry', 'select a store'];
  var found = errorSignals.filter(function(s) { return text.includes(s); });
  return JSON.stringify({
    isErrorPage: found.length > 0,
    matchedSignals: found,
    titleTag: document.title
  });
})()
```

Note: "select a store" is a common soft failure — the page loads but shows no products because no store is set. This isn't a site redesign; it's a session/cookie issue. If detected, the skill may need to add a store selection step.