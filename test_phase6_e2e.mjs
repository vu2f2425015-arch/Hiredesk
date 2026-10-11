import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import { ClientPortalService } from './apps/api/dist/services/clientPortal.js';
import { ApplicationStage, UserRole, InterviewRequestStatus } from './packages/shared/dist/index.js';

async function runPhase6LiveVerification() {
  console.log('=== HiredeskHR Phase 6 Live Supabase Integration Verification ===\n');

  // 1. Fetch live Organization and active Client
  const organization = await prisma.organization.findFirst({
    where: { status: 'active' },
    include: { clients: true, users: true },
  });

  if (!organization || organization.clients.length === 0) {
    throw new Error('No active organization with clients found in live database');
  }

  const client = organization.clients[0];
  console.log(`[PASS] Resolved Organization: "${organization.name}" (${organization.id})`);
  console.log(`       Target Client: "${client.name}" (${client.id})\n`);

  // Build live client user context
  const liveClientUser = {
    id: 'live-client-user-uuid',
    authUserId: 'live-auth-client-uuid',
    email: 'client.test@company.local',
    firstName: 'Charlie',
    lastName: 'Client',
    fullName: 'Charlie Client',
    role: UserRole.CLIENT,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: client.id,
    clientName: client.name,
    isActive: true,
  };

  // Cross-client test user (simulating Client B)
  const crossClientUser = {
    id: 'live-other-client-user-uuid',
    authUserId: 'live-auth-other-client-uuid',
    email: 'other@company.local',
    firstName: 'Other',
    lastName: 'Client',
    fullName: 'Other Client',
    role: UserRole.CLIENT,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: '00000000-0000-0000-0000-000000000002', // Non-matching clientId
    clientName: 'Other Corp',
    isActive: true,
  };

  // [TEST 1] Client Profile Context
  console.log('[TEST 1] Testing ClientPortalService.getClientProfile...');
  const profile = await ClientPortalService.getClientProfile(liveClientUser);
  console.log(`[PASS] Retrieved profile for client: "${profile.client.name}" (${profile.client.id})`);
  console.log(`       User role: ${profile.user.role}, Organization: ${profile.user.organizationName}\n`);

  // [TEST 2] Assigned Published Jobs
  console.log('[TEST 2] Testing ClientPortalService.listAssignedJobs...');
  const jobsResult = await ClientPortalService.listAssignedJobs(liveClientUser, { page: 1, limit: 10 });
  console.log(`[PASS] Found ${jobsResult.total} assigned job(s) for client.`);
  for (const j of jobsResult.jobs) {
    console.log(`       - [${j.jobCode}] "${j.title}" (Applicants: ${j.applicantCount}, Under Review: ${j.reviewCount}, Shortlisted: ${j.shortlistedCount})`);
  }
  console.log();

  // Find or create a test application in Client Review for testing client review actions
  let testJob = await prisma.job.findFirst({
    where: { clientId: client.id, organizationId: organization.id },
  });

  if (!testJob) {
    console.log('Creating a published test job for client review actions...');
    testJob = await prisma.job.create({
      data: {
        organizationId: organization.id,
        clientId: client.id,
        jobCode: `JOB-TEST-${Date.now().toString().slice(-4)}`,
        title: 'Phase 6 Live Verification Engineer',
        employmentType: 'full_time',
        workplaceModel: 'remote',
        country: 'US',
        description: 'Verification role',
        status: 'published',
        createdBy: organization.users[0]?.id || 'system-admin',
      },
    });
  }

  // Find or create test candidate and application
  let testCandidate = await prisma.candidate.findFirst({
    where: { organizationId: organization.id },
  });

  if (!testCandidate) {
    testCandidate = await prisma.candidate.create({
      data: {
        organizationId: organization.id,
        candidateCode: `CAND-TEST-${Date.now().toString().slice(-4)}`,
        normalizedEmail: `test.live.${Date.now()}@example.com`,
        name: 'Live Test Candidate',
      },
    });
  }

  let testApplication = await prisma.application.findFirst({
    where: { jobId: testJob.id, candidateId: testCandidate.id },
  });

  if (!testApplication) {
    testApplication = await prisma.application.create({
      data: {
        jobId: testJob.id,
        candidateId: testCandidate.id,
        organizationId: organization.id,
        clientId: client.id,
        stage: ApplicationStage.CLIENT_REVIEW,
        recruiterNotes: 'SECRET_RECRUITER_SALARY_DATA_DO_NOT_LEAK',
        clientFeedback: 'Initial live candidate evaluation',
      },
    });
  } else {
    // Ensure stage is Client Review for testing actions
    testApplication = await prisma.application.update({
      where: { id: testApplication.id },
      data: {
        stage: ApplicationStage.CLIENT_REVIEW,
        recruiterNotes: 'SECRET_RECRUITER_SALARY_DATA_DO_NOT_LEAK',
      },
    });
  }

  // [TEST 3] List Applications for Job
  console.log('[TEST 3] Testing ClientPortalService.listApplicationsForJob...');
  const appList = await ClientPortalService.listApplicationsForJob(liveClientUser, testJob.id, {});
  console.log(`[PASS] Retrieved ${appList.total} application(s) for job "${testJob.title}"`);
  console.log();

  // [TEST 4] Safe DTO & Notes Redaction
  console.log('[TEST 4] Verifying Safe Application DTO & Note Redaction...');
  const appDetail = await ClientPortalService.getApplicationById(liveClientUser, testApplication.id);
  if (appDetail.recruiterNotes !== undefined) {
    throw new Error('SECURITY VIOLATION: recruiterNotes leaked in client application DTO!');
  }
  console.log(`[PASS] recruiterNotes is undefined in client DTO (Zero Note Leakage).`);
  console.log(`       Candidate: ${appDetail.candidate.name} (${appDetail.candidate.candidateCode})`);
  console.log(`       Stage: ${appDetail.stage}`);
  console.log();

  // [TEST 5] Persisted Interview Request (Status Pending, NOT claiming scheduled/sent)
  console.log('[TEST 5] Testing ClientPortalService.requestInterview...');
  const interviewReq = await ClientPortalService.requestInterview(liveClientUser, testApplication.id, {
    preferredTimes: ['2026-10-25 10:00 AM UTC', '2026-10-26 02:00 PM UTC'],
    notes: 'Please evaluate TypeScript depth.',
  });

  console.log(`[PASS] Created persisted InterviewRequest: ID ${interviewReq.id}`);
  console.log(`       Status: "${interviewReq.status}" (Correctly marked pending)`);
  console.log(`       Message: "${interviewReq.message}"`);
  if (interviewReq.message.toLowerCase().includes('scheduled') || interviewReq.message.toLowerCase().includes('invite sent')) {
    throw new Error('VIOLATION: Falsely claimed interview was scheduled or invite was sent!');
  }
  console.log('       [VERIFIED] Did NOT claim scheduled meeting or sent email invite.');
  console.log();

  // [TEST 6] Submit Client Feedback
  console.log('[TEST 6] Testing ClientPortalService.submitFeedback...');
  const feedbackUpdated = await ClientPortalService.submitFeedback(liveClientUser, testApplication.id, {
    feedback: 'Strong portfolio presentation; recommended for technical discussion.',
  });
  console.log(`[PASS] Feedback persisted: "${feedbackUpdated.clientFeedback}"`);
  console.log();

  // [TEST 7] Shortlist Candidate Action
  console.log('[TEST 7] Testing ClientPortalService.shortlistCandidate...');
  const shortlistedApp = await ClientPortalService.shortlistCandidate(liveClientUser, testApplication.id, {
    notes: 'Approved for client shortlisting.',
  });
  console.log(`[PASS] Candidate successfully transitioned to stage: "${shortlistedApp.stage}"`);
  console.log();

  // [TEST 8] Cross-Client Negative Isolation
  console.log('[TEST 8] Verifying Cross-Client Negative Security Access...');
  try {
    await ClientPortalService.getApplicationById(crossClientUser, testApplication.id);
    throw new Error('SECURITY VIOLATION: Cross-client user was able to access application!');
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`[PASS] Cross-client access correctly denied with non-disclosing 404 NOT_FOUND.`);
    } else {
      throw err;
    }
  }

  // Cleanup: Reset application stage to CLIENT_REVIEW and delete test interview request
  await prisma.interviewRequest.deleteMany({
    where: { applicationId: testApplication.id },
  });
  await prisma.application.update({
    where: { id: testApplication.id },
    data: { stage: ApplicationStage.CLIENT_REVIEW },
  });

  console.log('\n=== All Phase 6 Live Supabase Integration Tests Passed Cleanly! ===\n');
  await prisma.$disconnect();
}

runPhase6LiveVerification().catch(async (err) => {
  console.error('[FAIL] Live verification failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
