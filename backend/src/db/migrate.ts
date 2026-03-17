import type { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await pool.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const applied = new Set(rows.map(r => r.version));

  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations');
  if (!fs.existsSync(dir)) {
    console.log('No migrations directory found. Skipping.');
    return;
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const versionStr = file.split('_')[0];
    if (!versionStr) continue;
    const version = parseInt(versionStr, 10);
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

// CLI entry point: tsx src/db/migrate.ts
async function main(): Promise<void> {
  const pg = await import('pg');
  const { config } = await import('../config.js');
  const directPool = new pg.default.Pool({ connectionString: config.DATABASE_URL });
  await migrate(directPool);
  await directPool.end();
}

const isDirectRun = process.argv[1]?.includes('migrate.ts') ?? false;
if (isDirectRun) {
  main();
}
