import type { Page, Frame, HTTPResponse } from 'puppeteer';
import { logger } from '../lib/logger.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PdfDiscoveryResult {
  found: boolean;
  pdfBuffer: Buffer | null;
  method: 'direct_link' | 'button_click' | 'context_menu' | 'two_step' | null;
  pdfUrl: string | null;
}

interface PdfElementMatch {
  frameIndex: number;
  elementIndex: number;
  text: string;
  href: string | null;
  isPdfHref: boolean;
  confidence: number; // higher = better match
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const PDF_TEXT_PATTERNS = [
  /download\s*(pdf|flyer)?/i,
  /view\s*pdf/i,
  /pdf\s*flyer/i,
  /print\s*this\s*flyer/i,
  /print\s*flyer/i,
  /save\s*as\s*pdf/i,
];

const CONTEXT_MENU_TEXT_PATTERNS = [
  /^more$/i,
  /^\.{3}$/,
  /^\u2026$/, // ellipsis character
];

const CONTEXT_MENU_ARIA_PATTERNS = [
  /more\s*options/i,
  /more\s*actions/i,
  /\bmenu\b/i,
];

const MENU_SETTLE_MS = 800;
const NAVIGATION_TIMEOUT_MS = 8000;
const PAGE_LOAD_SETTLE_MS = 5000;

const PRINT_TEXT_PATTERNS = [
  /print\s*(this\s*)?flyer/i,
  /print\s*page/i,
];

// ────────────────────────────────────────────────────────────
// DOM scanning
// ────────────────────────────────────────────────────────────

interface RawElementInfo {
  index: number;
  text: string;
  href: string | null;
  ariaLabel: string | null;
}

/**
 * Scan a frame for clickable elements that match PDF download patterns.
 */
async function scanFrameForPdfElements(
  frame: Page | Frame,
): Promise<RawElementInfo[]> {
  try {
    return await frame.evaluate(`
      (() => {
        const results = [];
        const els = document.querySelectorAll('a, button, [role="button"]');
        els.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          results.push({
            index,
            text: (el.textContent || '').trim().slice(0, 200),
            href: el.getAttribute('href'),
            ariaLabel: el.getAttribute('aria-label'),
          });
        });
        return results;
      })()
    `) as RawElementInfo[];
  } catch {
    return []; // Frame may have been detached
  }
}

/**
 * Score and filter elements that match PDF patterns.
 */
function matchPdfElements(
  elements: RawElementInfo[],
  frameIndex: number,
  pageUrl: string,
): PdfElementMatch[] {
  const matches: PdfElementMatch[] = [];

  for (const el of elements) {
    const text = el.text;
    const href = el.href;

    // Check href for .pdf
    let isPdfHref = false;
    if (href) {
      try {
        const resolved = new URL(href, pageUrl);
        isPdfHref = resolved.pathname.toLowerCase().endsWith('.pdf');
      } catch {
        isPdfHref = href.toLowerCase().includes('.pdf');
      }
    }

    // Check text against patterns
    const textMatches = PDF_TEXT_PATTERNS.some((p) => p.test(text));
    const ariaMatches = el.ariaLabel
      ? PDF_TEXT_PATTERNS.some((p) => p.test(el.ariaLabel!))
      : false;

    if (isPdfHref || textMatches || ariaMatches) {
      let confidence = 0;
      if (isPdfHref) confidence += 10;
      if (textMatches) confidence += 5;
      if (ariaMatches) confidence += 3;

      matches.push({
        frameIndex,
        elementIndex: el.index,
        text,
        href,
        isPdfHref,
        confidence,
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Scan a frame for context menu trigger elements.
 */
async function scanFrameForContextMenuTriggers(
  frame: Page | Frame,
): Promise<RawElementInfo[]> {
  try {
    const elements = await scanFrameForPdfElements(frame);
    // Reuse the scan but filter for context menu patterns instead
    return elements.filter((el) => {
      const textMatch = CONTEXT_MENU_TEXT_PATTERNS.some((p) => p.test(el.text));
      const ariaMatch = el.ariaLabel
        ? CONTEXT_MENU_ARIA_PATTERNS.some((p) => p.test(el.ariaLabel!))
        : false;
      return textMatch || ariaMatch;
    });
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Click helpers
// ────────────────────────────────────────────────────────────

/**
 * Get the Nth clickable element in a frame (matching the index from scan).
 */
async function getClickableElement(
  frame: Page | Frame,
  elementIndex: number,
): Promise<ReturnType<Frame['$']>> {
  const els = await frame.$$('a, button, [role="button"]');
  return els[elementIndex] ?? null;
}

// ────────────────────────────────────────────────────────────
// Download helpers
// ────────────────────────────────────────────────────────────

/**
 * Validate that a buffer is actually a PDF (check magic bytes).
 */
function isValidPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Download a PDF from a direct URL, forwarding cookies from the page.
 */
async function fetchPdfFromUrl(
  page: Page,
  url: string,
): Promise<Buffer | null> {
  try {
    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const response = await fetch(url, {
      headers: { Cookie: cookieHeader },
      redirect: 'follow',
    });

    if (!response.ok) {
      logger.warn('PDF fetch failed', { url, status: response.status });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > MAX_PDF_SIZE_BYTES) {
      logger.warn('PDF too large, skipping', {
        url,
        sizeBytes: buffer.length,
        maxBytes: MAX_PDF_SIZE_BYTES,
      });
      return null;
    }

    if (!isValidPdf(buffer)) {
      logger.warn('Downloaded file is not a valid PDF', { url });
      return null;
    }

    return buffer;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('PDF download error', { url, error: msg });
    return null;
  }
}

/**
 * Capture the current page as a PDF via CDP's Page.printToPDF.
 * Used when a "Print Flyer" button triggers window.print() instead of a download.
 */
async function capturePrintPdf(page: Page): Promise<Buffer | null> {
  try {
    const cdp = await page.createCDPSession();
    const result = await cdp.send('Page.printToPDF', {
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
    });
    await cdp.detach();

    const buffer = Buffer.from(result.data, 'base64');
    if (buffer.length > MAX_PDF_SIZE_BYTES) {
      logger.warn('Print PDF too large', { sizeBytes: buffer.length });
      return null;
    }
    if (!isValidPdf(buffer)) {
      return null;
    }
    return buffer;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Print PDF capture failed', { error: msg });
    return null;
  }
}

/**
 * Click an element and watch for a PDF response on the network.
 * If the element text matches a "print" pattern and no PDF/navigation occurs,
 * falls back to capturing the page via Page.printToPDF.
 * Returns the PDF buffer if intercepted, or indicates if navigation occurred.
 */
async function clickAndCapturePdf(
  page: Page,
  frame: Page | Frame,
  elementIndex: number,
  elementText: string,
): Promise<{ pdfBuffer: Buffer | null; pdfUrl: string | null; navigated: boolean }> {
  const element = await getClickableElement(frame, elementIndex);
  if (!element) {
    return { pdfBuffer: null, pdfUrl: null, navigated: false };
  }

  let capturedPdf: Buffer | null = null;
  let capturedUrl: string | null = null;
  const urlBefore = page.url();

  const responseHandler = async (response: HTTPResponse): Promise<void> => {
    try {
      const ct = response.headers()['content-type'] ?? '';
      const url = response.url();
      if (ct.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
        capturedUrl = url;
        capturedPdf = Buffer.from(await response.buffer());
      }
    } catch {
      // Response body may not be available
    }
  };

  page.on('response', responseHandler);

  try {
    // Click and race against navigation
    const [navResult] = await Promise.allSettled([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT_MS }),
      element.click(),
    ]);

    const navigated = navResult.status === 'fulfilled' && page.url() !== urlBefore;

    // Give a moment for any response handler to fire
    await new Promise((r) => setTimeout(r, 500));

    // If no PDF intercepted and no navigation, check if this was a print button
    if (!capturedPdf && !navigated && PRINT_TEXT_PATTERNS.some((p) => p.test(elementText))) {
      logger.info('PDF discovery: print button detected, capturing via printToPDF', {
        text: elementText,
      });
      capturedPdf = await capturePrintPdf(page);
      capturedUrl = 'printToPDF';
    }

    return { pdfBuffer: capturedPdf, pdfUrl: capturedUrl, navigated };
  } finally {
    page.off('response', responseHandler);
  }
}

// ────────────────────────────────────────────────────────────
// Two-step flow
// ────────────────────────────────────────────────────────────

/**
 * After a click navigated to a new page, scan that page for PDF links.
 * One level of recursion only.
 */
async function handleTwoStepFlow(
  page: Page,
): Promise<{ pdfBuffer: Buffer | null; pdfUrl: string | null }> {
  logger.info('Two-step flow: scanning new page for PDF', { url: page.url() });

  // Wait for JS-rendered content to appear
  await new Promise((r) => setTimeout(r, PAGE_LOAD_SETTLE_MS));

  const frames = getActiveFrames(page);
  for (let fi = 0; fi < frames.length; fi++) {
    const rawElements = await scanFrameForPdfElements(frames[fi]!);
    const matches = matchPdfElements(rawElements, fi, page.url());

    for (const match of matches) {
      // Try direct href first
      if (match.isPdfHref && match.href) {
        const resolved = new URL(match.href, page.url()).toString();
        const buffer = await fetchPdfFromUrl(page, resolved);
        if (buffer) {
          return { pdfBuffer: buffer, pdfUrl: resolved };
        }
      }

      // Try clicking
      const result = await clickAndCapturePdf(page, frames[fi]!, match.elementIndex, match.text);
      if (result.pdfBuffer && isValidPdf(result.pdfBuffer)) {
        return { pdfBuffer: result.pdfBuffer, pdfUrl: result.pdfUrl };
      }
    }
  }

  return { pdfBuffer: null, pdfUrl: null };
}

// ────────────────────────────────────────────────────────────
// Frame helpers
// ────────────────────────────────────────────────────────────

function getActiveFrames(page: Page): Array<Page | Frame> {
  const frames: Array<Page | Frame> = [page];
  for (const frame of page.frames()) {
    const url = frame.url();
    if (url && url !== 'about:blank' && frame !== page.mainFrame()) {
      frames.push(frame);
    }
  }
  return frames;
}

// ────────────────────────────────────────────────────────────
// Main orchestrator
// ────────────────────────────────────────────────────────────

/**
 * Discover and download a PDF flyer from the current page.
 *
 * Follows the ordered discovery steps from specs/scraper-pdf-discovery.md:
 * 1. Scan for visible PDF buttons/links
 * 2. Scan for context menus → open → scan for PDF options
 * 3. Return found PDF or { found: false }
 */
export async function discoverAndDownloadPdf(
  page: Page,
): Promise<PdfDiscoveryResult> {
  const originalUrl = page.url();
  const notFound: PdfDiscoveryResult = {
    found: false,
    pdfBuffer: null,
    method: null,
    pdfUrl: null,
  };

  // ── Step 1: Scan all frames for PDF buttons/links ──
  const frames = getActiveFrames(page);
  const allMatches: PdfElementMatch[] = [];

  for (let fi = 0; fi < frames.length; fi++) {
    const rawElements = await scanFrameForPdfElements(frames[fi]!);
    const matches = matchPdfElements(rawElements, fi, page.url());
    allMatches.push(...matches);
  }

  // Sort all matches by confidence (highest first)
  allMatches.sort((a, b) => b.confidence - a.confidence);

  logger.info('PDF discovery: scan complete', {
    framesScanned: frames.length,
    matchesFound: allMatches.length,
    topMatch: allMatches[0]
      ? { text: allMatches[0].text.slice(0, 60), confidence: allMatches[0].confidence }
      : null,
  });

  // Try each match
  for (const match of allMatches) {
    const frame = frames[match.frameIndex];
    if (!frame) continue;

    // Direct .pdf href
    if (match.isPdfHref && match.href) {
      const resolved = new URL(match.href, page.url()).toString();
      logger.info('PDF discovery: trying direct link', { url: resolved });
      const buffer = await fetchPdfFromUrl(page, resolved);
      if (buffer) {
        return { found: true, pdfBuffer: buffer, method: 'direct_link', pdfUrl: resolved };
      }
    }

    // Click the element
    logger.info('PDF discovery: trying button click', { text: match.text.slice(0, 60) });
    const clickResult = await clickAndCapturePdf(page, frame, match.elementIndex, match.text);

    if (clickResult.pdfBuffer && isValidPdf(clickResult.pdfBuffer)) {
      return {
        found: true,
        pdfBuffer: clickResult.pdfBuffer,
        method: 'button_click',
        pdfUrl: clickResult.pdfUrl,
      };
    }

    // Two-step: click navigated to a new page
    if (clickResult.navigated) {
      const twoStep = await handleTwoStepFlow(page);
      if (twoStep.pdfBuffer) {
        return {
          found: true,
          pdfBuffer: twoStep.pdfBuffer,
          method: 'two_step',
          pdfUrl: twoStep.pdfUrl,
        };
      }
      // Navigate back for next attempt
      try {
        await page.goto(originalUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        logger.warn('PDF discovery: failed to navigate back after two-step');
        return notFound;
      }
    }
  }

  // ── Step 2: Context menu scan ──
  logger.info('PDF discovery: scanning for context menus');

  // Re-fetch frames in case navigation changed them
  const freshFrames = getActiveFrames(page);

  for (let fi = 0; fi < freshFrames.length; fi++) {
    const frame = freshFrames[fi]!;
    const triggers = await scanFrameForContextMenuTriggers(frame);

    for (const trigger of triggers) {
      logger.info('PDF discovery: opening context menu', { text: trigger.text.slice(0, 30) });

      const triggerEl = await getClickableElement(frame, trigger.index);
      if (!triggerEl) continue;

      try {
        await triggerEl.click();
        await new Promise((r) => setTimeout(r, MENU_SETTLE_MS));

        // Re-scan this frame for newly revealed PDF elements
        const menuElements = await scanFrameForPdfElements(frame);
        const menuMatches = matchPdfElements(menuElements, fi, page.url());

        // Filter to only matches that weren't in the original scan
        const newMatches = menuMatches.filter(
          (m) => !allMatches.some(
            (orig) => orig.elementIndex === m.elementIndex && orig.frameIndex === m.frameIndex,
          ),
        );

        for (const menuMatch of newMatches) {
          // Direct href
          if (menuMatch.isPdfHref && menuMatch.href) {
            const resolved = new URL(menuMatch.href, page.url()).toString();
            logger.info('PDF discovery: context menu direct link', { url: resolved });
            const buffer = await fetchPdfFromUrl(page, resolved);
            if (buffer) {
              return { found: true, pdfBuffer: buffer, method: 'context_menu', pdfUrl: resolved };
            }
          }

          // Click
          logger.info('PDF discovery: clicking context menu item', {
            text: menuMatch.text.slice(0, 60),
          });
          const result = await clickAndCapturePdf(page, frame, menuMatch.elementIndex, menuMatch.text);
          if (result.pdfBuffer && isValidPdf(result.pdfBuffer)) {
            return {
              found: true,
              pdfBuffer: result.pdfBuffer,
              method: 'context_menu',
              pdfUrl: result.pdfUrl,
            };
          }
        }

        // Dismiss the menu before trying the next trigger
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('PDF discovery: context menu interaction failed', { error: msg });
      }
    }
  }

  logger.warn('PDF discovery: no PDF found');
  return notFound;
}
