import { describe, it, expect } from 'vitest';
import { shareMealBody, shareRespondParams, shareRespondQuery, sharePlanBody } from './sharing.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('shareMealBody', () => {
  it('accepts valid full input', () => {
    const result = shareMealBody.parse({
      meal_id: VALID_UUID,
      meal_source: 'user_recipe',
      recipient_name: 'Alice',
      recipient_contact: 'alice@example.com',
      share_type: 'cook_for_me',
      date: '2026-03-20',
      time: '18:30',
    });
    expect(result.mealId).toBe(VALID_UUID);
    expect(result.mealSource).toBe('user_recipe');
    expect(result.recipientName).toBe('Alice');
    expect(result.recipientContact).toBe('alice@example.com');
    expect(result.shareType).toBe('cook_for_me');
    expect(result.date).toBe('2026-03-20');
    expect(result.time).toBe('18:30');
  });

  it('defaults meal_source to "meal"', () => {
    const result = shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: 'alice@example.com',
      share_type: 'make_for_you',
    });
    expect(result.mealSource).toBe('meal');
  });

  it('transforms snake_case to camelCase', () => {
    const result = shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: '+14165551234',
      share_type: 'cook_for_me',
    });
    expect(result.mealId).toBe(VALID_UUID);
    expect(result.shareType).toBe('cook_for_me');
    expect(result.recipientContact).toBe('+14165551234');
    // Should not have snake_case keys
    expect((result as Record<string, unknown>).meal_id).toBeUndefined();
    expect((result as Record<string, unknown>).share_type).toBeUndefined();
  });

  it('sets optional fields to null when omitted', () => {
    const result = shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: 'test@test.com',
      share_type: 'cook_for_me',
    });
    expect(result.recipientName).toBeNull();
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
  });

  it('rejects invalid UUID for meal_id', () => {
    expect(() => shareMealBody.parse({
      meal_id: 'not-a-uuid',
      recipient_contact: 'test@test.com',
      share_type: 'cook_for_me',
    })).toThrow();
  });

  it('rejects missing meal_id', () => {
    expect(() => shareMealBody.parse({
      recipient_contact: 'test@test.com',
      share_type: 'cook_for_me',
    })).toThrow();
  });

  it('rejects missing recipient_contact', () => {
    expect(() => shareMealBody.parse({
      meal_id: VALID_UUID,
      share_type: 'cook_for_me',
    })).toThrow();
  });

  it('rejects missing share_type', () => {
    expect(() => shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: 'test@test.com',
    })).toThrow();
  });

  it('rejects invalid share_type', () => {
    expect(() => shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: 'test@test.com',
      share_type: 'invalid_type',
    })).toThrow();
  });

  it('rejects invalid meal_source', () => {
    expect(() => shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: 'test@test.com',
      share_type: 'cook_for_me',
      meal_source: 'invalid',
    })).toThrow();
  });

  it('rejects empty recipient_contact', () => {
    expect(() => shareMealBody.parse({
      meal_id: VALID_UUID,
      recipient_contact: '',
      share_type: 'cook_for_me',
    })).toThrow();
  });
});

describe('shareRespondParams', () => {
  it('accepts a valid token string', () => {
    const result = shareRespondParams.parse({ token: 'abc-123-def' });
    expect(result.token).toBe('abc-123-def');
  });

  it('rejects empty token', () => {
    expect(() => shareRespondParams.parse({ token: '' })).toThrow();
  });

  it('rejects missing token', () => {
    expect(() => shareRespondParams.parse({})).toThrow();
  });
});

describe('shareRespondQuery', () => {
  it('accepts "accept"', () => {
    const result = shareRespondQuery.parse({ action: 'accept' });
    expect(result.action).toBe('accept');
  });

  it('accepts "decline"', () => {
    const result = shareRespondQuery.parse({ action: 'decline' });
    expect(result.action).toBe('decline');
  });

  it('rejects invalid action', () => {
    expect(() => shareRespondQuery.parse({ action: 'maybe' })).toThrow();
  });

  it('rejects missing action', () => {
    expect(() => shareRespondQuery.parse({})).toThrow();
  });
});

describe('sharePlanBody', () => {
  it('accepts valid input', () => {
    const result = sharePlanBody.parse({
      plan_token: 'test-plan-token',
      recipient_name: 'Bob',
      recipient_contact: 'bob@example.com',
    });
    expect(result.planToken).toBe('test-plan-token');
    expect(result.recipientName).toBe('Bob');
    expect(result.recipientContact).toBe('bob@example.com');
  });

  it('transforms snake_case to camelCase', () => {
    const result = sharePlanBody.parse({
      plan_token: 'tok-123',
      recipient_contact: '+14165551234',
    });
    expect(result.planToken).toBe('tok-123');
    expect(result.recipientContact).toBe('+14165551234');
    expect((result as Record<string, unknown>).plan_token).toBeUndefined();
    expect((result as Record<string, unknown>).recipient_contact).toBeUndefined();
  });

  it('sets recipientName to null when omitted', () => {
    const result = sharePlanBody.parse({
      plan_token: 'tok-123',
      recipient_contact: 'test@test.com',
    });
    expect(result.recipientName).toBeNull();
  });

  it('rejects missing plan_token', () => {
    expect(() => sharePlanBody.parse({
      recipient_contact: 'test@test.com',
    })).toThrow();
  });

  it('rejects missing recipient_contact', () => {
    expect(() => sharePlanBody.parse({
      plan_token: 'tok-123',
    })).toThrow();
  });

  it('rejects empty plan_token', () => {
    expect(() => sharePlanBody.parse({
      plan_token: '',
      recipient_contact: 'test@test.com',
    })).toThrow();
  });

  it('rejects empty recipient_contact', () => {
    expect(() => sharePlanBody.parse({
      plan_token: 'tok-123',
      recipient_contact: '',
    })).toThrow();
  });
});
