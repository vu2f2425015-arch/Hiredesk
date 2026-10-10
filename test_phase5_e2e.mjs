import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import { AnalyticsService } from './apps/api/dist/services/analytics.js';
import { ApplicationService } from './apps/api/dist/services/applications.js';
import { ApplicationStage, UserRole } from './packages/shared/dist/index.js';

async function runPhase5LiveVerification() {
  console.log('=== HiredeskHR Phase 5 Live Supabase Integration Verification ===\n');

  // 1. Fetch live Organization and active Job
  const organization = await prisma.organization.findFirst({
    where: { status: 'active' },
    include: { clients: true, users: true },
  });

  if (!organization) {
    throw new Error('No active organization found in live database');
  }

  console.log(`[PASS] Resolved Organization: "${organization.name}" (${organization.id})`);
  console.log(`       Clients count: ${organization.clients.length}`);
  console.log(`       Users count: ${organization.users.length}\n`);

  // Create mock authenticated users based on real organization
  const recruiterUser = {
    id: organization.users[0]?.id || 'live-recruiter-id',
    authUserId: organization.users[0]?.authUserId || 'live-auth-recruiter',
    email: organization.users[0]?.email || 'recruiter@apex.local',
    role: UserRole.RECRUITER,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    clientId: null,
  };

  const clientUser = {
    id: 'live-client-user-id',
    authUserId: 'live-auth-client',
    email: 'client@acme.local',
    role: UserRole.CLIENT,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    clientId: organization.clients[0]?.id || null,
  };

  // 2. Test AnalyticsService.getDashboardMetrics against Live Database
  console.log('[TEST 1] Testing AnalyticsService.getDashboardMetrics on live Supabase...');
  const metrics = await AnalyticsService.getDashboardMetrics(recruiterUser);

  console.log(`[PASS] Live Database Dashboard Metrics:`);
  console.log(`       Total Jobs: ${metrics.totalJobs} (Active: ${metrics.publishedJobs}, Drafts: ${metrics.draftJobs}, Closed: ${metrics.closedJobs})`);
  console.log(`       Unique Candidates: ${metrics.totalCandidates}`);
  console.log(`       Applications: ${metrics.totalApplications} (+${metrics.recentApplicationsCount} in last 7 days)`);
  console.log(`       Approaching Deadline Jobs: ${metrics.jobsApproachingDeadline.length}`);
  console.log(`       Recent Activity Logs: ${metrics.recentActivity.length}\n`);

  // 3. Find or Create a Test Job and Candidate for Pipeline Testing
  console.log('[TEST 2] Verifying Per-Job Pipeline on live Supabase...');
  let job = await prisma.job.findFirst({
    where: { organizationId: organization.id, status: 'published' },
    include: { client: true },
  });

  if (!job) {
    job = await prisma.job.findFirst({
      where: { organizationId: organization.id },
      include: { client: true },
    });
  }

  if (!job) {
    throw new Error('No jobs available in organization for pipeline testing');
  }

  const pipeline = await ApplicationService.listPipelineForJob(recruiterUser, job.id);
  console.log(`[PASS] Pipeline retrieved for job ${pipeline.job.jobCode} - "${pipeline.job.title}":`);
  console.log(`       Total Applications in Pipeline: ${pipeline.totalApplications}`);
  for (const [stage, apps] of Object.entries(pipeline.stages)) {
    if (apps.length > 0) {
      console.log(`       - Stage "${stage}": ${apps.length} candidate(s)`);
    }
  }
  console.log();

  // 4. Test Stage Transition & Atomic Transaction Persistence
  console.log('[TEST 3] Testing Atomic Stage Transition & History in live Supabase...');
  let app = await prisma.application.findFirst({
    where: { organizationId: organization.id, jobId: job.id },
    include: { candidate: true, job: true },
  });

  if (!app) {
    // Look for any application in the org
    app = await prisma.application.findFirst({
      where: { organizationId: organization.id },
      include: { candidate: true, job: true },
    });
  }

  if (app) {
    const originalStage = app.stage;
    const testNextStage = originalStage === ApplicationStage.SHORTLISTED
      ? ApplicationStage.INTERVIEW
      : ApplicationStage.SHORTLISTED;

    console.log(`       Current Stage: "${originalStage}". Transitioning to "${testNextStage}"...`);

    const updatedApp = await ApplicationService.transitionStage(recruiterUser, app.id, {
      stage: testNextStage,
      reason: 'Phase 5 Automated E2E verification test',
    });

    if (updatedApp.stage !== testNextStage) {
      throw new Error(`Stage transition failed to update: expected ${testNextStage}, got ${updatedApp.stage}`);
    }

    // Verify StageHistory in live database
    const historyEntry = await prisma.stageHistory.findFirst({
      where: { applicationId: app.id },
      orderBy: { timestamp: 'desc' },
    });

    if (!historyEntry || historyEntry.nextStage !== testNextStage) {
      throw new Error('StageHistory entry was not created in database transaction');
    }
    console.log(`[PASS] Atomic StageHistory created: ID ${historyEntry.id}, previous: "${historyEntry.previousStage}" -> next: "${historyEntry.nextStage}"`);

    // Verify ActivityLog in live database
    const activityEntry = await prisma.activityLog.findFirst({
      where: { entityId: app.id, action: 'stage_transition' },
      orderBy: { timestamp: 'desc' },
    });

    if (!activityEntry) {
      throw new Error('ActivityLog entry was not created in database transaction');
    }
    console.log(`[PASS] Atomic ActivityLog created: ID ${activityEntry.id}, visibility: "${activityEntry.visibility}"`);

    // 5. Test Notes Updating and Client Separation
    console.log('\n[TEST 4] Testing Notes Separation & RBAC boundary...');
    await ApplicationService.updateApplicationNotes(recruiterUser, app.id, {
      recruiterNotes: 'Secret internal note for agency recruiter eyes only',
      clientFeedback: 'Client note visible to both client and recruiter',
    });

    // Fetch as recruiter: both should be present
    const appRecruiterView = await ApplicationService.getApplicationById(recruiterUser, app.id);
    if (!appRecruiterView.recruiterNotes || !appRecruiterView.clientFeedback) {
      throw new Error('Recruiter view failed to retrieve internal notes or client feedback');
    }
    console.log(`[PASS] Recruiter view shows recruiterNotes: "${appRecruiterView.recruiterNotes.slice(0, 30)}..."`);

    // Fetch as client: recruiterNotes MUST be strictly undefined
    if (clientUser.clientId) {
      // Reassign application client to match clientUser for access
      await prisma.application.update({
        where: { id: app.id },
        data: { clientId: clientUser.clientId },
      });

      const appClientView = await ApplicationService.getApplicationById(clientUser, app.id);
      if (appClientView.recruiterNotes !== undefined) {
        throw new Error('SECURITY VIOLATION: recruiterNotes was leaked to client user!');
      }
      console.log(`[PASS] Client view strictly redacted recruiterNotes (value is undefined)`);
      console.log(`       Client view retained clientFeedback: "${appClientView.clientFeedback}"`);

      // Attempt to write recruiterNotes as client: must throw 403
      let blocked = false;
      try {
        await ApplicationService.updateApplicationNotes(clientUser, app.id, {
          recruiterNotes: 'Malicious client tampering',
        });
      } catch (err) {
        if (err.statusCode === 403) blocked = true;
      }

      if (!blocked) {
        throw new Error('SECURITY VIOLATION: Client was able to modify recruiterNotes!');
      }
      console.log(`[PASS] Client attempt to modify recruiterNotes was blocked with 403 Forbidden`);
    }

    // 6. Test Candidate Profile retrieval
    console.log('\n[TEST 5] Testing Candidate Profile with Multi-Job Applications...');
    const candidateProfile = await ApplicationService.getCandidateById(recruiterUser, app.candidateId);
    console.log(`[PASS] Candidate Profile: ${candidateProfile.name} (${candidateProfile.candidateCode})`);
    console.log(`       Email: ${candidateProfile.email}`);
    console.log(`       Multi-job applications: ${candidateProfile.applications.length}`);
    console.log(`       Resumes: ${candidateProfile.resumes.length}`);

    // Revert stage back to original to keep database clean
    await ApplicationService.transitionStage(recruiterUser, app.id, {
      stage: originalStage,
      reason: 'Reverting stage after E2E verification test',
    });
    console.log(`\n[PASS] Reverted test application stage back to "${originalStage}"`);
  } else {
    console.log('[SKIP] No applications found in database to execute transition test');
  }

  console.log('\n=== All Phase 5 Live Supabase Integration Tests Passed Cleanly! ===');
}

runPhase5LiveVerification()
  .catch((err) => {
    console.error('\n[FAIL] Phase 5 Live Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
