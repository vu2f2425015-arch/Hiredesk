import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  setSupabaseAdminClient,
  resetSupabaseAdminClient,
} from "../src/services/auth.js";
import { config } from "../src/config/index.js";
import { UserRole } from "@hiredesk/shared";

// Mock the @hiredesk/database module
vi.mock("@hiredesk/database", () => {
  const mockPrisma = {
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    job: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    candidate: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    application: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  };
  return {
    prisma: mockPrisma,
  };
});

import { prisma } from "@hiredesk/database";

describe("Urgent Authentication Security Regression Test Suite", () => {
  const app = createApp();

  const mockAdminAuth = {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUserById: vi.fn(),
    listUsers: vi.fn(),
  };

  const mockSupabaseAdminClient = {
    auth: {
      admin: mockAdminAuth,
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    setSupabaseAdminClient(mockSupabaseAdminClient);
  });

  afterEach(() => {
    resetSupabaseAdminClient();
  });

  // ---------------------------------------------------------------------------
  // 1. Existing email registration conflict without password changes
  // ---------------------------------------------------------------------------
  describe("1. Existing email registration conflict without password changes", () => {
    it("Refuses registration with 409 Conflict if email already exists in database, without altering account", async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce({
        id: "existing-profile-id",
        email: "existing@agency.com",
        role: UserRole.MANAGER,
      });

      const res = await request(app).post("/api/auth/register").send({
        email: "existing@agency.com",
        password: "NewAttackerPassword123!",
        firstName: "Attacker",
        lastName: "User",
        organizationName: "Attacker Agency",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain("already exists");

      // Crucial: Supabase Auth methods were NEVER called to overwrite password or query accounts
      expect(mockAdminAuth.createUser).not.toHaveBeenCalled();
      expect(mockAdminAuth.updateUserById).not.toHaveBeenCalled();
      expect(mockAdminAuth.listUsers).not.toHaveBeenCalled();
    });

    it("Refuses registration with 409 Conflict if email already exists in Supabase Auth, without updating password", async () => {
      // Not in database profile yet, but exists in Supabase Auth
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null);

      mockAdminAuth.createUser.mockResolvedValueOnce({
        data: { user: null },
        error: {
          message: "A user with this email address has already been registered",
          status: 422,
        },
      });

      const res = await request(app).post("/api/auth/register").send({
        email: "supabase-existing@agency.com",
        password: "NewAttackerPassword123!",
        firstName: "Attacker",
        lastName: "User",
        organizationName: "Attacker Agency",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain("already exists");

      // Crucial security invariant: No updateUserById or password overwrite executed
      expect(mockAdminAuth.updateUserById).not.toHaveBeenCalled();
      expect(mockAdminAuth.listUsers).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Unverified new email behavior
  // ---------------------------------------------------------------------------
  describe("2. Unverified new email behavior", () => {
    it("Creates Supabase user without email_confirm: true and returns emailConfirmed: false", async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as any).mockResolvedValue(null);

      const newUserId = "new-unconfirmed-user-uuid";
      mockAdminAuth.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: newUserId,
            email: "newuser@agency.com",
            email_confirmed_at: null, // Unverified
          },
        },
        error: null,
      });

      const mockOrg = {
        id: "org-uuid-1",
        name: "New Agency",
        slug: "new-agency",
        status: "active",
      };
      const mockClient = {
        id: "client-uuid-1",
        name: "New Agency (Internal)",
        contactEmail: "newuser@agency.com",
      };
      const mockProfile = {
        id: "profile-uuid-1",
        authUserId: newUserId,
        email: "newuser@agency.com",
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
        role: UserRole.MANAGER,
        organizationId: "org-uuid-1",
        isActive: true,
      };

      (prisma.$transaction as any).mockResolvedValueOnce([
        mockOrg,
        mockClient,
        mockProfile,
      ]);

      const res = await request(app).post("/api/auth/register").send({
        email: "newuser@agency.com",
        password: "SafePassword123!",
        firstName: "Jane",
        lastName: "Doe",
        organizationName: "New Agency",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify email_confirm: true was NOT passed to Supabase Auth
      expect(mockAdminAuth.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newuser@agency.com",
          password: "SafePassword123!",
          user_metadata: {
            firstName: "Jane",
            lastName: "Doe",
            organizationName: "New Agency",
          },
        }),
      );
      const createUserArgs = mockAdminAuth.createUser.mock.calls[0][0];
      expect(createUserArgs.email_confirm).toBeUndefined();

      // Does not falsely claim email was confirmed
      expect(res.body.data.emailConfirmed).toBe(false);
      expect(res.body.data.requiresEmailVerification).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Database provisioning failure after Auth user creation
  // ---------------------------------------------------------------------------
  describe("3. Database provisioning failure after Auth user creation", () => {
    it("Rolls back newly created Supabase Auth user if Prisma provisioning fails, without touching pre-existing users", async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as any).mockResolvedValue(null);

      const newlyCreatedUserId = "orphaned-auth-user-id";
      mockAdminAuth.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: newlyCreatedUserId,
            email: "dbfail@agency.com",
          },
        },
        error: null,
      });

      mockAdminAuth.deleteUser.mockResolvedValueOnce({ data: {}, error: null });

      // Simulate database transaction failure
      (prisma.$transaction as any).mockRejectedValueOnce(
        new Error("Database connection lost during organization provisioning"),
      );

      const res = await request(app).post("/api/auth/register").send({
        email: "dbfail@agency.com",
        password: "ValidPassword123!",
        firstName: "Fail",
        lastName: "Case",
        organizationName: "Fail Agency",
      });

      // Endpoint should fail safely
      expect(res.status).toBe(500);

      // Verify controlled cleanup: The newly created user was deleted
      expect(mockAdminAuth.deleteUser).toHaveBeenCalledTimes(1);
      expect(mockAdminAuth.deleteUser).toHaveBeenCalledWith(newlyCreatedUserId);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Disallowed CORS origin rejection
  // ---------------------------------------------------------------------------
  describe("4. Disallowed CORS origin rejection", () => {
    it("Rejects requests from unauthorized origins with HTTP 403 Forbidden and omits Access-Control-Allow-Origin", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "https://unauthorized-evil-domain.com");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CORS_ERROR");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("Allows requests from configured origin in CORS_ORIGIN", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", config.CORS_ORIGIN || "http://localhost:5173");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        config.CORS_ORIGIN || "http://localhost:5173",
      );
    });

    it("In production mode, rejects wildcard *.vercel.app origins that are not configured in CORS_ORIGIN", async () => {
      const originalEnv = config.NODE_ENV;
      const originalCors = config.CORS_ORIGIN;
      try {
        (config as any).NODE_ENV = "production";
        (config as any).CORS_ORIGIN = "https://hiredesk-official.duckdns.org";

        const res = await request(app)
          .get("/api/health")
          .set("Origin", "https://malicious-random-app.vercel.app");

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("CORS_ERROR");
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      } finally {
        (config as any).NODE_ENV = originalEnv;
        (config as any).CORS_ORIGIN = originalCors;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Preventing self-assignment of privileged roles
  // ---------------------------------------------------------------------------
  describe("5. Preventing self-assignment of privileged roles", () => {
    it("Ignores any requested role in registration payload and strictly forces UserRole.MANAGER", async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as any).mockResolvedValue(null);

      const authId = "auth-privilege-attempt-uuid";
      mockAdminAuth.createUser.mockResolvedValueOnce({
        data: {
          user: { id: authId, email: "escalate@agency.com" },
        },
        error: null,
      });

      let assignedRole: any = null;
      (prisma.$transaction as any).mockImplementationOnce(
        async (callback: any) => {
          const txMock = {
            organization: {
              create: vi
                .fn()
                .mockResolvedValue({
                  id: "org-id",
                  name: "Escalate Org",
                  slug: "escalate-org",
                }),
            },
            client: {
              create: vi
                .fn()
                .mockResolvedValue({
                  id: "client-id",
                  name: "Escalate Org (Internal)",
                }),
            },
            userProfile: {
              create: vi.fn().mockImplementation(({ data }: any) => {
                assignedRole = data.role;
                return Promise.resolve({
                  id: "profile-id",
                  authUserId: authId,
                  email: "escalate@agency.com",
                  firstName: "Attacker",
                  lastName: "Manager",
                  fullName: "Attacker Manager",
                  role: data.role,
                  organizationId: "org-id",
                  isActive: true,
                });
              }),
            },
          };
          return callback(txMock);
        },
      );

      const res = await request(app).post("/api/auth/register").send({
        email: "escalate@agency.com",
        password: "StrongPassword123!",
        firstName: "Attacker",
        lastName: "Manager",
        organizationName: "Escalate Org",
        role: "super_admin", // Attacker attempting privilege elevation
      });

      expect(res.status).toBe(201);
      // Strictly verified: role assigned in database and returned in DTO is MANAGER, NEVER super_admin
      expect(assignedRole).toBe(UserRole.MANAGER);
      expect(res.body.data.user.role).toBe(UserRole.MANAGER);
      expect(res.body.data.user.role).not.toBe(UserRole.SUPER_ADMIN);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Clean workspace for a new agency with no mock business records
  // ---------------------------------------------------------------------------
  describe("6. Clean workspace for a new agency with no mock business records", () => {
    it("Creates only 1 organization, 1 default internal client, and zero mock business records", async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as any).mockResolvedValue(null);

      const authId = "auth-clean-workspace-uuid";
      mockAdminAuth.createUser.mockResolvedValueOnce({
        data: {
          user: { id: authId, email: "clean@agency.com" },
        },
        error: null,
      });

      let createdOrgData: any = null;
      let createdClientData: any = null;
      let createdProfileData: any = null;

      (prisma.$transaction as any).mockImplementationOnce(
        async (callback: any) => {
          const txMock = {
            organization: {
              create: vi.fn().mockImplementation(({ data }: any) => {
                createdOrgData = data;
                return Promise.resolve({ id: "clean-org-id", ...data });
              }),
            },
            client: {
              create: vi.fn().mockImplementation(({ data }: any) => {
                createdClientData = data;
                return Promise.resolve({ id: "clean-client-id", ...data });
              }),
            },
            userProfile: {
              create: vi.fn().mockImplementation(({ data }: any) => {
                createdProfileData = data;
                return Promise.resolve({ id: "clean-profile-id", ...data });
              }),
            },
          };
          return callback(txMock);
        },
      );

      const res = await request(app).post("/api/auth/register").send({
        email: "clean@agency.com",
        password: "CleanPassword123!",
        firstName: "Clean",
        lastName: "Agency",
        organizationName: "Clean Search Partners",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify exact resources created
      expect(createdOrgData).toEqual({
        name: "Clean Search Partners",
        slug: "clean-search-partners",
        status: "active",
      });

      expect(createdClientData).toEqual({
        organizationId: "clean-org-id",
        name: "Clean Search Partners (Internal)",
        contactEmail: "clean@agency.com",
        status: "active",
      });

      expect(createdProfileData).toEqual({
        authUserId: authId,
        email: "clean@agency.com",
        firstName: "Clean",
        lastName: "Agency",
        fullName: "Clean Agency",
        role: UserRole.MANAGER,
        organizationId: "clean-org-id",
        clientId: null,
        isActive: true,
      });

      // Verify no business entities (jobs, candidates, applications) were seeded or linked
      expect(prisma.job.create).toBeUndefined();
      expect(prisma.candidate.create).toBeUndefined();
      expect(prisma.application.create).toBeUndefined();
    });
  });
});
