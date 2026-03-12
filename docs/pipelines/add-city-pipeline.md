# Add City Pipeline Specification

> Admin-triggered process to onboard a new city. Not a cron job — run manually via CLI command.

## Overview

When expanding to a new city, we need to populate `store_locations` with every physical location for each `store_brand` already in the database. This pipeline automates that by scraping each chain's store locator page, falling back to OpenStreetMap when a chain's locator fails, and prompting the admin for any missing data.

## Usage

```bash
npx ts-node backend/src/pipelines/addCity.ts --city "Toronto" --region "ON" --center "43.6532,-79.3832" --radius 25
```

**Required arguments:**
- `--city` — city name (stored on each location record)
- `--region` — province/state code (e.g. "ON", "BC", "NY")
- `--center` — lat,lng of city center
- `--radius` — search radius in km (default: 25)

**Optional:**
- `--brands` — comma-separated brand names to limit scope (e.g. "No Frills,FreshCo"). Default: all brands in DB.
- `--dry-run` — print what would be inserted without writing to DB

## Architecture

```
For each store_brand in database (or --brands filter):

  1. Try: Scrape the brand's store locator page with Puppeteer
     → Extract all locations within radius
     → Validate and insert

  2. Fallback: Query OpenStreetMap Overpass API
     → Search for brand name near city center
     → Extract locations within radius
     → Validate and insert

  3. Final fallback: Prompt admin for manual input
     → Print what was found, what's missing
     → Accept CSV path or manual entry
```

## Step 1: Store Locator Scraping (Primary)

Each chain has a store locator page. We maintain a config map of known locator URLs and strategies per brand.

### Brand Locator Config

```typescript
interface BrandLocatorConfig {
  locatorUrl: string;
  searchMethod: 'postal_code' | 'city_name' | 'lat_lng';
  searchInputSelector: string;
  searchButtonSelector: string;
  resultSelector: string;
  extractFn: string;  // name of a custom extraction function
}

const BRAND_LOCATORS: Record<string, BrandLocatorConfig> = {
  'No Frills': {
    locatorUrl: 'https://www.nofrills.ca/store-locator',
    searchMethod: 'postal_code',
    searchInputSelector: 'input[placeholder*="postal" i], input[placeholder*="address" i]',
    searchButtonSelector: 'button[type="submit"], button[aria-label*="search" i]',
    resultSelector: '[data-testid*="store"], [class*="StoreCard"], [class*="store-result"]',
    extractFn: 'extractLoblawStore',
  },
  'FreshCo': {
    locatorUrl: 'https://www.freshco.com/store-locator/',
    searchMethod: 'city_name',
    searchInputSelector: 'input[placeholder*="city" i], input[placeholder*="location" i]',
    searchButtonSelector: 'button[type="submit"]',
    resultSelector: '[class*="store-card"], [class*="StoreResult"]',
    extractFn: 'extractSobeysStore',
  },
  // ... one entry per brand
};
```

### Scraping Flow

For each brand:

1. **Launch Puppeteer** (reuse browser instance across brands)
2. **Navigate** to `locatorUrl`
3. **Dismiss cookie banners** (same logic as scraper pipeline)
4. **Enter search term** based on `searchMethod`:
   - `postal_code`: use a central postal code for the city (derived from center lat/lng via reverse geocode, or a hardcoded map of city → postal codes)
   - `city_name`: type the `--city` argument
   - `lat_lng`: use the `--center` coordinates if the locator supports geolocation
5. **Click search** and wait for results
6. **Scroll through results** — some locators lazy-load
7. **Extract location data** from each result card:

```typescript
interface ScrapedLocation {
  address: string;
  city: string;
  region: string;
  postalZip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
}
```

8. **If lat/lng missing** from the page, geocode the address using OpenStreetMap Nominatim (free, no API key)
9. **Filter to radius** — only keep locations within `--radius` km of `--center`
10. **Deduplicate** against existing `store_locations` for this brand (match on address similarity)

