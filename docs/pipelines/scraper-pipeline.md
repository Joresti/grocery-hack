# Scraper Pipeline Specification

> Pipeline 1 of 2. Runs every Tuesday at 10pm ET via node-cron.

## Overview

The scraper fetches weekly grocery flyers from store websites, extracts deal data using Claude Haiku's vision and text capabilities, and inserts structured deals into the database.

## Architecture

```
For each store where scrape_status != 'disabled':

  1. Puppeteer opens store.flyer_url
  2. Dismiss cookie banners, wait for content
  3. Scroll through the page in viewport-sized chunks
  4. For each chunk: capture screenshot + extract visible text
  5. Send screenshot + visible text to Claude Haiku
  6. Claude returns structured deal JSON
  7. Validate with Zod, deduplicate
  8. Delete old deals for this store, insert new ones
  9. Update store.last_scraped_at and store.scrape_status
```

## Why Screenshot + Visible Text (Not DOM Parsing)

We scrape many different grocery store websites. Each store uses different tech stacks, frameworks, and DOM structures. Selectors break when sites redesign.

**Screenshot** captures what a human sees — works on SPAs, image-based flyers, PDF viewers, anything.

**Visible text** gives Claude exact strings — precise prices, unit info, product names — that may be hard to read from a compressed screenshot.

**Together** they provide both visual context and exact data. Neither depends on CSS class names, DOM structure, or any site-specific implementation.

The only store-specific value is `flyer_url` in the `stores` table.

## Puppeteer Page Capture

### Browser Setup

```typescript
// One browser instance per pipeline run, reused across stores
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Page Capture Strategy

```typescript
interface PageChunk {
  screenshot: Buffer;     // PNG screenshot of the viewport
  visibleText: string;    // innerText from the visible portion
  scrollPosition: number; // pixels from top
}
```

For each store:

1. **Navigate** to `store.flyer_url`
2. **Wait** for network idle (no requests for 500ms) or 15-second timeout
3. **Dismiss cookie banners** — click any element matching common cookie consent selectors:
   - `[aria-label*="cookie" i]`, `[class*="cookie-banner" i]`, `[id*="cookie" i]`
   - Button text: "Accept", "Close", "OK", "Got it"
4. **Measure** full page height via `document.body.scrollHeight`
5. **Scroll and capture** in viewport-sized chunks (1280×800 default):
   - Scroll to position
   - Wait 500ms for lazy-loaded images
   - Capture screenshot (PNG, full viewport)
   - Extract visible text from the viewport area
6. **Cap at 20 chunks** per store (safety limit — most flyers are 3-8 pages)

### Cookie Banner Dismissal

```typescript
const COOKIE_DISMISS_SELECTORS = [
  'button[aria-label*="close" i]',
  'button[aria-label*="accept" i]',
  '[class*="cookie"] button',
  '[id*="cookie"] button',
  '[class*="consent"] button',
  '[class*="privacy"] button',
];

const COOKIE_DISMISS_TEXT = ['Accept', 'Close', 'OK', 'Got it', 'I agree', 'Agree'];
```

Try selectors first, then fall back to text matching. If nothing works, continue anyway — the banner may overlap some content but Claude can still extract deals from the visible portions.

## Claude Haiku Prompt Template

### System Prompt

```
You are a grocery deal extraction engine. You receive a screenshot and visible text from a Canadian grocery store flyer page. Extract every grocery deal visible on the page.

Return a JSON array. Each deal object must have exactly these fields:

{
  "item_name": string,       // Normalized product name. Title case. No ALL CAPS. Include size if part of the product name (e.g. "Strawberries 1LB")
  "brand": string | null,    // Brand name if shown. null if store brand or not specified
  "category": string,        // One of the allowed categories listed below
  "sale_price": number,      // Current/sale price in dollars. For "about" prices, use the approximate value
  "regular_price": number | null, // Original price if shown (strikethrough or "was" price). null if not shown
  "unit": string,            // One of: "each", "lb", "kg", "100g", "100ml", "pack", "bag"
  "unit_size": string | null, // Package size as shown (e.g. "454 g", "2 kg", "1 l", "6 ea"). null if not shown
  "deal_conditions": string | null, // Any conditions: "limit 4", "member only", "4 day sale", "BOGO". null if none
  "price_type": string       // One of: "fixed", "per_weight", "multi_buy", "bogo"
}

