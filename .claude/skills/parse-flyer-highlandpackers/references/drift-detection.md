# Drift Detection — Highland Packers

Run this diagnostic **after navigating to the flyer page** but **before downloading images and calling Claude Vision**. Vision API calls are the expensive part — catch structural problems first.

## Structural Drift

### Image inventory check

The skill depends on product images matching specific filename patterns. Run this to verify images are present and follow the expected naming:

```js
(function() {
  var imgs = [...document.querySelectorAll('img')];
  var patterns = {
    freshMeat: imgs.filter(i => i.src.includes('FRESH-MEAT')).length,
    bulk: imgs.filter(i => i.src.includes('BULK') && !i.src.includes('HEADER')).length,
    summitDairy: imgs.filter(i => i.src.includes('SUMMIT-DAIRY')).length,
    produceHotBuys: imgs.filter(i => i.src.includes('HOT-BUYS')).length,
    produceSaveMore: imgs.filter(i => i.src.includes('SAVE-MORE')).length,
    frozenProduce: imgs.filter(i => i.src.includes('FROZEN-PRODUCE')).length,
    grocery: imgs.filter(i => i.src.includes('GROCERY') && !i.src.includes('HEADER')).length,
    bakery: imgs.filter(i => i.src.includes('BAKERY') && !i.src.includes('HEADER')).length,
    deli: imgs.filter(i => i.src.includes('DELI') && !i.src.includes('HEADER')).length,
    frozen: imgs.filter(i => i.src.includes('FROZEN') && !i.src.includes('HEADER') && !i.src.includes('FROZEN-PRODUCE')).length,
    headers: imgs.filter(i => i.src.includes('HEADER')).length
  };
  var totalProducts = Object.values(patterns).reduce((a, b) => a + b, 0) - patterns.headers;
  patterns._totalProductImages = totalProducts;
  patterns._totalHeaders = patterns.headers;
  patterns._totalAllImages = imgs.length;
  return JSON.stringify(patterns);
})()
```

**Interpret:**
- **40-60 product images** — normal range, proceed
- **20-39 product images** — partial drift. Some sections may have been removed or renamed. Check which sections returned 0 and note in output.
- **<20 product images** — hard drift. The filename convention or page structure has fundamentally changed. Stop and report.
- **0 product images but 40+ total images** — the filename convention changed. Check if new naming pattern exists by inspecting image `src` attributes.

### Filename convention check

Verify that product images still follow the `DIGITAL-ADD---<SECTION>` or `FRESH-PRODUCE---<SUBSECTION>` naming pattern:

```js
(function() {
  var imgs = [...document.querySelectorAll('img')];
  var productImgs = imgs.filter(i => {
    var fn = i.src.split('/').pop();
    return fn.includes('DIGITAL-ADD') || fn.includes('FRESH-PRODUCE') ||
           fn.includes('FROZEN-PRODUCE') || fn.includes('SUMMIT-DAIRY');
  });
  var nonMatching = imgs.filter(i => {
    var fn = i.src.split('/').pop();
    return !fn.includes('DIGITAL-ADD') && !fn.includes('FRESH-PRODUCE') &&
           !fn.includes('FROZEN-PRODUCE') && !fn.includes('SUMMIT-DAIRY') &&
           !fn.includes('HEADER') && !fn.includes('FLYER') && !fn.includes('CAFE') &&
           !fn.includes('MENU');
  });
  return JSON.stringify({
    matchingPattern: productImgs.length,
    nonMatchingImages: nonMatching.map(i => i.src.split('/').pop()),
    sampleMatching: productImgs.slice(0, 3).map(i => i.src.split('/').pop())
  });
})()
```

If `nonMatchingImages` contains items that look like product images (not logos, backgrounds), the naming convention may be changing. Note the new pattern.

### DOM container check

Verify product images are inside `w-layout-cell` containers (Webflow grid layout):

```js
(function() {
  var cells = document.querySelectorAll('.w-layout-cell');
  var layouts = document.querySelectorAll('.w-layout-layout');
  return JSON.stringify({
    layoutCellCount: cells.length,
    layoutContainerCount: layouts.length,
    platformSignal: cells.length > 0 ? 'Webflow (expected)' : 'CHANGED — not Webflow layout',
    inIframe: window !== window.top
  });
})()
```

If `layoutCellCount` is 0, the site has been rebuilt off Webflow.

### Page weight fingerprint

```js
(function() {
  return JSON.stringify({
    htmlSizeKB: Math.round(document.documentElement.outerHTML.length / 1024),
    scriptCount: document.querySelectorAll('script').length,
    stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]').length,
    iframeCount: document.querySelectorAll('iframe').length,
    totalImageCount: document.querySelectorAll('img').length
  });
})()
```

**Baseline (2026-03-31):**
- HTML: ~49KB
- Scripts: ~9
- Stylesheets: ~4
- Iframes: 0
- Images: ~58

A 3x+ change in any metric suggests a platform migration. The image count is the most important metric — if it drops significantly, products may have moved to a different delivery mechanism (e.g., embedded in a JS gallery, or served via Flipp).

## Content Drift

### Temporal coherence

The flyer header image contains the date range (e.g., "MAR 26TH TO APR 1ST 2026"). Since this text is inside an image, check the header image filename or page title for date signals:

