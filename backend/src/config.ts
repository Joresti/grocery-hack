import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load .env from project root (one level up from backend/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  ANTHROPIC_API_KEY: z.string().default(''),
  CLAUDE_SCRAPER_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  CLAUDE_PLANNER_MODEL: z.string().default('claude-sonnet-4-5-20250929'),

  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_ID: z.string().default(''),

  EMAIL_PROVIDER: z.enum(['resend', 'ses']).default('resend'),
  EMAIL_FROM: z.string().default('GroceryHack <plans@localhost>'),
  RESEND_API_KEY: z.string().default(''),

  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_PHONE_NUMBER: z.string().default(''),

  GEOCODE_PROVIDER: z.enum(['opencage', 'nominatim']).default('opencage'),
  OPENCAGE_API_KEY: z.string().default(''),

  SCRAPER_CRON: z.string().default('0 22 * * 2'),
  PLANNER_CRON: z.string().default('0 6 * * 3'),
  PIPELINE_TIMEZONE: z.string().default('America/Toronto'),

  CLAUDE_MONTHLY_BUDGET_USD: z.coerce.number().default(25),
  CLAUDE_MAX_REQUESTS_PER_PIPELINE_RUN: z.coerce.number().default(100),
  CLAUDE_MAX_REQUESTS_PER_USER_PER_DAY: z.coerce.number().default(5),
  TWILIO_MONTHLY_SMS_LIMIT: z.coerce.number().default(500),
  TWILIO_MAX_SMS_PER_USER_PER_DAY: z.coerce.number().default(10),
  EMAIL_MONTHLY_LIMIT: z.coerce.number().default(3000),
  EMAIL_MAX_PER_USER_PER_DAY: z.coerce.number().default(20),
  GEOCODE_DAILY_LIMIT: z.coerce.number().default(50),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),
  RATE_LIMIT_AUTH_MULTIPLIER: z.coerce.number().default(2),
  STRIPE_WEBHOOK_TOLERANCE_SEC: z.coerce.number().default(300),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