### Extraction Functions

Each brand family has slightly different HTML. Custom extraction functions handle the differences:

```typescript
// Loblaw brands: No Frills, Real Canadian Superstore, Loblaws, Shoppers
function extractLoblawStore(element: Element): ScrapedLocation { ... }

// Sobeys brands: FreshCo, Sobeys, Farm Boy, Foodland
function extractSobeysStore(element: Element): ScrapedLocation { ... }

// Metro brands: Metro, Food Basics
function extractMetroStore(element: Element): ScrapedLocation { ... }

// Empire brands: Safeway, FreshCo (West)
function extractEmpireStore(element: Element): ScrapedLocation { ... }
```

These are simple DOM text extractors — not AI. They read address, city, postal code from predictable card layouts. If a brand's locator changes, the extraction function needs updating (but this runs infrequently, not weekly).

### Handling Pagination / "Load More"

Some store locators paginate or have a "show more" button:

1. After initial results load, check for a "Load More" / "Show More" / "Next" button
2. Click it and wait for new results
3. Repeat until no more button or results stop growing
4. Cap at 500 results per brand (safety limit)

## Step 2: OpenStreetMap Fallback

If the store locator scrape fails (page changed, CAPTCHA, timeout) or the brand has no known locator URL, fall back to OpenStreetMap.

### Overpass API Query

```typescript
async function queryOverpass(brandName: string, lat: number, lng: number, radiusKm: number): Promise<ScrapedLocation[]> {
  const radiusM = radiusKm * 1000;

  const query = `
    [out:json][timeout:30];
    (
      node["name"~"${escapeOverpass(brandName)}",i]["shop"="supermarket"](around:${radiusM},${lat},${lng});
      way["name"~"${escapeOverpass(brandName)}",i]["shop"="supermarket"](around:${radiusM},${lat},${lng});
    );
    out center;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await response.json();

  return data.elements.map((el: OverpassElement) => ({
    address: el.tags?.['addr:street']
      ? `${el.tags['addr:housenumber'] ?? ''} ${el.tags['addr:street']}`.trim()
      : null,
    city: el.tags?.['addr:city'] ?? null,
    region: el.tags?.['addr:province'] ?? el.tags?.['addr:state'] ?? null,
    postalZip: el.tags?.['addr:postcode'] ?? null,
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    phone: el.tags?.['phone'] ?? null,
  }));
}
```

### Overpass Limitations

- OSM data can be incomplete — some locations may lack addresses or have outdated info
- Rate limited: max 1 request per second, 10,000 requests per day
- Results are best-effort — always prompt admin to review

### Reverse Geocoding for Missing Addresses

If Overpass returns lat/lng but no address, use Nominatim reverse geocoding:

```typescript
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'User-Agent': 'GroceryHack/1.0' } }
  );
  const data = await response.json();
  return data.display_name;
}
```

Nominatim requires a `User-Agent` header and has a rate limit of 1 request/second. Batch with delays.

## Step 3: Admin Review & Manual Input

After Steps 1 and 2, the pipeline presents a summary to the admin in the terminal:

```
═══════════════════════════════════════
  Add City: Toronto, ON (radius: 25km)
═══════════════════════════════════════

No Frills
  ✓ Store locator: 47 locations found
  ✓ 3 already in DB, 44 new
  → Ready to insert 44

FreshCo
  ✓ Store locator: 22 locations found
  ✓ 0 already in DB, 22 new
  → Ready to insert 22

Food Basics
  ✗ Store locator failed: timeout
  ✓ OpenStreetMap: 18 locations found (3 missing addresses)
  → Ready to insert 15, 3 need manual address

Metro
  ✗ Store locator failed: no config
  ✗ OpenStreetMap: 0 results
  → Manual input required

────────────────────────────────────────
Summary: 103 locations ready, 3 need addresses, 1 brand needs manual input

