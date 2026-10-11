import { prisma } from '@hiredesk/database';
import {
  NotificationQueryInput,
  CreateNotificationInput,
  NotificationListResponse,
  NotificationDto,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  /**
   * Creates a notification with automatic idempotency / deduplication if eventKey is provided.
   * Can accept an ongoing transaction client or standard prisma client.
   */
  static async createNotification(
    db: any,
    input: CreateNotificationInput
  ): Promise<NotificationDto> {
    const client = db || prisma;
    if (!client?.notification?.create) {
      return {
        id: 'mock-notif-id',
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        actionUrl: input.actionUrl || null,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        metadata: input.metadata || {},
      };
    }

    // 1. Check deduplication if eventKey is supplied
    if (input.eventKey) {
      const existing = await client.notification.findUnique({
        where: {
          userId_eventKey: {
            userId: input.userId,
            eventKey: input.eventKey,
          },
        },
      });

      if (existing) {
        logger.info(
          { userId: input.userId, eventKey: input.eventKey, notificationId: existing.id },
          'Notification already exists for eventKey; skipping duplicate insertion'
        );
        return {
          id: existing.id,
          type: existing.type,
          title: existing.title,
          message: existing.message,
          entityType: existing.entityType,
          entityId: existing.entityId,
          actionUrl: existing.actionUrl,
          isRead: existing.isRead,
          readAt: existing.readAt ? existing.readAt.toISOString() : null,
          createdAt: existing.createdAt.toISOString(),
          metadata: (existing.metadata as Record<string, any>) || {},
        };
      }
    }

    // 2. Insert notification
    const notification = await client.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        actionUrl: input.actionUrl || null,
        eventKey: input.eventKey || null,
        metadata: input.metadata || {},
      },
    });

    logger.info(
      {
        id: notification.id,
        userId: input.userId,
        type: input.type,
      },
      'Notification created successfully'
    );

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      actionUrl: notification.actionUrl,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
      metadata: (notification.metadata as Record<string, any>) || {},
    };
  }

  /**
   * Lists notifications for authenticated user with unread count and pagination.
   */
  static async listNotifications(
    user: AuthenticatedUser,
    query: NotificationQueryInput
  ): Promise<NotificationListResponse> {
    if (!user.organizationId) {
      const err = new Error('Organization context required');
      (err as any).statusCode = 400;
      (err as any).code = 'ORGANIZATION_REQUIRED';
      throw err;
    }

    const where: any = {
      organizationId: user.organizationId,
      userId: user.id,
    };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, unreadCount, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          organizationId: user.organizationId,
          userId: user.id,
          isRead: false,
        },
      }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mapped: NotificationDto[] = items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId,
      actionUrl: n.actionUrl,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
      metadata: (n.metadata as Record<string, any>) || {},
    }));

    return {
      notifications: mapped,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Returns current unread count for user badge.
   */
  static async getUnreadCount(user: AuthenticatedUser): Promise<{ unreadCount: number }> {
    if (!user.organizationId) return { unreadCount: 0 };

    const count = await prisma.notification.count({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(user: AuthenticatedUser, notificationId: string): Promise<NotificationDto> {
    if (!user.organizationId) {
      const err = new Error('Organization context required');
      (err as any).statusCode = 400;
      throw err;
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        organizationId: user.organizationId,
      },
    });

    if (!notification) {
      const err = new Error('Notification not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (notification.isRead) {
      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entityType: notification.entityType,
        entityId: notification.entityId,
        actionUrl: notification.actionUrl,
        isRead: true,
        readAt: notification.readAt ? notification.readAt.toISOString() : null,
        createdAt: notification.createdAt.toISOString(),
        metadata: (notification.metadata as Record<string, any>) || {},
      };
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      message: updated.message,
      entityType: updated.entityType,
      entityId: updated.entityId,
      actionUrl: updated.actionUrl,
      isRead: updated.isRead,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      metadata: (updated.metadata as Record<string, any>) || {},
    };
  }

  /**
   * Marks all unread notifications as read for current user.
   */
  static async markAllAsRead(user: AuthenticatedUser): Promise<{ updatedCount: number }> {
    if (!user.organizationId) {
      const err = new Error('Organization context required');
      (err as any).statusCode = 400;
      throw err;
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Broadcasts a notification to all active recruiter/admin members of an organization (excluding client users).
   */
  static async notifyAgencyMembers(
    db: any,
    organizationId: string,
    notificationData: Omit<CreateNotificationInput, 'userId' | 'organizationId'>,
    excludeUserId?: string
  ): Promise<number> {
    const client = db || prisma;
    if (!client?.userProfile?.findMany || !client?.notification?.create) {
      return 0;
    }
    const members = await client.userProfile.findMany({
      where: {
        organizationId,
        role: { in: ['admin', 'recruiter', 'hiring_manager'] },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    let count = 0;
    for (const member of members) {
      await this.createNotification(client, {
        ...notificationData,
        organizationId,
        userId: member.id,
        eventKey: notificationData.eventKey ? `${notificationData.eventKey}:${member.id}` : undefined,
      });
      count++;
    }
    return count;
  }
}

