---
name: parse-flyer-highlandpackers
description: Parse grocery deals from the Highland Packers flyer page using image URL collection + Claude Vision OCR via Chrome CDP. Built and tested against highlandpackers.com/weekly-specials-flyer.html. This is an IMAGE-BASED flyer — zero DOM text, all product names and prices are embedded in JPG images. Use this skill whenever parsing, scraping, or extracting deals from a Highland Packers flyer, or when someone mentions Highland Packers deals or flyer data.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Parse Grocery Flyer (Highland Packers)

Extract deals from the Highland Packers weekly specials flyer page. Unlike other store scrapers that use CSS selectors on structured DOM elements, Highland Packers is a **Webflow-hosted image-based flyer** — every product name, price, and detail is embedded inside JPG product images with zero DOM text. Extraction requires collecting image URLs from the page, downloading them, and sending them to Claude Vision (Haiku) for OCR.

## Arguments

`$ARGUMENTS` — the flyer page URL.

Example: `https://www.highlandpackers.com/weekly-specials-flyer.html`

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

Wait 5 seconds for all images to load (the page is image-heavy, ~49KB HTML but many 1265x1265 JPGs).

### 2. Dismiss popups

Highland Packers currently has no cookie banners, store selectors, or login walls. Check anyway:

```js
(function() {
  var acceptBtn = [...document.querySelectorAll('button')].find(b =>
    /accept|agree|got it|ok/i.test(b.textContent.trim()));
  if (acceptBtn) acceptBtn.click();
  return acceptBtn ? 'Dismissed popup' : 'No popup found';
})()
```

### 3. No view switching needed

Highland Packers has no grid/list toggle, no Flipp iframe, and no tabs. The flyer is a single vertical scroll of product images organized by section headers. All products load on initial page load — no pagination, no "Load More" button.

### 4. Run drift detection

Before extracting, verify the page structure hasn't changed. Read `references/drift-detection.md` for the full diagnostic script and thresholds. Run the image inventory check — if product image count drops below 20, stop and report.

### 5. Collect product image URLs with section mapping

The page structure is: section header images (e.g., `MEAT-HEADER.png`) followed by product images in `w-layout-cell` containers. Each product image filename encodes its section. Collect all product images (excluding headers and the cafe menu):

```js
(function() {
  var imgs = [...document.querySelectorAll('img')];
  var productImgs = imgs.filter(function(img) {
    var fn = (img.src || '').split('/').pop();
    return (fn.includes('DIGITAL-ADD') || fn.includes('FRESH-PRODUCE') ||
            fn.includes('FROZEN-PRODUCE') || fn.includes('SUMMIT-DAIRY')) &&
           !fn.includes('HEADER') && !fn.includes('CAFE');
  });
  return JSON.stringify(productImgs.map(function(img) {
    var fn = img.src.split('/').pop();
    var section = 'other';
    if (fn.includes('FRESH-MEAT')) section = 'meat';
    else if (fn.includes('BULK')) section = 'meat';
    else if (fn.includes('SUMMIT-DAIRY')) section = 'dairy';
    else if (fn.includes('HOT-BUYS')) section = 'produce';
    else if (fn.includes('SAVE-MORE')) section = 'produce';
    else if (fn.includes('FROZEN-PRODUCE')) section = 'frozen';
    else if (fn.includes('GROCERY')) section = 'pantry';
    else if (fn.includes('BAKERY')) section = 'bakery';
    else if (fn.includes('DELI')) section = 'deli';
    else if (fn.includes('FROZEN')) section = 'frozen';
    return { url: img.src, filename: fn, section: section };
  }));
})()
```

**Expected count:** 40-50 product images. If <20, the page structure likely changed.

### 6. Download all product images

Download each image to a temporary directory:

```bash
mkdir -p /tmp/highland-flyer-imgs
```

For each image URL collected in step 5:

```bash
curl -s -o "/tmp/highland-flyer-imgs/<filename>" "<image_url>"
```

Download all images. They are ~100-300KB each (1265x1265 JPGs).

### 7. Extract deals via Claude Vision

Send each product image to Claude Haiku for OCR extraction. Each image contains ONE or occasionally TWO product deals with:
- Product name (bold text at top of image)
- Sale price (large price text, e.g., "$4.99 LB")
- Metric equivalent (smaller text below, e.g., "$11.00 KG")
- Optional "WEEKLY SPECIAL" badge
- Optional description text (e.g., "CUT FROM CANADA GRADE AA BEEF OR HIGHER")

For each image, call Claude with this prompt:

