# Migration Strategy

## Problem

`schema.sql` is the source of truth for the database, but running the full file destroys all data. We need incremental migrations for production schema changes after initial deployment.

## Approach: Numbered SQL Files

No ORM. No migration library. Plain SQL files with a tracking table.

### Tracking Table

Added to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration Files

```
backend/src/db/migrations/
├── 001_initial_schema.sql      # Full schema.sql contents (baseline)
├── 002_add_user_avatar.sql     # Example future migration
├── 003_add_meal_cuisine_index.sql
└── ...
```

Rules:
- Files are numbered sequentially: `001_`, `002_`, `003_`
- Each file is a single transaction
- Each file starts with `BEGIN;` and ends with `COMMIT;`
- File name describes the change
- Migrations are **forward-only** — no rollback files (if something goes wrong, write a new migration to fix it)

### Migration Runner

```typescript
// backend/src/db/migrate.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function migrate(pool: Pool): Promise<void> {
  // Ensure tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Get already-applied migrations
  const { rows } = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const applied = new Set(rows.map(r => r.version));

  // Read migration files
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    console.log(`Applying migration ${file}...`);

    await pool.query(sql);
    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [version, file]
    );

    console.log(`Applied: ${file}`);
  }

  console.log('Migrations complete.');
}
```

### CLI Commands

```json
{
  "scripts": {
    "migrate": "tsx src/db/migrate.ts",
    "migrate:status": "tsx src/db/migrateStatus.ts",
    "db:reset": "psql -f ../schema.sql && npm run seed"
  }
}
```

- `npm run migrate` — applies pending migrations
- `npm run migrate:status` — shows which migrations have been applied
- `npm run db:reset` — nuclear option: drops everything, re-runs full schema, re-seeds

### Server Startup

The server runs `migrate()` on startup before listening:

```typescript
// backend/src/index.ts
import { pool } from './db/client';
import { migrate } from './db/migrate';
import { app } from './app';

async function start(): Promise<void> {
  await migrate(pool);
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start();
```

This ensures the database is always up-to-date when the server starts. Safe for multiple instances — the tracking table prevents double-application.

## Development Workflow

### Initial setup

```bash
psql -f schema.sql          # Create all tables from scratch
npm run seed -w backend     # Insert test data
npm run dev                 # Start server (runs migrate on startup — no-op since schema is fresh)
```

### Making a schema change

1. Edit `schema.sql` to reflect the final desired state (this remains the canonical reference)
2. Create a new migration file: `backend/src/db/migrations/NNN_description.sql`
3. Write the ALTER/CREATE/DROP statements that transition from the previous state to the new state
4. Run `npm run migrate -w backend` to test it
5. Commit both `schema.sql` and the migration file together

### Example migration

```sql
-- backend/src/db/migrations/002_add_approval_score_columns.sql
BEGIN;

ALTER TABLE meals ADD COLUMN IF NOT EXISTS swipe_right_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS swipe_left_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS approval_score NUMERIC(5,4) DEFAULT NULL;

COMMIT;
```

## What NOT to Do

- **Don't use an ORM's migration system** — we use raw SQL queries, adding an ORM just for migrations is overhead
- **Don't write rollback migrations** — forward-only is simpler and safer. If a migration is wrong, write a corrective migration.
- **Don't modify applied migrations** — once a migration has run in any environment, it's immutable. Create a new one.
- **Don't skip `schema.sql` updates** — the migration file handles the transition, but `schema.sql` must always represent the complete current schema (for new dev setup and reference)

## MVP Timeline

For the trial period (weeks 1-5), `schema.sql` + `db:reset` is sufficient — no production database exists yet. The migration system is here for when we deploy to a persistent environment and can't afford to drop tables.

Migration file `001_initial_schema.sql` will be created at first production deployment, containing the full `schema.sql` as a baseline.
