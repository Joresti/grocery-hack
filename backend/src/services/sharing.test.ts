import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────
// Mock dependencies
// ────────────────────────────────────────────────────────────

vi.mock('../db/queries/sharing.js', () => ({
  createMealShare: vi.fn(),
  findShareByToken: vi.fn(),
  updateShareStatus: vi.fn(),
  findMealName: vi.fn(),
  findSenderDisplayName: vi.fn(),
  findPlanByToken: vi.fn(),
}));

vi.mock('../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/sms.js', () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/emailTemplates.js', () => ({
  renderShareCookForMeEmail: vi.fn().mockReturnValue({
    subject: 'Cook for me',
    html: '<p>Cook</p>',
    text: 'Cook',
  }),
  renderShareMakeForYouEmail: vi.fn().mockReturnValue({
    subject: 'Make for you',
    html: '<p>Make</p>',
    text: 'Make',
  }),
  renderShareAcceptedEmail: vi.fn().mockReturnValue({
    subject: 'Accepted',
    html: '<p>Accepted</p>',
    text: 'Accepted',
  }),
  renderShareDeclinedEmail: vi.fn().mockReturnValue({
    subject: 'Declined',
    html: '<p>Declined</p>',
    text: 'Declined',
  }),
  renderSharePlanEmail: vi.fn().mockReturnValue({
    subject: 'Plan shared',
    html: '<p>Plan</p>',
    text: 'Plan',
  }),
}));

vi.mock('../lib/smsTemplates.js', () => ({
  renderShareCookForMeSms: vi.fn().mockReturnValue('Cook for me SMS'),
  renderShareMakeForYouSms: vi.fn().mockReturnValue('Make for you SMS'),
  renderSharePlanSms: vi.fn().mockReturnValue('Plan shared SMS'),
}));

vi.mock('../config.js', () => ({
  config: {
    APP_URL: 'http://localhost:3000',
  },
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import { shareMeal, respondToShare, sharePlan } from './sharing.js';
import * as sharingQueries from '../db/queries/sharing.js';
import { sendEmail } from '../lib/email.js';
import { sendSms } from '../lib/sms.js';
import * as emailTemplates from '../lib/emailTemplates.js';
import * as smsTemplates from '../lib/smsTemplates.js';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MEAL_ID = '660e8400-e29b-41d4-a716-446655440001';

// ────────────────────────────────────────────────────────────
// shareMeal
// ────────────────────────────────────────────────────────────

describe('shareMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sharingQueries.findMealName).mockResolvedValue('Chicken Stir Fry');
    vi.mocked(sharingQueries.findSenderDisplayName).mockResolvedValue('Test User');
    vi.mocked(sharingQueries.createMealShare).mockResolvedValue({
      id: 'share-1',
      sender_id: USER_ID,
      token: 'mock-token',
      meal_id: MEAL_ID,
      meal_source: 'meal',
      share_type: 'cook_for_me',
      recipient_name: null,
      recipient_contact: 'alice@example.com',
      channel: 'email',
      status: 'pending',
      date: null,
      time: null,
      responded_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });
  });

  it('shares meal via email (cook_for_me)', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: 'Alice',
      recipientContact: 'alice@example.com',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('email');
    expect(result.share_token).toBeDefined();
    expect(typeof result.share_token).toBe('string');
    expect(sharingQueries.createMealShare).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(emailTemplates.renderShareCookForMeEmail).toHaveBeenCalledOnce();
  });

  it('shares meal via SMS (cook_for_me)', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: '+14165551234',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('sms');
    expect(sendSms).toHaveBeenCalledOnce();
    expect(smsTemplates.renderShareCookForMeSms).toHaveBeenCalledOnce();
  });

  it('shares meal via email (make_for_you)', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: 'Bob',
      recipientContact: 'bob@example.com',
      shareType: 'make_for_you',
      date: '2026-03-20',
      time: '18:00',
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('email');
    expect(emailTemplates.renderShareMakeForYouEmail).toHaveBeenCalledOnce();
  });

  it('shares meal via SMS (make_for_you)', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: '+14165551234',
      shareType: 'make_for_you',
      date: null,
      time: null,
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('sms');
    expect(smsTemplates.renderShareMakeForYouSms).toHaveBeenCalledOnce();
  });

  it('detects email channel via @ symbol', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: 'test@test.com',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    });

    expect(result.channel).toBe('email');
  });

  it('detects sms channel for phone numbers', async () => {
    const result = await shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: '+14165551234',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    });

    expect(result.channel).toBe('sms');
  });

  it('throws INVALID_CONTACT for bad email', async () => {
    await expect(shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: 'bademail@',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    })).rejects.toMatchObject({
      code: 'INVALID_CONTACT',
      status: 400,
    });
  });

  it('throws INVALID_CONTACT for short phone number', async () => {
    await expect(shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: '12345',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    })).rejects.toMatchObject({
      code: 'INVALID_CONTACT',
      status: 400,
    });
  });

  it('throws MEAL_NOT_FOUND when meal does not exist', async () => {
    vi.mocked(sharingQueries.findMealName).mockResolvedValue(null);

    await expect(shareMeal(USER_ID, {
      mealId: MEAL_ID,
      mealSource: 'meal',
      recipientName: null,
      recipientContact: 'test@test.com',
      shareType: 'cook_for_me',
      date: null,
      time: null,
    })).rejects.toMatchObject({
      code: 'MEAL_NOT_FOUND',
      status: 404,
    });
  });
});

