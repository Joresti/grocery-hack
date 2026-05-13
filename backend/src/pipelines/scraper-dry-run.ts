/**
 * Dry-run scraper: tests PDF discovery and deal extraction against a store URL.
 * Does NOT write anything to the database.
 *
 * Usage:
 *   npx tsx backend/src/pipelines/scraper-dry-run.ts <url> [--store-name "Name"]
 *
 * Examples:
 *   npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.nofrills.ca/en/deals/flyer" --store-name "No Frills"
 *   npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.freshco.com/flyer/" --store-name "FreshCo"
 *   npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.foodbasics.ca/flyer" --store-name "Food Basics"
 *   npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.metro.ca/en/flyer" --store-name "Metro"
 */

import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { config } from '../config.js';
import { pool } from '../db/client.js';
import {
  calculateFlyerDates,
  deduplicateDeals,
  dismissCookieBanners,
  captureChunks,
  extractDealsFromChunk,
  extractDealsFromPdf,
  type ExtractedDeal,
} from './scraper.js';
import { discoverAndDownloadPdf } from './pdfDiscovery.js';

// ── CLI args ───────────────────────────────────────────────

function parseArgs(): { url: string; storeName: string } {
  const args = process.argv.slice(2);
  let url = '';
  let storeName = 'Test Store';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--store-name' && args[i + 1]) {
      storeName = args[i + 1]!;
      i++;
    } else if (!args[i]!.startsWith('--')) {
      url = args[i]!;
    }
  }

  if (!url) {
    console.error('Usage: npx tsx backend/src/pipelines/scraper-dry-run.ts <url> [--store-name "Name"]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.nofrills.ca/en/deals/flyer" --store-name "No Frills"');
    console.error('  npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.freshco.com/flyer/" --store-name "FreshCo"');
    console.error('  npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.foodbasics.ca/flyer" --store-name "Food Basics"');
    console.error('  npx tsx backend/src/pipelines/scraper-dry-run.ts "https://www.metro.ca/en/flyer" --store-name "Metro"');
    process.exit(1);
  }

  return { url, storeName };
}

// ── Main ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const { url, storeName } = parseArgs();
  const flyerDates = calculateFlyerDates();

  console.error(`[info] Store: ${storeName}`);
  console.error(`[info] URL: ${url}`);
  console.error(`[info] Flyer dates: ${flyerDates.validFrom} → ${flyerDates.validTo}`);
  console.error(`[info] Model: ${config.CLAUDE_SCRAPER_MODEL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.error(`[info] Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 2000));

    await dismissCookieBanners(page);

    // ── PDF discovery ──
    console.error('[info] Starting PDF discovery...');
    const pdfResult = await discoverAndDownloadPdf(page);

    let allDeals: ExtractedDeal[] = [];

    if (pdfResult.found && pdfResult.pdfBuffer) {
      const sizeMb = (pdfResult.pdfBuffer.length / (1024 * 1024)).toFixed(1);
      console.error(`[info] PDF found! method=${pdfResult.method}, size=${sizeMb}MB`);
      if (pdfResult.pdfUrl) {
        console.error(`[info] PDF URL: ${pdfResult.pdfUrl}`);
      }

      // Save PDF for inspection
      const safeName = storeName.toLowerCase().replace(/\s+/g, '-');
      const pdfPath = `/tmp/${safeName}-flyer.pdf`;
      writeFileSync(pdfPath, pdfResult.pdfBuffer);
      console.error(`[info] PDF saved: ${pdfPath}`);

      // Extract deals from PDF
      console.error('[info] Extracting deals from PDF...');
      allDeals = await extractDealsFromPdf(pdfResult.pdfBuffer, storeName, flyerDates);
      console.error(`[info] Deals extracted from PDF: ${allDeals.length}`);
    } else {
      console.error('[warn] No PDF found, falling back to page capture');

      // Navigate back if discovery changed the page
      if (page.url() !== url) {
        console.error(`[info] Navigating back to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
        await dismissCookieBanners(page);
      }

      const chunks = await captureChunks(page);
      console.error(`[info] Captured ${chunks.length} page chunks`);

      for (let i = 0; i < chunks.length; i++) {
        try {
          console.error(`[info] Extracting deals from chunk ${i + 1}/${chunks.length}...`);
          const chunkDeals = await extractDealsFromChunk(chunks[i]!, storeName, flyerDates);
          console.error(`[info] Chunk ${i + 1}: ${chunkDeals.length} deals`);
          allDeals = allDeals.concat(chunkDeals);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: string }).code === 'SPEND_LIMIT_REACHED'
          ) {
            console.error(`[fatal] Spend limit reached at chunk ${i + 1}`);
            break;
          }
          console.error(`[warn] Chunk ${i + 1} failed: ${msg}`);
        }
      }
    }

    // Deduplicate
    const deduplicated = deduplicateDeals(allDeals);

    // Summary to stderr
    console.error('');
    console.error('─── Summary ───');
    console.error(`  Store:        ${storeName}`);
    console.error(`  Method:       ${pdfResult.found ? pdfResult.method : 'page_capture (fallback)'}`);
    console.error(`  Raw deals:    ${allDeals.length}`);
    console.error(`  Deduplicated: ${deduplicated.length}`);
    console.error(`  Categories:   ${[...new Set(deduplicated.map((d) => d.category))].join(', ')}`);
    console.error('');

    // Deals JSON to stdout
    console.log(JSON.stringify(deduplicated, null, 2));
  } finally {
    await browser.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
