# Drift Detection — Walmart (Flipp API)

This skill depends on an undocumented Flipp API. It can break without warning. Run these checks **before every scrape** and **after every scrape**. If any check fails, stop and alert the human.

## Pre-scrape checks

Run all three checks before fetching deal data. If any fails, do NOT proceed.

### Check 1: API is alive

```bash
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=234")
echo "Flipp API status: $HTTP_STATUS"
```

| Result | Action |
|---|---|
| `200` | Proceed |
| `401` / `403` | **HARD DRIFT.** API now requires authentication. |
| `404` | **HARD DRIFT.** Endpoint moved or removed. |
| `429` | Rate limited. Wait 60 seconds and retry once. If still 429, stop. |
| `5xx` | Transient. Retry after 30 seconds. If still failing, stop. |
| Timeout / DNS failure | Flipp may have changed domains. Check if `backflipp.wishabi.com` still resolves. |

On any HARD DRIFT, print:

```
WALMART SCRAPER BROKEN — Flipp API returned HTTP $STATUS.
The undocumented API endpoint has likely changed or been secured.

To investigate, run:
  claude -p "The Walmart flyer scraper uses the Flipp API at backflipp.wishabi.com. It's returning HTTP $STATUS. Investigate whether the API has moved, requires auth now, or has been shut down. Check walmart.ca/en/flyer in a browser to see if Flipp still powers the flyer widget, and look for new API endpoints in the network tab."
```

### Check 2: Walmart flyer exists and is current

```bash
curl -s "https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=L9A0A1&merchant_id=234" | python3 -c "
import sys, json
from datetime import datetime, timezone

data = json.loads(sys.stdin.read())
flyers = [f for f in data.get('flyers', []) if f.get('merchant_id') == 234]

if not flyers:
    print('DRIFT: No Walmart flyers returned. Merchant ID 234 may have changed.')
    print('ACTION: Check walmart.ca/en/flyer page source for new merchant ID.')
    sys.exit(1)

grocery = [f for f in flyers if 'Groceries' in f.get('categories_csv', '')]
if not grocery:
    print(f'WARNING: {len(flyers)} Walmart flyers found but none categorized as Groceries.')
    print('Flyer names: ' + ', '.join(f['name'] for f in flyers))
    print('Proceeding with first flyer, but category filtering may have changed.')
    grocery = flyers

f = grocery[0]
valid_to = datetime.fromisoformat(f['valid_to'])
now = datetime.now(valid_to.tzinfo)

if valid_to < now:
    days_stale = (now - valid_to).days
    print(f'DRIFT: Flyer expired {days_stale} days ago (valid_to: {f[\"valid_to\"]})')
    if days_stale > 3:
        print('ACTION: Walmart may have stopped publishing to Flipp.')
        sys.exit(1)
    else:
        print('This may just be a delayed publish. Proceeding with warning.')

print(f'OK: Flyer {f[\"id\"]} — {f[\"name\"]} — valid {f[\"valid_from\"][:10]} to {f[\"valid_to\"][:10]}')
print(f'FLYER_ID={f[\"id\"]}')
"
```

| Result | Action |
|---|---|
| `OK: Flyer ...` | Proceed with the printed FLYER_ID |
| `DRIFT: No Walmart flyers` | **HARD DRIFT.** Merchant ID changed or Walmart left Flipp. |
| `DRIFT: Flyer expired >3 days` | **HARD DRIFT.** Walmart may have stopped publishing flyers to Flipp. |
| `WARNING: no Groceries category` | Proceed cautiously — Flipp may have changed category labels |

On HARD DRIFT, print:

```
WALMART SCRAPER BROKEN — No current Walmart flyer found on Flipp.

To investigate, run:
  claude -p "The Walmart flyer scraper can't find a current flyer from Flipp API (merchant_id=234). Check walmart.ca/en/flyer in a browser. Is the flyer still powered by Flipp? If so, inspect the page source for a new merchant ID. If not, Walmart may have switched flyer providers."
```

### Check 3: Flyer has items

```bash
curl -s "https://backflipp.wishabi.com/flipp/flyers/<FLYER_ID>?locale=en-ca&postal_code=L9A0A1" | python3 -c "
import sys, json

data = json.loads(sys.stdin.read())
items = data.get('items', [])
products = [i for i in items if i.get('display_type') == 1 and i.get('price')]

print(f'Total items: {len(items)}')
print(f'Products (display_type=1 with price): {len(products)}')

if len(products) == 0:
    print('DRIFT: Zero products returned. API response shape may have changed.')
    print('Item keys found: ' + str(list(items[0].keys()) if items else 'NO ITEMS'))
    sys.exit(1)

if len(products) < 100:
    print(f'WARNING: Only {len(products)} products. Expected 400-900. Partial data?')

# Check that critical fields still exist
sample = products[0]
required = ['name', 'price', 'display_type', 'flyer_id']
missing = [f for f in required if f not in sample]
if missing:
    print(f'DRIFT: Missing fields in item schema: {missing}')
    sys.exit(1)

print(f'OK: {len(products)} products with expected schema')
"
```