Options:
  [1] Insert ready locations now, skip incomplete
  [2] Provide CSV for missing data
  [3] Enter missing data manually
  [4] Abort
```

### CSV Format for Manual Input

```csv
brand_name,address,city,region,postal_zip,lat,lng
Metro,123 Queen St W,Toronto,ON,M5H 2M9,43.6512,-79.3832
Metro,456 Bloor St E,Toronto,ON,M4W 1H1,43.6704,-79.3733
```

If lat/lng are omitted, the pipeline geocodes the address via Nominatim.

### Manual Entry (Interactive)

```
Enter location for Metro (or 'done' to finish):
  Address: 123 Queen St W
  City [Toronto]:
  Region [ON]:
  Postal/Zip: M5H 2M9
  → Geocoded to 43.6512, -79.3832
  ✓ Saved

Enter location for Metro (or 'done' to finish):
  done
```

## Database Operations

```sql
-- Insert new locations (batch, skip duplicates)
INSERT INTO store_locations (store_brand_id, address, city, region, postal_zip, lat, lng)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (store_brand_id, address) DO NOTHING;
```

The `UNIQUE (store_brand_id, address)` constraint prevents duplicate locations.

## Adding a New Brand

If the admin wants to add a brand that doesn't exist yet:

```bash
npx ts-node backend/src/pipelines/addCity.ts --add-brand "T&T Supermarket" --flyer-url "https://www.tntsupermarket.com/flyer"
```

This creates a `store_brands` row first, then proceeds with the location search for that brand in the specified city.

## Geocoding Strategy

All geocoding uses **OpenStreetMap Nominatim** (free, no API key):

- Forward geocode: address → lat/lng
- Reverse geocode: lat/lng → address
- Rate limit: 1 request/second (enforced with delay)
- `User-Agent: GroceryHack/1.0` header required

No Google Maps, no paid geocoding APIs. For the volumes we're dealing with (hundreds of locations, not millions), Nominatim is sufficient.

## Error Handling

| Error | Action |
|-------|--------|
| Puppeteer timeout on store locator | Log warning, fall through to Overpass |
| CAPTCHA detected on store locator | Log warning, fall through to Overpass |
| Store locator HTML changed (no results extracted) | Log warning, fall through to Overpass |
| Overpass API timeout | Retry once after 5s. If still fails, mark brand for manual input |
| Overpass returns 0 results | Mark brand for manual input |
| Nominatim geocoding fails for an address | Log warning, mark location as needing manual lat/lng |
| Duplicate address detected | Skip silently (ON CONFLICT DO NOTHING) |
| Invalid lat/lng (outside reasonable bounds) | Skip with warning |

## Logging

Each run produces a report file:

```
logs/add-city-toronto-2026-03-11.json
```

Contents:
- City, region, center, radius
- Per brand: source (locator/overpass/manual), locations found, locations inserted, locations skipped, errors
- Total locations added
- Duration

## Testing Strategy

1. **Config validation**: Assert every brand in DB has either a locator config or gracefully falls back
2. **Extraction function tests**: Saved HTML fixtures for each brand family, assert correct address/lat/lng extraction
3. **Overpass query tests**: Mock Overpass responses, assert correct filtering and parsing
4. **Deduplication tests**: Insert existing locations, run pipeline, assert no duplicates
5. **Geocoding tests**: Mock Nominatim responses, assert correct lat/lng assignment
6. **Dry run test**: Run with `--dry-run`, assert no DB writes

## Future Improvements

- **Scheduled refresh**: Monthly cron to re-scrape store locators and add newly opened locations / remove closed ones
- **Store hours**: Extract opening hours from locator pages (useful for shopping plan timing)
- **Flyer region mapping**: Some chains have different flyers per region (GTA vs Ottawa). Support `flyer_region` on store_locations to map locations to the correct flyer URL
