/**
 * Navigate to Food Basics flyer page (the real store URL), find and click
 * the PDF download button behind the context menu, capture the PDF URL.
 */
import puppeteer from 'puppeteer';

const FLYER_URL = 'https://www.foodbasics.ca/flyer';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Track ALL network requests for PDFs
  const pdfUrls: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] ?? '';
    if (url.includes('.pdf') || ct.includes('pdf')) {
      pdfUrls.push(`${url} [${ct}]`);
    }
  });

  // Track new tabs/downloads
  browser.on('targetcreated', async (target) => {
    console.log(`[new-target] type=${target.type()} url=${target.url()}`);
  });

  console.log(`Loading: ${FLYER_URL}`);
  await page.goto(FLYER_URL, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Dismiss cookie banners
  const cookieSelectors = ['#onetrust-accept-btn-handler', 'button[aria-label*="accept" i]', '[class*="cookie"] button'];
  for (const sel of cookieSelectors) {
    try { const el = await page.$(sel); if (el) { await el.click(); await new Promise((r) => setTimeout(r, 500)); break; } } catch {}
  }

  await page.screenshot({ path: '/tmp/fb-flyer-page.png' });
  console.log('Screenshot: /tmp/fb-flyer-page.png');

  // Check what iframes exist
  const frames = page.frames();
  console.log(`\nFrames found: ${frames.length}`);
  for (const frame of frames) {
    const url = frame.url();
    if (url && url !== 'about:blank') {
      console.log(`  - ${url.slice(0, 120)}`);
    }
  }

  // Find the Flipp iframe and interact with it
  const flippFrame = frames.find((f) => f.url().includes('flyer.foodbasics.ca'));
  if (flippFrame) {
    console.log(`\nFound Flipp iframe: ${flippFrame.url().slice(0, 120)}`);

    // Dismiss tour in the iframe
    try {
      await flippFrame.evaluate(() => {
        const links = document.querySelectorAll('a, button, span');
        for (const el of Array.from(links)) {
          if (/skip tour/i.test(el.textContent ?? '')) {
            (el as HTMLElement).click();
            return;
          }
        }
      });
      await new Promise((r) => setTimeout(r, 500));
    } catch {}

    // List all buttons in the iframe
    const allButtons = await flippFrame.$$('button');
    console.log(`\nButtons in iframe: ${allButtons.length}`);
    for (const btn of allButtons) {
      const info = await btn.evaluate((el: Element) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent ?? '').trim().slice(0, 60),
          ariaLabel: el.getAttribute('aria-label'),
          className: (el.className?.toString() ?? '').slice(0, 80),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        };
      });
      console.log(`  ${JSON.stringify(info)}`);
    }

    // Click the "More" button
    for (const btn of allButtons) {
      const text = await btn.evaluate((el: Element) => (el.textContent ?? '').trim());
      if (/^More$|^\.\.\./i.test(text)) {
        console.log(`\nClicking "${text}" button...`);
        await btn.click();
        await new Promise((r) => setTimeout(r, 1500));
        break;
      }
    }

    await page.screenshot({ path: '/tmp/fb-flyer-after-more.png' });
    console.log('Screenshot after More: /tmp/fb-flyer-after-more.png');

    // Look for everything visible after More click
    const menuItems = await flippFrame.evaluate(() => {
      const results: Array<{ tag: string; text: string; href: string | null; className: string }> = [];
      const all = document.querySelectorAll('*');
      for (const el of Array.from(all)) {
        const text = (el.textContent ?? '').trim();
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none';
        if (visible && /pdf|download|save|print|share/i.test(text + (el.className?.toString() ?? ''))) {
          results.push({
            tag: el.tagName.toLowerCase(),
            text: text.slice(0, 120),
            href: el.getAttribute('href'),
            className: (el.className?.toString() ?? '').slice(0, 120),
          });
        }
      }
      return results;
    });

    console.log('\n=== PDF/Download/Print elements after More click ===');
    for (const item of menuItems) {
      console.log(JSON.stringify(item, null, 2));
    }
  } else {
    console.log('No Flipp iframe found');
  }

  if (pdfUrls.length > 0) {
    console.log('\n=== PDF URLs from network ===');
    for (const url of pdfUrls) console.log(url);
  }

  await browser.close();
}

main().catch(console.error);
