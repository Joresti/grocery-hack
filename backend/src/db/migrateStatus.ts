import pg from 'pg';
import { config } from '../config.js';

async function showStatus(): Promise<void> {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

  try {
    const { rows } = await pool.query<{ version: number; name: string; applied_at: Date }>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    );

    if (rows.length === 0) {
      console.log('No migrations applied yet.');
    } else {
      console.log('Applied migrations:');
      for (const row of rows) {
        console.log(`  ${String(row.version).padStart(3, '0')} | ${row.name} | ${row.applied_at.toISOString()}`);
      }
    }
  } catch {
    console.log('schema_migrations table does not exist. No migrations applied.');
  } finally {
    await pool.end();
  }
}

showStatus();
