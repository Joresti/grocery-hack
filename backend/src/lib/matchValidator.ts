import { spawn } from 'node:child_process';
import { pool } from '../db/client.js';
import { logger } from './logger.js';

interface MatchPair {
  keyword: string;
  productType: string;
}

interface Verdict {
  keyword: string;
  productType: string;
  isValid: boolean;
  reason: string;
}

// ────────────────────────────────────────────────────────────
// Cache lookup
// ────────────────────────────────────────────────────────────

async function lookupVerdicts(
  pairs: MatchPair[],
): Promise<Map<string, boolean>> {
  if (pairs.length === 0) return new Map();

  const params: unknown[] = [];
  const valueRows: string[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const kwIdx = i * 2 + 1;
    const ptIdx = i * 2 + 2;
    params.push(pairs[i]!.keyword.toLowerCase(), pairs[i]!.productType.toLowerCase());
    valueRows.push(`($${kwIdx}::text, $${ptIdx}::text)`);
  }

  const { rows } = await pool.query(
    `SELECT mv.ingredient_keyword, mv.product_type, mv.is_valid
     FROM match_verdicts mv
     JOIN (VALUES ${valueRows.join(', ')}) AS q(kw, pt)
       ON mv.ingredient_keyword = q.kw AND mv.product_type = q.pt`,
    params,
  );

  const results = new Map<string, boolean>();
  for (const row of rows as { ingredient_keyword: string; product_type: string; is_valid: boolean }[]) {
    const key = `${row.ingredient_keyword}|${row.product_type}`;
    results.set(key, row.is_valid);
  }
  return results;
}

function cacheKey(keyword: string, productType: string): string {
  return `${keyword.toLowerCase()}|${productType.toLowerCase()}`;
}

// ────────────────────────────────────────────────────────────
// Claude CLI validation for uncached pairs
// Uses `claude -p` (subscription) instead of the API (per-token)
// ────────────────────────────────────────────────────────────

function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', 'sonnet'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude -p failed: ${stderr.slice(0, 500)}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on('error', (err) => {
      reject(new Error(`claude -p failed: ${err.message}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const BATCH_SIZE = 20;

async function classifyBatch(pairs: MatchPair[]): Promise<Verdict[]> {
  const pairList = pairs
    .map((p, i) => `${i + 1}. ingredient="${p.keyword}" product_type="${p.productType}"`)
    .join('\n');

  const prompt = `You are a grocery shopping expert. For each pair below, answer YES if someone shopping for the ingredient would buy a product of this type, NO if they are different products that share a word. Be strict: the product must be a reasonable substitute for the ingredient in a recipe.

Return ONLY a JSON array of objects with keys: keyword, productType, valid (boolean), reason (short). No markdown fences.

${pairList}`;

  const response = await runClaudeCli(prompt);

  try {
    const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    const parsed = JSON.parse(cleaned) as {
      keyword: string;
      productType: string;
      valid: boolean;
      reason: string;
    }[];
    return parsed.map((v) => ({
      keyword: v.keyword,
      productType: v.productType,
      isValid: v.valid,
      reason: v.reason,
    }));
  } catch {
    logger.error('[MATCH_VALIDATOR] Failed to parse claude -p response', {
      response: response.slice(0, 500),
    });
    return pairs.map((p) => ({
      keyword: p.keyword,
      productType: p.productType,
      isValid: true,
      reason: 'parse_error_fallback',
    }));
  }
}

async function classifyWithClaude(pairs: MatchPair[]): Promise<Verdict[]> {
  if (pairs.length === 0) return [];

  // Chunk into small batches for accuracy — large batches degrade sonnet's judgment
  const chunks: MatchPair[][] = [];
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    chunks.push(pairs.slice(i, i + BATCH_SIZE));
  }

  logger.info('[MATCH_VALIDATOR] Classifying in batches', {
    total: pairs.length,
    batches: chunks.length,
    batchSize: BATCH_SIZE,
  });

  // Run batches sequentially — concurrent claude -p calls can exhaust credit limits
  const results: Verdict[] = [];
  for (const chunk of chunks) {
    const batch = await classifyBatch(chunk);
    results.push(...batch);
  }
  return results;
}

// ────────────────────────────────────────────────────────────
// Cache write
// ────────────────────────────────────────────────────────────

async function saveVerdicts(verdicts: Verdict[]): Promise<void> {
  if (verdicts.length === 0) return;

  const params: unknown[] = [];
  const valueRows: string[] = [];
  for (let i = 0; i < verdicts.length; i++) {
    const base = i * 4;
    params.push(
      verdicts[i]!.keyword.toLowerCase(),
      verdicts[i]!.productType.toLowerCase(),
      verdicts[i]!.isValid,
      verdicts[i]!.reason,
    );
    valueRows.push(
      `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`,
    );
  }

  await pool.query(
    `INSERT INTO match_verdicts (id, ingredient_keyword, product_type, is_valid, reason)
     VALUES ${valueRows.join(', ')}
     ON CONFLICT (ingredient_keyword, product_type) DO NOTHING`,
    params,
  );
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Validate a batch of (keyword, productType) pairs.
 * Returns a Set of cache keys for pairs that are INVALID.
 * Cache hits are free (<10ms). Only misses call `claude -p` (subscription, no API cost).
 */
export async function validateMatches(
  pairs: MatchPair[],
): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();

  // Deduplicate
  const uniqueMap = new Map<string, MatchPair>();
  for (const p of pairs) {
    const key = cacheKey(p.keyword, p.productType);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  }
  const uniquePairs = [...uniqueMap.values()];

  // 1. Check cache
  const cached = await lookupVerdicts(uniquePairs);

  // 2. Find uncached pairs
  const uncached = uniquePairs.filter(
    (p) => !cached.has(cacheKey(p.keyword, p.productType)),
  );

  // 3. Classify uncached via claude -p (if any)
  if (uncached.length > 0) {
    logger.info('[MATCH_VALIDATOR] Classifying uncached pairs via claude -p', {
      count: uncached.length,
      cached: cached.size,
    });

    try {
      const verdicts = await classifyWithClaude(uncached);
      await saveVerdicts(verdicts);

      for (const v of verdicts) {
        cached.set(cacheKey(v.keyword, v.productType), v.isValid);
      }
    } catch (err) {
      logger.error('[MATCH_VALIDATOR] claude -p failed, allowing all uncached', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4. Return set of invalid cache keys
  const invalidKeys = new Set<string>();
  for (const [key, isValid] of cached) {
    if (!isValid) {
      invalidKeys.add(key);
    }
  }
  return invalidKeys;
}
