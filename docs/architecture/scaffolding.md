# Project Scaffolding

Directory structure, package.json files, and tsconfig.json files needed before coding begins.

## Root

```
groceryhack/
├── packages/
│   └── shared/
│       ├── types.ts              # Already exists
│       ├── constants.ts          # Enums, config values
│       ├── package.json
│       └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── app.ts                # Express app setup (middleware, routes)
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── stores.ts
│   │   │   ├── deals.ts
│   │   │   ├── meals.ts
│   │   │   ├── recipes.ts
│   │   │   ├── watchlist.ts
│   │   │   ├── importantItems.ts
│   │   │   ├── optimize.ts
│   │   │   ├── plans.ts
│   │   │   ├── flyerRequests.ts
│   │   │   ├── sharing.ts
│   │   │   ├── events.ts
│   │   │   └── admin.ts
│   │   ├── services/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── stores.ts
│   │   │   ├── deals.ts
│   │   │   ├── meals.ts
│   │   │   ├── recipes.ts
│   │   │   ├── watchlist.ts
│   │   │   ├── importantItems.ts
│   │   │   ├── optimize.ts
│   │   │   ├── plans.ts
│   │   │   ├── flyerRequests.ts
│   │   │   ├── sharing.ts
│   │   │   ├── events.ts
│   │   │   └── admin.ts
│   │   ├── schemas/              # Zod schemas (see zod-strategy.md)
│   │   │   ├── primitives.ts
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── meals.ts
│   │   │   ├── recipes.ts
│   │   │   ├── watchlist.ts
│   │   │   ├── importantItems.ts
│   │   │   ├── optimize.ts
│   │   │   ├── deals.ts
│   │   │   ├── stores.ts
│   │   │   ├── flyerRequests.ts
│   │   │   ├── sharing.ts
│   │   │   ├── events.ts
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification
│   │   │   ├── validate.ts       # Zod validation middleware
│   │   │   ├── errorHandler.ts   # Central error handler
│   │   │   └── rateLimit.ts      # IP + user rate limiting
│   │   ├── db/
│   │   │   ├── client.ts         # pg Pool setup
│   │   │   ├── queries/
│   │   │   │   ├── users.ts
│   │   │   │   ├── storeBrands.ts
│   │   │   │   ├── storeLocations.ts
│   │   │   │   ├── deals.ts
│   │   │   │   ├── meals.ts
│   │   │   │   ├── userRecipes.ts
│   │   │   │   ├── userMealPreferences.ts
│   │   │   │   ├── dealWatchlist.ts
│   │   │   │   ├── importantItems.ts
│   │   │   │   ├── weeklyPlans.ts
│   │   │   │   ├── flyerRequests.ts
│   │   │   │   ├── events.ts
│   │   │   │   └── usageTracking.ts
│   │   │   ├── migrations/       # Incremental migrations (see migration-strategy.md)
│   │   │   └── seed.ts           # Seed script (see seed-data.md)
│   │   ├── pipelines/
│   │   │   ├── scraper.ts        # Tuesday night flyer scraper
│   │   │   ├── planner.ts        # Wednesday morning plan generator
│   │   │   └── scheduler.ts      # node-cron schedule definitions
│   │   ├── lib/
│   │   │   ├── claude.ts         # Anthropic SDK wrapper
│   │   │   ├── email.ts          # Email rendering + sending
│   │   │   ├── sms.ts            # Twilio wrapper
│   │   │   ├── geocode.ts        # Postal code → lat/lng
│   │   │   ├── spendLimit.ts     # Usage tracking + limit enforcement
│   │   │   ├── haversine.ts      # Distance calculation
│   │   │   └── logger.ts         # Structured logging
│   │   └── config.ts             # Env var loading + validation
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── SharedPlanPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── components/           # Shared UI components
│   │   ├── modals/               # Full-screen modals
│   │   ├── hooks/                # Custom React hooks
│   │   ├── services/
│   │   │   └── api.ts            # Typed API client
│   │   ├── theme/
│   │   │   ├── tokens.ts         # Design system tokens
│   │   │   └── icons/            # Custom SVG icon components
│   │   └── utils/                # Small utilities (initials, colors, etc.)
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── ionic.config.json
│   ├── capacitor.config.ts
│   └── tsconfig.json
├── specs/                         # Gherkin behavioral specs (existing)
├── schema.sql                     # PostgreSQL schema (existing)
├── api-contract.yaml              # OpenAPI spec (existing)
├── package.json                   # Root workspace
├── tsconfig.base.json             # Shared compiler options
├── .env.example                   # From env-spec.md
└── .gitignore
```

## Root package.json

```json
{
  "name": "groceryhack",
  "private": true,
  "workspaces": [
    "packages/*",
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w backend && npm run build -w frontend",
    "test": "npm run test -w backend && npm run test -w frontend",
    "lint": "eslint . --ext .ts,.tsx",
    "db:reset": "psql -f schema.sql",
    "seed": "npm run seed -w backend"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "typescript": "^5.4.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0"
  }
}
```

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## packages/shared/package.json

```json
{
  "name": "@groceryhack/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./types.ts",
  "types": "./types.ts"
}
```

## packages/shared/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist"
  },
  "include": ["./**/*.ts"]
}
```

## backend/package.json

```json
{
  "name": "@groceryhack/backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx src/db/seed.ts",
    "seed:reset": "psql -f ../schema.sql && tsx src/db/seed.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@groceryhack/shared": "workspace:*",
    "bcrypt": "^5.1.0",
    "cors": "^2.8.0",
    "express": "^4.21.0",
    "express-rate-limit": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "node-cron": "^3.0.0",
    "pg": "^8.13.0",
    "puppeteer": "^23.0.0",
    "stripe": "^17.0.0",
    "twilio": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

## backend/tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../packages/shared" }
  ]
}
```

## frontend/package.json

```json
{
  "name": "@groceryhack/frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@capacitor/core": "^6.0.0",
    "@groceryhack/shared": "workspace:*",
    "@ionic/react": "^8.0.0",
    "@ionic/react-router": "^8.0.0",
    "@tanstack/react-query": "^5.0.0",
    "framer-motion": "^11.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

## frontend/tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "rootDir": "src",
    "outDir": "dist",
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": [
    { "path": "../packages/shared" }
  ]
}
```

## .gitignore

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.capacitor/
android/
ios/
www/
```

## Constants File

```typescript
// packages/shared/constants.ts

export const MAX_NOTABLE_DEALS = 10;
export const MAX_LIKED_MEALS_PREVIEW = 6;
export const MAX_SWIPEABLE_MEALS = 20;
export const MIN_SWIPES_FOR_COLLAB = 5;
export const MIN_SWIPES_FOR_APPROVAL = 5;
export const JACCARD_SIMILARITY_THRESHOLD = 0.8;
export const MIN_NEW_MEALS_PER_RUN = 3;
export const MEALS_PER_PLAN = 8; // 5 primary + 3 alternates

export const CATEGORIES = [
  'Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery',
  'Frozen', 'Pantry', 'Beverages', 'Snacks', 'Deli',
  'Household', 'Baby', 'Pet', 'Health', 'Other',
] as const;

export const DIETARY_TAGS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
  'nut-free', 'halal', 'kosher',
] as const;

export const BUDGET_TIERS = ['value', 'sweet_spot', 'splurge'] as const;
```
