import { describe, it, expect } from 'vitest';
import {
  renderWelcomeEmail,
  renderWeeklyPlanEmail,
  renderShareCookForMeEmail,
  renderShareMakeForYouEmail,
  renderShareAcceptedEmail,
  renderShareDeclinedEmail,
  renderPasswordResetEmail,
  renderSharePlanEmail,
} from './emailTemplates.js';

const APP_URL = 'https://app.groceryhack.ca';

describe('renderWelcomeEmail', () => {
  it('returns subject, html, and text', () => {
    const result = renderWelcomeEmail({ displayName: 'Alice', appUrl: APP_URL });
    expect(result.subject).toContain('Welcome');
    expect(result.html).toContain('Alice');
    expect(result.html).toContain(APP_URL);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('uses fallback greeting when displayName is null', () => {
    const result = renderWelcomeEmail({ displayName: null, appUrl: APP_URL });
    expect(result.html).toContain('Hi there');
    expect(result.html).not.toContain('null');
  });
});

describe('renderWeeklyPlanEmail', () => {
  const baseData = {
    displayName: 'Bob',
    weekOf: 'March 10, 2026',
    planToken: 'plan-abc-123',
    totalSavings: 18.5,
    mealCount: 5,
    topMeals: [
      { name: 'Chicken Stir Fry', savings: 4.5 },
      { name: 'Pasta Primavera', savings: 3.2 },
    ],
    appUrl: APP_URL,
    userId: '550e8400-e29b-41d4-a716-446655440000',
    emailToken: 'email-token-xyz',
  };

  it('includes savings in subject', () => {
    const result = renderWeeklyPlanEmail(baseData);
    expect(result.subject).toContain('$18.50');
  });

  it('includes tracking pixel', () => {
    const result = renderWeeklyPlanEmail(baseData);
    expect(result.html).toContain('/api/v1/events/pixel');
    expect(result.html).toContain('email-token-xyz');
    expect(result.html).toContain(baseData.userId);
  });

  it('includes tracked CTA link', () => {
    const result = renderWeeklyPlanEmail(baseData);
    expect(result.html).toContain('/api/v1/r?url=');
    expect(result.html).toContain('plan-abc-123');
  });

  it('lists top meals', () => {
    const result = renderWeeklyPlanEmail(baseData);
    expect(result.html).toContain('Chicken Stir Fry');
    expect(result.html).toContain('Pasta Primavera');
    expect(result.html).toContain('$4.50');
  });

  it('has non-empty text version', () => {
    const result = renderWeeklyPlanEmail(baseData);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).toContain('Chicken Stir Fry');
  });

  it('handles null displayName', () => {
    const result = renderWeeklyPlanEmail({ ...baseData, displayName: null });
    expect(result.html).toContain('Hi there');
  });
});

describe('renderShareCookForMeEmail', () => {
  const baseData = {
    senderName: 'Alice',
    recipientName: 'Bob',
    mealName: 'Tacos',
    shareToken: 'share-abc-123',
    date: 'Friday',
    time: '7pm',
    appUrl: APP_URL,
  };

  it('includes sender and meal in subject', () => {
    const result = renderShareCookForMeEmail(baseData);
    expect(result.subject).toContain('Alice');
    expect(result.subject).toContain('Tacos');
  });

  it('includes date and time', () => {
    const result = renderShareCookForMeEmail(baseData);
    expect(result.html).toContain('Friday');
    expect(result.html).toContain('7pm');
  });

  it('includes respond URL with share token', () => {
    const result = renderShareCookForMeEmail(baseData);
    expect(result.html).toContain('/share/share-abc-123');
  });

  it('handles null senderName', () => {
    const result = renderShareCookForMeEmail({ ...baseData, senderName: null });
    expect(result.subject).toContain('Someone');
    expect(result.html).toContain('Someone');
  });

  it('handles null date and time', () => {
    const result = renderShareCookForMeEmail({ ...baseData, date: null, time: null });
    expect(result.html).not.toContain('on null');
    expect(result.html).not.toContain('at null');
  });

  it('handles only date set', () => {
    const result = renderShareCookForMeEmail({ ...baseData, time: null });
    expect(result.html).toContain('on Friday');
  });

  it('handles only time set', () => {
    const result = renderShareCookForMeEmail({ ...baseData, date: null });
    expect(result.html).toContain('at 7pm');
  });
});

describe('renderShareMakeForYouEmail', () => {
  it('includes sender and meal in subject', () => {
    const result = renderShareMakeForYouEmail({
      senderName: 'Carol',
      recipientName: 'Dave',
      mealName: 'Lasagna',
      date: 'Saturday',
      time: '6pm',
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Carol');
    expect(result.subject).toContain('Lasagna');
  });

  it('handles null sender', () => {
    const result = renderShareMakeForYouEmail({
      senderName: null,
      recipientName: null,
      mealName: 'Soup',
      date: null,
      time: null,
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Someone');
  });
});

describe('renderShareAcceptedEmail', () => {
  it('includes meal name in subject', () => {
    const result = renderShareAcceptedEmail({
      recipientName: 'Eve',
      mealName: 'Pizza',
      date: 'Sunday',
      time: '5pm',
      calendarUrl: 'https://cal.example.com/event',
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Pizza');
    expect(result.html).toContain('Eve');
    expect(result.html).toContain('Sunday');
    expect(result.html).toContain('5pm');
  });

  it('includes calendar link when provided', () => {
    const result = renderShareAcceptedEmail({
      recipientName: 'Eve',
      mealName: 'Pizza',
      date: null,
      time: null,
      calendarUrl: 'https://cal.example.com/event',
      appUrl: APP_URL,
    });
    expect(result.html).toContain('https://cal.example.com/event');
    expect(result.html).toContain('Add to Calendar');
  });

  it('omits calendar link when null', () => {
    const result = renderShareAcceptedEmail({
      recipientName: null,
      mealName: 'Pizza',
      date: null,
      time: null,
      calendarUrl: null,
      appUrl: APP_URL,
    });
    expect(result.html).not.toContain('Add to Calendar');
    expect(result.html).toContain('They');
  });
});

describe('renderShareDeclinedEmail', () => {
  it('includes recipient and meal in subject', () => {
    const result = renderShareDeclinedEmail({
      recipientName: 'Frank',
      mealName: 'Curry',
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Frank');
    expect(result.subject).toContain('Curry');
  });

  it('handles null recipientName', () => {
    const result = renderShareDeclinedEmail({
      recipientName: null,
      mealName: 'Curry',
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('They');
  });
});

describe('renderPasswordResetEmail', () => {
  it('includes reset URL', () => {
    const result = renderPasswordResetEmail({
      resetUrl: 'https://app.groceryhack.ca/reset/token123',
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Reset');
    expect(result.html).toContain('https://app.groceryhack.ca/reset/token123');
    expect(result.html).toContain('1 hour');
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe('renderSharePlanEmail', () => {
  it('includes sender, savings, and meal count', () => {
    const result = renderSharePlanEmail({
      senderName: 'Grace',
      recipientName: 'Hank',
      planToken: 'plan-xyz-789',
      totalSavings: 22.75,
      mealCount: 7,
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Grace');
    expect(result.html).toContain('$22.75');
    expect(result.html).toContain('7 meals');
    expect(result.html).toContain('/plan/plan-xyz-789');
  });

  it('handles null sender', () => {
    const result = renderSharePlanEmail({
      senderName: null,
      recipientName: null,
      planToken: 'plan-xyz-789',
      totalSavings: 10,
      mealCount: 3,
      appUrl: APP_URL,
    });
    expect(result.subject).toContain('Someone');
  });
});
