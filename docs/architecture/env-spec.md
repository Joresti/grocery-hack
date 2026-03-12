# GroceryHack — Environment Variables

All environment variables required by the backend and pipelines. Frontend has no env vars — it talks to the backend API only.

**Current phase: local development.** Production values are documented but everything runs locally for now.

---

## App

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development`, `production`, `test` |
| `PORT` | Yes | `3000` | Backend API server port |
| `APP_URL` | Yes | `http://localhost:3000` | Public base URL. Used for plan share links (`/plans/{token}`), email CTAs, calendar links. No trailing slash. |
| `JWT_SECRET` | Yes | `(random 64-char hex)` | Secret for signing access tokens. Generate with `openssl rand -hex 32`. |
| `JWT_REFRESH_SECRET` | Yes | `(random 64-char hex)` | Secret for signing refresh tokens. Must differ from `JWT_SECRET`. |
| `JWT_EXPIRY` | No | `15m` | Access token TTL. Default: `15m`. |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token TTL. Default: `7d`. |

---

## Database

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/groceryhack` | Full Postgres connection string. Must be PostgreSQL 15+. |
| `DATABASE_POOL_MAX` | No | `20` | Max connections in pg pool. Default: `10`. |
| `DATABASE_SSL` | No | `false` | Require SSL for database connection. Default: `false` locally, `true` in production. |

---

## Anthropic (Claude API)

Used by both pipelines (scraper + planner).

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | `sk-ant-...` | API key from console.anthropic.com. |
| `CLAUDE_SCRAPER_MODEL` | No | `claude-haiku-4-5-20251001` | Model for flyer scraping pipeline. Default: `claude-haiku-4-5-20251001`. |
| `CLAUDE_PLANNER_MODEL` | No | `claude-sonnet-4-5-20250929` | Model for plan generation + recipe import. Default: `claude-sonnet-4-5-20250929`. |

---

## Stripe

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | Yes | `sk_test_...` | Stripe secret key. Use test key in development. |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_...` | Webhook signing secret for verifying Stripe events. |
| `STRIPE_PRICE_ID` | Yes | `price_...` | Price ID for the $4/month subscription product. |

---

## Email

Using Resend (recommended for MVP) or AWS SES.

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER` | Yes | `resend` | `resend` or `ses`. |
| `EMAIL_FROM` | Yes | `GroceryHack <plans@groceryhack.com>` | Sender address for all outbound email. |
| `RESEND_API_KEY` | If Resend | `re_...` | Resend API key. Required when `EMAIL_PROVIDER=resend`. |
| `AWS_SES_REGION` | If SES | `us-east-1` | AWS region for SES. Required when `EMAIL_PROVIDER=ses`. |
| `AWS_SES_ACCESS_KEY_ID` | If SES | `AKIA...` | AWS access key. Required when `EMAIL_PROVIDER=ses`. |
| `AWS_SES_SECRET_ACCESS_KEY` | If SES | `(secret)` | AWS secret key. Required when `EMAIL_PROVIDER=ses`. |

---

## SMS (Twilio)

Used for sharing meals, plans, and important items via text.

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | `AC...` | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Yes | `(token)` | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | Yes | `+16475551234` | Twilio phone number for outbound SMS. Canadian number preferred. |

---

## Geocoding

One-time geocode when a store is added. Free tier is sufficient.

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `GEOCODE_PROVIDER` | Yes | `opencage` | `opencage` or `nominatim`. |
| `OPENCAGE_API_KEY` | If OpenCage | `(key)` | OpenCage API key. Required when `GEOCODE_PROVIDER=opencage`. |
| `NOMINATIM_USER_AGENT` | If Nominatim | `groceryhack/1.0` | User-Agent string for Nominatim requests (required by their ToS). Required when `GEOCODE_PROVIDER=nominatim`. |

---

## Pipeline Schedule

Cron expressions for the two background pipelines.

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `SCRAPER_CRON` | No | `0 22 * * 2` | Flyer scraper schedule. Default: Tuesday 10pm local. |
| `PLANNER_CRON` | No | `0 6 * * 3` | Plan generation schedule. Default: Wednesday 6am local. |
| `PIPELINE_TIMEZONE` | No | `America/Toronto` | Timezone for cron schedules. Default: `America/Toronto`. |

---

## Spend Limits & Rate Controls

Hard caps to prevent overbilling. The backend must enforce these — never rely on provider-side limits alone.

### How It Works

All external API usage is tracked in the `usage_tracking` table (`schema.sql`, table 13). Every call to a paid service follows this flow:

1. **Before the call:** Query `usage_tracking` for the current period's `request_count` and `estimated_cost`
2. **Check global limit:** Compare system-wide totals (rows where `user_id IS NULL`) against the monthly/daily cap
3. **Check per-user limit:** Compare user-specific totals against the per-user-per-day cap
4. **At 80%:** Log a warning (`USAGE_WARNING` level) with service name, current count, and limit
5. **At 100%:** Refuse the call. Return error code `SPEND_LIMIT_REACHED` with a user-friendly message
6. **After a successful call:** Upsert the counter — increment `request_count` by 1, add the estimated cost to `estimated_cost`

**Period keys:** Monthly limits use `YYYY-MM` (e.g., `2026-03`). Daily limits use `YYYY-MM-DD` (e.g., `2026-03-10`).

**System-wide vs per-user:** Global limits (monthly budget, pipeline caps) use `user_id = NULL`. Per-user limits use the authenticated user's ID.

**Pipelines:** When a pipeline run hits the cap mid-execution, it must:
- Stop making further calls to that service
- Log which users were skipped (user ID + reason)
- Continue processing users that don't require the capped service (if possible)
- Skipped users should be retried on the next pipeline run

**User-facing errors:** When a user action is blocked by a spend limit, return:
```json
{"error": true, "code": "SPEND_LIMIT_REACHED", "message": "We've hit our processing limit for today — please try again tomorrow."}
```

**Cost estimation:** Claude API costs are estimated per-call using input/output token counts from the response. Twilio and email costs use fixed per-message estimates ($0.0075/SMS, $0.001/email). Geocoding is free but capped for safety.

### Claude API Limits

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAUDE_MONTHLY_BUDGET_USD` | No | `25` | Hard cap on total Claude API spend per calendar month. Tracked via `estimated_cost` on system-wide rows. |
| `CLAUDE_MAX_REQUESTS_PER_PIPELINE_RUN` | No | `100` | Max Claude API calls per single pipeline execution (scraper or planner). Tracked in-memory per run, not in the table. |
| `CLAUDE_MAX_REQUESTS_PER_USER_PER_DAY` | No | `5` | Max Claude calls triggered by a single user per day (optimizer). |

