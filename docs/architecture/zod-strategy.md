# Zod Schema Strategy

## Problem

We have three places that define "what data looks like":
1. `schema.sql` — database columns (snake_case)
2. `api-contract.yaml` — API request/response shapes (snake_case JSON)
3. `packages/shared/types.ts` — TypeScript interfaces (camelCase)

Without a strategy, we'd maintain Zod schemas as a fourth parallel definition. Instead, Zod schemas should be the **single runtime authority** for request validation, with TypeScript types inferred from them.

## Rules

### Request bodies: Zod is the source of truth

Every API request body has a Zod schema. The TypeScript type is **inferred** from the schema, never hand-written separately.

```typescript
// backend/src/schemas/auth.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  postal_code: z.string().min(3).max(10),
  display_name: z.string().optional(),
  budget: z.number().positive().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  max_stores: z.union([z.literal(1), z.literal(2)]).default(1),
  household_size: z.number().int().min(1).max(12).default(1),
});

// Infer the type — don't write a separate interface
export type RegisterInput = z.infer<typeof registerSchema>;
// { email: string; password: string; postal_code: string; ... }
```

### Response bodies: TypeScript interfaces stay in shared types

We control what the server returns — there's no untrusted input to validate. Response shapes remain as interfaces in `packages/shared/types.ts` so both frontend and backend share them.

### snake_case in, camelCase out

API requests arrive in snake_case. Zod schemas validate the snake_case input. A `.transform()` at the end of each schema converts to camelCase for the service layer.

```typescript
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  postal_code: z.string().min(3).max(10),
  display_name: z.string().optional(),
  budget: z.number().positive().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  max_stores: z.union([z.literal(1), z.literal(2)]).default(1),
  household_size: z.number().int().min(1).max(12).default(1),
}).transform(d => ({
  email: d.email,
  password: d.password,
  postalCode: d.postal_code,
  displayName: d.display_name,
  budget: d.budget,
  dietaryRestrictions: d.dietary_restrictions,
  maxStores: d.max_stores,
  householdSize: d.household_size,
}));

// After transform, the inferred type is camelCase
export type RegisterInput = z.output<typeof registerSchema>;
```

**Why not a generic `snakeToCamel` utility?** It would work at runtime but TypeScript can't infer the output type from a generic key transform. Explicit transforms give us full type safety on both sides.

### Path params and query params get schemas too

```typescript
export const mealIdParam = z.object({
  meal_id: z.string().uuid(),
}).transform(d => ({ mealId: d.meal_id }));

export const dealsQuery = z.object({
  store_brand_id: z.string().uuid().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
}).transform(d => ({
  storeBrandId: d.store_brand_id,
  category: d.category,
  search: d.search,
}));
```

## File Organization

```
backend/src/schemas/
├── auth.ts              # registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema
├── users.ts             # updateUserSchema
├── meals.ts             # mealIdParam, swipeSchema, mealsQuery
├── recipes.ts           # recipeCreateSchema, recipeIdParam, publishSchema
├── watchlist.ts         # heartDealSchema, watchlistIdParam
├── importantItems.ts    # addItemSchema, updateItemSchema, itemIdParam
├── optimize.ts          # optimizeSchema
├── deals.ts             # dealsQuery
├── flyerRequests.ts     # createFlyerRequestSchema
├── sharing.ts           # shareMealSchema, sharePlanSchema
├── events.ts            # trackEventSchema, publicEventSchema
└── index.ts             # re-exports all schemas
```

One file per API tag, matching the route files. Each exports named schemas and their inferred types.

## Validation Middleware

A single reusable middleware validates request body, params, and query against Zod schemas.

```typescript
// backend/src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        next({
          code: 'VALIDATION_ERROR',
          status: 400,
          message: `Invalid request: ${firstIssue.path.join('.')} ${firstIssue.message}`,
        });
      } else {
        next(err);
      }
    }
  };
}
```

### Usage in routes

```typescript
// backend/src/routes/auth.ts
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas/auth';
import { authService } from '../services/auth';

const router = Router();

router.post('/register',
  validate({ body: registerSchema }),
  async (req, res, next) => {
    // req.body is already validated and transformed to camelCase
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }
);

router.post('/login',
  validate({ body: loginSchema }),
  async (req, res, next) => {
    const result = await authService.login(req.body);
    res.json(result);
  }
);
```

After `validate()` runs, `req.body` is the **transformed camelCase** type. The service layer never sees snake_case.

## What About shared/types.ts Request Types?

The existing request interfaces in `packages/shared/types.ts` (`RegisterRequest`, `LoginRequest`, `OptimizeRequest`, etc.) become **redundant** once Zod schemas exist — the Zod-inferred types replace them.

**Migration plan:**
1. Create Zod schemas in `backend/src/schemas/`
2. Export inferred types from the schema files
3. Backend imports types from schemas, not from shared/types
4. Frontend continues using shared/types for response types
5. Once all routes use Zod, remove the request interfaces from shared/types and add a comment pointing to the schema files

