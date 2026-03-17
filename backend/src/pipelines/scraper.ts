import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { z } from 'zod';
import { callClaude } from '../lib/claude.js';
import type { ClaudeContentBlock } from '../lib/claude.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { pool } from '../db/client.js';

// ────────────────────────────────────────────────────────────
// Zod validation schema for extracted deals
// ────────────────────────────────────────────────────────────

export const dealExtractionSchema = z.object({
  item_name: z.string().min(2).max(200),
  brand: z.string().nullable(),
  category: z.enum([
    'produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen',
    'pantry', 'beverages', 'snacks', 'household', 'personal_care',
    'baby', 'pet', 'deli', 'other',
  ]),
  sale_price: z.number().positive().max(500),
  regular_price: z.number().positive().max(500).nullable(),
  unit: z.enum(['each', 'lb', 'kg', '100g', '100ml', 'pack', 'bag']),
  unit_size: z.string().nullable(),
  deal_conditions: z.string().nullable(),
  price_type: z.enum(['fixed', 'per_weight', 'multi_buy', 'bogo']),
});

export const dealExtractionArraySchema = z.array(dealExtractionSchema);

export type ExtractedDeal = z.infer<typeof dealExtractionSchema>;

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface StoreBrandRow {
  id: string;
  name: string;
  flyer_url: string;
  scrape_status: string;
}

interface PageChunk {
  screenshot: Buffer;
  visibleText: string;
  scrollPosition: number;
}

interface FlyerDates {
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
}

