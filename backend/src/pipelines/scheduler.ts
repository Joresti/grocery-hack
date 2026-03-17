import cron from 'node-cron';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { scrapeAllStores } from './scraper.js';
import { runPlannerForAllUsers } from './planner.js';

export function startScheduler(): void {
  logger.info('Starting pipeline scheduler', {
    scraperCron: config.SCRAPER_CRON,
    plannerCron: config.PLANNER_CRON,
    timezone: config.PIPELINE_TIMEZONE,
  });

  // Scraper: Tuesday 10pm ET
  cron.schedule(
    config.SCRAPER_CRON,
    async () => {
      logger.info('Scraper pipeline triggered');
      try {
        const result = await scrapeAllStores();
        logger.info('Scraper pipeline completed', {
          brandsScraped: result.brandsScraped,
          dealsFound: result.dealsFound,
          errorCount: result.errors.length,
        });
      } catch (err) {
        logger.error('Scraper pipeline failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { timezone: config.PIPELINE_TIMEZONE },
  );

  // Planner: Wednesday 7am ET
  cron.schedule(
    config.PLANNER_CRON,
    async () => {
      logger.info('Planner pipeline triggered');
      try {
        const result = await runPlannerForAllUsers();
        logger.info('Planner pipeline completed', {
          usersProcessed: result.usersProcessed,
          usersSkipped: result.usersSkipped,
          mealsGenerated: result.mealsGenerated,
          totalCostUsd: result.totalCostUsd,
        });
      } catch (err) {
        logger.error('Planner pipeline failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { timezone: config.PIPELINE_TIMEZONE },
  );

  logger.info('Pipeline scheduler started');
}
