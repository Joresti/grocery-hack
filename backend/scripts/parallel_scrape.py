#!/usr/bin/env python3
"""Parallel multi-tab CDP scraper for Loblaw Digital flyer pages.

Opens multiple Chrome tabs simultaneously to scrape paginated flyer data.
Requires Chrome running with --remote-debugging-port=9222.

Usage:
  python3 backend/scripts/parallel_scrape.py <base_url> [--concurrency N] [--max-pages N] [--output PATH]

Example:
  python3 backend/scripts/parallel_scrape.py https://www.nofrills.ca/en/deals/flyer --concurrency 6 --output /tmp/nofrills_raw.json
"""

import sys, json, asyncio, urllib.request, argparse, time

try:
    import websockets
except ImportError:
    sys.exit("Missing dependency: pip install websockets")

CDP_HOST = "http://127.0.0.1:9222"
MAX_MSG = 10 * 1024 * 1024

DISMISS_JS = (
    "document.querySelectorAll('button').forEach(function(b){"
    "var t=b.textContent.trim();"
    "if(t==='Yes'||t==='Close')b.click();"
    "});'dismissed'"
)

COUNT_JS = 'document.querySelectorAll(\'[data-testid="product-title"]\').length'

EXTRACT_JS = (
    "(function(){"
    "var cards=document.querySelectorAll('.chakra-linkbox');"
    "var r=[];"
    "for(var i=0;i<cards.length;i++){"
    "var c=cards[i];"
    "var g=function(s){var e=c.querySelector('[data-testid=\"'+s+'\"]');return e?e.textContent.trim():null;};"
    "var title=g('product-title');"
    "if(!title)continue;"
    "var pcPts=c.textContent.indexOf('PC Optimum Points');"
    "var ptsMatch=pcPts>-1?c.textContent.match(/(\\d[\\d,]*)\\s*PC Optimum Points/):null;"
    "r.push({"
    "brand:g('product-brand'),"
    "name:title,"
    "salePrice:g('sale-price'),"
    "wasPrice:g('was-price'),"
    "regularPrice:g('regular-price'),"
    "priceDesc:g('price-descriptor'),"
    "size:g('product-package-size'),"
    "badge:g('product-badge'),"
    "pcPoints:ptsMatch?ptsMatch[1]:null,"
    "plusTax:c.textContent.indexOf('Plus tax')>-1"
    "});"
    "}"
    "return JSON.stringify(r);"
    "})()"
)


async def send_cmd(ws, method, params=None, msg_id=1, timeout=15):
    payload = {"id": msg_id, "method": method}
    if params:
        payload["params"] = params
    await ws.send(json.dumps(payload))
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
        if msg.get("id") == msg_id:
            return msg


async def wait_for_load(ws, timeout=15):
    """Wait for Page.loadEventFired."""
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            break
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
            msg = json.loads(raw)
            if msg.get("method") == "Page.loadEventFired":
                break
        except asyncio.TimeoutError:
            break


async def create_tab(url="about:blank"):
    """Create a new Chrome tab and return (websocket, target_id)."""
    version = json.loads(urllib.request.urlopen(f"{CDP_HOST}/json/version").read())
    browser_ws = await websockets.connect(version["webSocketDebuggerUrl"], max_size=MAX_MSG)
    result = await send_cmd(browser_ws, "Target.createTarget", {"url": url})
    target_id = result["result"]["targetId"]
    await browser_ws.close()

    # Find the new tab's WS URL by matching target ID
    tabs = json.loads(urllib.request.urlopen(f"{CDP_HOST}/json").read())
    tab = next(t for t in tabs if t["id"] == target_id)
    ws = await websockets.connect(tab["webSocketDebuggerUrl"], max_size=MAX_MSG)
    return ws, target_id


def close_tab_http(target_id):
    """Close a tab via the HTTP endpoint (no websocket needed)."""
    try:
        urllib.request.urlopen(f"{CDP_HOST}/json/close/{target_id}")
    except Exception:
        pass


async def wait_for_products(ws, timeout=30, poll_interval=0.5, min_products=10):
    """Poll the DOM until enough product-title elements appear or timeout.

    min_products: wait until at least this many products render.
    Sponsored/sticky cards often show 2-3 immediately; the real grid has ~49.
    """
    deadline = asyncio.get_event_loop().time() + timeout
    last_count = 0
    while True:
        result = await send_cmd(ws, "Runtime.evaluate", {"expression": COUNT_JS}, msg_id=99)
        count = result["result"]["result"].get("value", 0)
        last_count = count
        if count >= min_products:
            # Products loaded — give an extra 2s for stragglers to render
            await asyncio.sleep(2)
            return count
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return last_count
        await asyncio.sleep(min(poll_interval, remaining))


