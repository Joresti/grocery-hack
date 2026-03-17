import { describe, it, expect } from 'vitest';
import {
  renderShareCookForMeSms,
  renderShareMakeForYouSms,
  renderShareAcceptedSms,
  renderShareDeclinedSms,
  renderSharePlanSms,
} from './smsTemplates.js';

describe('renderShareCookForMeSms', () => {
  it('contains sender name and meal name', () => {
    const msg = renderShareCookForMeSms({
      senderName: 'Alice',
      mealName: 'Tacos',
      respondUrl: 'https://app.groceryhack.ca/share/abc',
    });
    expect(msg).toContain('Alice');
    expect(msg).toContain('Tacos');
    expect(msg).toContain('https://app.groceryhack.ca/share/abc');
  });

  it('is 160 characters or less', () => {
    const msg = renderShareCookForMeSms({
      senderName: 'Alice',
      mealName: 'Tacos',
      respondUrl: 'https://app.groceryhack.ca/share/abc',
    });
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('handles null senderName', () => {
    const msg = renderShareCookForMeSms({
      senderName: null,
      mealName: 'Tacos',
      respondUrl: 'https://app.groceryhack.ca/share/abc',
    });
    expect(msg).toContain('Someone');
  });

  it('truncates long messages', () => {
    const msg = renderShareCookForMeSms({
      senderName: 'Alice',
      mealName: 'A Very Long Meal Name That Takes Up A Lot Of Characters In The Message',
      respondUrl: 'https://app.groceryhack.ca/share/a-very-long-token-that-makes-it-exceed-limit-yes',
    });
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});

describe('renderShareMakeForYouSms', () => {
  it('contains sender and meal', () => {
    const msg = renderShareMakeForYouSms({
      senderName: 'Bob',
      mealName: 'Pasta',
    });
    expect(msg).toContain('Bob');
    expect(msg).toContain('Pasta');
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('handles null senderName', () => {
    const msg = renderShareMakeForYouSms({ senderName: null, mealName: 'Pasta' });
    expect(msg).toContain('Someone');
  });
});

describe('renderShareAcceptedSms', () => {
  it('contains recipient and meal', () => {
    const msg = renderShareAcceptedSms({
      recipientName: 'Carol',
      mealName: 'Stir Fry',
    });
    expect(msg).toContain('Carol');
    expect(msg).toContain('Stir Fry');
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('handles null recipientName', () => {
    const msg = renderShareAcceptedSms({ recipientName: null, mealName: 'Stir Fry' });
    expect(msg).toContain('They');
  });
});

describe('renderShareDeclinedSms', () => {
  it('contains recipient and meal', () => {
    const msg = renderShareDeclinedSms({
      recipientName: 'Dave',
      mealName: 'Curry',
    });
    expect(msg).toContain('Dave');
    expect(msg).toContain('Curry');
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('handles null recipientName', () => {
    const msg = renderShareDeclinedSms({ recipientName: null, mealName: 'Curry' });
    expect(msg).toContain('They');
  });
});

describe('renderSharePlanSms', () => {
  it('contains sender and plan URL', () => {
    const msg = renderSharePlanSms({
      senderName: 'Eve',
      planUrl: 'https://app.groceryhack.ca/plan/xyz',
    });
    expect(msg).toContain('Eve');
    expect(msg).toContain('https://app.groceryhack.ca/plan/xyz');
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it('handles null senderName', () => {
    const msg = renderSharePlanSms({
      senderName: null,
      planUrl: 'https://app.groceryhack.ca/plan/xyz',
    });
    expect(msg).toContain('Someone');
  });
});
