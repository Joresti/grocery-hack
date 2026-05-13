import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { logger } from './logger.js';

const MODEL_NAME = 'Xenova/bge-base-en-v1.5';
const EMBEDDING_DIM = 768;

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    logger.info('Loading embedding model…');
    extractor = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    });
    logger.info('Embedding model loaded');
  }
  return extractor;
}

const BGE_PREFIX = 'Represent this sentence: ';

/**
 * Generate a 768-dim embedding for a single text string.
 * BGE models require an instruction prefix for best results.
 */
export async function embed(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(BGE_PREFIX + text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIM);
}

/**
 * Generate embeddings for multiple texts in a single batch.
 * Returns one 768-dim vector per input text.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ext = await getExtractor();
  const results: number[][] = [];
  // Process individually to avoid OOM on large batches
  for (const text of texts) {
    const output = await ext(BGE_PREFIX + text, { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIM));
  }
  return results;
}

/**
 * Format a vector as a pgvector-compatible string: '[0.1,0.2,...]'
 */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Cosine similarity between two vectors (both assumed normalized).
 * Returns value between -1 and 1 (1 = identical).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

/** Similarity threshold for in-memory matching (cosine similarity >= 0.85) */
export const SIMILARITY_THRESHOLD = 0.85;

export { EMBEDDING_DIM };
