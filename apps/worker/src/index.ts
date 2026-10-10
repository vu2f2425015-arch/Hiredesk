import { workerConfig } from './config.js';
import { logger } from './logger.js';

let isShuttingDown = false;

export async function startWorker(): Promise<void> {
  logger.info(
    {
      env: workerConfig.NODE_ENV,
      mailbox: workerConfig.IMAP_MAILBOX_ID,
      host: workerConfig.IMAP_HOST,
      port: workerConfig.IMAP_PORT,
    },
    'HiredeskHR IMAP Worker initialized (scaffold mode)'
  );

  logger.info('Worker standby. Ready for Phase 4 full IMAP event-loop attachment.');
}

export function shutdownWorker(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down worker gracefully...`);
  // Will disconnect imap connection and flush pending operations in Phase 4
  process.exit(0);
}

process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
process.on('SIGINT', () => shutdownWorker('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  startWorker().catch((err) => {
    logger.fatal({ err }, 'Fatal worker error');
    process.exit(1);
  });
}