```js
(function() {
  // Check page title for date hints
  var title = document.title;
  // Check for the header image
  var headerImg = document.querySelector('img[src*="FLYER-HEADER"]');
  // The date is embedded in the header image — we can't read it from DOM
  // Instead, check if the header image was recently modified via fetch
  return JSON.stringify({
    pageTitle: title,
    headerImageSrc: headerImg ? headerImg.src : 'NOT FOUND',
    note: 'Date is embedded in FLYER-HEADER.jpg image — requires Vision OCR to validate. Check header image in extraction step.'
  });
})()
```

To validate temporal coherence, include the header image (`FLYER-HEADER.jpg`) in the first Vision API call and ask Claude to extract the date range. If the date range is >2 weeks old, the flyer is stale — log and skip.

### Schema conformance (run after Vision extraction)

After extracting products via Vision, check null rates:

```
Fields and thresholds:
- item_name null >5%: Vision extraction is failing on product names
- sale_price null >10%: Vision extraction is failing on prices
- price_unit null >30%: acceptable (some images show price without clear unit)
- section null: 0% (derived from filename, not Vision)
```

If Vision extraction returns empty/garbage for >20% of images, the image format may have changed (different layout, different font, overlays blocking text).

### Content volume

**Expected range:** 35-55 deals per weekly flyer. Highland Packers is a single store with focused departments (heavily meat-oriented).

- **<20 deals**: Extraction is probably broken, or major sections are missing
- **>80 deals**: The page may be showing historical products or has added new sections

### Content hash delta

After extraction, hash the sorted product names to detect stale data:

```js
// Run on the extracted deals array
(function(deals) {
  var names = deals.map(function(d) { return d.item_name; }).sort().join('|');
  var hash = 0;
  for (var i = 0; i < names.length; i++) {
    hash = ((hash << 5) - hash) + names.charCodeAt(i);
    hash |= 0;
  }
  return 'content_hash:' + hash;
})(deals)
```

Store this hash. If 3+ consecutive weekly runs return the same hash, the site is serving a cached/stale flyer. Highland Packers updates weekly (specials effective Thursday to Wednesday).

## Behavioral Drift

### No interactive steps to verify

Unlike other store scrapers, Highland Packers requires no clicks, no view toggles, no pagination. The only interaction is navigation. This makes behavioral drift less likely but also means there are fewer signals — if the page breaks, it breaks silently.

### Redirect tracking

After navigation, verify the URL didn't change:

```js
JSON.stringify({
  currentUrl: window.location.href,
  expectedUrl: 'https://www.highlandpackers.com/weekly-specials-flyer.html',
  urlMatch: window.location.href.includes('weekly-specials-flyer')
});
```

If redirected to a different page, the flyer URL may have changed.

### Image load verification

Verify that product images actually loaded (not broken/404):

```js
(function() {
  var imgs = [...document.querySelectorAll('.w-layout-cell img')];
  var broken = imgs.filter(function(img) {
    return !img.complete || img.naturalWidth === 0;
  });
  return JSON.stringify({
    totalCellImages: imgs.length,
    brokenImages: broken.length,
    brokenPct: Math.round((broken.length / imgs.length) * 100),
    brokenSrcs: broken.slice(0, 5).map(i => i.src.split('/').pop())
  });
})()
```

If `brokenPct` > 20%, the image hosting may be down or URLs have changed.

### HTTP status / soft 404 detection

```js
(function() {
  var text = (document.body.innerText || '').toLowerCase();
  var errorSignals = ['page not found', '404', 'coming soon', 'under maintenance', 'we\'re sorry'];
  var found = errorSignals.filter(function(s) { return text.includes(s); });
  // Also check if the page has suspiciously little content
  var imgCount = document.querySelectorAll('img').length;
  return JSON.stringify({
    isErrorPage: found.length > 0 || imgCount < 5,
    matchedSignals: found,
    titleTag: document.title,
    imageCount: imgCount,
    note: imgCount < 5 ? 'Suspiciously few images — may be error page' : 'OK'
  });
})()
```

## Store-Specific Drift Risks

### Image-based extraction fragility

**Risk: HIGH** — The entire extraction depends on Claude Vision correctly reading product images. If Highland Packers changes their flyer image template (different fonts, different layout, overlapping text, lower resolution), extraction accuracy will degrade without any DOM signal.

**Mitigation:** After Vision extraction, spot-check 2-3 results against the actual images. If prices look implausible (e.g., >$100/lb for ground beef), flag for manual review.

### Webflow platform dependency

**Risk: LOW-MEDIUM** — The site runs on Webflow. Webflow updates could change the `w-layout-cell` / `w-layout-layout` class names. However, the skill primarily depends on `img` elements and filename patterns, not Webflow-specific selectors.

### Single-location store

**Risk: LOW** — Highland Packers is an independent single-store operation, not part of a chain. Changes are made by the store directly (likely a marketing person updating Webflow). Changes tend to be gradual (new images each week with same template) rather than sudden platform redesigns.

### Filename convention dependency

**Risk: MEDIUM** — The skill maps sections from filenames (e.g., `DIGITAL-ADD---FRESH-MEAT-*.jpg` -> meat). If the person updating the site changes the naming convention (e.g., `MEAT-1.jpg` instead of `DIGITAL-ADD---FRESH-MEAT-.jpg`), section mapping will break. The images will still be collected (they're in `w-layout-cell` containers) but will all map to "other" category.

**Mitigation:** If >50% of images map to "other", fall back to Vision-based category detection — ask Claude to classify the product category from the image content.

### No parent company siblings

Highland Packers is independent. No sibling stores share this platform, so drift here does not predict drift elsewhere (and vice versa).
