import { z } from 'zod';

export const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

export const CreateNotificationSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string().max(100),
  title: z.string().max(255),
  message: z.string().max(2000),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
  actionUrl: z.string().max(500).optional(),
  eventKey: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type NotificationQueryInput = z.infer<typeof NotificationQuerySchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, any>;
}

export interface NotificationListResponse {
  notifications: NotificationDto[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
