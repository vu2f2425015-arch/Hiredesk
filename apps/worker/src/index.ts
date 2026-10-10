import { workerConfig } from './config.js';
import { logger } from './logger.js';
import { defaultDaemon } from './imapClient.js';

export * from './config.js';
export * from './jobCodeExtractor.js';
export * from './emailParser.js';
export * from './storage.js';
export * from './inboundProcessor.js';
export * from './imapClient.js';

let isShuttingDown = false;

export async function startWorker(): Promise<void> {
  logger.info(
    {
      env: workerConfig.NODE_ENV,
      mailbox: workerConfig.INBOUND_MAILBOX_ID,
      host: workerConfig.IMAP_HOST,
      port: workerConfig.IMAP_PORT,
    },
    'HiredeskHR IMAP Inbound Worker starting...'
  );

  await defaultDaemon.start();
}

export async function shutdownWorker(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down worker gracefully...`);
  await defaultDaemon.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
process.on('SIGINT', () => shutdownWorker('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  startWorker().catch((err) => {
    logger.fatal({ err }, 'Fatal worker daemon failure');
    process.exit(1);
  });
}
