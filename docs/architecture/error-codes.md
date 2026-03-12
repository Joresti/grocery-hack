# Error Code Catalog

Every API error response uses this shape — no exceptions:

```json
{"error": true, "code": "MACHINE_READABLE_CODE", "message": "Human-readable message."}
```

Codes are **SCREAMING_SNAKE_CASE**. Messages are plain English, safe to show to users. Never include stack traces, SQL, or internal details in `message`.

---

## Global Errors

These can be returned by any endpoint.

| Code | HTTP | Message | When |
|------|------|---------|------|
| `UNAUTHORIZED` | 401 | "Authentication required." | No token, expired token, or malformed token. |
| `TOKEN_EXPIRED` | 401 | "Your session has expired. Please sign in again." | JWT access token past its TTL. |
| `FORBIDDEN` | 403 | "You don't have permission to do that." | Valid token but insufficient role (e.g. non-admin hitting admin endpoint). |
| `NOT_FOUND` | 404 | "Resource not found." | Generic 404. Use specific codes below when possible. |
| `VALIDATION_ERROR` | 400 | "Invalid request: {zod error detail}." | Zod validation failed. `message` includes the first failing field. |
| `RATE_LIMIT_EXCEEDED` | 429 | "Too many requests. Please wait a moment." | IP or user rate limit exceeded. |
| `INTERNAL_ERROR` | 500 | "Something went wrong. Please try again." | Unhandled exception. Log full error server-side, never expose. |
| `SPEND_LIMIT_REACHED` | 503 | "We've hit our processing limit for today — please try again tomorrow." | Any paid external API (Claude, Twilio, email, geocode) at 100% budget. |

---

## Auth (`/auth/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `EMAIL_ALREADY_EXISTS` | 409 | POST /auth/register | "An account with this email already exists." | Registration with duplicate email. |
| `INVALID_CREDENTIALS` | 401 | POST /auth/login | "Invalid email or password." | Wrong email/password combo. Never reveal which field is wrong. |
| `INVALID_REFRESH_TOKEN` | 401 | POST /auth/refresh | "Invalid or expired refresh token." | Refresh token is malformed, expired, or revoked. |
| `RESET_TOKEN_INVALID` | 400 | POST /auth/reset-password | "This reset link is invalid or has expired." | Token doesn't exist, already used, or past 1-hour TTL. |
| `WEAK_PASSWORD` | 400 | POST /auth/register, /auth/reset-password | "Password must be at least 8 characters." | Password doesn't meet minimum requirements. |
| `INVALID_EMAIL` | 400 | POST /auth/register | "Please enter a valid email address." | Email format validation failed. |
| `INVALID_POSTAL_CODE` | 400 | POST /auth/register | "Please enter a valid postal code or zip code." | Postal/zip code format unrecognized. |

---

## Users (`/users/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `INVALID_BUDGET` | 400 | PATCH /users/me | "Budget must be a positive number." | Budget <= 0 or not a number. |
| `INVALID_HOUSEHOLD_SIZE` | 400 | PATCH /users/me | "Household size must be between 1 and 12." | Out of range. |
| `INVALID_MAX_STORES` | 400 | PATCH /users/me | "Max stores must be 1 or 2." | Value other than 1 or 2. |

---

## Stores (`/stores/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `NO_NEARBY_STORES` | 404 | GET /stores/nearby | "No stores found near that location." | Haversine query returned 0 results within radius. |
| `GEOCODE_FAILED` | 400 | GET /stores/nearby | "Couldn't determine location from that postal code." | Geocoding the provided postal code returned no results. |

---

## Deals (`/deals/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `NO_ACTIVE_DEALS` | 404 | GET /deals | "No active deals found for those stores." | No deals match the filters + date range. |
| `STORE_BRAND_NOT_FOUND` | 404 | GET /deals | "Store brand not found." | `store_brand_id` filter references a nonexistent brand. |

---

## Meals (`/meals/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `MEAL_NOT_FOUND` | 404 | GET /meals/{meal_id} | "Meal not found." | No meal with that ID. |
| `ALREADY_SWIPED` | 409 | POST /meals/{meal_id}/swipe | "You've already swiped on this meal." | Duplicate swipe attempt. |
| `INVALID_MEAL_ID` | 400 | POST /meals/{meal_id}/swipe | "Invalid meal ID." | Malformed UUID in path. |

---

## User Recipes (`/recipes/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `RECIPE_NOT_FOUND` | 404 | GET/PATCH/DELETE /recipes/{recipe_id} | "Recipe not found." | No recipe with that ID, or it belongs to another user. |
| `RECIPE_NAME_REQUIRED` | 400 | POST /recipes | "Recipe name is required." | Missing name field. |
| `RECIPE_INGREDIENTS_REQUIRED` | 400 | POST /recipes | "At least one ingredient is required." | Empty ingredients array. |
| `RECIPE_NOT_OWNER` | 403 | PATCH/DELETE /recipes/{recipe_id}, GET /recipes/{recipe_id}/stats | "You can only access your own recipes." | Recipe belongs to different user. |

---

## Deal Watchlist (`/watchlist/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `DEAL_NOT_FOUND` | 404 | POST /watchlist | "Deal not found." | `deal_id` references a nonexistent or expired deal. |
| `WATCHLIST_ITEM_NOT_FOUND` | 404 | DELETE /watchlist/{id} | "Watchlist item not found." | No watchlist entry with that ID for this user. |

---

