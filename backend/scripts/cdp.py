#!/usr/bin/env python3
"""Chrome DevTools Protocol helper for WSL → Windows Chrome on port 9222.

Subcommands:
  goto <url> [screenshot_path]   Navigate to URL, wait for load, optionally screenshot
  screenshot <path>              Capture current viewport to file
  scroll <y> <path>              Scroll to Y offset, then screenshot
  height                         Print document.body.scrollHeight
  eval <js>                      Evaluate JS expression and print result
  click <js> [--wait N]          Evaluate JS (e.g. click), wait N seconds (default 3)
  download <win_path>            Set auto-download path (Windows path, e.g. C:\\Users\\me\\Downloads)
  click_download <js> <win_path> [--wait N]
                                 Set download path, eval JS, wait for download (default 60s timeout)
  print_pdf <output_path>        Capture current page as PDF (bypasses native Print dialog)
"""

import sys, json, asyncio, base64, urllib.request

try:
    import websockets
except ImportError:
    sys.exit("Missing dependency: pip install websockets")

CDP_URL = "http://127.0.0.1:9222/json"
MAX_MSG = 50 * 1024 * 1024  # 50 MB for screenshot payloads


async def connect():
    tabs = json.loads(urllib.request.urlopen(CDP_URL).read())
    page_tab = next(
        (t for t in tabs if t["type"] == "page" and not t["url"].startswith("chrome-extension")),
        tabs[0],
    )
    return await websockets.connect(page_tab["webSocketDebuggerUrl"], max_size=MAX_MSG)


async def send_and_recv(ws, method, params=None, msg_id=1, timeout=10):
    payload = {"id": msg_id, "method": method}
    if params:
        payload["params"] = params
    await ws.send(json.dumps(payload))
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
        if msg.get("id") == msg_id:
            return msg


async def save_screenshot(ws, path, msg_id=10):
    msg = await send_and_recv(ws, "Page.captureScreenshot", msg_id=msg_id)
    with open(path, "wb") as f:
        f.write(base64.b64decode(msg["result"]["data"]))
    print(f"saved: {path}")


async def cmd_goto(url, screenshot_path=None):
    ws = await connect()
    await ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": url}}))
    import time
    deadline = time.time() + 12
    while time.time() < deadline:
        try:
            await asyncio.wait_for(ws.recv(), timeout=1.0)
        except asyncio.TimeoutError:
            pass
    print("navigated")
    if screenshot_path:
        await save_screenshot(ws, screenshot_path)
    await ws.close()


async def cmd_screenshot(path):
    ws = await connect()
    await save_screenshot(ws, path)
    await ws.close()


async def cmd_scroll(y, path):
    ws = await connect()
    await send_and_recv(ws, "Runtime.evaluate", {"expression": f"window.scrollTo(0, {y})"})
    await asyncio.sleep(1.5)
    await save_screenshot(ws, path)
    await ws.close()


async def cmd_height():
    ws = await connect()
    msg = await send_and_recv(ws, "Runtime.evaluate", {"expression": "document.body.scrollHeight"})
    print(msg["result"]["result"]["value"])
    await ws.close()


async def cmd_eval(js):
    ws = await connect()
    msg = await send_and_recv(ws, "Runtime.evaluate", {"expression": js})
    print(msg["result"]["result"].get("value", ""))
    await ws.close()


async def cmd_click(js, wait=3):
    ws = await connect()
    msg = await send_and_recv(ws, "Runtime.evaluate", {"expression": js})
    print(msg["result"]["result"].get("value", ""))
    await asyncio.sleep(wait)
    await ws.close()


async def set_download_path(ws, win_path, msg_id=20):
    """Enable auto-download to win_path and subscribe to download events."""
    await send_and_recv(ws, "Browser.setDownloadBehavior", {
        "behavior": "allow",
        "downloadPath": win_path,
        "eventsEnabled": True,
    }, msg_id=msg_id)
    print(f"download path set: {win_path}")


async def wait_for_download(ws, timeout=60):
    """Listen for Browser.downloadWillBegin/downloadProgress until complete."""
    filename = None
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            print("download timed out")
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            print("download timed out")
            return None
        msg = json.loads(raw)
        method = msg.get("method", "")
        if method == "Browser.downloadWillBegin":
            filename = msg["params"].get("suggestedFilename", "<unknown>")
            print(f"download started: {filename}")
        elif method == "Browser.downloadProgress":
            state = msg["params"].get("state", "")
            if state == "completed":
                print(f"download completed: {filename}")
                return filename
            elif state == "canceled":
                print(f"download canceled: {filename}")
                return None


async def cmd_download(win_path):
    ws = await connect()
    await set_download_path(ws, win_path)
    await ws.close()


async def cmd_click_download(js, win_path, timeout=60):
    ws = await connect()
    await set_download_path(ws, win_path)
    await send_and_recv(ws, "Runtime.evaluate", {"expression": js}, msg_id=21)
    print("click evaluated, waiting for download...")
    await wait_for_download(ws, timeout=timeout)
    await ws.close()


async def cmd_print_pdf(output_path):
    ws = await connect()
    # Suppress window.print() so website download buttons become no-ops
    await send_and_recv(ws, "Runtime.evaluate", {"expression": "window.print = () => {};"}, msg_id=30)
    msg = await send_and_recv(ws, "Page.printToPDF", {
        "landscape": False,
        "printBackground": True,
        "preferCSSPageSize": True,
    }, msg_id=31, timeout=30)
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(msg["result"]["data"]))
    print(f"saved: {output_path}")
    await ws.close()


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    cmd = args[0]

    if cmd == "goto":
        url = args[1]
        path = args[2] if len(args) > 2 else None
        asyncio.run(cmd_goto(url, path))
    elif cmd == "screenshot":
        asyncio.run(cmd_screenshot(args[1]))
    elif cmd == "scroll":
        asyncio.run(cmd_scroll(int(args[1]), args[2]))
    elif cmd == "height":
        asyncio.run(cmd_height())
    elif cmd == "eval":
        asyncio.run(cmd_eval(args[1]))
    elif cmd == "click":
        wait = 3
        if "--wait" in args:
            wi = args.index("--wait")
            wait = int(args[wi + 1])
            args = args[:wi] + args[wi + 2:]
        asyncio.run(cmd_click(args[1], wait))
    elif cmd == "download":
        asyncio.run(cmd_download(args[1]))
    elif cmd == "click_download":
        wait = 60
        if "--wait" in args:
            wi = args.index("--wait")
            wait = int(args[wi + 1])
            args = args[:wi] + args[wi + 2:]
        asyncio.run(cmd_click_download(args[1], args[2], timeout=wait))
    elif cmd == "print_pdf":
        asyncio.run(cmd_print_pdf(args[1]))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
