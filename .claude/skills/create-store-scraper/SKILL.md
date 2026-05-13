---
name: create-store-scraper
description: Generate a grocery store flyer scraper skill and drift detection file for a new store. Use this skill whenever adding a new grocery store to the scraping pipeline, creating a new flyer parser, or when someone says "add [store name] to the scraper" or "create a skill for [store name]". This skill handles the full process — browser reconnaissance, selector discovery, pagination detection, extraction testing, and outputting both a SKILL.md and drift-detection.md that match the conventions of existing store skills.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
---

# Create Store Scraper

Generate a complete scraper skill and drift detection file for a new grocery store flyer page. This skill codifies the patterns from 9 existing store scrapers — spanning DOM-based (No Frills, RCSS, Fortinos, Metro, Food Basics, FreshCo), API-based (Walmart via Flipp), and Vision OCR (Highland Packers) strategies — so new stores are consistent and production-ready from the start.

## Arguments

`$ARGUMENTS` — the store name and flyer page URL.

Example: `Metro https://www.metro.ca/en/flyer`

## Prerequisites

Chrome must be running in **headed mode** with `--remote-debugging-port=9222`:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run --no-default-browser-check &
```

Never use `--headless`.

The CDP helper script must be available at `backend/scripts/cdp.py`.

## Instructions

### Phase 1: Reconnaissance

The goal is to understand the page before writing any extraction code. Do NOT extract products yet.

#### 1.1 Navigate and observe

```bash
python3 backend/scripts/cdp.py goto "<flyer_url>"
```

Wait 5 seconds for the page to fully load. Then capture an initial snapshot:

```js
(function() {
  return JSON.stringify({
    url: window.location.href,
    title: document.title,
    htmlSizeKB: Math.round(document.documentElement.outerHTML.length / 1024),
    scriptCount: document.querySelectorAll('script').length,
    stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]').length,
    iframeCount: document.querySelectorAll('iframe').length,
    bodyTextPreview: document.body.innerText.substring(0, 500)
  });
})()
```

Check for redirects — if the URL changed from what was provided, note the actual URL.

#### 1.2 Classify scraping strategy

Before diving into DOM selectors, determine which scraping strategy fits this store. The wrong strategy wastes hours — a Flipp API store doesn't need selector discovery, and an image-based store won't have any extractable text nodes.

```js
(function() {
  // Check for Flipp iframe
  var flippIframe = [...document.querySelectorAll('iframe')].find(f =>
    (f.src || '').includes('flipp') || (f.src || '').includes('wishabi'));

  // Check for bot protection (PerimeterX is common on Canadian grocery sites)
  var hasPerimeterX = !!document.querySelector('script[src*="perimeterx"]') ||
    !!document.querySelector('#px-captcha') ||
    document.cookie.includes('_pxhd');

  // Check for extractable product text in DOM
  var productSelectors = '[data-testid*="product"], .product-tile, .product-card, .default-product-tile, [class*="product"][class*="tile"], [data-product-name]';
  var domProductCount = document.querySelectorAll(productSelectors).length;

  // Check for image-heavy layouts with no text products
  var productImages = [...document.querySelectorAll('img')].filter(function(img) {
    return (img.naturalWidth > 200 || img.width > 200) &&
           !/logo|banner|icon|arrow|sprite/i.test(img.src);
  });

  var bodyTextLength = document.body.innerText.replace(/\s+/g, ' ').trim().length;

  return JSON.stringify({
    hasFlippIframe: !!flippIframe,
    flippSrc: flippIframe ? flippIframe.src : null,
    hasPerimeterX: hasPerimeterX,
    domProductCount: domProductCount,
    largeImageCount: productImages.length,
    bodyTextLength: bodyTextLength,
    likelyImageBased: productImages.length > 10 && domProductCount === 0 && bodyTextLength < 2000
  });
})()
```

Based on the results, choose one of three paths:

| Signal | Strategy | Next step |
|---|---|---|
| `hasPerimeterX` true OR Flipp iframe with no grid view toggle | **API-based** — use the Flipp API directly, bypass browser | Skip to Phase 1-API |
| `likelyImageBased` true OR `domProductCount` = 0 with many large images | **Vision OCR** — collect images, extract via Claude Vision | Skip to Phase 1-Vision |
| `domProductCount` > 0 | **DOM-based** — extract from CSS selectors (default path) | Continue to step 1.3 |

If the Flipp iframe is present but a grid view toggle is also available, prefer DOM-based extraction — grid view surfaces the data directly without needing the API. This is the pattern used by Metro, Food Basics, and FreshCo.

---

**DOM-based path continues below (steps 1.3–1.8). For API or Vision paths, skip to Phase 1-API or Phase 1-Vision after Phase 1.**

#### 1.3 Detect blockers

Check for cookie banners, store selectors, age gates, or login walls:

```js
(function() {
  var text = document.body.innerText.toLowerCase();
  return JSON.stringify({
    cookieBanner: !![...document.querySelectorAll('button')].find(b =>
      /accept|agree|got it|ok/i.test(b.textContent.trim())),
    storeSelector: text.includes('select a store') || text.includes('choose your store') || text.includes('find a store'),
    ageGate: text.includes('19 years') || text.includes('of legal age'),
    loginWall: text.includes('sign in') && document.querySelectorAll('[data-testid="product-title"], .product-tile, .product-card').length === 0,
    errorPage: ['page not found', '404', 'coming soon', 'under maintenance'].some(s => text.includes(s))
  });
})()
```

If a cookie banner exists, dismiss it. Note the exact button text and selector used for the skill.

If a store picker/location modal is detected (common on Loblaw Digital sites like RCSS and Fortinos), dismiss it by clicking the close button or selecting a default store. These modals block interaction with the product grid:

```js
(function() {
  // Loblaw-style pickup location modal
  var closeBtn = document.querySelector('[data-testid="modal-close"], button[aria-label="Close"], .modal-close');
  if (closeBtn) { closeBtn.click(); return 'Closed modal'; }
  // Sometimes need to select a store first — click "Skip" or "No thanks" if available
  var skipBtn = [...document.querySelectorAll('button')].find(b =>
    /skip|no thanks|continue without/i.test(b.textContent.trim()));
  if (skipBtn) { skipBtn.click(); return 'Skipped store selector'; }
  return 'No store picker found';
})()
```

Note the exact dismissal approach for the skill — this varies by parent company.

#### 1.4 Detect view mode

Many store flyer pages default to a Flipp flipbook iframe. Check if a grid/list view is available:

```js
(function() {
  var hasFlipp = document.querySelectorAll('iframe').length > 0 &&
    [...document.querySelectorAll('iframe')].some(f =>
      (f.src || '').includes('flipp') || (f.className || '').includes('flipp'));

  var viewToggles = [...document.querySelectorAll('button, a, div')].filter(el => {
    var t = el.textContent.trim().toLowerCase();
    return t === 'grid view' || t === 'list view' || t === 'grid' || t === 'list' ||
           el.className.includes('icon-grid') || el.className.includes('grid-view');
  });

  var tabs = [...document.querySelectorAll('button, a, [role="tab"]')].filter(el => {
    var t = el.textContent.trim().toLowerCase();
    return t.includes('complete flyer') || t.includes('all deals') || t.includes('all items');
  });

  return JSON.stringify({
    hasFlippIframe: hasFlipp,
    viewToggles: viewToggles.map(el => ({
      text: el.textContent.trim(),
      tag: el.tagName,
      className: el.className.substring(0, 80),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestId: el.getAttribute('data-testid')
    })),
    tabs: tabs.map(el => ({
      text: el.textContent.trim(),
      tag: el.tagName,
      className: el.className.substring(0, 80),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestId: el.getAttribute('data-testid'),
      role: el.getAttribute('role')
    }))
  });
})()
```

If a grid view toggle exists, click it and wait 3 seconds. Note ALL available attributes on the toggle (data-testid, aria-label, class, text) for the skill — use the most stable selector available in this priority order: `data-testid` > `aria-label` > unique class > text match.

If tabs like "Complete Flyer" exist, click them too. Note the same attribute details.

#### 1.5 Discover product card selectors

This is the most important step. Find the product card container and all relevant data selectors:

```js
(function() {
  // Common product card selectors across grocery sites
  var candidateSelectors = [
    // data-testid selectors (Loblaw Digital: RCSS, Fortinos, No Frills)
    '[data-testid*="product"]',
    '[data-testid*="deal"]',
    '[data-testid*="item"]',
    // Rich data-* attribute selectors (Metro: data-product-name, data-main-price)
    '[data-product-name]',
    '[data-product-brand]',
    '[data-main-price]',
    // Semantic CSS class selectors (Metro/Food Basics: .default-product-tile)
    '.product-tile', '.product-card', '.deal-card', '.item-card',
    '.default-product-tile',
    '[class*="product"][class*="tile"]',
    '[class*="product"][class*="card"]',
    '[class*="deal"][class*="card"]',
    // Chakra UI (Loblaw Digital)
    '.chakra-linkbox',
    'article[class*="product"]',
    '.grid > div > div' // generic grid children as fallback
  ];

  var results = {};
  candidateSelectors.forEach(function(sel) {
    try {
      var count = document.querySelectorAll(sel).length;
      if (count > 0) results[sel] = count;
    } catch(e) {}
  });

  // If we found cards, inspect the first one for internal structure
  var bestSelector = Object.keys(results).sort((a, b) => {
    // Prefer data-testid, then semantic classes, then generic
    if (a.includes('data-testid')) return -1;
    if (b.includes('data-testid')) return 1;
    return results[b] - results[a];
  })[0];

  var cardStructure = null;
  if (bestSelector) {
    var card = document.querySelector(bestSelector);
    // Get all text-containing elements inside the card
    var elements = [...card.querySelectorAll('*')].filter(el =>
      el.children.length === 0 && el.textContent.trim().length > 0
    );
    cardStructure = elements.map(el => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent.trim().substring(0, 80),
      className: el.className ? el.className.substring(0, 80) : '',
      dataTestId: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      parentClass: el.parentElement ? el.parentElement.className.substring(0, 60) : ''
    }));
    // Also check for rich data-* attributes on the card itself (Metro pattern)
    // These are more stable than CSS classes and often contain product data directly
    var cardAttrs = [...card.attributes].filter(a => a.name.startsWith('data-'));
    var richDataAttrs = cardAttrs.map(a => ({ name: a.name, value: a.value.substring(0, 60) }));
  }

  return JSON.stringify({
    candidateHits: results,
    bestCandidate: bestSelector,
    firstCardStructure: cardStructure,
    richDataAttributes: richDataAttrs || []
  }, null, 2);
})()
```

From the card structure, identify selectors for each required field:

| Field | What to look for | Examples |
|---|---|---|
| Product name/title | Largest text, heading elements, `data-testid*="title"` | "Strawberries 1LB" |
| Sale price | Text containing "$", red/bold styling, `data-testid*="sale"` | "$2.99" |
| Regular/was price | Strikethrough text, `data-testid*="was"` or `*="regular"` | "was $3.99" |
| Size/weight | Small text with g, ml, kg, lb patterns | "454g, $0.66/100g" |
| Savings | "SAVE $X" badges, colored backgrounds | "SAVE $1.00" |
| Loyalty/member price | Loyalty program badges, member-only prices | "PC Optimum" / "Scene+" |

**Rich data-* attributes** (Metro pattern): If `richDataAttributes` returned entries like `data-product-name`, `data-main-price`, `data-discount-percent`, these are extremely valuable — they contain product data directly as attribute values, requiring no text parsing. Prefer these over CSS text extraction when available. Stability: HIGH (used by the store's own analytics, rarely removed).

For EACH identified selector, document:
- The primary selector (most stable)
- A fallback selector (alternative approach)
- Whether it uses data-testid (most stable), rich data-* attribute (high), semantic class (moderate), or Tailwind/utility class (fragile)
- The stability rating: HIGH (data-testid, rich data-*), MEDIUM (semantic class), LOW (utility/Tailwind class)

#### 1.6 Position-based fallback analysis

When the site uses Tailwind or utility-only classes (no data-testid, no aria-labels), run this additional analysis. Structural position within the card is the most drift-resistant fallback for Tailwind sites — it survives color token renames, class refactors, and build tool changes.

```js
(function() {
  var grid = document.querySelector('GRID_SELECTOR_HERE');
  var cards = grid ? [...grid.children].slice(0, 5) : [];
  return JSON.stringify(cards.map(function(card) {
    // Find the price row — typically a <p> or <div> with multiple <span> children containing "$"
    var priceRows = [...card.querySelectorAll('p, div')].filter(function(el) {
      var spans = el.querySelectorAll('span');
      return spans.length >= 2 && [...spans].some(function(s) { return s.textContent.includes('$'); });
    });
    var priceRow = priceRows[0];
    if (!priceRow) return {hasPriceRow: false};
    var children = [...priceRow.children];
    return {
      hasPriceRow: true,
      priceRowTag: priceRow.tagName,
      priceRowClasses: priceRow.className.substring(0, 80),
      childCount: children.length,
      children: children.map(function(c, idx) {
        return {
          index: idx,
          tag: c.tagName,
          text: c.textContent.trim().substring(0, 20),
          hasLineThrough: (c.className || '').includes('line-through'),
          hasStrikethrough: c.tagName === 'S' || c.tagName === 'DEL'
        };
      })
    };
  }), null, 2);
})()
```

If the position pattern is consistent across cards (e.g., child[0] is always sale price, child[1] is always regular price), document it as the primary fallback strategy in the skill. This is especially important for Sobeys/Empire sites which use Tailwind throughout.

Also look for non-utility classes that survive Tailwind rebuilds — loyalty badge elements often have semantic classes (like `offerstop`, `card-title`) even when the rest of the card is pure Tailwind:

```js
(function() {
  var grid = document.querySelector('GRID_SELECTOR_HERE');
  var card = grid ? grid.children[0] : null;
  if (!card) return 'no card';
  var allElements = card.querySelectorAll('*');
  var semanticClasses = [];
  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    var classes = (el.className || '').split(' ').filter(function(c) {
      // Filter out Tailwind-pattern classes (contain numbers, brackets, colons, slashes)
      return c.length > 2 && !/[\d\[\]:\/]/.test(c) && !/^(flex|grid|text|bg|p|m|w|h|min|max|gap|rounded|border|font|items|justify|relative|absolute|overflow|inline|block|cursor|z|top|bottom|left|right|hidden|visible|opacity|transition|shadow|hover|focus|active|disabled|before|after|first|last|even|odd)/.test(c);
    });
    if (classes.length > 0) {
      semanticClasses.push({
        tag: el.tagName,
        classes: classes,
        text: el.textContent.trim().substring(0, 40)
      });
    }
  }
  return JSON.stringify(semanticClasses, null, 2);
})()
```

Document any semantic classes found — these are the most resilient selectors on Tailwind sites.

#### 1.7 Detect pagination

Check how the page loads more products:

```js
(function() {
  // Check for Load More button
  var loadMore = [...document.querySelectorAll('button, a')].find(el => {
    var t = el.textContent.trim().toLowerCase();
    return t.includes('load more') || t.includes('show more') || t.includes('view more');
  });

  // Check for pagination
  var pagination = document.querySelector(
    '[class*="pagination"], [class*="Pagination"], nav[aria-label*="page"], .pager'
  );

  // Check for URL parameter pagination (Loblaw Digital: RCSS, Fortinos use ?page=N)
  var urlHasPage = /[?&]page=\d+/.test(window.location.search);
  var pageLinks = [...document.querySelectorAll('a')].filter(function(a) {
    return /[?&]page=\d+/.test(a.href || '');
  });

  // Check for infinite scroll (presence of intersection observer targets)
  var sentinel = document.querySelector('[class*="sentinel"], [class*="observer"], [class*="infinite"]');

  // Check current product count
  var productCount = document.querySelectorAll(
    '[data-testid*="product"], .product-tile, .product-card, .default-product-tile, .deal-card'
  ).length;

  // Check for a total count display (both in main content and sidebar)
  var bodyText = document.body.innerText;
  var totalMatch = bodyText.match(/(?:found|showing|of)\s*:?\s*([\d,]+)\s*(?:deals|items|products|results)/i);

  // Check sidebar category counts — these often sum to the total flyer size
  var catElements = [...document.querySelectorAll('*')].filter(function(el) {
    return el.children.length === 0 && /\(\d+\)/.test(el.textContent.trim()) && el.textContent.trim().length < 50;
  });
  var sidebarTotal = 0;
  catElements.forEach(function(el) {
    var m = el.textContent.match(/\((\d+)\)/);
    if (m) sidebarTotal += parseInt(m[1]);
  });

  return JSON.stringify({
    loadMoreButton: loadMore ? {
      text: loadMore.textContent.trim(),
      tag: loadMore.tagName,
      className: loadMore.className.substring(0, 80),
      dataTestId: loadMore.getAttribute('data-testid')
    } : null,
    hasPagination: !!pagination,
    hasInfiniteScroll: !!sentinel,
    currentProductCount: productCount,
    displayedTotal: totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : null,
    sidebarCategoryTotal: sidebarTotal > 0 ? sidebarTotal : null,
    sidebarCategories: catElements.map(function(el) { return el.textContent.trim(); }),
    urlHasPageParam: urlHasPage,
    pageLinksCount: pageLinks.length,
    paginationType: loadMore ? 'load_more_button' :
                    sentinel ? 'infinite_scroll' :
                    (pageLinks.length > 0 || urlHasPage) ? 'url_page_param' :
                    pagination ? 'page_numbers' : 'unknown'
  });
})()
```

Based on the pagination type detected:
- **load_more_button**: Use a click loop similar to Food Basics / FreshCo / Metro skills
- **infinite_scroll**: Use a scroll loop similar to No Frills skill
- **url_page_param**: Navigate to `?page=1`, `?page=2`, etc., extracting products from each page. Stop when a page returns 0 products. This is the Loblaw Digital pattern (RCSS, Fortinos). **Important**: these sites often have a sticky sponsored ad card that appears on every page — deduplicate by filtering products with `badge="Sponsored"` or by name.
- **page_numbers**: Will need a page navigation loop (click next, extract, repeat)
- **unknown**: Try scrolling to bottom and checking if count increases. If not, all products may already be loaded (Highland Packers pattern — single-page load).

The sidebar category totals and displayed total ("Found: N Deals") are valuable completion signals — use them to verify the Load More / scroll loop loaded everything.

#### 1.8 Detect flyer date range

```js
(function() {
  var text = document.body.innerText;
  var dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}\w*\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\w*\s*\d{1,2}\w*/i);
  return dateMatch ? dateMatch[0] : 'NO DATE FOUND';
})()
```

Note the format for the drift detection temporal coherence check.

### Phase 1-API: API-Based Stores (Flipp)

Use this path when step 1.2 classified the store as API-based. Many Canadian grocery chains serve flyers through Flipp (backflipp.wishabi.com), and some protect their sites with PerimeterX bot detection, making DOM scraping unreliable. The Flipp API returns the same data without browser dependencies.

#### Discover the Flipp merchant ID

The Flipp API requires a `merchant_id`. Find it by searching Flipp's merchant list:

```bash
curl -s "https://backflipp.wishabi.com/flipp/merchants?locale=en-ca" | python3 -c "
import json, sys
merchants = json.load(sys.stdin)
for m in merchants:
    name = m.get('name', '').lower()
    if 'STORE_NAME_LOWERCASE' in name:
        print(f\"ID: {m['id']}, Name: {m['name']}\")
"
```

Replace `STORE_NAME_LOWERCASE` with the store name. If the store was found in a Flipp iframe, the merchant ID may also be in the iframe's src URL.

#### Verify API access

```bash
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=MERCHANT_ID")
echo "Status: $HTTP_STATUS"
```

- `200`: Proceed
- `401`/`403`: API requires authentication — HARD DRIFT, cannot use API path
- `404`: Endpoint moved — HARD DRIFT
- `429`: Rate limited — wait 60s, retry once

#### Fetch and inspect flyer data

```bash
# Get active flyers
curl -s "https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=MERCHANT_ID" > /tmp/flyer-list.json

# Identify the current grocery flyer (valid_to in future, has grocery category)
# Then fetch all items
curl -s "https://backflipp.wishabi.com/flipp/flyers/FLYER_ID?locale=en-ca&postal_code=L9A0A1" > /tmp/flyer-items.json
```

Inspect the response schema — note all available fields. Common Flipp fields:

| API Field | Maps To | Notes |
|---|---|---|
| `name` | `item_name` | Title Case; prepend `brand` if not already in name |
| `brand` | (prefix) | ~40-60% of items have brand; prepend only if missing from name |
| `price` | `sale_price` | Parse string as float |
| `discount` | `regular_price` | Calculate: `sale_price / (1 - discount/100)` |
| `display_type` | (filter) | `1` = product, `5` = banner/header — keep only `1` |

**Skip rules for API stores:**
- Skip items with no price or price = 0
- Skip `display_type` != 1
- Skip non-grocery categories (furniture, electronics, clothing, automotive, toys, sporting goods)

After testing extraction, skip to **Phase 3** to generate the skill file. The skill should document API endpoints, merchant ID, field mappings, and skip rules instead of DOM selectors. For the drift detection file, include pre-scrape API health checks (HTTP status, schema validation, flyer freshness) — see the Walmart skill's `drift-detection.md` for the pattern.

**Estimated cost**: $0 (no Claude API calls needed for API-based stores).

---

### Phase 1-Vision: Image-Based Stores

Use this path when step 1.2 classified the store as image-based. This is common for independent stores, butcher shops, and specialty grocers that upload flyer page scans or product photos with no extractable DOM text.

#### Collect product image URLs with section mapping

First, identify the image filename patterns that distinguish product images from headers, logos, and decoration:

```js
(function() {
  var imgs = [...document.querySelectorAll('img')].filter(function(img) {
    return (img.naturalWidth > 150 || img.width > 150) &&
           !/logo|banner|icon|arrow|sprite|header|footer/i.test(img.src);
  });
  // Group by filename prefix to find patterns
  var groups = {};
  imgs.forEach(function(img) {
    var fn = (img.src || '').split('/').pop().split('?')[0];
    var prefix = fn.replace(/[-_]?\d+\.(jpg|png|webp)$/i, '');
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push({ url: img.src, filename: fn });
  });
  return JSON.stringify({
    totalCandidates: imgs.length,
    groups: Object.entries(groups)
      .map(function(e) { return { prefix: e[0], count: e[1].length, sample: e[1][0].filename }; })
      .sort(function(a, b) { return b.count - a.count; })
  }, null, 2);
})()
```

From the groupings:
- Identify which filename patterns are product images (typically the largest group with consistent dimensions)
- Identify headers, banners, and logos to skip
- Check if filenames encode section/category info (e.g., `FRESH-MEAT-01.jpg`, `DAIRY-SPECIAL.jpg`) — this is valuable because it provides free category mapping without Vision

Build a filtering and section-mapping script specific to this store's filename conventions:

```js
(function() {
  var imgs = [...document.querySelectorAll('img')].filter(function(img) {
    var fn = (img.src || '').split('/').pop();
    // CUSTOMIZE: filter for product images based on discovered patterns
    return fn.includes('PRODUCT_PATTERN') && !fn.includes('HEADER');
  });
  return JSON.stringify(imgs.map(function(img) {
    var fn = img.src.split('/').pop();
    // CUSTOMIZE: map filename patterns to categories
    var section = 'other';
    if (/meat|beef|pork|chicken/i.test(fn)) section = 'meat';
    else if (/dairy|milk|cheese/i.test(fn)) section = 'dairy';
    else if (/produce|fruit|veg/i.test(fn)) section = 'produce';
    else if (/frozen/i.test(fn)) section = 'frozen';
    else if (/bakery|bread/i.test(fn)) section = 'bakery';
    else if (/deli/i.test(fn)) section = 'deli';
    return { url: img.src, filename: fn, section: section };
  }));
})()
```

**Expected**: 30-60 product images for a typical store. If <20, the page structure likely changed.

#### Download images and extract via Claude Vision

```bash
mkdir -p /tmp/STORE-flyer-imgs
# Download each product image (generate curl commands from the URL list)
curl -s -o "/tmp/STORE-flyer-imgs/FILENAME" "IMAGE_URL"
```

Use Claude Vision (Haiku) to extract deal information from each image:

- **Model**: `claude-haiku-4-5-20251001`
- **Config**: `max_tokens: 300`, `temperature: 0`
- **Rate limiting**: Process sequentially or in batches of 5 to avoid rate limits

**Vision extraction prompt template** (customize based on what this store's images show):

```
Extract ALL grocery deals from this product image. Some images contain multiple products (a main product and a smaller secondary product).

For EACH product, return a JSON object with:
- "item_name": the product name exactly as shown (Title Case)
- "sale_price": the main sale price as a number (e.g., 4.99)
- "price_unit": "lb", "kg", "each", or "100g"
- "description": any additional description text, or null

Return a JSON array of objects (even if only one product). No markdown fences.
```

Add fields to the prompt based on what the store's images show:
- If dual-unit pricing visible (lb + kg): add `metric_price` and `metric_unit` fields
- If regular prices shown: add `regular_price` field
- If deal badges visible (BOGO, limit): add `deal_conditions` field

**Validation before full run**: Spot-check 3-5 Vision results against the actual images. If accuracy is below 90%, adjust the prompt or check image resolution. Some images may contain multiple products — verify the prompt handles this.

**Field mappings for Vision stores:**
- `regular_price`: Often NULL (many independent stores only show sale prices)
- `category`: Derived from filename section mapping, not from Vision response
- `deal_conditions`: Usually NULL unless badges are visible in images

After testing extraction, skip to **Phase 3**. The generated skill should document the image collection script, filename patterns, Vision prompt, section-to-category mapping, and rate limiting. For drift detection, include image inventory checks (expected count and filename patterns), broken image detection, and Vision accuracy monitoring.

**Estimated cost**: ~$0.001-0.002 per image with Haiku Vision. For a typical 40-50 image store: ~$0.05-0.10 per scrape.

---

### Phase 2: Test extraction (DOM-based stores)

Now that you understand the page structure, write and test the extraction. This phase applies to DOM-based stores. API and Vision stores complete their extraction in Phase 1-API or Phase 1-Vision above.

#### 2.1 Load all products

Based on the pagination type detected in Phase 1, load all products into the DOM. Use the appropriate pattern:

**For Load More buttons** — click loop with miss-count exit AND item-count stall detection:

```js
(function() {
  return new Promise(function(resolve) {
    var maxAttempts = 500;
    var attempts = 0;
    var missCount = 0;
    var lastCount = 0;
    var staleRounds = 0;
    var interval = setInterval(function() {
      var btn = [...document.querySelectorAll('button, a')].find(function(el) {
        return /load more|show more|view more/i.test(el.textContent.trim()) && el.offsetParent !== null;
      });
      attempts++;

      // Count current products
      var currentCount = document.querySelectorAll('CARD_SELECTOR_HERE').length;

      if (btn) {
        missCount = 0;
        btn.click();
        // Check if clicking actually loaded new items
        if (currentCount === lastCount) {
          staleRounds++;
        } else {
          staleRounds = 0;
        }
        lastCount = currentCount;
      } else {
        missCount++;
        if (missCount >= 3) {
          clearInterval(interval);
          resolve('Done (button gone). ' + currentCount + ' products loaded.');
          return;
        }
      }
      // Exit if 3 consecutive clicks didn't increase count
      if (staleRounds >= 3) {
        clearInterval(interval);
        resolve('Done (stale). ' + currentCount + ' products loaded.');
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        resolve('Safety limit. ' + currentCount + ' products loaded.');
      }
    }, 2000);
  });
})()
```

**For infinite scroll** — scroll loop with count plateau detection:

```js
(function() {
  return new Promise(function(resolve) {
    var maxScrolls = 30;
    var scrolls = 0;
    var lastCount = 0;
    var staleScrolls = 0;
    var interval = setInterval(function() {
      window.scrollTo(0, document.body.scrollHeight);
      scrolls++;
      setTimeout(function() {
        var count = document.querySelectorAll('CARD_SELECTOR_HERE').length;
        if (count === lastCount) {
          staleScrolls++;
        } else {
          staleScrolls = 0;
        }
        lastCount = count;
        if (staleScrolls >= 3 || scrolls >= maxScrolls) {
          clearInterval(interval);
          resolve('Done. ' + count + ' products loaded after ' + scrolls + ' scrolls.');
        }
      }, 2000);
    }, 3000);
  });
})()
```

**For URL parameter pagination** (`?page=N`) — navigate to each page and extract (Loblaw Digital pattern: RCSS, Fortinos):

This pattern requires navigating to each page URL rather than loading products into a single DOM. Extract products from each page separately, then merge results. Use `python3 backend/scripts/cdp.py goto` to navigate between pages.

For each page `N` starting at 1:
1. Navigate to `FLYER_URL?page=N`
2. Wait for products to render
3. Extract all products on that page
4. If 0 products found, stop — you've passed the last page
5. Otherwise, append to results and increment N

**Important**: Loblaw Digital sites often show a sticky sponsored ad card on every page. Deduplicate by filtering products where `badge` contains "Sponsored" or by tracking seen product names across pages.

Replace `CARD_SELECTOR_HERE` with the actual card selector discovered in Phase 1.

#### 2.2 Extract all products

Write an extraction script using the selectors discovered in Phase 1. The script must return a JSON array. Test it and verify:

- Total count matches what was loaded
- Product names are populated (>95% non-null)
- Prices parse as numbers
- No obvious garbage data

If the output is too large for a single pass, implement batch extraction using array slicing.

#### 2.3 Validate extraction quality

Run this validation on the extracted data:

```js
(function(products) {
  var report = {
    totalProducts: products.length,
    fields: {}
  };
  var fieldNames = Object.keys(products[0] || {});
  fieldNames.forEach(function(f) {
    var nullCount = products.filter(function(p) { return !p[f]; }).length;
    report.fields[f] = {
      nullCount: nullCount,
      nullPct: Math.round((nullCount / products.length) * 100),
      sample: products.find(function(p) { return p[f]; }) ?
              products.find(function(p) { return p[f]; })[f] : null
    };
  });
  // Price sanity
  var prices = products.map(function(p) {
    var match = (p.salePrice || p.price || '').toString().match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }).filter(function(p) { return p !== null; });
  report.priceStats = {
    count: prices.length,
    min: Math.min.apply(null, prices),
    max: Math.max.apply(null, prices),
    avg: Math.round(prices.reduce(function(a,b){return a+b;}, 0) / prices.length * 100) / 100
  };
  return JSON.stringify(report, null, 2);
})(products)
```

If null rates are too high for key fields (name >5%, price >20%), revisit the selectors.

### Phase 3: Generate the skill file

Write the SKILL.md file following this exact structure. Every section is required.

#### Frontmatter

```yaml
---
name: parse-flyer-STORENAME
description: Parse grocery deals from the STORENAME flyer page using [SELECTOR_TYPE] via Chrome CDP. Built and tested against DOMAIN. Use this skill whenever parsing, scraping, or extracting deals from a STORENAME flyer.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---
```

#### Required sections (in this order)

1. **Title and description** — one paragraph explaining what the skill does and what site it targets.

2. **Arguments** — `$ARGUMENTS` is the flyer page URL. Include an example URL.

3. **Prerequisites** — Chrome in headed mode with `--remote-debugging-port=9222`. Copy this exactly from existing skills. Never use `--headless`.

4. **Instructions** — numbered steps:
   - Step 1: Navigate to the flyer page
   - Step 2: Dismiss popups (cookie banners, overlays)
   - Step 3: Switch view mode (if applicable — grid view, complete flyer tab)
   - Step 4: Run drift detection — verify the page structure hasn't changed before doing expensive work. Point to `references/drift-detection.md` for the full diagnostic script and thresholds. Run the selector hit rate check. If below 50%, stop and report.
   - Step 5: Load all products (pagination handling)
   - Step 6: Extract all products in one pass
   - Step 7: Parse into deal records
   - Step 8: Output

5. **Parse rules** (inside Step 7) — document these for each field:
   - **item_name**: How to build it. Title Case.
   - **sale_price**: Source field, what to strip, parse as number.
   - **regular_price**: Source field, what to strip. NULL if absent.
   - **unit**: How to parse from size field. Map to: each, 100g, 100ml, lb, kg. Default: each.
   - **category**: Classify from product name using this canonical list: produce, meat, seafood, dairy, bakery, frozen, pantry, beverages, snacks, household, personal_care, baby, pet, deli, other.
   - **product_type**: The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. If the item IS the ingredient (a bag of rice, a cut of meat), product_type matches what a recipe would call for. If the item CONTAINS the ingredient but is a different product (crackers with olive oil, dog food with beef), product_type is the actual product. Examples: "Ritz Crackers with Olive Oil" → "crackers", "Bertolli Olive Oil 1L" → "olive oil", "Pedigree Beef Dog Food" → "dog food", "AAA Beef Striploin Steak" → "beef steak".
   - **deal_conditions**: Multi-buy, limit, BOGO, loyalty points. NULL if none.
   - **Skip rules**: Skip items with no sale price. Skip non-grocery items.

6. **Output format** — JSON array. Each object must match this schema:

```json
{
  "item_name": "Product Name With Size",
  "product_type": "core product identity",
  "category": "category_from_canonical_list",
  "sale_price": 2.99,
  "regular_price": 3.99,
  "unit": "each",
  "deal_conditions": null
}
```

Report total deals extracted and count per category.

7. **Selector reference table** — a table listing every selector the skill uses, its stability rating, and its fallback. This makes drift detection actionable:

| Selector | Purpose | Stability | Fallback |
|---|---|---|---|
| `[data-testid="product-title"]` | Product name | HIGH | `h3.product-name` |
| `.text-red400.font-bold` | Sale price | LOW (Tailwind) | Price row child[0] |

8. **Key differences from other store skills** — note what makes this store unique (selector type, pagination method, loyalty programs, view switching).

9. **Tested against** — the domain and date tested.

#### Selector documentation

For each selector used in extraction scripts, add an inline comment noting stability and fallback:

```js
// PRIMARY: data-testid="product-title" (HIGH stability)
// FALLBACK: h3.product-name, .card-title
var title = card.querySelector('[data-testid="product-title"]');
```

### Phase 4: Generate the drift detection file

Write a `references/drift-detection.md` file following the exact structure used by existing stores. It must include ALL of these sections:

#### Structural drift
- **Selector hit rate** — script that checks all selectors used by the skill. Include thresholds for proceed / partial drift / hard drift.
- **DOM path fingerprint** — the expected path from grid to card. Script to verify.
- **Element count stability** — expected range on initial load before pagination.
- **Page weight fingerprint** — baseline HTML size, script count, stylesheet count, iframe count with date.

#### Content drift
- **Temporal coherence** — extract and validate the flyer date range.
- **Schema conformance** — null rate check per field with thresholds specific to this store.
- **Content volume** — expected deal count range. Document what "too few" and "too many" mean.
- **Content hash delta** — hash sorted product names to detect stale data across weeks.

#### Behavioral drift
- **Step completion verification** — after each interaction step (view toggle, tab click, pagination), verify it worked.
- **Redirect tracking** — verify URL didn't change unexpectedly.
- **Button label drift** — log actual text of all interactive elements the skill depends on.
- **HTTP status / soft 404 detection** — check for error page signals.

#### Store-specific drift risks

Document any unique fragility for this store:
- What selector type is used (data-testid = low risk, Tailwind = high risk)
- Parent company and sibling brands (if one drifts, check the others)
- Third-party integrations (Flipp iframe, chat widgets)
- Known quirks discovered during reconnaissance

### Phase 5: Validate end-to-end

Run the complete skill against the live site:

1. Follow every step in the generated SKILL.md
2. Run every check in the generated drift-detection.md
3. Verify the output matches the expected schema
4. Report: total products, category breakdown, any parsing failures

If anything fails, fix the skill and re-test before saving.

### Phase 6: Save files

Save the generated files to these paths:

```
.claude/skills/parse-flyer-STORENAME/SKILL.md
.claude/skills/parse-flyer-STORENAME/references/drift-detection.md
```

Report what was created and the test results.

## Parent company reference

When generating drift risk notes, use these groupings. If one store in a group drifts, the others likely will too:

| Parent | Stores | Scraping strategy | Platform risk |
|---|---|---|---|
| Loblaw Digital | No Frills, Loblaws, Real Canadian Superstore, Zehrs, Valu-mart, Fortinos | DOM (data-testid) | Shared platform; selectors may be stripped in prod builds. RCSS/Fortinos use `?page=N` pagination; No Frills uses infinite scroll. |
| Empire / Sobeys | FreshCo, Sobeys, Farm Boy, Safeway, Chalo FreshCo | DOM (Tailwind CSS) | HIGH drift risk — Tailwind classes are generated and change with any build tool update. Position-based fallbacks essential. |
| Metro Inc. | Food Basics, Metro, Super C, Jean Coutu (grocery) | DOM (semantic CSS + rich data-*) | Moderate stability. Metro has rich `data-product-name`, `data-main-price` attributes; Food Basics uses CSS classes only. |
| Flipp API stores | Walmart, and others using Flipp flipbook | API (backflipp.wishabi.com) | No browser needed. Risk: API auth changes, endpoint removal, rate limiting. Check PerimeterX on the site as a signal. |
| Independent stores | Highland Packers, local butchers/specialty grocers | Vision OCR (image-based) | Image filename conventions and Claude Vision prompt tuning. Low platform risk but high extraction fragility. |

When adding a store that belongs to one of these groups, read the existing skill for a sibling store first — they likely share significant page structure. Reference the sibling skill in the "Key differences" section so future maintainers know the relationship.

When adding a Flipp API store, check the Walmart skill (`parse-flyer-walmart`) for the endpoint patterns and drift detection approach. When adding an image-based store, check the Highland Packers skill (`parse-flyer-highlandpackers`) for the Vision OCR pipeline and prompt template.