```
Extract ALL grocery deals from this product image. Some images contain 2 products (a main product and a smaller secondary product shown below it).

For EACH product, return a JSON object with these fields:
- "item_name": the product name exactly as shown (Title Case)
- "sale_price": the main sale price as a number (e.g., 4.99)
- "price_unit": the unit for the sale price — "lb", "kg", "each", or "100g"
- "metric_price": the metric equivalent price as a number if shown (e.g., 11.00), or null
- "metric_unit": the metric unit if shown (usually "kg"), or null
- "description": any additional description text, or null

Return a JSON array of objects (even if only one product). No markdown fences.
```

Use model `claude-haiku-4-5-20251001` with `max_tokens: 300` and `temperature: 0`.

Pass the image as a base64 content block with `media_type: "image/jpeg"`.

**Batch strategy:** Process images sequentially or in small batches (5 at a time) to respect rate limits. Each image is one API call.

### 8. Parse into deal records

For each Vision extraction result, combine with the section mapping from step 5:

**item_name:** From Vision `item_name`. Title Case. Append size/weight if the Vision response includes it in the name.

**sale_price:** From Vision `sale_price`. Must be a positive number.

**regular_price:** Highland Packers flyer images do NOT show regular/original prices. Always NULL.

**unit:** From Vision `price_unit`. Map: "lb" -> "lb", "kg" -> "kg", "each" or "ea" -> "each", "100g" -> "100g". Default: "each".

**category:** Use the section mapping from step 5 (derived from filename). Map to canonical categories:
- meat -> meat
- bulk -> meat (Highland Packers bulk section is bulk meat)
- dairy -> dairy
- produce -> produce
- frozen -> frozen
- pantry -> pantry
- bakery -> bakery
- deli -> deli
- other -> other

**product_type:** The core product identity in 1-3 lowercase words. Answers "what IS this product?" — not its flavor, brand, or a sub-ingredient. Examples:
- "Fresh Lean Ground Beef" → "ground beef"
- "Boneless Skinless Chicken Breast" → "chicken breast"
- "Beef Striploin Steak" → "beef steak"
- "Pork Back Ribs" → "pork ribs"
If the item IS the ingredient (a cut of meat, a block of cheese), product_type matches what a recipe would call for.

**deal_conditions:** NULL (Highland Packers does not show multi-buy or BOGO conditions on their flyer images).

**Skip rules:**
- Skip items where Vision could not extract a sale price
- Skip the cafe menu board image (already filtered by filename in step 5)
- Skip any image that Vision identifies as a header/banner rather than a product

### 9. Output

Print the final parsed deals as a JSON array. Each deal object:

```json
{
  "item_name": "Fresh Lean Ground Beef",
  "product_type": "ground beef",
  "category": "meat",
  "sale_price": 4.99,
  "regular_price": null,
  "unit": "lb",
  "deal_conditions": null
}
```

Report total deals extracted and count per category.

## Selector reference table

Highland Packers uses NO CSS selectors for product data — all data is in images. The skill depends on these structural selectors for image discovery only:

| Selector | Purpose | Stability | Fallback |
|---|---|---|---|
| `img` (all images) | Find all images on page | HIGH | N/A |
| Filename pattern `DIGITAL-ADD*`, `FRESH-PRODUCE*`, etc. | Filter product images from headers | MEDIUM (depends on naming convention) | Filter by image dimensions (1265x1265) |
| Filename pattern `*HEADER*` | Identify section headers | MEDIUM | Filter by image dimensions (1265x135) |
| `.w-layout-cell` | Product image container | MEDIUM (Webflow class) | `img` parent element |

## Key differences from other store skills

1. **Image-based extraction** — Unlike all other store skills that use DOM CSS selectors, Highland Packers requires Claude Vision OCR. There is zero DOM text on the page.
2. **No pagination** — All products load on initial page load. No "Load More" button, no infinite scroll.
3. **No regular prices** — The flyer only shows sale prices. `regular_price` is always null.
4. **Section from filename** — Categories are derived from image filenames (e.g., `DIGITAL-ADD---FRESH-MEAT-*.jpg`) rather than DOM structure.
5. **Webflow platform** — The site is built on Webflow (uses `w-layout-cell`, `w-layout-layout` classes). Not part of any major grocery chain platform (Loblaw, Empire, Metro).
6. **Single location** — Highland Packers is a single-location store at 432 Highland Rd E, Stoney Creek, ON. Not a chain.
7. **API cost** — Each scrape requires ~45 Claude Haiku Vision API calls (one per product image). Budget ~$0.05-0.10 per full scrape.

## Tested against

- Highland Packers (`highlandpackers.com/weekly-specials-flyer.html`) — 2026-03-31
- 45 product images across 8 sections (meat, bulk/meat, dairy, produce, frozen, pantry, bakery, deli)
- Plus 1 cafe menu image (skipped)
