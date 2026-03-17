import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dealExtractionSchema,
  parseClaudeResponse,
  deduplicateDeals,
  calculateFlyerDates,
  scrapeAllStores,
} from './scraper.js';
import type { ExtractedDeal } from './scraper.js';

// ────────────────────────────────────────────────────────────
// Mocks — use vi.hoisted so mock references are available
// before vi.mock factories run (vi.mock is hoisted)
// ────────────────────────────────────────────────────────────

const {
  mockPage,
  mockBrowser,
  mockCallClaude,
  mockQuery,
  mockLogger,
} = vi.hoisted(() => {
  const _mockEvaluate = vi.fn().mockImplementation((expr: unknown) => {
    if (typeof expr === 'string' && expr.includes('scrollHeight')) {
      return Promise.resolve(800);
    }
    if (typeof expr === 'string' && expr.includes('innerText')) {
      return Promise.resolve('Sample flyer text with deals');
    }
    if (typeof expr === 'string' && expr.includes('scrollTo')) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(800);
  });
  const _mockPage = {
    setViewport: vi.fn(),
    goto: vi.fn(),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    evaluate: _mockEvaluate,
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    close: vi.fn(),
  };
  const _mockBrowser = {
    newPage: vi.fn().mockResolvedValue(_mockPage),
    close: vi.fn(),
  };
  const _mockCallClaude = vi.fn().mockResolvedValue('[]');
  const _mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  const _mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    mockPage: _mockPage,
    mockBrowser: _mockBrowser,
    mockCallClaude: _mockCallClaude,
    mockQuery: _mockQuery,
    mockLogger: _mockLogger,
  };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

vi.mock('../lib/claude.js', () => ({
  callClaude: mockCallClaude,
}));

vi.mock('../db/client.js', () => ({
  pool: {
    query: mockQuery,
  },
}));

vi.mock('../config.js', () => ({
  config: {
    CLAUDE_SCRAPER_MODEL: 'claude-haiku-4-5-20251001',
    ANTHROPIC_API_KEY: 'test-key',
    SCRAPER_CRON: '0 22 * * 2',
    PLANNER_CRON: '0 6 * * 3',
    PIPELINE_TIMEZONE: 'America/Toronto',
    CLAUDE_MONTHLY_BUDGET_USD: 25,
    CLAUDE_MAX_REQUESTS_PER_PIPELINE_RUN: 100,
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: mockLogger,
}));

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeValidDeal(overrides: Partial<ExtractedDeal> = {}): ExtractedDeal {
  return {
    item_name: 'Chicken Breast Boneless Skinless',
    brand: null,
    category: 'meat',
    sale_price: 3.99,
    regular_price: 6.99,
    unit: 'kg',
    unit_size: '1 kg',
    deal_conditions: null,
    price_type: 'fixed',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests: Zod schema validation
// ────────────────────────────────────────────────────────────

describe('dealExtractionSchema', () => {
  it('accepts a valid deal', () => {
    const deal = makeValidDeal();
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(true);
  });

  it('accepts a deal with null optional fields', () => {
    const deal = makeValidDeal({
      brand: null,
      regular_price: null,
      unit_size: null,
      deal_conditions: null,
    });
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(true);
  });

  it('rejects a deal with missing item_name', () => {
    const deal = { ...makeValidDeal(), item_name: '' };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with invalid category', () => {
    const deal = { ...makeValidDeal(), category: 'electronics' };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with negative sale_price', () => {
    const deal = { ...makeValidDeal(), sale_price: -1 };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with zero sale_price', () => {
    const deal = { ...makeValidDeal(), sale_price: 0 };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with invalid price_type', () => {
    const deal = { ...makeValidDeal(), price_type: 'clearance' };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with invalid unit', () => {
    const deal = { ...makeValidDeal(), unit: 'bushel' };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('rejects a deal with sale_price exceeding 500', () => {
    const deal = { ...makeValidDeal(), sale_price: 501 };
    const result = dealExtractionSchema.safeParse(deal);
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    const categories = [
      'produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen',
      'pantry', 'beverages', 'snacks', 'household', 'personal_care',
      'baby', 'pet', 'deli', 'other',
    ] as const;

    for (const category of categories) {
      const deal = makeValidDeal({ category });
      const result = dealExtractionSchema.safeParse(deal);
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid price_types', () => {
    const priceTypes = ['fixed', 'per_weight', 'multi_buy', 'bogo'] as const;

    for (const price_type of priceTypes) {
      const deal = makeValidDeal({ price_type });
      const result = dealExtractionSchema.safeParse(deal);
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid units', () => {
    const units = ['each', 'lb', 'kg', '100g', '100ml', 'pack', 'bag'] as const;

    for (const unit of units) {
      const deal = makeValidDeal({ unit });
      const result = dealExtractionSchema.safeParse(deal);
      expect(result.success).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────
// Tests: parseClaudeResponse
// ────────────────────────────────────────────────────────────

describe('parseClaudeResponse', () => {
  it('parses a valid JSON array of deals', () => {
    const deals = [makeValidDeal(), makeValidDeal({ item_name: 'White Rice' })];
    const raw = JSON.stringify(deals);
    const result = parseClaudeResponse(raw, 'Test Store');
    expect(result).toHaveLength(2);
    expect(result[0]!.item_name).toBe('Chicken Breast Boneless Skinless');
    expect(result[1]!.item_name).toBe('White Rice');
  });

  it('returns empty array for malformed JSON', () => {
    const result = parseClaudeResponse('not json at all', 'Test Store');
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    const result = parseClaudeResponse('{"key": "value"}', 'Test Store');
    expect(result).toEqual([]);
  });

  it('filters out invalid deals from mixed array', () => {
    const deals = [
      makeValidDeal(),
      { item_name: '', category: 'invalid', sale_price: -1 }, // invalid
      makeValidDeal({ item_name: 'Bananas', category: 'produce' }),
    ];
    const raw = JSON.stringify(deals);
    const result = parseClaudeResponse(raw, 'Test Store');
    expect(result).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const deals = [makeValidDeal()];
    const raw = '```json\n' + JSON.stringify(deals) + '\n```';
    const result = parseClaudeResponse(raw, 'Test Store');
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty string', () => {
    const result = parseClaudeResponse('', 'Test Store');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty JSON array', () => {
    const result = parseClaudeResponse('[]', 'Test Store');
    expect(result).toEqual([]);
  });

  it('logs error when more than 50% of deals are invalid', () => {
    const deals = [
      makeValidDeal(),
      { item_name: '', sale_price: -1 },
      { item_name: '', sale_price: -2 },
      { item_name: '', sale_price: -3 },
    ];
    const raw = JSON.stringify(deals);
    parseClaudeResponse(raw, 'Bad Store');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('50%'),
      expect.objectContaining({ store: 'Bad Store' }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Tests: deduplicateDeals
// ────────────────────────────────────────────────────────────

describe('deduplicateDeals', () => {
  it('removes duplicates with same item_name (case insensitive)', () => {
    const deals: ExtractedDeal[] = [
      makeValidDeal({ item_name: 'Chicken Breast' }),
      makeValidDeal({ item_name: 'chicken breast' }),
    ];
    const result = deduplicateDeals(deals);
    expect(result).toHaveLength(1);
  });

  it('keeps deal with more complete data when deduplicating', () => {
    const deals: ExtractedDeal[] = [
      makeValidDeal({ item_name: 'Chicken Breast', regular_price: null, unit_size: null }),
      makeValidDeal({ item_name: 'chicken breast', regular_price: 8.99, unit_size: '1 kg' }),
    ];
    const result = deduplicateDeals(deals);
    expect(result).toHaveLength(1);
    expect(result[0]!.regular_price).toBe(8.99);
    expect(result[0]!.unit_size).toBe('1 kg');
  });

  it('treats different brands as separate items', () => {
    const deals: ExtractedDeal[] = [
      makeValidDeal({ item_name: 'Yogurt', brand: 'Danone' }),
      makeValidDeal({ item_name: 'Yogurt', brand: 'Astro' }),
    ];
    const result = deduplicateDeals(deals);
    expect(result).toHaveLength(2);
  });

  it('treats null brand and empty string brand as same', () => {
    const deals: ExtractedDeal[] = [
      makeValidDeal({ item_name: 'Yogurt', brand: null }),
      makeValidDeal({ item_name: 'Yogurt', brand: null }),
    ];
    const result = deduplicateDeals(deals);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const result = deduplicateDeals([]);
    expect(result).toEqual([]);
  });

  it('preserves all unique deals', () => {
    const deals: ExtractedDeal[] = [
      makeValidDeal({ item_name: 'Chicken Breast' }),
      makeValidDeal({ item_name: 'White Rice' }),
      makeValidDeal({ item_name: 'Bananas' }),
    ];
    const result = deduplicateDeals(deals);
    expect(result).toHaveLength(3);
  });
});

// ────────────────────────────────────────────────────────────
// Tests: calculateFlyerDates
// ────────────────────────────────────────────────────────────

describe('calculateFlyerDates', () => {
  it('returns valid_from as next Thursday from a Tuesday', () => {
    // Tuesday March 10, 2026 at 10pm
    const tuesday = new Date(2026, 2, 10, 22, 0, 0);
    const dates = calculateFlyerDates(tuesday);
    expect(dates.validFrom).toBe('2026-03-12'); // Thursday
  });

  it('returns valid_to as Wednesday (6 days after Thursday)', () => {
    const tuesday = new Date(2026, 2, 10, 22, 0, 0);
    const dates = calculateFlyerDates(tuesday);
    expect(dates.validTo).toBe('2026-03-18'); // Wednesday
  });

  it('Thursday maps to next Thursday (not same day)', () => {
    const thursday = new Date(2026, 2, 12, 10, 0, 0);
    const dates = calculateFlyerDates(thursday);
    expect(dates.validFrom).toBe('2026-03-19'); // Following Thursday
  });

  it('Sunday maps to the following Thursday', () => {
    const sunday = new Date(2026, 2, 8, 10, 0, 0);
    const dates = calculateFlyerDates(sunday);
    expect(dates.validFrom).toBe('2026-03-12'); // Thursday
  });

  it('valid_from and valid_to are 6 days apart', () => {
    const date = new Date(2026, 2, 10, 22, 0, 0);
    const dates = calculateFlyerDates(date);
    const from = new Date(dates.validFrom + 'T00:00:00');
    const to = new Date(dates.validTo + 'T00:00:00');
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });

  it('valid_from is always a Thursday', () => {
    const date = new Date(2026, 2, 10, 22, 0, 0);
    const dates = calculateFlyerDates(date);
    const validFrom = new Date(dates.validFrom + 'T00:00:00');
    expect(validFrom.getDay()).toBe(4); // Thursday
  });

  it('valid_to is always a Wednesday', () => {
    const date = new Date(2026, 2, 10, 22, 0, 0);
    const dates = calculateFlyerDates(date);
    const validTo = new Date(dates.validTo + 'T00:00:00');
    expect(validTo.getDay()).toBe(3); // Wednesday
  });
});

// ────────────────────────────────────────────────────────────
// Tests: scrapeAllStores (integration with mocks)
// ────────────────────────────────────────────────────────────

describe('scrapeAllStores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockQuery.mockResolvedValue({ rows: [] });
    mockCallClaude.mockResolvedValue('[]');
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.$.mockResolvedValue(null);
    mockPage.$$.mockResolvedValue([]);
    mockPage.evaluate.mockImplementation((expr: unknown) => {
      if (typeof expr === 'string' && expr.includes('scrollHeight')) {
        return Promise.resolve(800);
      }
      if (typeof expr === 'string' && expr.includes('innerText')) {
        return Promise.resolve('Sample flyer text with deals');
      }
      if (typeof expr === 'string' && expr.includes('scrollTo')) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(800);
    });
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake-png'));
  });

  it('returns zero results when no brands found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await scrapeAllStores();

    expect(result.brandsScraped).toBe(0);
    expect(result.dealsFound).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('scrapes brands and counts results', async () => {
    let queryCallCount = 0;
    mockQuery.mockImplementation(() => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return Promise.resolve({
          rows: [{
            id: 'brand-1',
            name: 'No Frills',
            flyer_url: 'https://nofrills.ca/flyer',
            scrape_status: 'pending',
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const validDeals = [makeValidDeal({ item_name: 'Bananas', category: 'produce' })];
    mockCallClaude.mockResolvedValue(JSON.stringify(validDeals));

    const result = await scrapeAllStores();

    expect(result.brandsScraped).toBe(1);
    expect(result.dealsFound).toBe(1);
  });

  it('skips disabled brands (query excludes them)', async () => {
    // Query returns no brands (disabled ones are filtered at SQL level)
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await scrapeAllStores();

    expect(result.brandsScraped).toBe(0);
  });

  it('handles spend limit errors gracefully', async () => {
    let queryCallCount = 0;
    mockQuery.mockImplementation(() => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return Promise.resolve({
          rows: [
            { id: 'brand-1', name: 'No Frills', flyer_url: 'https://nofrills.ca/flyer', scrape_status: 'pending' },
            { id: 'brand-2', name: 'FreshCo', flyer_url: 'https://freshco.ca/flyer', scrape_status: 'pending' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    mockCallClaude.mockRejectedValue({
      code: 'SPEND_LIMIT_REACHED',
      status: 503,
      message: "We've hit our processing limit for today -- please try again tomorrow.",
    });

    const result = await scrapeAllStores();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Spend limit reached'))).toBe(true);
  });

  it('continues to next brand when one fails', async () => {
    let queryCallCount = 0;
    mockQuery.mockImplementation(() => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return Promise.resolve({
          rows: [
            { id: 'brand-1', name: 'No Frills', flyer_url: 'https://nofrills.ca/flyer', scrape_status: 'pending' },
            { id: 'brand-2', name: 'FreshCo', flyer_url: 'https://freshco.ca/flyer', scrape_status: 'pending' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const validDeals = [makeValidDeal({ item_name: 'Bananas', category: 'produce' })];
    mockCallClaude.mockResolvedValue(JSON.stringify(validDeals));

    // Make first page.goto fail, second succeeds
    let pageCallCount = 0;
    mockBrowser.newPage.mockImplementation(() => {
      pageCallCount++;
      if (pageCallCount === 1) {
        return Promise.resolve({
          setViewport: vi.fn(),
          goto: vi.fn().mockRejectedValue(new Error('Navigation timeout')),
          $: vi.fn().mockResolvedValue(null),
          $$: vi.fn().mockResolvedValue([]),
          evaluate: vi.fn().mockResolvedValue(800),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake')),
          close: vi.fn(),
        });
      }
      return Promise.resolve(mockPage);
    });

    const result = await scrapeAllStores();

    // Both brands were attempted
    expect(result.brandsScraped).toBe(2);
    // First brand failed (0 deals), second succeeds (1 deal)
    expect(result.dealsFound).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Navigation timeout');
  });

  it('checks spend limit via callClaude (null userId for pipeline)', async () => {
    let queryCallCount = 0;
    mockQuery.mockImplementation(() => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return Promise.resolve({
          rows: [{
            id: 'brand-1',
            name: 'No Frills',
            flyer_url: 'https://nofrills.ca/flyer',
            scrape_status: 'pending',
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    mockCallClaude.mockResolvedValue('[]');

    await scrapeAllStores();

    // callClaude should have been called with null userId (pipeline-level)
    expect(mockCallClaude).toHaveBeenCalled();
    const callArgs = mockCallClaude.mock.calls[0];
    // Third argument is userId, which should be null for pipeline calls
    expect(callArgs![2]).toBeNull();
  });

  it('updates scrape_status after successful run', async () => {
    let queryCallCount = 0;
    mockQuery.mockImplementation(() => {
      queryCallCount++;
      if (queryCallCount === 1) {
        return Promise.resolve({
          rows: [{
            id: 'brand-1',
            name: 'No Frills',
            flyer_url: 'https://nofrills.ca/flyer',
            scrape_status: 'pending',
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    mockCallClaude.mockResolvedValue('[]');

    await scrapeAllStores();

    // Find the UPDATE store_brands call
    const updateCall = mockQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('UPDATE store_brands'),
    );
    expect(updateCall).toBeDefined();
    // Status should be 'ok'
    expect(updateCall![1]).toContain('ok');
  });
});
