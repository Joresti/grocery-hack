/**
 * Quick script to inspect the Flipp viewer DOM for navigation elements.
 */
import puppeteer from 'puppeteer';

const FLIPP_URL = 'https://flyer.foodbasics.ca/flyer/82595?storeId=836&language=en';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(FLIPP_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Dismiss tour
  await page.evaluate(() => {
    const links = document.querySelectorAll('a, button, span');
    for (const el of Array.from(links)) {
      if (/skip tour/i.test(el.textContent ?? '')) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Dump all interactive elements with their bounding boxes, text, and attributes
  const elements = await page.evaluate(() => {
    const results: Array<{
      tag: string;
      text: string;
      ariaLabel: string | null;
      className: string;
      id: string;
      role: string | null;
      rect: { x: number; y: number; width: number; height: number };
    }> = [];

    const els = document.querySelectorAll('button, a, [role="button"], [aria-label], svg, [class*="nav"], [class*="arrow"], [class*="next"], [class*="prev"], [class*="forward"], [class*="back"]');
    for (const el of Array.from(els)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      results.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 80),
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className.toString().slice(0, 120),
        id: el.id,
        role: el.getAttribute('role'),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      });
    }
    return results;
  });

  // Filter for elements that look navigation-related
  const navElements = elements.filter((el) =>
    /nav|arrow|next|prev|forward|back|page|chevron|flip/i.test(
      `${el.ariaLabel ?? ''} ${el.className} ${el.id} ${el.text}`
    ) ||
    // Right-side positioned elements (potential next arrows)
    el.rect.x > 900
  );

  console.log('=== All navigation-related elements ===');
  for (const el of navElements) {
    console.log(JSON.stringify(el, null, 2));
  }

  console.log(`\n=== Total interactive elements: ${elements.length}, nav-related: ${navElements.length} ===`);

  // Also hover over the right edge to trigger any hover-activated arrows
  await page.mouse.move(1250, 400);
  await new Promise((r) => setTimeout(r, 1000));

  const afterHover = await page.evaluate(() => {
    const results: Array<{ tag: string; text: string; ariaLabel: string | null; className: string; rect: { x: number; y: number; width: number; height: number } }> = [];
    const els = document.querySelectorAll('button, a, [role="button"], [aria-label]');
    for (const el of Array.from(els)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.x > 900) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 80),
          ariaLabel: el.getAttribute('aria-label'),
          className: el.className.toString().slice(0, 120),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        });
      }
    }
    return results;
  });

  console.log('\n=== Right-side elements after hovering right edge ===');
  for (const el of afterHover) {
    console.log(JSON.stringify(el, null, 2));
  }

  // Take screenshot after hover
  await page.screenshot({ path: '/tmp/flipp-hover-right.png' });
  console.log('\nScreenshot saved to /tmp/flipp-hover-right.png');

  await browser.close();
}

main().catch(console.error);