## Important Items (`/important-items/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `ITEM_NOT_FOUND` | 404 | PATCH /important-items/{item_id} | "Item not found." | No important item with that ID for this user. |
| `ITEM_NAME_REQUIRED` | 400 | POST /important-items | "Item name is required." | Missing or empty name. |
| `DUPLICATE_ITEM` | 409 | POST /important-items | "You already have this item. It's been reactivated." | Item with same name exists — server reactivates it and returns 200 instead. This 409 is only if the item is already active. |

---

## Optimize (`/optimize`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `NO_NEARBY_STORES` | 404 | POST /optimize | "No stores found near your location." | No store locations within radius. |
| `NO_ACTIVE_DEALS` | 404 | POST /optimize | "No active deals found this week." | No current deals at nearby stores. |
| `NO_LIKED_MEALS` | 400 | POST /optimize | "Like some meals first so we can build your plan." | User has zero liked meals — nothing to optimize. |
| `OPTIMIZATION_FAILED` | 500 | POST /optimize | "Something went wrong building your plan. Please try again." | Code-based optimizer hit an unexpected error. |

---

## Weekly Plans (`/plans/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `PLAN_NOT_FOUND` | 404 | GET /plans/{token} | "Plan not found or link has expired." | Invalid token. |

---

## Flyer Requests (`/flyer-requests/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `INVALID_FLYER_URL` | 400 | POST /flyer-requests | "Please enter a valid URL." | URL format validation failed. |
| `DUPLICATE_FLYER_REQUEST` | 409 | POST /flyer-requests | "This flyer URL has already been submitted." | Same URL already in the requests table. |

---

## Sharing (`/share/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `INVALID_CONTACT` | 400 | POST /share/meal, /share/plan | "Please enter a valid email address or phone number." | Contact isn't a valid email or phone. |
| `MEAL_NOT_FOUND` | 404 | POST /share/meal | "Meal not found." | `meal_id` doesn't exist. |
| `PLAN_NOT_FOUND` | 404 | POST /share/plan | "Plan not found." | `plan_token` doesn't exist. |
| `SHARE_NOT_FOUND` | 404 | GET /share/{token}/respond | "This share link is invalid." | Token doesn't match any meal_shares record. |
| `SHARE_EXPIRED` | 410 | GET /share/{token}/respond | "This share request has expired." | Share is past `expires_at` or status is `expired`. |
| `SHARE_ALREADY_RESPONDED` | 409 | GET /share/{token}/respond | "This request has already been responded to." | Status is `accepted` or `declined` (not `pending`). |
| `INVALID_SHARE_ACTION` | 400 | GET /share/{token}/respond | "Invalid action. Use accept or decline." | `action` query param is not `accept` or `decline`. |
| `SMS_SEND_FAILED` | 502 | POST /share/meal, /share/plan | "Couldn't send the text message. Please try again." | Twilio API error. |
| `EMAIL_SEND_FAILED` | 502 | POST /share/meal, /share/plan | "Couldn't send the email. Please try again." | Email provider error. |

---

## Events (`/events/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `INVALID_EVENT_TYPE` | 400 | POST /events, /events/public | "Invalid event type." | Unknown event_type string. |
| `INVALID_PUBLIC_EVENT` | 400 | POST /events/public | "Invalid event. Only share and view events are allowed." | event_type not in allowed public set. |
| `INVALID_EVENT_TOKEN` | 400 | POST /events/public | "Invalid or missing token." | metadata.token doesn't match a real plan/share. |

---

## Admin (`/admin/*`)

| Code | HTTP | Endpoint | Message | When |
|------|------|----------|---------|------|
| `ADMIN_REQUIRED` | 403 | GET /admin/trial-metrics | "Admin access required." | Non-admin user. |

---

## Implementation Notes

### Error handling middleware

All routes throw typed errors. A single Express error handler catches them:

```typescript
interface AppError {
  code: string;       // from this catalog
  status: number;     // HTTP status
  message: string;    // user-facing
}

function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const status = err.status ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = status === 500
    ? 'Something went wrong. Please try again.'
    : err.message;

  // Log full error server-side (including stack for 500s)
  if (status >= 500) {
    logger.error({ err, req: { method: req.method, path: req.path } });
  }

  res.status(status).json({ error: true, code, message });
}
```

### Throw helpers

```typescript
function throwNotFound(code: string, message: string): never {
  throw { code, status: 404, message };
}

function throwBadRequest(code: string, message: string): never {
  throw { code, status: 400, message };
}

function throwConflict(code: string, message: string): never {
  throw { code, status: 409, message };
}

function throwForbidden(code: string, message: string): never {
  throw { code, status: 403, message };
}
```

### Zod validation errors

Zod errors are caught in validation middleware and mapped to `VALIDATION_ERROR`:

```typescript
function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw {
        code: 'VALIDATION_ERROR',
        status: 400,
        message: `Invalid request: ${firstIssue.path.join('.')} ${firstIssue.message}`,
      };
    }
    req.body = result.data;
    next();
  };
}
```

### Spend limit errors

Spend limit checks happen in a shared utility. The error code is always `SPEND_LIMIT_REACHED` regardless of which service hit the cap:

```typescript
async function checkSpendLimit(service: string, userId: string | null): Promise<void> {
  const usage = await getUsage(service, userId);
  if (usage.percentage >= 100) {
    throw {
      code: 'SPEND_LIMIT_REACHED',
      status: 503,
      message: "We've hit our processing limit for today — please try again tomorrow.",
    };
  }
  if (usage.percentage >= 80) {
    logger.warn({ service, usage }, 'Approaching spend limit');
  }
}
```