ALLOWED CATEGORIES (pick the closest match):
- "produce" — fruits, vegetables, fresh herbs
- "meat" — beef, chicken, pork, lamb, turkey, deli meats
- "seafood" — fish, shrimp, shellfish, canned tuna/salmon
- "dairy" — milk, cheese, yogurt, butter, cream, eggs
- "bakery" — bread, buns, bagels, pastries, tortillas
- "frozen" — frozen meals, frozen vegetables, ice cream, frozen fries
- "pantry" — rice, pasta, canned goods, sauces, oils, spices, sugar, flour, condiments
- "beverages" — juice, pop, water, coffee, tea
- "snacks" — chips, crackers, cookies, candy, popcorn, granola bars
- "household" — cleaning supplies, paper towels, laundry, garbage bags
- "personal_care" — soap, shampoo, toothpaste, deodorant
- "baby" — diapers, formula, baby food
- "pet" — pet food, pet treats, pet supplies
- "deli" — prepared foods, rotisserie chicken, salads, soups
- "other" — anything that doesn't fit above

RULES:
1. Extract EVERY deal visible on the page. Do not skip items.
2. Normalize item names to Title Case. Remove excessive branding or ALL CAPS formatting.
3. If a price says "about $X.XX", use that number as sale_price. This means the item is sold by weight.
4. If a price says "$X.XX/lb" or "$X.XX/kg" without a fixed price, set price_type to "per_weight".
5. Multi-buy deals like "2 for $5" → sale_price: 2.50, deal_conditions: "2 for $5", price_type: "multi_buy".
6. BOGO deals → sale_price is the price paid per item, deal_conditions: "buy one get one free", price_type: "bogo".
7. If you see "SAVE $X.XX" but no regular_price, calculate it: regular_price = sale_price + savings.
8. Ignore non-grocery items (pharmacy, clothing, gift cards).
9. Ignore "Sponsored" or "Ad" labels — extract the deal normally.
10. If the page shows no deals (empty, error page, login wall), return an empty array: []
11. Return ONLY the JSON array. No markdown, no explanation, no code fences.
```

### User Message Structure

Each Claude API call sends one viewport chunk:

```typescript
{
  role: "user",
  content: [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: screenshotBase64
      }
    },
    {
      type: "text",
      text: `STORE: ${storeName}\nFLYER DATES: ${validFrom} to ${validTo}\n\nVISIBLE TEXT FROM THIS SECTION:\n${visibleText}`
    }
  ]
}
```

### Why One Call Per Chunk (Not One Giant Call)

- Image resolution degrades if you stitch multiple screenshots into one
- Token limits — a full flyer's text can exceed Haiku's context window
- Parallel processing — chunks can be sent concurrently (respecting rate limits)
- Easier retry — if one chunk fails, re-scrape just that section

## Flyer Date Detection

The valid_from and valid_to dates are critical. Strategy:

1. **First chunk often contains the flyer header** with dates like "Flyer prices effective Thursday, March 12 to Wednesday, March 18, 2026"
2. Send the first chunk to Claude with an additional instruction: `"Also extract the flyer validity dates if visible. Add a top-level field: flyer_dates: { valid_from: 'YYYY-MM-DD', valid_to: 'YYYY-MM-DD' } or null if not visible."`
3. If no dates found in first chunk, **default to**: valid_from = next Thursday, valid_to = next Wednesday (standard Canadian grocery flyer cycle: Thursday to Wednesday)
4. Apply the same dates to ALL deals from this store for this scrape run

## Output Validation

Every deal from Claude is validated with a Zod schema before insertion:

```typescript
const DealExtractionSchema = z.object({
  item_name: z.string().min(2).max(200),
  brand: z.string().nullable(),
  category: z.enum([
    'produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen',
    'pantry', 'beverages', 'snacks', 'household', 'personal_care',
    'baby', 'pet', 'deli', 'other'
  ]),
  sale_price: z.number().positive().max(500),
  regular_price: z.number().positive().max(500).nullable(),
  unit: z.enum(['each', 'lb', 'kg', '100g', '100ml', 'pack', 'bag']),
  unit_size: z.string().nullable(),
  deal_conditions: z.string().nullable(),
  price_type: z.enum(['fixed', 'per_weight', 'multi_buy', 'bogo']),
});

const DealExtractionArraySchema = z.array(DealExtractionSchema);
```

**Validation failures** are logged but do not halt the pipeline. Invalid deals are skipped with a warning. If >50% of deals from a chunk fail validation, log an error and flag the store for review.

## Deduplication

The same product can appear in multiple viewport chunks (overlapping scroll). Before insertion:

1. Collect all deals from all chunks for a store
2. Deduplicate by `item_name` + `brand` (case-insensitive). If duplicates exist, keep the one with more complete data (has regular_price, has unit_size, etc.)
3. Then insert the deduplicated set

## Database Operations

```sql
-- Within a transaction:

-- 1. Delete previous flyer deals for this store (keep user-reported deals)
DELETE FROM deals
WHERE store_id = $1
  AND source = 'flyer';

-- 2. Insert new deals (batch insert)
INSERT INTO deals (store_id, item_name, category, sale_price, regular_price,
                   unit, deal_conditions, valid_from, valid_to, source)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'flyer');

