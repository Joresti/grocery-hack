import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from './logger.js';
import { checkSpendLimit, recordUsage } from './spendLimit.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ClaudeContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    data: string;
  };
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeOptions {
  model: string;
  maxTokens: number;
  system?: string;
  temperature?: number;
}

export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions,
  userId: string | null = null,
): Promise<string> {
  // Check spend limit before calling
  await checkSpendLimit('claude', userId);

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: options.model,
    max_tokens: options.maxTokens,
    system: options.system,
    temperature: options.temperature,
    messages: messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content.map((block) => {
              if (block.type === 'text') {
                return { type: 'text' as const, text: block.text! };
              }
              return {
                type: 'image' as const,
                source: block.source!,
              };
            }),
    })),
  });

  // Estimate cost (Haiku: ~$1/$5 per MTok input/output, Sonnet: ~$3/$15 per MTok)
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const isHaiku = options.model.includes('haiku');
  const inputCostPerMTok = isHaiku ? 1.0 : 3.0;
  const outputCostPerMTok = isHaiku ? 5.0 : 15.0;
  const cost =
    (inputTokens * inputCostPerMTok + outputTokens * outputCostPerMTok) /
    1_000_000;

  await recordUsage('claude', userId, cost);

  logger.info('Claude API call', {
    model: options.model,
    inputTokens,
    outputTokens,
    estimatedCost: cost.toFixed(4),
  });

  // Extract text from response
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return '';
  }
  return textBlock.text;
}
