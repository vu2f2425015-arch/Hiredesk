import { ImapFlow } from 'imapflow';
import { workerConfig } from './config.js';
import { logger } from './logger.js';
import { claimOrRegisterInboundRecord, processInboundEmail } from './inboundProcessor.js';

export interface MailboxMessage {
  uid: number;
  uidValidity: number;
  seq: number;
  envelope: {
    messageId?: string;
    date?: Date;
    subject?: string;
    from?: Array<{ address?: string; name?: string }>;
    to?: Array<{ address?: string; name?: string }>;
  };
  source: Buffer;
}

export interface MailboxFetcher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  fetchNewMessages(mailboxName: string): Promise<MailboxMessage[]>;
  markSeen?(uid: number): Promise<void>;
}

export class ImapFlowFetcher implements MailboxFetcher {
  private client: ImapFlow | null = null;

  async connect(): Promise<void> {
    if (!workerConfig.IMAP_HOST || !workerConfig.IMAP_USERNAME) {
      throw new Error('IMAP connection parameters not configured');
    }

    this.client = new ImapFlow({
      host: workerConfig.IMAP_HOST,
      port: workerConfig.IMAP_PORT,
      secure: workerConfig.IMAP_SECURE,
      auth: {
        user: workerConfig.IMAP_USERNAME,
        pass: workerConfig.IMAP_PASSWORD,
      },
      logger: false,
    });

    await this.client.connect();
    logger.info(
      { host: workerConfig.IMAP_HOST, port: workerConfig.IMAP_PORT, secure: workerConfig.IMAP_SECURE },
      'Successfully connected to IMAP server'
    );
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Warning during IMAP client logout');
      } finally {
        this.client = null;
      }
    }
  }

  async fetchNewMessages(mailboxName: string = workerConfig.IMAP_MAILBOX): Promise<MailboxMessage[]> {
    if (!this.client) {
      throw new Error('IMAP client is not connected');
    }

    const lock = await this.client.getMailboxLock(mailboxName);
    const messages: MailboxMessage[] = [];

    try {
      const mailbox = this.client.mailbox;
      const uidValidity = Number(mailbox ? mailbox.uidValidity : 1);

      // Search for unseen messages
      const searchResults = await this.client.search({ seen: false });
      if (!searchResults || searchResults.length === 0) {
        return [];
      }

      for (const msgSeq of searchResults) {
        const download = await this.client.download(String(msgSeq), undefined, { uid: true });
        if (!download || !download.content) continue;

        const chunks: Buffer[] = [];
        for await (const chunk of download.content) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const fullSource = Buffer.concat(chunks);

        const fetched = await this.client.fetchOne(String(msgSeq), {
          envelope: true,
          uid: true,
        });

        if (fetched) {
          messages.push({
            uid: fetched.uid,
            uidValidity,
            seq: fetched.seq,
            envelope: {
              messageId: fetched.envelope?.messageId,
              date: fetched.envelope?.date,
              subject: fetched.envelope?.subject,
              from: fetched.envelope?.from?.map((f) => ({ address: f.address, name: f.name })),
              to: fetched.envelope?.to?.map((t) => ({ address: t.address, name: t.name })),
            },
            source: fullSource,
          });
        }
      }
    } finally {
      lock.release();
    }

    return messages;
  }

  async markSeen(uid: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen'], { uid: true });
    } catch (err: any) {
      logger.warn({ err: err.message, uid }, 'Failed to mark message as \\Seen in IMAP');
    }
  }
}

export class ImapWorkerDaemon {
  private fetcher: MailboxFetcher;
  private isRunning = false;
  private isPolling = false;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;

  constructor(fetcher?: MailboxFetcher) {
    this.fetcher = fetcher || new ImapFlowFetcher();
  }

  setFetcher(fetcher: MailboxFetcher): void {
    this.fetcher = fetcher;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info(
      {
        mailboxId: workerConfig.INBOUND_MAILBOX_ID,
        intervalMs: workerConfig.IMAP_POLL_INTERVAL_MS,
      },
      'Starting HiredeskHR IMAP Worker Daemon'
    );

    // Initial poll
    await this.pollCycle();

    // Setup periodic polling with non-overlapping execution guarantee
    this.pollIntervalTimer = setInterval(() => {
      this.pollCycle().catch((err) => {
        logger.error({ err }, 'Unhandled exception in daemon poll cycle');
      });
    }, workerConfig.IMAP_POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }

    try {
      await this.fetcher.disconnect();
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Exception during fetcher disconnect');
    }

    logger.info('IMAP Worker Daemon stopped cleanly');
  }

  async pollCycle(): Promise<void> {
    if (this.isPolling) {
      logger.debug('Previous poll cycle still in progress; skipping this tick');
      return;
    }

    this.isPolling = true;

    try {
      // Connect if not already connected
      await this.fetcher.connect();
      const messages = await this.fetcher.fetchNewMessages(workerConfig.IMAP_MAILBOX);
      this.consecutiveErrors = 0;

      logger.info({ messageCount: messages.length }, 'Fetched messages from inbound mailbox');

      for (const msg of messages) {
        if (!this.isRunning) break;

        const senderEmail = msg.envelope.from?.[0]?.address || 'unknown@sender.com';
        const senderName = msg.envelope.from?.[0]?.name || null;
        const recipientEmail = msg.envelope.to?.[0]?.address || 'inbound@hiredesk.io';
        const subject = msg.envelope.subject || 'No Subject';

        // 1. Claim or register message
        const { record, claimed } = await claimOrRegisterInboundRecord({
          mailboxId: workerConfig.INBOUND_MAILBOX_ID,
          uidValidity: BigInt(msg.uidValidity),
          uid: BigInt(msg.uid),
          messageId: msg.envelope.messageId || null,
          subject,
          senderEmail,
          senderName,
          recipientEmail,
          receivedAt: msg.envelope.date || new Date(),
          rawPayload: {
            seq: msg.seq,
          },
        });

        if (!claimed) {
          logger.info(
            { uid: msg.uid, status: record.status },
            'Message already claimed or processed; skipping'
          );
          continue;
        }

        // 2. Process message safely
        logger.info(
          { uid: msg.uid, uidValidity: msg.uidValidity, recordId: record.id },
          'Processing inbound email'
        );

        const result = await processInboundEmail(record.id, msg.source);

        logger.info(
          {
            uid: msg.uid,
            recordId: record.id,
            status: result.status,
            jobCode: result.jobCode,
            applicationId: result.applicationId,
          },
          'Inbound email processing completed'
        );

        // 3. Mark seen on IMAP if supported
        if (this.fetcher.markSeen) {
          await this.fetcher.markSeen(msg.uid);
        }
      }
    } catch (err: any) {
      this.consecutiveErrors++;
      const backoffDelay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 30000);
      logger.error(
        {
          err: err.message,
          consecutiveErrors: this.consecutiveErrors,
          backoffDelayMs: backoffDelay,
        },
        'Error during IMAP poll cycle; scheduling backoff'
      );
    } finally {
      this.isPolling = false;
    }
  }
}

export const defaultDaemon = new ImapWorkerDaemon();
