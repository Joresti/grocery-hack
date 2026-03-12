# Check Spend

Show current usage vs limits for all paid external services.

## Instructions

1. **Read the spend limit configuration:**
   - `docs/architecture/env-spec.md` — all limit variables and their defaults
   - `schema.sql` — the `usage_tracking` table structure (table 13)

2. **Query the database** for current usage across all services:

   ```sql
   -- Current month's usage by service (system-wide)
   SELECT
     service,
     SUM(request_count) AS total_requests,
     SUM(estimated_cost) AS total_cost_usd
   FROM usage_tracking
   WHERE period = 'monthly'
     AND period_key = to_char(now(), 'YYYY-MM')
     AND user_id IS NULL
   GROUP BY service;

   -- Today's usage by service (per-user breakdown)
   SELECT
     service,
     user_id,
     request_count,
     estimated_cost
   FROM usage_tracking
   WHERE period = 'daily'
     AND period_key = to_char(now(), 'YYYY-MM-DD')
   ORDER BY service, estimated_cost DESC;

   -- Top users by spend this month
   SELECT
     u.display_name,
     u.email,
     ut.service,
     SUM(ut.request_count) AS requests,
     SUM(ut.estimated_cost) AS cost_usd
   FROM usage_tracking ut
   JOIN users u ON ut.user_id = u.id
   WHERE ut.period = 'monthly'
     AND ut.period_key = to_char(now(), 'YYYY-MM')
   GROUP BY u.display_name, u.email, ut.service
   ORDER BY cost_usd DESC
   LIMIT 10;
   ```

3. **Compare against limits** from env vars (or defaults from env-spec.md):

   | Service | Limit Variable | Default |
   |---------|----------------|---------|
   | Claude API | `CLAUDE_MONTHLY_BUDGET_USD` | $25/month |
   | Claude per pipeline | `CLAUDE_MAX_REQUESTS_PER_PIPELINE_RUN` | 100/run |
   | Claude per user | `CLAUDE_MAX_REQUESTS_PER_USER_PER_DAY` | 5/day |
   | Twilio SMS | `TWILIO_MONTHLY_SMS_LIMIT` | 500/month |
   | Twilio per user | `TWILIO_MAX_SMS_PER_USER_PER_DAY` | 10/day |
   | Email | `EMAIL_MONTHLY_LIMIT` | 3000/month |
   | Email per user | `EMAIL_MAX_PER_USER_PER_DAY` | 20/day |
   | Geocoding | `GEOCODE_DAILY_LIMIT` | 50/day |

4. **Output the report:**

   ```
   ## Spend Report — {YYYY-MM-DD}

   ### Monthly Totals
   | Service  | Used     | Limit    | %    | Status |
   |----------|----------|----------|------|--------|
   | Claude   | $X.XX    | $25.00   | XX%  | OK/WARNING/BLOCKED |
   | Twilio   | XXX SMS  | 500 SMS  | XX%  | OK/WARNING/BLOCKED |
   | Email    | XXX      | 3000     | XX%  | OK/WARNING/BLOCKED |
   | Geocode  | XX today | 50/day   | XX%  | OK/WARNING/BLOCKED |

   ### Today's Usage
   | Service  | Requests | Cost     |
   |----------|----------|----------|
   | Claude   | XX       | $X.XX    |
   | Twilio   | XX       | $X.XX    |
   | Email    | XX       | $X.XX    |

   ### Top Users (this month)
   | User     | Service  | Requests | Cost     |
   |----------|----------|----------|----------|
   | {name}   | Claude   | XX       | $X.XX    |
   ...

   ### Warnings
   - {any services at 80%+ usage}
   ```

   Status thresholds:
   - `OK` = under 80%
   - `WARNING` = 80-99%
   - `BLOCKED` = 100%+

5. **If no database is available** (connection fails), report that the usage_tracking table couldn't be queried and show just the configured limits from env vars.

6. **Do not modify any data.** This is a read-only command.
