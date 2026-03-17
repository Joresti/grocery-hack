import { config } from '../config.js';
import { logger } from './logger.js';
import { checkSpendLimit, recordUsage } from './spendLimit.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions, userId: string | null): Promise<void> {
  // Check spend limits before sending
  await checkSpendLimit('email', userId);

  if (!config.RESEND_API_KEY) {
    // Mock mode
    logger.info('[EMAIL MOCK]', { to: options.to, subject: options.subject });
    await recordUsage('email', userId, 0);
    return;
  }

  // Real Resend API call
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Email send failed', { status: response.status, body: errorBody });
    throw { code: 'EMAIL_SEND_FAILED', status: 502, message: "Couldn't send the email. Please try again." };
  }

  // Record usage after successful send
  await recordUsage('email', userId, 0.001); // ~$0.001 per email on Resend
}