### Twilio (SMS) Limits

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWILIO_MONTHLY_SMS_LIMIT` | No | `500` | Max outbound SMS per month. At ~$0.0075/text, this caps spend at ~$3.75/month. |
| `TWILIO_MAX_SMS_PER_USER_PER_DAY` | No | `10` | Max SMS a single user can trigger per day. Prevents sharing spam. |

### Email Limits

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_MONTHLY_LIMIT` | No | `3000` | Max outbound emails per month. Resend free tier is 3K/month — stay within it. |
| `EMAIL_MAX_PER_USER_PER_DAY` | No | `20` | Max emails a single user can trigger per day. |

### Geocoding Limits

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEOCODE_DAILY_LIMIT` | No | `50` | Max geocode requests per day. OpenCage free tier is 2,500/day — this is a safety margin since geocoding is one-time per store. |

### Stripe

No spend limit needed — Stripe charges users, not us. But protect against webhook replay:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_WEBHOOK_TOLERANCE_SEC` | No | `300` | Max age in seconds for webhook event signatures. Default: 5 minutes. |

### General API Rate Limiting

IP-based rate limiting on all endpoints, independent of spend tracking.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms. Default: 1 minute. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `60` | Max requests per IP per window. Default: 60/minute. |
| `RATE_LIMIT_AUTH_MULTIPLIER` | No | `2` | Authenticated users get this multiplier on the base limit (120/min default). |

---

## NOT MVP (do not configure yet)

These are documented for future reference. Do not implement.

| Variable | Phase | Description |
|----------|-------|-------------|
| `FIREBASE_PROJECT_ID` | v1 | Firebase project for push notifications |
| `FIREBASE_SERVICE_ACCOUNT` | v1 | Path to Firebase service account JSON |
| `APNS_KEY_ID` | v1 | APNs key for iOS push |
| `APNS_TEAM_ID` | v1 | Apple team ID |
| `APNS_KEY_PATH` | v1 | Path to APNs .p8 key file |

---

## .env.example

```bash
# ── App ──────────────────────────────────────────
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
JWT_SECRET=
JWT_REFRESH_SECRET=

# ── Database ─────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/groceryhack

# ── Anthropic ────────────────────────────────────
ANTHROPIC_API_KEY=
# CLAUDE_SCRAPER_MODEL=claude-haiku-4-5-20251001
# CLAUDE_PLANNER_MODEL=claude-sonnet-4-5-20250929

# ── Stripe ───────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# ── Email ────────────────────────────────────────
EMAIL_PROVIDER=resend
EMAIL_FROM=GroceryHack <plans@localhost>
RESEND_API_KEY=

# ── SMS ──────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ── Geocoding ────────────────────────────────────
GEOCODE_PROVIDER=opencage
OPENCAGE_API_KEY=

# ── Pipelines ────────────────────────────────────
# SCRAPER_CRON=0 22 * * 2
# PLANNER_CRON=0 6 * * 3
# PIPELINE_TIMEZONE=America/Toronto

# ── Spend Limits ─────────────────────────────────
CLAUDE_MONTHLY_BUDGET_USD=25
CLAUDE_MAX_REQUESTS_PER_PIPELINE_RUN=100
CLAUDE_MAX_REQUESTS_PER_USER_PER_DAY=5
TWILIO_MONTHLY_SMS_LIMIT=500
TWILIO_MAX_SMS_PER_USER_PER_DAY=10
EMAIL_MONTHLY_LIMIT=3000
EMAIL_MAX_PER_USER_PER_DAY=20
GEOCODE_DAILY_LIMIT=50

# ── Rate Limiting ────────────────────────────────
# RATE_LIMIT_WINDOW_MS=60000
# RATE_LIMIT_MAX_REQUESTS=60
# RATE_LIMIT_AUTH_MULTIPLIER=2
```