// ────────────────────────────────────────────────────────────
// respondToShare
// ────────────────────────────────────────────────────────────

describe('respondToShare', () => {
  const pendingShare = {
    id: 'share-1',
    sender_id: USER_ID,
    token: 'test-token',
    meal_id: MEAL_ID,
    meal_source: 'meal',
    share_type: 'cook_for_me',
    recipient_name: 'Alice',
    recipient_contact: 'alice@example.com',
    channel: 'email',
    status: 'pending',
    date: '2026-03-20',
    time: '18:00',
    responded_at: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    sender_display_name: 'Test User',
    sender_email: 'sender@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sharingQueries.findShareByToken).mockResolvedValue({ ...pendingShare });
    vi.mocked(sharingQueries.updateShareStatus).mockResolvedValue({
      ...pendingShare,
      status: 'accepted',
      responded_at: new Date().toISOString(),
    });
    vi.mocked(sharingQueries.findMealName).mockResolvedValue('Chicken Stir Fry');
  });

  it('accepts a share and returns calendar URL', async () => {
    const result = await respondToShare('test-token', 'accept');

    expect(result.status).toBe('accepted');
    expect(result.meal_name).toBe('Chicken Stir Fry');
    expect(result.sender_name).toBe('Test User');
    expect(result.date).toBe('2026-03-20');
    expect(result.time).toBe('18:00');
    expect(result.calendar_url).toContain('calendar.google.com');
    expect(result.calendar_url).toContain('Chicken+Stir+Fry');
    expect(sharingQueries.updateShareStatus).toHaveBeenCalledWith('test-token', 'accepted');
    expect(emailTemplates.renderShareAcceptedEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('declines a share with no calendar URL', async () => {
    const result = await respondToShare('test-token', 'decline');

    expect(result.status).toBe('declined');
    expect(result.calendar_url).toBeNull();
    expect(sharingQueries.updateShareStatus).toHaveBeenCalledWith('test-token', 'declined');
    expect(emailTemplates.renderShareDeclinedEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('returns null calendar_url when accepted but no date', async () => {
    vi.mocked(sharingQueries.findShareByToken).mockResolvedValue({
      ...pendingShare,
      date: null,
      time: null,
    });

    const result = await respondToShare('test-token', 'accept');

    expect(result.status).toBe('accepted');
    expect(result.calendar_url).toBeNull();
  });

  it('throws SHARE_NOT_FOUND when token is invalid', async () => {
    vi.mocked(sharingQueries.findShareByToken).mockResolvedValue(null);

    await expect(respondToShare('bad-token', 'accept')).rejects.toMatchObject({
      code: 'SHARE_NOT_FOUND',
      status: 404,
    });
  });

  it('throws SHARE_EXPIRED when share is expired', async () => {
    vi.mocked(sharingQueries.findShareByToken).mockResolvedValue({
      ...pendingShare,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    await expect(respondToShare('test-token', 'accept')).rejects.toMatchObject({
      code: 'SHARE_EXPIRED',
      status: 410,
    });
  });

  it('throws SHARE_ALREADY_RESPONDED when not pending', async () => {
    vi.mocked(sharingQueries.findShareByToken).mockResolvedValue({
      ...pendingShare,
      status: 'accepted',
    });

    await expect(respondToShare('test-token', 'accept')).rejects.toMatchObject({
      code: 'SHARE_ALREADY_RESPONDED',
      status: 409,
    });
  });
});

// ────────────────────────────────────────────────────────────
// sharePlan
// ────────────────────────────────────────────────────────────

describe('sharePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sharingQueries.findPlanByToken).mockResolvedValue({
      id: 'plan-1',
      user_id: USER_ID,
      token: 'plan-token',
      week_of: '2026-03-09',
      one_store_optimized: { estimatedSavings: 12.50, meals: [{}, {}, {}] },
      two_store_optimized: null,
      watchlist_alerts: [],
      recipe_alerts: [],
      owner_display_name: 'Test User',
      created_at: new Date().toISOString(),
    });
    vi.mocked(sharingQueries.findSenderDisplayName).mockResolvedValue('Test User');
  });

  it('shares plan via email', async () => {
    const result = await sharePlan(USER_ID, {
      planToken: 'plan-token',
      recipientName: 'Bob',
      recipientContact: 'bob@example.com',
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('email');
    expect(emailTemplates.renderSharePlanEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('shares plan via SMS', async () => {
    const result = await sharePlan(USER_ID, {
      planToken: 'plan-token',
      recipientName: null,
      recipientContact: '+14165551234',
    });

    expect(result.sent).toBe(true);
    expect(result.channel).toBe('sms');
    expect(smsTemplates.renderSharePlanSms).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledOnce();
  });

  it('throws PLAN_NOT_FOUND when plan does not exist', async () => {
    vi.mocked(sharingQueries.findPlanByToken).mockResolvedValue(null);

    await expect(sharePlan(USER_ID, {
      planToken: 'nonexistent',
      recipientName: null,
      recipientContact: 'test@test.com',
    })).rejects.toMatchObject({
      code: 'PLAN_NOT_FOUND',
      status: 404,
    });
  });

  it('throws INVALID_CONTACT for bad phone', async () => {
    await expect(sharePlan(USER_ID, {
      planToken: 'plan-token',
      recipientName: null,
      recipientContact: '123',
    })).rejects.toMatchObject({
      code: 'INVALID_CONTACT',
      status: 400,
    });
  });
});
