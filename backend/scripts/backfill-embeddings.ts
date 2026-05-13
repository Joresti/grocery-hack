import { pool } from '../src/db/client.js';
import { embed, toPgVector } from '../src/lib/embeddings.js';

async function backfill(): Promise<void> {
  const forceAll = process.argv.includes('--all');
  const whereClause = forceAll ? '' : 'WHERE embedding IS NULL';

  const { rows } = await pool.query(
    `SELECT id, item_name FROM deals ${whereClause}`,
  );

  console.log(`Found ${rows.length} deals to embed (${forceAll ? 'all' : 'missing only'})`);

  let count = 0;
  for (const row of rows as { id: string; item_name: string }[]) {
    const vec = await embed(row.item_name);
    await pool.query(
      `UPDATE deals SET embedding = $1 WHERE id = $2`,
      [toPgVector(vec), row.id],
    );
    count++;
    if (count % 50 === 0) {
      console.log(`  ${count}/${rows.length} done`);
    }
  }

  console.log(`Backfilled ${count} deal embeddings`);
  await pool.end();
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
