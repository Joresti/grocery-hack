import { describe, it, expect } from 'vitest';
import { trackEventsBody, publicEventBody } from './events.js';

describe('trackEventsBody', () => {
  it('accepts a valid single event', () => {
    const result = trackEventsBody.parse({
      event_type: 'page_view',
      metadata: { section: 'home' },
      session_id: 'sess-123',
    });
    expect(result).toEqual({
      event_type: 'page_view',
      metadata: { section: 'home' },
      session_id: 'sess-123',
    });
  });

  it('accepts a single event with only event_type', () => {
    const result = trackEventsBody.parse({
      event_type: 'session_start',
    });
    expect(result).toEqual({
      event_type: 'session_start',
      metadata: {},
    });
  });

  it('accepts a valid batch of events', () => {
    const result = trackEventsBody.parse({
      events: [
        { event_type: 'page_view', metadata: { section: 'home' } },
        { event_type: 'meal_swiped_right', metadata: { meal_id: '123' } },
      ],
    });
    expect('events' in result).toBe(true);
    if ('events' in result) {
      expect(result.events).toHaveLength(2);
      expect(result.events[0]?.event_type).toBe('page_view');
      expect(result.events[1]?.event_type).toBe('meal_swiped_right');
    }
  });

  it('rejects an unknown event type', () => {
    const result = trackEventsBody.safeParse({
      event_type: 'totally_fake_event',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty batch', () => {
    const result = trackEventsBody.safeParse({
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a batch exceeding 100 events', () => {
    const events = Array.from({ length: 101 }, () => ({
      event_type: 'page_view' as const,
    }));
    const result = trackEventsBody.safeParse({ events });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 100 events in a batch', () => {
    const events = Array.from({ length: 100 }, () => ({
      event_type: 'page_view' as const,
    }));
    const result = trackEventsBody.safeParse({ events });
    expect(result.success).toBe(true);
  });

  it('rejects a batch with one invalid event type', () => {
    const result = trackEventsBody.safeParse({
      events: [
        { event_type: 'page_view' },
        { event_type: 'not_a_real_event' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('defaults metadata to empty object when omitted', () => {
    const result = trackEventsBody.parse({
      event_type: 'swipe_mode_entered',
    });
    expect(result).toHaveProperty('metadata');
    expect((result as { metadata: Record<string, unknown> }).metadata).toEqual({});
  });

  it('accepts a single event with created_at', () => {
    const result = trackEventsBody.parse({
      event_type: 'deal_hearted',
      created_at: '2026-03-13T12:00:00Z',
    });
    expect((result as { created_at?: string }).created_at).toBe('2026-03-13T12:00:00Z');
  });

  it('accepts all known pipeline event types', () => {
    const pipelineTypes = [
      'pipeline_scraper_completed',
      'pipeline_planner_completed',
      'pipeline_planner_user_skipped',
      'pipeline_spend_limit_hit',
    ] as const;
    for (const eventType of pipelineTypes) {
      const result = trackEventsBody.safeParse({ event_type: eventType });
      expect(result.success).toBe(true);
    }
  });
});

describe('publicEventBody', () => {
  it('accepts a valid share_link_opened event', () => {
    const result = publicEventBody.parse({
      event_type: 'share_link_opened',
      metadata: { token: 'abc-123', share_type: 'meal' },
    });
    expect(result.event_type).toBe('share_link_opened');
    expect(result.metadata.token).toBe('abc-123');
  });

  it('accepts share_recipient_signed_up', () => {
    const result = publicEventBody.parse({
      event_type: 'share_recipient_signed_up',
      metadata: { token: 'tok-456', referrer_user_id: 'user-1' },
    });
    expect(result.event_type).toBe('share_recipient_signed_up');
  });

  it('accepts shared_plan_viewed', () => {
    const result = publicEventBody.parse({
      event_type: 'shared_plan_viewed',
      metadata: { token: 'plan-tok-789', plan_token: 'plan-1' },
    });
    expect(result.event_type).toBe('shared_plan_viewed');
  });

  it('rejects a non-public event type', () => {
    const result = publicEventBody.safeParse({
      event_type: 'page_view',
      metadata: { token: 'abc' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when metadata is missing token', () => {
    const result = publicEventBody.safeParse({
      event_type: 'share_link_opened',
      metadata: { share_type: 'meal' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when token is empty string', () => {
    const result = publicEventBody.safeParse({
      event_type: 'share_link_opened',
      metadata: { token: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when token is not a string', () => {
    const result = publicEventBody.safeParse({
      event_type: 'share_link_opened',
      metadata: { token: 42 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects when metadata is missing entirely', () => {
    const result = publicEventBody.safeParse({
      event_type: 'share_link_opened',
    });
    expect(result.success).toBe(false);
  });

  it('rejects meal_swiped_right as public event', () => {
    const result = publicEventBody.safeParse({
      event_type: 'meal_swiped_right',
      metadata: { token: 'abc' },
    });
    expect(result.success).toBe(false);
  });
});