| Result | Action |
|---|---|
| `OK: N products` | Proceed |
| `DRIFT: Zero products` | **HARD DRIFT.** API response changed shape. |
| `WARNING: Only N products` | Proceed but flag in output — may be partial data |
| `DRIFT: Missing fields` | **HARD DRIFT.** API schema changed. |

On HARD DRIFT, print:

```
WALMART SCRAPER BROKEN — Flipp API response shape changed.

To investigate, run:
  claude -p "The Walmart flyer scraper hit the Flipp API but got unexpected data. Run: curl -s 'https://backflipp.wishabi.com/flipp/flyers/<FLYER_ID>?locale=en-ca&postal_code=L9A0A1' | python3 -m json.tool | head -50 — and figure out what changed in the response schema. Then update .claude/skills/parse-flyer-walmart/SKILL.md"
```

## Post-scrape checks

Run after parsing to verify the output is complete and sane.

### Check 4: Deal count is reasonable

```bash
python3 -c "
import json
deals = json.load(open('/tmp/walmart-flyer-raw.json'))
print(f'Deals extracted: {len(deals)}')
if len(deals) < 100:
    print('DRIFT: Too few deals. Expected 400-900.')
    print('Possible causes: filtering too aggressive, API returning partial data, or schema change broke parsing.')
elif len(deals) > 1500:
    print('WARNING: Unusually high count. May include non-grocery items or duplicates.')
else:
    print('OK: Deal count in expected range')
"
```

### Check 5: No field went blank

```bash
python3 -c "
import json
deals = json.load(open('/tmp/walmart-flyer-raw.json'))
total = len(deals)

name_null = sum(1 for d in deals if not d.get('name'))
price_null = sum(1 for d in deals if not d.get('price'))

print(f'name null: {name_null}/{total} ({round(name_null/total*100)}%)')
print(f'price null: {price_null}/{total} ({round(price_null/total*100)}%)')

if name_null / total > 0.05:
    print('DRIFT: >5% of items missing name. The name field may have been renamed in the API.')
if price_null / total > 0.10:
    print('DRIFT: >10% of items missing price. The price field may have been renamed in the API.')
if name_null / total <= 0.05 and price_null / total <= 0.10:
    print('OK: Field coverage within thresholds')
"
```

### Check 6: Prices aren't garbage

```bash
python3 -c "
import json
deals = json.load(open('/tmp/walmart-flyer-raw.json'))
prices = [float(d['price']) for d in deals if d.get('price')]

if not prices:
    print('DRIFT: No parseable prices')
else:
    avg = sum(prices) / len(prices)
    under_1 = sum(1 for p in prices if p < 0.50)
    over_200 = sum(1 for p in prices if p > 200)
    print(f'Price stats: min=\${min(prices):.2f}, max=\${max(prices):.2f}, avg=\${avg:.2f}')
    print(f'Under \$0.50: {under_1}, Over \$200: {over_200}')
    if avg < 1.0 or avg > 100:
        print('DRIFT: Average price wildly off. Price field may now be in cents or a different currency.')
    else:
        print('OK: Prices look reasonable')
"
```

## Baseline (recorded 2026-03-30)

These are the values from the first successful scrape. Use them to calibrate thresholds.

| Metric | Value |
|---|---|
| Flipp merchant_id for Walmart | 234 |
| API response HTTP status | 200 |
| Flyer items (total) | 764 |
| Products (display_type=1 with price) | 686 |
| Banners (display_type=5) | 78 |
| Items with brand | 416 (61%) |
| Items with discount % | 310 (45%) |
| Price range | $0.75 - $629.96 |
| Price average | $24.70 |
| Flyer pages | 33 |
| Item schema keys | id, flyer_id, name, display_type, brand, left, bottom, right, top, cutout_image_url, valid_from, valid_to, page_destination, discount, available_to, video_url, price, print_id, short_name, text_areas |

## What to do when drift is detected

Every HARD DRIFT prints a `claude -p "..."` command. Copy and run it. That command gives Claude the context to investigate and fix the skill.

For WARNINGs, the scrape will still proceed but the output should be manually reviewed before it feeds into the planner pipeline.