-- 3. Update store metadata
UPDATE stores
SET last_scraped_at = now(),
    scrape_status = 'ok',
    updated_at = now()
WHERE id = $1;
```

## Spend Limit Enforcement

Before each Claude API call:

```typescript
// 1. Check current period usage
const usage = await db.query(
  `SELECT SUM(estimated_cost_usd) as total
   FROM usage_tracking
   WHERE service = 'anthropic'
     AND period = 'monthly'
     AND period_key = $1`,
  [getCurrentMonthKey()]  // e.g. "2026-03"
);

// 2. Compare against limit
const limit = parseFloat(process.env.CLAUDE_MONTHLY_BUDGET_USD!);
const current = usage.rows[0]?.total ?? 0;

if (current >= limit) {
  logger.error(`Spend limit reached: $${current}/$${limit}. Skipping store: ${store.name}`);
  skippedStores.push(store.id);
  continue;
}

if (current >= limit * 0.8) {
  logger.warn(`Spend at ${((current/limit)*100).toFixed(0)}%: $${current}/$${limit}`);
}

// 3. After successful call, record usage
await db.query(
  `INSERT INTO usage_tracking (service, period, period_key, call_count, estimated_cost_usd)
   VALUES ('anthropic', 'monthly', $1, 1, $2)
   ON CONFLICT (service, user_id, period, period_key)
   DO UPDATE SET call_count = usage_tracking.call_count + 1,
                 estimated_cost_usd = usage_tracking.estimated_cost_usd + $2`,
  [getCurrentMonthKey(), estimatedCostForCall]
);
```

Pipeline spend is tracked with `user_id = NULL` (system-level usage, not per-user).

## Cost Estimation

Per store (typical flyer with 5 viewport chunks):
- 5 screenshots × ~1,500 tokens each (image) = ~7,500 image tokens
- 5 text blocks × ~500 tokens each = ~2,500 input tokens
- System prompt × 5 calls = ~3,500 tokens
- 5 responses × ~2,000 tokens each = ~10,000 output tokens
- **Total input: ~13,500 tokens, Total output: ~10,000 tokens**
- **Haiku cost: ~$0.05-0.10 per store** (input $0.80/M + output $4.00/M)

At 15 stores: **~$0.75-1.50 per weekly run, ~$3-6/month**

## Error Handling

| Error | Action |
|-------|--------|
| Puppeteer navigation timeout (>30s) | Set `scrape_status = 'failed'`, log, continue to next store |
| Page loads but no deal content detected | Set `scrape_status = 'failed'`, log "no deals found" |
| Claude API error (rate limit, 500) | Retry once after 5s. If still fails, skip store, log |
| Claude returns invalid JSON | Retry once with same input. If still fails, skip chunk, log |
| >50% of deals fail Zod validation | Log error, flag store for manual review, still insert valid deals |
| Spend limit reached | Skip remaining stores, log which stores were skipped |
| All stores fail | Send alert email to admin |

## Logging

Every pipeline run logs:
- Start time, end time, total duration
- Per store: URL, chunks captured, deals extracted, deals inserted, errors
- Total deals across all stores
- Claude API calls made, total tokens used, estimated cost
- Stores skipped (with reason)

## Cron Schedule

```typescript
// scheduler.ts
import cron from 'node-cron';
import { runScraper } from './scraper';

// Every Tuesday at 10:00 PM ET
cron.schedule('0 22 * * 2', async () => {
  logger.info('Starting weekly flyer scrape');
  await runScraper();
}, {
  timezone: 'America/Toronto'
});
```

## Testing Strategy

1. **Snapshot tests**: Save real page captures (screenshot + text) from different stores. Run Claude extraction against them. Assert output matches expected deals.
2. **Zod validation tests**: Feed edge-case deal objects (missing fields, weird prices, boundary values) through the schema.
3. **Deduplication tests**: Feed overlapping deal arrays, assert correct merging behavior.
4. **Spend limit tests**: Mock usage_tracking to test 80% warning and 100% block behavior.
5. **Integration test**: Full pipeline against a saved HTML fixture (no live scraping).

## Known Limitations

- **Image-heavy flyers**: Some stores show deals only as images with no text overlay. Claude vision handles this but accuracy may be lower for small text in compressed screenshots.
- **Dynamic flyers**: Flyers that require store/postal code selection need the URL to include location context, or the pipeline needs per-store navigation steps. For MVP, we assume `flyer_url` points directly to a pre-filtered flyer view.
- **Rate limits**: Claude Haiku has rate limits. With 15 stores × 5 chunks = 75 API calls, this should be well within limits, but the pipeline processes stores sequentially and chunks in batches of 5.
- **Flyer availability**: Some stores post new flyers Thursday, not Tuesday. The Tuesday 10pm schedule catches most stores. Stores with different schedules can have their `flyer_url` updated manually or the cron can be adjusted per-store in a future version.