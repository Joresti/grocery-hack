import { pool } from './db/client.js';
import { migrate } from './db/migrate.js';
import { app } from './app.js';
import { config } from './config.js';
import { startScheduler } from './pipelines/scheduler.js';

async function start(): Promise<void> {
  await migrate(pool);
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });

  // Start cron-based pipeline scheduler
  startScheduler();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