async def scrape_page(base_url, page_num, semaphore):
    """Scrape a single page in its own tab, bounded by semaphore."""
    async with semaphore:
        url = base_url if page_num == 1 else f"{base_url}?page={page_num}"
        ws = None
        target_id = None
        try:
            ws, target_id = await create_tab("about:blank")

            # Enable page events, then navigate
            await send_cmd(ws, "Page.enable", msg_id=0)
            await ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": url}}))
            await wait_for_load(ws)

            # Dismiss popups on every tab (location modal can appear on any new tab)
            await send_cmd(ws, "Runtime.evaluate", {"expression": DISMISS_JS}, msg_id=2)

            # Poll DOM until products actually render (or timeout)
            count = await wait_for_products(ws)
            if count <= 1:
                print(f"  Page {page_num}: {count} products (empty)")
                return page_num, []

            # Extract products
            data_result = await send_cmd(ws, "Runtime.evaluate", {"expression": EXTRACT_JS}, msg_id=4)
            raw = data_result["result"]["result"].get("value", "[]")
            products = json.loads(raw)
            print(f"  Page {page_num}: {len(products)} products")
            return page_num, products

        except Exception as e:
            print(f"  Page {page_num}: error - {e}")
            return page_num, []
        finally:
            if ws:
                await ws.close()
            if target_id:
                close_tab_http(target_id)


async def warmup_session(base_url):
    """Navigate the main tab to set the store/session cookie before batch scraping.

    Opens the flyer URL, dismisses the location modal, and waits for products
    to confirm the session is active. New tabs then inherit the cookie.
    """
    print("Warming up session (setting store cookie)...")
    tabs = json.loads(urllib.request.urlopen(f"{CDP_HOST}/json").read())
    # Use the first non-extension page tab
    page_tab = next((t for t in tabs if t.get("type") == "page" and "extension" not in t.get("url", "")), tabs[0])
    ws = await websockets.connect(page_tab["webSocketDebuggerUrl"], max_size=MAX_MSG)

    await send_cmd(ws, "Page.enable", msg_id=0)
    await ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": base_url}}))
    await wait_for_load(ws)
    await asyncio.sleep(2)

    # Dismiss location modal / cookie banner
    await send_cmd(ws, "Runtime.evaluate", {"expression": DISMISS_JS}, msg_id=2)
    await asyncio.sleep(1)
    # Try a second dismiss in case the first click revealed another prompt
    await send_cmd(ws, "Runtime.evaluate", {"expression": DISMISS_JS}, msg_id=3)

    # Wait for products to confirm session is good
    count = await wait_for_products(ws)
    print(f"  Session ready — {count} products on main tab")
    await ws.close()


async def run(base_url, max_pages=45, batch_size=4, output="/tmp/nofrills_raw.json"):
    start = time.time()

    print(f"Scraping {base_url} — {batch_size} tabs at a time, up to {max_pages} pages...")

    # Set session cookie before opening batch tabs
    await warmup_session(base_url)

    all_products = []
    semaphore = asyncio.Semaphore(batch_size)

    for batch_start in range(1, max_pages + 1, batch_size):
        batch_end = min(batch_start + batch_size, max_pages + 1)
        pages = list(range(batch_start, batch_end))
        print(f"\n--- Batch: pages {pages[0]}-{pages[-1]} ---")

        # Open up to batch_size tabs, scrape, close them all, then next batch
        tasks = [scrape_page(base_url, p, semaphore) for p in pages]
        results = await asyncio.gather(*tasks)

        batch_total = 0
        for page_num, products in sorted(results):
            all_products.extend(products)
            batch_total += len(products)

        print(f"  Batch total: {batch_total} products")

        # If entire batch was empty, we've passed the last page
        if batch_total == 0:
            print("  Empty batch — stopping pagination.")
            break

    with open(output, "w") as f:
        json.dump(all_products, f)

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")
    print(f"Total raw products: {len(all_products)}")
    print(f"Saved to: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parallel multi-tab Loblaw flyer scraper")
    parser.add_argument("url", help="Base flyer URL (e.g. https://www.nofrills.ca/en/deals/flyer)")
    parser.add_argument("--max-pages", type=int, default=45, help="Max pages to try (default: 45)")
    parser.add_argument("--batch-size", type=int, default=4, help="Tabs per batch (default: 4)")
    parser.add_argument("--output", default="/tmp/nofrills_raw.json", help="Output JSON path")
    args = parser.parse_args()
    asyncio.run(run(args.url, args.max_pages, args.batch_size, args.output))