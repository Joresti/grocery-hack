import { Router } from 'express';
import { logger } from '../lib/logger.js';
import { insertEvent, hasEvent, insertPublicEvent } from '../db/queries/events.js';
import { requireAuth } from '../middleware/auth.js';
import { trackEventsBody, publicEventBody } from '../schemas/events.js';
import { throwBadRequest } from '../middleware/errorHandler.js';

const router = Router();

// 1x1 transparent GIF
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// UUID v4 regex for basic validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /pixel — Email open tracking
 * Query params: token (required), user (required UUID)
 */
router.get('/pixel', (req, res) => {
  const token = req.query.token as string | undefined;
  const user = req.query.user as string | undefined;

  // Always return the pixel, even if params are bad
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (!token || !user || !UUID_RE.test(user)) {
    res.send(PIXEL_GIF);
    return;
  }

  // Fire-and-forget: insert event, deduplicated
  const metadata = { token };
  hasEvent(user, 'email_opened', metadata)
    .then((exists) => {
      if (!exists) {
        return insertEvent(user, null, 'email_opened', metadata);
      }
    })
    .catch((err: unknown) => {
      logger.error('Failed to track email open', {
        error: err instanceof Error ? err.message : String(err),
        userId: user,
      });
    });

  res.send(PIXEL_GIF);
});

/**
 * GET /r — Click redirect tracking
 * Query params: url (required), token (required), user (required UUID)
 */
router.get('/r', (req, res) => {
  const url = req.query.url as string | undefined;
  const token = req.query.token as string | undefined;
  const user = req.query.user as string | undefined;

  // Validate URL to prevent open redirect
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    res.status(400).json({
      error: true,
      code: 'INVALID_REDIRECT_URL',
      message: 'Invalid or missing redirect URL.',
    });
    return;
  }

  if (token && user && UUID_RE.test(user)) {
    // Fire-and-forget: insert event, deduplicated
    const metadata = { token, link_target: url };
    hasEvent(user, 'email_clicked', metadata)
      .then((exists) => {
        if (!exists) {
          return insertEvent(user, null, 'email_clicked', metadata);
        }
      })
      .catch((err: unknown) => {
        logger.error('Failed to track email click', {
          error: err instanceof Error ? err.message : String(err),
          userId: user,
        });
      });
  }

  res.redirect(302, url);
});

/**
 * POST / — Authenticated analytics event tracking
 * Accepts a single event or a batch of up to 100 events.
 */
router.post('/',
  requireAuth,
  async (req, res, next) => {
    try {
      const result = trackEventsBody.safeParse(req.body);
      if (!result.success) {
        throwBadRequest('INVALID_EVENT_TYPE', 'Invalid event type.');
      }

      const userId = req.user!.userId;
      const parsed = result.data;

      // Normalise to array
      const events = 'events' in parsed ? parsed.events : [parsed];

      const inserts = events.map((e) =>
        insertEvent(userId, e.session_id ?? null, e.event_type, e.metadata),
      );

      await Promise.all(inserts);
      res.json({ received: events.length });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /public — Unauthenticated public event tracking
 * Only allows share-related event types.
 */
router.post('/public',
  async (req, res, next) => {
    try {
      const result = publicEventBody.safeParse(req.body);
      if (!result.success) {
        // Determine which field failed to provide the right error code
        const firstIssue = result.error.issues[0];
        const path = firstIssue?.path.join('.') ?? '';

        if (path === 'metadata') {
          throwBadRequest('INVALID_EVENT_TOKEN', 'Invalid or missing token.');
        }
        throwBadRequest('INVALID_PUBLIC_EVENT', 'Invalid event. Only share and view events are allowed.');
      }

      const { event_type, metadata } = result.data;

      await insertPublicEvent(event_type, metadata);
      res.json({ received: 1 });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
