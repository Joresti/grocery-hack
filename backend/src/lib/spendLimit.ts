import { pool } from '../db/client.js';
import { config } from '../config.js';
import { logger } from './logger.js';
import type { TrackedService } from '@groceryhack/shared/types.js';

interface ServiceLimit {
  maxRequests?: number;
  maxCost?: number;
  period: 'daily' | 'monthly';
}

function getServiceLimits(service: TrackedService, isUserLevel: boolean): ServiceLimit {
  switch (service) {
    case 'claude':
      return isUserLevel
        ? { maxRequests: config.CLAUDE_MAX_REQUESTS_PER_USER_PER_DAY, period: 'daily' }
        : { maxCost: config.CLAUDE_MONTHLY_BUDGET_USD, period: 'monthly' };
    case 'twilio':
      return isUserLevel
        ? { maxRequests: config.TWILIO_MAX_SMS_PER_USER_PER_DAY, period: 'daily' }
        : { maxRequests: config.TWILIO_MONTHLY_SMS_LIMIT, period: 'monthly' };
    case 'email':
      return isUserLevel
        ? { maxRequests: config.EMAIL_MAX_PER_USER_PER_DAY, period: 'daily' }
        : { maxRequests: config.EMAIL_MONTHLY_LIMIT, period: 'monthly' };
    default:
      return { maxRequests: config.GEOCODE_DAILY_LIMIT, period: 'daily' };
  }
}

function getPeriodKey(period: 'daily' | 'monthly'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  if (period === 'monthly') return `${year}-${month}`;
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getUsage(
  service: TrackedService,
  userId: string | null,
  periodKey: string
): Promise<{ requestCount: number; estimatedCost: number }> {
  const result = userId
    ? await pool.query(
        `SELECT COALESCE(SUM(request_count), 0) as request_count,
                COALESCE(SUM(estimated_cost), 0) as estimated_cost
         FROM usage_tracking
         WHERE service = $1 AND user_id = $2 AND period_key = $3`,
        [service, userId, periodKey]
      )
    : await pool.query(
        `SELECT COALESCE(SUM(request_count), 0) as request_count,
                COALESCE(SUM(estimated_cost), 0) as estimated_cost
         FROM usage_tracking
         WHERE service = $1 AND user_id IS NULL AND period_key = $2`,
        [service, periodKey]
      );

  const row = result.rows[0];
  return {
    requestCount: Number(row?.request_count ?? 0),
    estimatedCost: Number(row?.estimated_cost ?? 0),
  };
}

export async function checkSpendLimit(
  service: TrackedService,
  userId: string | null
): Promise<void> {
  const isUserLevel = userId !== null;
  const limits = getServiceLimits(service, isUserLevel);
  const periodKey = getPeriodKey(limits.period);
  const usage = await getUsage(service, userId, periodKey);

  let percentage: number;
  if (limits.maxCost !== undefined) {
    percentage = limits.maxCost > 0 ? (usage.estimatedCost / limits.maxCost) * 100 : 0;
  } else if (limits.maxRequests !== undefined) {
    percentage = limits.maxRequests > 0 ? (usage.requestCount / limits.maxRequests) * 100 : 0;
  } else {
    return;
  }

  if (percentage >= 100) {
    throw {
      code: 'SPEND_LIMIT_REACHED',
      status: 503,
      message: "We've hit our processing limit for today — please try again tomorrow.",
    };
  }

  if (percentage >= 80) {
    logger.warn('Approaching spend limit', {
      service,
      userId,
      percentage: Math.round(percentage),
      periodKey,
    });
  }
}

export async function recordUsage(
  service: TrackedService,
  userId: string | null,
  cost: number
): Promise<void> {
  const isUserLevel = userId !== null;
  const limits = getServiceLimits(service, isUserLevel);
  const periodKey = getPeriodKey(limits.period);

  if (userId) {
    await pool.query(
      `INSERT INTO usage_tracking (id, service, user_id, period, period_key, request_count, estimated_cost)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, $5)
       ON CONFLICT (service, user_id, period, period_key) WHERE user_id IS NOT NULL
       DO UPDATE SET request_count = usage_tracking.request_count + 1,
                     estimated_cost = usage_tracking.estimated_cost + $5,
                     updated_at = now()`,
      [service, userId, limits.period, periodKey, cost]
    );
  } else {
    await pool.query(
      `INSERT INTO usage_tracking (id, service, period, period_key, request_count, estimated_cost)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, $4)
       ON CONFLICT (service, period, period_key) WHERE user_id IS NULL
       DO UPDATE SET request_count = usage_tracking.request_count + 1,
                     estimated_cost = usage_tracking.estimated_cost + $4,
                     updated_at = now()`,
      [service, limits.period, periodKey, cost]
    );
  }
}
