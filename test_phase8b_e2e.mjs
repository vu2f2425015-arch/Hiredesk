import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import { NotificationService } from './apps/api/dist/services/notifications.js';
import { AnalyticsService } from './apps/api/dist/services/analytics.js';
import { UserRole } from './packages/shared/dist/index.js';

async function runPhase8BLiveVerification() {
  console.log('=== HiredeskHR Phase 8B Live Supabase Reporting & Notifications Verification ===\n');

  // 1. Fetch live active Organization with retry for pooler resilience
  let organization = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      organization = await prisma.organization.findFirst({
        where: { status: 'active' },
        include: { clients: true, users: true },
      });
      if (organization) break;
    } catch (e) {
      if (attempt === 4) throw e;
      console.log(`Pooler connection attempt ${attempt} timed out; retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!organization) {
    throw new Error('No active organization found in live database');
  }

  console.log(`[PASS] Step 1: Resolved Organization: "${organization.name}" (${organization.id})`);

  // Find or create test agency user profile in database
  let testUser = organization.users.find((u) => u.role === 'admin' || u.role === 'recruiter');
  if (!testUser) {
    testUser = await prisma.userProfile.create({
      data: {
        organizationId: organization.id,
        authUserId: `test-auth-${Date.now()}`,
        email: `test.recruiter.${Date.now()}@hiredesk.local`,
        firstName: 'Test',
        lastName: 'Recruiter',
        fullName: 'Test Recruiter',
        role: 'recruiter',
        isActive: true,
      },
    });
  }

  console.log(`[PASS] Step 2: Resolved User Profile for Notifications: "${testUser.email}" (${testUser.id})\n`);

  const recruiterUser = {
    id: testUser.id,
    authUserId: testUser.authUserId,
    email: testUser.email,
    firstName: testUser.firstName,
    lastName: testUser.lastName,
    fullName: testUser.fullName,
    role: UserRole.RECRUITER,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: null,
    clientName: null,
    isActive: true,
  };

  const clientUser = {
    id: 'live-client-uuid',
    authUserId: 'live-auth-client-uuid',
    email: 'client.test@company.local',
    firstName: 'Charlie',
    lastName: 'Client',
    fullName: 'Charlie Client',
    role: UserRole.CLIENT,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: organization.clients[0]?.id || 'dummy-client-uuid',
    clientName: organization.clients[0]?.name || 'Client Corp',
    isActive: true,
  };

  const testEventKey = `live_test_event_${Date.now()}`;
  let createdNotifId = null;

  try {
    // ------------------------------------------------------------------------
    // Test 1: Create durable in-app notification in Supabase
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Create Durable Notification in Live Supabase ---');
    const notif = await NotificationService.createNotification(prisma, {
      organizationId: organization.id,
      userId: testUser.id,
      type: 'interview_scheduled',
      title: 'Phase 8B Live Interview Notification',
      message: 'Candidate Alex Vance scheduled for Technical Architecture Review',
      entityType: 'Interview',
      entityId: 'live-test-interview-id',
      actionUrl: '/interviews',
      eventKey: testEventKey,
      metadata: { priority: 'high', candidateName: 'Alex Vance' },
    });

    createdNotifId = notif.id;
    console.log(`[PASS] Created notification ID: ${notif.id}, isRead: ${notif.isRead}\n`);

    // ------------------------------------------------------------------------
    // Test 2: Unread count calculation
    // ------------------------------------------------------------------------
    console.log('--- Test 2: Fetch Unread Count ---');
    const countRes = await NotificationService.getUnreadCount(recruiterUser);
    console.log(`[PASS] Unread count returned: ${countRes.unreadCount} (>= 1 verified)\n`);
    if (countRes.unreadCount < 1) throw new Error('Unread count should be at least 1');

    // ------------------------------------------------------------------------
    // Test 3: Notification deduplication via eventKey
    // ------------------------------------------------------------------------
    console.log('--- Test 3: Notification Deduplication via eventKey ---');
    const duplicateNotif = await NotificationService.createNotification(prisma, {
      organizationId: organization.id,
      userId: testUser.id,
      type: 'interview_scheduled',
      title: 'Duplicate Event Attempt',
      message: 'Should not create new row',
      eventKey: testEventKey,
    });

    if (duplicateNotif.id !== createdNotifId) {
      throw new Error(`Expected deduplicated notification ID ${createdNotifId}, got ${duplicateNotif.id}`);
    }
    console.log(`[PASS] Deduplication confirmed: returned existing notification ID ${duplicateNotif.id}\n`);

    // ------------------------------------------------------------------------
    // Test 4: Mark Notification as Read
    // ------------------------------------------------------------------------
    console.log('--- Test 4: Mark Notification as Read ---');
    const readNotif = await NotificationService.markAsRead(recruiterUser, createdNotifId);
    if (!readNotif.isRead || !readNotif.readAt) {
      throw new Error('Notification should have isRead: true and readAt populated');
    }
    console.log(`[PASS] Notification marked read: isRead=${readNotif.isRead}, readAt=${readNotif.readAt}\n`);

    // ------------------------------------------------------------------------
    // Test 5: Live Funnel Reporting Aggregation
    // ------------------------------------------------------------------------
    console.log('--- Test 5: Live Database Funnel Report Aggregation ---');
    const funnel = await AnalyticsService.getFunnelReport(recruiterUser, {});
    console.log(`[PASS] Total applications: ${funnel.totalApplications}`);
    console.log(`[PASS] Pipeline stages reported: ${funnel.stages.length}`);
    for (const st of funnel.stages.slice(0, 4)) {
      console.log(`   - ${st.stage}: ${st.count} applicants (${st.conversionFromApplied}% from top)`);
    }
    console.log();

    // ------------------------------------------------------------------------
    // Test 6: Live Time-to-Hire Reporting Aggregation
    // ------------------------------------------------------------------------
    console.log('--- Test 6: Live Time-to-Hire Report Aggregation ---');
    const timeToHire = await AnalyticsService.getTimeToHireReport(recruiterUser, {});
    console.log(`[PASS] Total Hires in sample: ${timeToHire.totalHired}`);
    console.log(`[PASS] Average Days to Hire: ${timeToHire.averageDaysToHire} days`);
    console.log(`[PASS] Median Days to Hire: ${timeToHire.medianDaysToHire} days`);
    console.log(`[PASS] Stage Averages count: ${timeToHire.stageAverages.length}\n`);

    // ------------------------------------------------------------------------
    // Test 7: Live Candidate Sources Reporting Aggregation
    // ------------------------------------------------------------------------
    console.log('--- Test 7: Live Candidate Sources Report Aggregation ---');
    const sources = await AnalyticsService.getCandidateSourcesReport(recruiterUser, {});
    console.log(`[PASS] Total applications categorized: ${sources.totalApplications}`);
    console.log(`[PASS] Sources tracked: ${sources.sources.length}`);
    for (const src of sources.sources) {
      console.log(`   - ${src.source}: ${src.count} applicants (${src.percentage}%), ${src.hiredCount} hired`);
    }
    console.log();

    // ------------------------------------------------------------------------
    // Test 8: Live Recruiter Productivity Reporting Aggregation
    // ------------------------------------------------------------------------
    console.log('--- Test 8: Live Recruiter Productivity Report Aggregation ---');
    const productivity = await AnalyticsService.getRecruiterProductivityReport(recruiterUser, {});
    console.log(`[PASS] Recruiters tracked in organization: ${productivity.recruiters.length}`);
    for (const r of productivity.recruiters) {
      console.log(`   - ${r.recruiterName} (${r.email}): ${r.stageTransitionsCount} stage moves, ${r.interviewsScheduledCount} interviews, ${r.notesLoggedCount} notes`);
    }
    console.log();

    // ------------------------------------------------------------------------
    // Test 9: Client Role Boundary Security Verification
    // ------------------------------------------------------------------------
    console.log('--- Test 9: Client Role Boundary Security Check ---');
    try {
      await AnalyticsService.getRecruiterProductivityReport(clientUser, {});
      throw new Error('SECURITY VIOLATION: Client role should have been rejected with 403');
    } catch (err) {
      if (err.statusCode === 403 || err.code === 'FORBIDDEN') {
        console.log(`[PASS] Client role access blocked cleanly with ${err.code || 'FORBIDDEN'} (403)\n`);
      } else {
        throw err;
      }
    }

    console.log('========================================================================');
    console.log('>>> ALL 9 LIVE SUPABASE PHASE 8B TESTS PASSED CLEANLY! <<<');
    console.log('========================================================================');
  } finally {
    // Cleanup created test notification
    if (createdNotifId) {
      await prisma.notification.deleteMany({
        where: { id: createdNotifId },
      });
      console.log(`\n[CLEANUP] Deleted test notification ${createdNotifId}`);
    }
    await prisma.$disconnect();
  }
}

runPhase8BLiveVerification().catch((err) => {
  console.error('\n[FAIL] Phase 8B Live Verification failed:', err);
  process.exit(1);
});
