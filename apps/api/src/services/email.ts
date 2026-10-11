import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions as NodemailerMailOptions } from 'nodemailer';
import { prisma } from '@hiredesk/database';
import { CommunicationStatus } from '@hiredesk/shared';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  icsContent?: string;
  isCancellation?: boolean;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
    isTransient: boolean;
  };
}

export class EmailService {
  private static customTransporter: Transporter | null = null;

  /**
   * For testing: inject mock nodemailer transporter
   */
  static setCustomTransporter(transporter: Transporter | null): void {
    this.customTransporter = transporter;
  }

  /**
   * Check if real SMTP credentials are configured in the environment
   */
  static isSmtpConfigured(): boolean {
    if (this.customTransporter) return true;
    return Boolean(config.SMTP_HOST && config.SMTP_USERNAME && config.SMTP_PASSWORD);
  }

  /**
   * Get configured Nodemailer transporter or null if not configured
   */
  private static getTransporter(): Transporter | null {
    if (this.customTransporter) {
      return this.customTransporter;
    }

    if (!config.SMTP_HOST || !config.SMTP_USERNAME || !config.SMTP_PASSWORD) {
      return null;
    }

    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USERNAME,
        pass: config.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: config.NODE_ENV === 'production',
      },
    });
  }

  /**
   * Sends an email via SMTP or returns clear failure if SMTP is not configured.
   */
  static async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = this.getTransporter();

    if (!transporter) {
      logger.warn(
        { recipient: options.to },
        'SMTP delivery skipped: SMTP credentials are not configured in environment'
      );
      return {
        success: false,
        error: {
          code: 'SMTP_NOT_CONFIGURED',
          message: 'SMTP credentials are not configured in server environment. Email was not dispatched.',
          isTransient: false,
        },
      };
    }

    try {
      const fromAddress = config.SMTP_FROM_EMAIL || config.SMTP_USERNAME || 'no-reply@hiredeskhr.com';
      const fromHeader = `"${config.SMTP_FROM_NAME}" <${fromAddress}>`;

      const mailPayload: NodemailerMailOptions = {
        from: fromHeader,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };


      if (options.icsContent) {
        mailPayload.attachments = [
          {
            filename: options.isCancellation ? 'cancellation.ics' : 'invite.ics',
            content: options.icsContent,
            contentType: `text/calendar; charset=utf-8; method=${options.isCancellation ? 'CANCEL' : 'REQUEST'}`,
          },
        ];
      }

      const info = await transporter.sendMail(mailPayload);
      logger.info({ messageId: info.messageId, recipient: options.to }, 'SMTP message dispatched successfully');

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown SMTP transport error';
      const errCode = err?.code || 'SMTP_TRANSPORT_ERROR';
      const isTransient = this.isTransientError(err);

      logger.error(
        { errCode, errMsg, isTransient, recipient: options.to },
        'SMTP send failed'
      );

      return {
        success: false,
        error: {
          code: errCode,
          message: errMsg,
          isTransient,
        },
      };
    }
  }

  /**
   * Classify if an SMTP error is transient (retryable)
   */
  private static isTransientError(err: any): boolean {
    const code = String(err?.code || '').toUpperCase();
    const message = String(err?.message || '').toLowerCase();

    // Network / timeout / rate-limit errors are transient
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'EAI_AGAIN' ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('try again later') ||
      message.includes('421') ||
      message.includes('450') ||
      message.includes('451') ||
      message.includes('452')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Process a single queued OutboundCommunication record
   */
  static async processCommunicationRecord(commId: string): Promise<boolean> {
    const record = await prisma.outboundCommunication.findUnique({
      where: { id: commId },
      include: {
        interview: true,
      },
    });

    if (!record || record.status === CommunicationStatus.SENT) {
      return true;
    }

    // Mark status sending
    await prisma.outboundCommunication.update({
      where: { id: commId },
      data: {
        status: CommunicationStatus.SENDING,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    const metadata = (record.metadata || {}) as Record<string, any>;
    const icsContent = metadata.icsContent as string | undefined;
    const isCancellation = metadata.isCancellation as boolean | undefined;

    const result = await this.sendMail({
      to: record.recipientEmail,
      subject: record.subject,
      text: record.bodyText || '',
      html: record.bodyHtml || '',
      icsContent,
      isCancellation,
    });

    if (result.success) {
      await prisma.outboundCommunication.update({
        where: { id: commId },
        data: {
          status: CommunicationStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.messageId || 'sent-mock',
          errorCode: null,
          errorMessage: null,
        },
      });
      return true;
    } else {
      const err = result.error!;
      const newAttemptCount = record.attemptCount + 1;
      const isExhausted = newAttemptCount >= record.maxAttempts;
      const willRetry = err.isTransient && !isExhausted;

      await prisma.outboundCommunication.update({
        where: { id: commId },
        data: {
          status: willRetry ? CommunicationStatus.QUEUED : CommunicationStatus.FAILED,
          failedAt: willRetry ? null : new Date(),
          errorCode: err.code,
          errorMessage: err.message,
        },
      });
      return false;
    }
  }

  /**
   * Process pending outbox queue
   */
  static async processOutboxQueue(limit = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
    const queuedRecords = await prisma.outboundCommunication.findMany({
      where: {
        status: CommunicationStatus.QUEUED,
        attemptCount: { lt: 5 },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let succeeded = 0;
    let failed = 0;

    for (const record of queuedRecords) {
      const ok = await this.processCommunicationRecord(record.id);
      if (ok) succeeded++;
      else failed++;
    }

    return {
      processed: queuedRecords.length,
      succeeded,
      failed,
    };
  }

  /**
   * Manually retry a failed communication record
   */
  static async retryCommunication(commId: string, organizationId: string): Promise<boolean> {
    const record = await prisma.outboundCommunication.findFirst({
      where: {
        id: commId,
        organizationId,
      },
    });

    if (!record) {
      const err = new Error('Communication record not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    await prisma.outboundCommunication.update({
      where: { id: commId },
      data: {
        status: CommunicationStatus.QUEUED,
        errorCode: null,
        errorMessage: null,
      },
    });

    return await this.processCommunicationRecord(commId);
  }
}
