import crypto from 'node:crypto';
import { config } from '../config.js';
import { throwBadRequest, throwNotFound, throwConflict, createAppError } from '../middleware/errorHandler.js';
import * as sharingQueries from '../db/queries/sharing.js';
import { sendEmail } from '../lib/email.js';
import { sendSms } from '../lib/sms.js';
import * as emailTemplates from '../lib/emailTemplates.js';
import * as smsTemplates from '../lib/smsTemplates.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function determineChannel(contact: string): 'email' | 'sms' {
  return contact.includes('@') ? 'email' : 'sms';
}

function validateContact(contact: string, channel: 'email' | 'sms'): void {
  if (channel === 'email') {
    if (!contact.includes('@') || !contact.includes('.')) {
      throwBadRequest('INVALID_CONTACT', 'Please enter a valid email address or phone number.');
    }
  } else {
    // Phone: basic length check (strip non-digit chars first)
    const digits = contact.replace(/\D/g, '');
    if (digits.length < 10) {
      throwBadRequest('INVALID_CONTACT', 'Please enter a valid email address or phone number.');
    }
  }
}

function buildCalendarUrl(
  mealName: string,
  date: string,
  time: string | null,
  senderName: string | null,
): string {
  const hour = time ?? '18:00';
  const [h, m] = hour.split(':') as [string, string];
  const dateClean = date.replace(/-/g, '');
  const startDt = `${dateClean}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`;

  // End time = start + 1 hour
  const endHour = String(Number(h) + 1).padStart(2, '0');
  const endDt = `${dateClean}T${endHour}${m.padStart(2, '0')}00`;

  const details = senderName
    ? `Shared via GroceryHack by ${senderName}`
    : 'Shared via GroceryHack';

  const params = new URLSearchParams({
    text: mealName,
    dates: `${startDt}/${endDt}`,
    details,
  });

  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

// ────────────────────────────────────────────────────────────
// Share Meal
// ────────────────────────────────────────────────────────────

export interface ShareMealData {
  mealId: string;
  mealSource: string;
  recipientName: string | null;
  recipientContact: string;
  shareType: 'cook_for_me' | 'make_for_you';
  date: string | null;
  time: string | null;
}

export interface ShareMealResult {
  sent: true;
  channel: 'email' | 'sms';
  share_token: string;
}

export async function shareMeal(
  userId: string,
  data: ShareMealData,
): Promise<ShareMealResult> {
  const channel = determineChannel(data.recipientContact);
  validateContact(data.recipientContact, channel);

  // Look up meal name
  const mealName = await sharingQueries.findMealName(data.mealId, data.mealSource);
  if (!mealName) {
    throwNotFound('MEAL_NOT_FOUND', 'Meal not found.');
  }

  // Look up sender display name
  const senderName = await sharingQueries.findSenderDisplayName(userId);

  // Generate token and expiry
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Create meal_shares record
  await sharingQueries.createMealShare({
    senderId: userId,
    token,
    mealId: data.mealId,
    mealSource: data.mealSource,
    shareType: data.shareType,
    recipientName: data.recipientName,
    recipientContact: data.recipientContact,
    channel,
    date: data.date,
    time: data.time,
    expiresAt,
  });

  // Send email or SMS based on share_type and channel
  const respondUrl = `${config.APP_URL}/share/${token}`;

  if (data.shareType === 'cook_for_me') {
    if (channel === 'email') {
      const emailContent = emailTemplates.renderShareCookForMeEmail({
        senderName,
        recipientName: data.recipientName,
        mealName,
        shareToken: token,
        date: data.date,
        time: data.time,
        appUrl: config.APP_URL,
      });
      await sendEmail({ to: data.recipientContact, ...emailContent }, userId);
    } else {
      const smsBody = smsTemplates.renderShareCookForMeSms({
        senderName,
        mealName,
        respondUrl,
      });
      await sendSms(data.recipientContact, smsBody, userId);
    }
  } else {
    // make_for_you
    if (channel === 'email') {
      const emailContent = emailTemplates.renderShareMakeForYouEmail({
        senderName,
        recipientName: data.recipientName,
        mealName,
        date: data.date,
        time: data.time,
        appUrl: config.APP_URL,
      });
      await sendEmail({ to: data.recipientContact, ...emailContent }, userId);
    } else {
      const smsBody = smsTemplates.renderShareMakeForYouSms({
        senderName,
        mealName,
      });
      await sendSms(data.recipientContact, smsBody, userId);
    }
  }

  return { sent: true, channel, share_token: token };
}

// ────────────────────────────────────────────────────────────
// Respond To Share
// ────────────────────────────────────────────────────────────

export interface RespondToShareResult {
  status: 'accepted' | 'declined';
  meal_name: string;
  sender_name: string | null;
  date: string | null;
  time: string | null;
  calendar_url: string | null;
}

export async function respondToShare(
  token: string,
  action: 'accept' | 'decline',
): Promise<RespondToShareResult> {
  // Find share
  const share = await sharingQueries.findShareByToken(token);
  if (!share) {
    throwNotFound('SHARE_NOT_FOUND', 'Share not found.');
  }

  // Check expiry
  const expiresAt = new Date(share.expires_at as string);
  if (expiresAt < new Date()) {
    throw createAppError('SHARE_EXPIRED', 410, 'This share request has expired.');
  }

  // Check if already responded
  if (share.status !== 'pending') {
    throwConflict('SHARE_ALREADY_RESPONDED', 'This request has already been responded to.');
  }

  // Validate action (already validated by Zod, but for safety)
  if (action !== 'accept' && action !== 'decline') {
    throwBadRequest('INVALID_SHARE_ACTION', 'Invalid action. Use accept or decline.');
  }

  // Update status
  const status = action === 'accept' ? 'accepted' : 'declined';
  await sharingQueries.updateShareStatus(token, status);

  // Get meal name
  const mealName = await sharingQueries.findMealName(
    share.meal_id as string,
    share.meal_source as string,
  );

  const senderName = (share.sender_display_name as string | null) ?? null;
  const senderEmail = share.sender_email as string;
  const shareDate = (share.date as string | null) ?? null;
  const shareTime = (share.time as string | null) ?? null;
  const recipientName = (share.recipient_name as string | null) ?? null;

  // Generate calendar URL if accepted and date is set
  let calendarUrl: string | null = null;
  if (status === 'accepted' && shareDate) {
    calendarUrl = buildCalendarUrl(mealName ?? 'Meal', shareDate, shareTime, senderName);
  }

  // Send confirmation email to sender
  if (status === 'accepted') {
    const emailContent = emailTemplates.renderShareAcceptedEmail({
      recipientName,
      mealName: mealName ?? 'a meal',
      date: shareDate,
      time: shareTime,
      calendarUrl,
      appUrl: config.APP_URL,
    });
    await sendEmail({ to: senderEmail, ...emailContent }, share.sender_id as string);
  } else {
    const emailContent = emailTemplates.renderShareDeclinedEmail({
      recipientName,
      mealName: mealName ?? 'a meal',
      appUrl: config.APP_URL,
    });
    await sendEmail({ to: senderEmail, ...emailContent }, share.sender_id as string);
  }

  return {
    status,
    meal_name: mealName ?? 'Unknown meal',
    sender_name: senderName,
    date: shareDate,
    time: shareTime,
    calendar_url: calendarUrl,
  };
}

// ────────────────────────────────────────────────────────────
// Share Plan
// ────────────────────────────────────────────────────────────

export interface SharePlanData {
  planToken: string;
  recipientName: string | null;
  recipientContact: string;
}

export interface SharePlanResult {
  sent: true;
  channel: 'email' | 'sms';
}

export async function sharePlan(
  userId: string,
  data: SharePlanData,
): Promise<SharePlanResult> {
  // Look up plan
  const plan = await sharingQueries.findPlanByToken(data.planToken);
  if (!plan) {
    throwNotFound('PLAN_NOT_FOUND', 'Plan not found.');
  }

  const channel = determineChannel(data.recipientContact);
  validateContact(data.recipientContact, channel);

  // Look up sender display name
  const senderName = await sharingQueries.findSenderDisplayName(userId);

  // Extract plan data for templates
  const oneStore = plan.one_store_optimized as Record<string, unknown> | null;
  const totalSavings = oneStore ? Number((oneStore.estimatedSavings as number) ?? 0) : 0;
  const mealCount = oneStore && Array.isArray(oneStore.meals) ? (oneStore.meals as unknown[]).length : 0;

  if (channel === 'email') {
    const emailContent = emailTemplates.renderSharePlanEmail({
      senderName,
      recipientName: data.recipientName,
      planToken: data.planToken,
      totalSavings,
      mealCount,
      appUrl: config.APP_URL,
    });
    await sendEmail({ to: data.recipientContact, ...emailContent }, userId);
  } else {
    const planUrl = `${config.APP_URL}/plan/${data.planToken}`;
    const smsBody = smsTemplates.renderSharePlanSms({
      senderName,
      planUrl,
    });
    await sendSms(data.recipientContact, smsBody, userId);
  }

  return { sent: true, channel };
}
