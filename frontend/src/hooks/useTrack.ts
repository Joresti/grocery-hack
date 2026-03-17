import { useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { EventType, TrackEventPayload } from '@groceryhack/shared/types';

const FLUSH_INTERVAL_MS = 5000;
const BASE_URL = '/api/v1';

export function useTrack() {
  const queueRef = useRef<TrackEventPayload[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    if (queueRef.current.length === 0) {
      return;
    }
    const events = [...queueRef.current];
    queueRef.current = [];
    try {
      const snakeEvents = events.map((e) => ({
        event_type: e.eventType,
        metadata: e.metadata,
        session_id: e.sessionId,
        created_at: e.createdAt,
      }));
      await api.post('/events', { events: snakeEvents });
    } catch {
      // Re-queue events on failure so they aren't lost
      queueRef.current = [...events, ...queueRef.current];
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    const handleBeforeUnload = (): void => {
      if (queueRef.current.length === 0) {
        return;
      }
      const snakeEvents = queueRef.current.map((e) => ({
        event_type: e.eventType,
        metadata: e.metadata,
        session_id: e.sessionId,
        created_at: e.createdAt,
      }));
      const payload = JSON.stringify({ events: snakeEvents });
      navigator.sendBeacon(`${BASE_URL}/events`, new Blob([payload], { type: 'application/json' }));
      queueRef.current = [];
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Flush remaining events on unmount
      void flush();
    };
  }, [flush]);

  const track = useCallback(
    (eventType: EventType, metadata?: Record<string, unknown>): void => {
      const event: TrackEventPayload = {
        eventType,
        metadata,
        createdAt: new Date().toISOString(),
      };
      queueRef.current.push(event);
    },
    []
  );

  return { track };
}
