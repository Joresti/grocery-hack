import { logger } from './logger.js';
import { checkSpendLimit, recordUsage } from './spendLimit.js';

export async function sendSms(to: string, body: string, userId: string | null): Promise<void> {
  await checkSpendLimit('twilio', userId);

  logger.info('[SMS MOCK] Message sent', { to, body });

  await recordUsage('twilio', userId, 0.01);
}
