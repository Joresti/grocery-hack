import puppeteer from 'puppeteer';

async function main(): Promise<void> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://www.nofrills.ca/en/print-flyer', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/tmp/nofrills-print-flyer.png', fullPage: false });

  const els = await page.evaluate(`
    (() => {
      const results = [];
      document.querySelectorAll('a, button, [role="button"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const text = (el.textContent || '').trim().slice(0, 100);
        const href = el.getAttribute('href') || '';
        if (/pdf|download|print|flyer|save/i.test(text + href)) {
          results.push({ tag: el.tagName, text, href: el.getAttribute('href') });
        }
      });
      return results;
    })()
  `);
  console.log(JSON.stringify(els, null, 2));
  await browser.close();
}

main().catch(console.error);