**Frontend request types:** The frontend still needs to know request shapes for API calls. Two options:
- **Option A (simple):** Keep request interfaces in shared/types, manually kept in sync with Zod schemas. Acceptable at MVP scale (~15 endpoints).
- **Option B (strict):** Export Zod schemas from a shared package, frontend uses `z.input<>` for request shapes. Adds a shared dependency on Zod.

**Decision: Option A for MVP.** The number of request types is small enough that manual sync is fine. If they drift, the `/validate-types` skill catches it.

## Schema Catalog

Every schema needed, grouped by file:

### auth.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `registerSchema` | POST /auth/register body | email, password, postal_code, display_name?, budget?, dietary_restrictions?, max_stores?, household_size? |
| `loginSchema` | POST /auth/login body | email, password |
| `refreshSchema` | POST /auth/refresh body | refresh_token |
| `forgotPasswordSchema` | POST /auth/forgot-password body | email |
| `resetPasswordSchema` | POST /auth/reset-password body | token, new_password (min 8) |

### users.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `updateUserSchema` | PATCH /users/me body | display_name?, postal_code?, budget?, dietary_restrictions?, max_stores?, household_size?, household_members?, household_names? |

### meals.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `mealIdParam` | /meals/:meal_id param | meal_id (uuid) |
| `mealsQuery` | GET /meals query | limit? (int, max 50) |
| `swipeSchema` | POST /meals/:id/swipe body | liked (boolean) |

### recipes.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `recipeIdParam` | /recipes/:recipe_id param | recipe_id (uuid) |
| `recipeCreateSchema` | POST /recipes body | name, ingredients, tagline?, description?, instructions?, steps?, prep_time_minutes?, cook_time_minutes?, servings?, difficulty?, dietary_tags?, tips?, nutrition?, is_public? |
| `publishSchema` | POST /recipes/:id/publish body | is_public (boolean) |

### watchlist.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `heartDealSchema` | POST /watchlist body | deal_id (uuid) |
| `watchlistIdParam` | DELETE /watchlist/:id param | watchlist_id (uuid) |

### importantItems.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `addItemSchema` | POST /important-items body | name, quantity? |
| `updateItemSchema` | PATCH /important-items/:id body | name?, quantity?, is_active? |
| `itemIdParam` | /important-items/:item_id param | item_id (uuid) |

### optimize.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `optimizeSchema` | POST /optimize body | postal_code?, lat?, lng?, store_location_ids?, max_stores? |

### deals.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `dealsQuery` | GET /deals query | store_brand_id?, category?, search? |

### flyerRequests.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `createFlyerRequestSchema` | POST /flyer-requests body | flyer_url (url), store_name? |

### sharing.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `shareMealSchema` | POST /share/meal body | meal_id (uuid), meal_source?, recipient_name?, recipient_contact, share_type, date?, time? |
| `sharePlanSchema` | POST /share/plan body | plan_token, recipient_name?, recipient_contact |
| `shareRespondParams` | GET /share/{token}/respond path | token |
| `shareRespondQuery` | GET /share/{token}/respond query | action (enum: accept, decline) |

### events.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `trackEventSchema` | POST /events body | event_type, metadata?, session_id?, created_at? |
| `trackEventBatchSchema` | POST /events body (batch) | events[] |
| `publicEventSchema` | POST /events/public body | event_type (enum: share_link_opened, share_recipient_signed_up, shared_plan_viewed), metadata |

### stores.ts
| Schema | Validates | Fields |
|--------|-----------|--------|
| `nearbyStoresQuery` | GET /stores/nearby query | radius_km?, lat?, lng? |

## Shared Zod Primitives

Common reusable pieces:

```typescript
// backend/src/schemas/primitives.ts
import { z } from 'zod';

export const uuid = z.string().uuid();
export const email = z.string().email();
export const postalCode = z.string().min(3).max(10);
export const maxStores = z.union([z.literal(1), z.literal(2)]);
export const difficulty = z.enum(['easy', 'medium']);
export const priceTier = z.enum(['staple', 'premium', 'luxury']);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string(),
  unit: z.string(),
});

export const nutritionSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  sodium_mg: z.number(),
  per_serving: z.boolean().default(true),
}).transform(d => ({
  calories: d.calories,
  proteinG: d.protein_g,
  carbsG: d.carbs_g,
  fatG: d.fat_g,
  fiberG: d.fiber_g,
  sodiumMg: d.sodium_mg,
  perServing: d.per_serving,
}));
```

## Testing Zod Schemas

Each schema file gets a co-located test:

```
backend/src/schemas/auth.ts
backend/src/schemas/auth.test.ts
```

Tests cover:
- Valid input passes
- Missing required fields fail with correct error path
- Type coercion works (string numbers → numbers where expected)
- Transform produces correct camelCase keys
- Edge cases: empty strings, negative numbers, oversized arrays
