import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier } from '../src/services/auth.js';
import { UserRole } from '@hiredesk/shared';

const NOTIF_ID_1 = '11111111-1111-1111-1111-111111111111';
const NOTIF_ID_2 = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const ORG_ID = 'org-corp-uuid';

// Mock the database client
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    userProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@hiredesk/database';

describe('Notifications API & Service (Phase 8B)', () => {
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();

    const mockUser = {
      id: USER_ID,
      authUserId: 'auth-recruiter',
      email: 'recruiter@agency.com',
      role: UserRole.RECRUITER,
      organizationId: ORG_ID,
      organization: { id: ORG_ID, name: 'Agency Corp', slug: 'agency-corp' },
      clientId: null,
      client: null,
      isActive: true,
    };

    const mockClient = {
      id: 'client-user-uuid',
      authUserId: 'auth-client',
      email: 'client@clientcorp.com',
      role: UserRole.CLIENT,
      organizationId: ORG_ID,
      organization: { id: ORG_ID, name: 'Agency Corp', slug: 'agency-corp' },
      clientId: 'client-corp-uuid',
      client: { id: 'client-corp-uuid', name: 'Client Corp' },
      isActive: true,
    };

    setTokenVerifier(async (token: string) => {
      if (token === 'recruiter-token') return { authUserId: 'auth-recruiter' };
      if (token === 'client-token') return { authUserId: 'auth-client' };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.authUserId === 'auth-recruiter' || where.id === USER_ID) {
        return Promise.resolve(mockUser);
      }
      if (where.authUserId === 'auth-client' || where.id === 'client-user-uuid') {
        return Promise.resolve(mockClient);
      }
      return Promise.resolve(null);
    });
  });

  describe('GET /api/notifications', () => {
    it('returns paginated notifications and unread count for recruiter', async () => {
      const now = new Date();
      (prisma.notification.count as any)
        .mockResolvedValueOnce(2) // total count
        .mockResolvedValueOnce(1); // unread count

      (prisma.notification.findMany as any).mockResolvedValueOnce([
        {
          id: NOTIF_ID_1,
          organizationId: ORG_ID,
          userId: USER_ID,
          type: 'new_application',
          title: 'New Candidate Application',
          message: 'Alice applied for Senior Frontend Engineer',
          entityType: 'application',
          entityId: 'app-uuid-1',
          actionUrl: '/applications/app-uuid-1',
          eventKey: 'new_app:app-uuid-1',
          metadata: { candidateName: 'Alice' },
          isRead: false,
          readAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: NOTIF_ID_2,
          organizationId: ORG_ID,
          userId: USER_ID,
          type: 'interview_scheduled',
          title: 'Interview Scheduled',
          message: 'Interview with Bob',
          entityType: 'Interview',
          entityId: 'interview-uuid-2',
          actionUrl: '/interviews',
          eventKey: 'interview_sched:2',
          metadata: {},
          isRead: true,
          readAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await request(app)
        .get('/api/notifications?page=1&limit=20')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.notifications[0].isRead).toBe(false);
      expect(res.body.data.notifications[1].isRead).toBe(true);
    });

    it('rejects access from client user role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer client-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('returns unread count accurately', async () => {
      (prisma.notification.count as any).mockResolvedValueOnce(3);

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBe(3);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          organizationId: ORG_ID,
          userId: USER_ID,
          isRead: false,
        },
      });
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('marks an unread notification as read', async () => {
      const now = new Date();
      (prisma.notification.findFirst as any).mockResolvedValueOnce({
        id: NOTIF_ID_1,
        organizationId: ORG_ID,
        userId: USER_ID,
        type: 'new_application',
        title: 'New Candidate',
        message: 'Alice applied',
        entityType: 'application',
        entityId: 'app-uuid',
        actionUrl: '/applications/app-uuid',
        isRead: false,
        readAt: null,
        createdAt: now,
        metadata: {},
      });

      (prisma.notification.update as any).mockResolvedValueOnce({
        id: NOTIF_ID_1,
        organizationId: ORG_ID,
        userId: USER_ID,
        type: 'new_application',
        title: 'New Candidate',
        message: 'Alice applied',
        entityType: 'application',
        entityId: 'app-uuid',
        actionUrl: '/applications/app-uuid',
        isRead: true,
        readAt: now,
        createdAt: now,
        metadata: {},
      });

      const res = await request(app)
        .patch(`/api/notifications/${NOTIF_ID_1}/read`)
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalled();
    });

    it('returns 404 for non-existent or cross-tenant notification', async () => {
      (prisma.notification.findFirst as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .patch(`/api/notifications/${NOTIF_ID_2}/read`)
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('bulk marks all unread notifications as read', async () => {
      (prisma.notification.updateMany as any).mockResolvedValueOnce({ count: 5 });

      const res = await request(app)
        .post('/api/notifications/mark-all-read')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          organizationId: ORG_ID,
          isRead: false,
        },
        data: expect.objectContaining({
          isRead: true,
        }),
      });
    });
  });
});