export interface ScrapeResult {
  brandsScraped: number;
  dealsFound: number;
  errors: string[];
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const MAX_CHUNKS = 20;
const NAVIGATION_TIMEOUT_MS = 30_000;
const SCROLL_SETTLE_MS = 500;

const COOKIE_DISMISS_SELECTORS = [
  'button[aria-label*="close" i]',
  'button[aria-label*="accept" i]',
  '[class*="cookie"] button',
  '[id*="cookie"] button',
  '[class*="consent"] button',
  '[class*="privacy"] button',
  '#onetrust-accept-btn-handler',
];

const COOKIE_DISMISS_TEXT = ['Accept', 'Close', 'OK', 'Got it', 'I agree', 'Agree'];

// ────────────────────────────────────────────────────────────
// Claude Haiku system prompt
// ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a grocery deal extraction engine. You receive a screenshot and visible text from a Canadian grocery store flyer page. Extract every grocery deal visible on the page.

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
11. Return ONLY the JSON array. No markdown, no explanation, no code fences.`;

// ────────────────────────────────────────────────────────────
// Date calculation helpers
// ────────────────────────────────────────────────────────────

/**
 * Calculate the flyer valid_from (next Thursday) and valid_to (following Wednesday).
 * Canadian grocery flyers typically run Thursday to Wednesday.
 */
export function calculateFlyerDates(referenceDate?: Date): FlyerDates {
  const now = referenceDate ?? new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  // Calculate days until next Thursday (day 4)
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  // If today is Thursday, we still want *next* Thursday for a Tuesday night run
  if (daysUntilThursday === 0) {
    daysUntilThursday = 7;
  }
  // For Tuesday night (day 2), daysUntilThursday = 2 which is correct (Thu is 2 days away)

  const validFrom = new Date(now);
  validFrom.setDate(now.getDate() + daysUntilThursday);
  validFrom.setHours(0, 0, 0, 0);

  const validTo = new Date(validFrom);
  validTo.setDate(validFrom.getDate() + 6); // Wednesday = Thursday + 6 days
  validTo.setHours(0, 0, 0, 0);

  return {
    validFrom: formatDate(validFrom),
    validTo: formatDate(validTo),
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ────────────────────────────────────────────────────────────
// Claude response parsing
// ────────────────────────────────────────────────────────────

/**
 * Parse the Claude Haiku response into an array of validated deals.
 * Returns only deals that pass Zod validation; logs invalid ones.
 */
export function parseClaudeResponse(raw: string, storeName: string): ExtractedDeal[] {
  let parsed: unknown;

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    cleaned = cleaned.slice(firstNewline + 1);
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3).trim();
    }
  }

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error('Claude returned invalid JSON', {
      store: storeName,
      rawLength: raw.length,
      rawPreview: raw.slice(0, 200),
    });
    return [];
  }

  if (!Array.isArray(parsed)) {
    logger.error('Claude response is not an array', {
      store: storeName,
      type: typeof parsed,
    });
    return [];
  }

  const validDeals: ExtractedDeal[] = [];
  let invalidCount = 0;

  for (const item of parsed) {
    const result = dealExtractionSchema.safeParse(item);
    if (result.success) {
      validDeals.push(result.data);
    } else {
      invalidCount++;
      logger.warn('Invalid deal skipped', {
        store: storeName,
        item: JSON.stringify(item).slice(0, 200),
        errors: result.error.flatten().fieldErrors,
      });
    }
  }

  const totalCount = parsed.length;
  if (totalCount > 0 && invalidCount / totalCount > 0.5) {
    logger.error('More than 50% of deals failed validation — flagging for review', {
      store: storeName,
      total: totalCount,
      invalid: invalidCount,
    });
  }

  return validDeals;
}

// ────────────────────────────────────────────────────────────
// Deduplication
// ────────────────────────────────────────────────────────────

/**
 * Deduplicate deals by item_name + brand (case-insensitive).
 * When duplicates exist, keep the one with more complete data.
 */
export function deduplicateDeals(deals: ExtractedDeal[]): ExtractedDeal[] {
  const seen = new Map<string, ExtractedDeal>();

  for (const deal of deals) {
    const brandKey = (deal.brand ?? '').toLowerCase().trim();
    const key = `${deal.item_name.toLowerCase().trim()}||${brandKey}`;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, deal);
    } else {
      // Keep the deal with more complete data
      const existingScore = completenessScore(existing);
      const newScore = completenessScore(deal);
      if (newScore > existingScore) {
        seen.set(key, deal);
      }
    }
  }

  return Array.from(seen.values());
}

function completenessScore(deal: ExtractedDeal): number {
  let score = 0;
  if (deal.regular_price !== null) score++;
  if (deal.unit_size !== null) score++;
  if (deal.deal_conditions !== null) score++;
  if (deal.brand !== null) score++;
  return score;
}

// ────────────────────────────────────────────────────────────
// Puppeteer helpers
// ────────────────────────────────────────────────────────────

async function dismissCookieBanners(page: Page): Promise<void> {
  // Try common selectors
  for (const selector of COOKIE_DISMISS_SELECTORS) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await new Promise((resolve) => setTimeout(resolve, 300));
        return;
      }
    } catch {
      // Selector not found or click failed, continue
    }
  }

  // Fallback: try text matching on buttons
  try {
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.evaluate(
        (el: { textContent: string | null }) => el.textContent?.trim() ?? '',
      );
      if (COOKIE_DISMISS_TEXT.some((t) => text.includes(t))) {
        await button.click();
        await new Promise((resolve) => setTimeout(resolve, 300));
        return;
      }
    }
  } catch {
    // Text matching failed, continue without dismissing
  }
}

async function captureChunks(page: Page): Promise<PageChunk[]> {
  const chunks: PageChunk[] = [];

  const pageHeight = await page.evaluate('document.body.scrollHeight') as number;
  const chunkCount = Math.min(
    Math.ceil(pageHeight / VIEWPORT_HEIGHT),
    MAX_CHUNKS,
  );

  for (let i = 0; i < chunkCount; i++) {
    const scrollY = i * VIEWPORT_HEIGHT;

    await page.evaluate(`window.scrollTo(0, ${scrollY})`);
    await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));

    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: scrollY,
        width: VIEWPORT_WIDTH,
        height: Math.min(VIEWPORT_HEIGHT, pageHeight - scrollY),
      },
    }) as Buffer;

    const visibleText = await page.evaluate('document.body.innerText') as string;

    chunks.push({ screenshot, visibleText, scrollPosition: scrollY });
  }

  return chunks;
}

// ────────────────────────────────────────────────────────────
// Claude extraction
// ────────────────────────────────────────────────────────────

async function extractDealsFromChunk(
  chunk: PageChunk,
  storeName: string,
  flyerDates: FlyerDates,
): Promise<ExtractedDeal[]> {
  const screenshotBase64 = chunk.screenshot.toString('base64');

  const content: ClaudeContentBlock[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: screenshotBase64,
      },
    },
    {
      type: 'text',
      text: `STORE: ${storeName}\nFLYER DATES: ${flyerDates.validFrom} to ${flyerDates.validTo}\n\nVISIBLE TEXT FROM THIS SECTION:\n${chunk.visibleText.slice(0, 4000)}`,
    },
  ];

  const raw = await callClaude(
    [{ role: 'user', content }],
    {
      model: config.CLAUDE_SCRAPER_MODEL,
      maxTokens: 4096,
      system: SYSTEM_PROMPT,
      temperature: 0,
    },
    null, // pipeline-level, no user
  );

  return parseClaudeResponse(raw, storeName);
}

// ────────────────────────────────────────────────────────────
// Database operations
// ────────────────────────────────────────────────────────────

async function getScrapableBrands(): Promise<StoreBrandRow[]> {
  const { rows } = await pool.query(
    `SELECT id, name, flyer_url, scrape_status
     FROM store_brands
     WHERE scrape_status != 'disabled'
       AND flyer_url IS NOT NULL`,
  );
  return rows as StoreBrandRow[];
}

async function deleteOldFlyerDeals(
  storeBrandId: string,
  validFrom: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM deals
     WHERE store_brand_id = $1
       AND source = 'flyer'
       AND valid_from >= $2::date`,
    [storeBrandId, validFrom],
  );
}

async function insertDeals(
  storeBrandId: string,
  deals: ExtractedDeal[],
  flyerDates: FlyerDates,
): Promise<number> {
  if (deals.length === 0) return 0;

  let insertedCount = 0;

  for (const deal of deals) {
    await pool.query(
      `INSERT INTO deals (
        store_brand_id, item_name, category, sale_price, regular_price,
        unit, deal_conditions, valid_from, valid_to, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'flyer')`,
      [
        storeBrandId,
        deal.item_name,
        deal.category,
        deal.sale_price,
        deal.regular_price,
        deal.unit,
        deal.deal_conditions,
        flyerDates.validFrom,
        flyerDates.validTo,
      ],
    );
    insertedCount++;
  }

  return insertedCount;
}

async function updateBrandScrapeStatus(
  storeBrandId: string,
  status: 'ok' | 'failed',
): Promise<void> {
  await pool.query(
    `UPDATE store_brands
     SET scrape_status = $2,
         last_scraped_at = now()
     WHERE id = $1`,
    [storeBrandId, status],
  );
}

// ────────────────────────────────────────────────────────────
// Per-brand scraping
// ────────────────────────────────────────────────────────────

async function scrapeBrand(
  brand: StoreBrandRow,
  browser: Browser,
): Promise<{ dealsFound: number; error: string | null }> {
  let page: Page | null = null;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });

    logger.info('Scraping brand', { brand: brand.name, url: brand.flyer_url });

    await page.goto(brand.flyer_url, {
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await dismissCookieBanners(page);

    const flyerDates = calculateFlyerDates();
    const chunks = await captureChunks(page);

    logger.info('Captured page chunks', {
      brand: brand.name,
      chunkCount: chunks.length,
    });

    // Extract deals from each chunk
    let allDeals: ExtractedDeal[] = [];
    for (const chunk of chunks) {
      try {
        const chunkDeals = await extractDealsFromChunk(
          chunk,
          brand.name,
          flyerDates,
        );
        allDeals = allDeals.concat(chunkDeals);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        // Check if spend limit was hit
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'SPEND_LIMIT_REACHED'
        ) {
          throw err; // Re-throw spend limit errors
        }

        logger.error('Failed to extract deals from chunk', {
          brand: brand.name,
          scrollPosition: chunk.scrollPosition,
          error: message,
        });
      }
    }

    // Deduplicate
    const deduplicated = deduplicateDeals(allDeals);

    logger.info('Deals extracted', {
      brand: brand.name,
      rawCount: allDeals.length,
      deduplicatedCount: deduplicated.length,
    });

    // Delete old flyer deals and insert new ones (within scope of this brand)
    await deleteOldFlyerDeals(brand.id, flyerDates.validFrom);
    const insertedCount = await insertDeals(brand.id, deduplicated, flyerDates);

    await updateBrandScrapeStatus(brand.id, 'ok');

    logger.info('Brand scrape completed', {
      brand: brand.name,
      dealsInserted: insertedCount,
    });

    return { dealsFound: insertedCount, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Brand scrape failed', { brand: brand.name, error: message });

    // Re-throw spend limit errors so the caller can stop the pipeline
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'SPEND_LIMIT_REACHED'
    ) {
      await updateBrandScrapeStatus(brand.id, 'failed');
      throw err;
    }

    try {
      await updateBrandScrapeStatus(brand.id, 'failed');
    } catch (updateErr) {
      logger.error('Failed to update brand scrape status', {
        brand: brand.name,
        error: updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    }

    return { dealsFound: 0, error: message };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Page already closed
      }
    }
  }
}

// ────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────

export async function scrapeAllStores(): Promise<ScrapeResult> {
  const startTime = Date.now();
  logger.info('Starting scraper pipeline');

  const brands = await getScrapableBrands();

  if (brands.length === 0) {
    logger.warn('No scrapable brands found');
    return { brandsScraped: 0, dealsFound: 0, errors: [] };
  }

  logger.info('Found brands to scrape', { count: brands.length });

  let browser: Browser | null = null;
  let brandsScraped = 0;
  let totalDeals = 0;
  const errors: string[] = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const brand of brands) {
      try {
        const result = await scrapeBrand(brand, browser);
        brandsScraped++;
        totalDeals += result.dealsFound;
        if (result.error) {
          errors.push(`${brand.name}: ${result.error}`);
        }
      } catch (err) {
        // Spend limit reached — stop processing remaining brands
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'SPEND_LIMIT_REACHED'
        ) {
          const skippedBrands = brands
            .slice(brands.indexOf(brand))
            .map((b) => b.name);
          logger.error('Spend limit reached — skipping remaining brands', {
            skippedBrands,
          });
          errors.push(`Spend limit reached — skipped: ${skippedBrands.join(', ')}`);
          break;
        }

        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${brand.name}: ${message}`);
      }
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Browser already closed
      }
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info('Scraper pipeline completed', {
    brandsScraped,
    dealsFound: totalDeals,
    errorCount: errors.length,
    durationMs,
  });

  return { brandsScraped, dealsFound: totalDeals, errors };
}
