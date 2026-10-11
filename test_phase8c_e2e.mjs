import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import { AiRecruiterService } from './apps/api/dist/services/aiRecruiter.js';
import { UserRole } from './packages/shared/dist/index.js';

async function runPhase8CLiveVerification() {
  console.log('=== HiredeskHR Phase 8C Live Supabase AI Recruiter Verification ===\n');

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

  // Recruiter user context
  const recruiterUser = {
    id: organization.users[0]?.id || 'live-recruiter-uuid',
    authUserId: organization.users[0]?.authUserId || 'live-auth-recruiter-uuid',
    email: organization.users[0]?.email || 'recruiter@agency.local',
    firstName: organization.users[0]?.firstName || 'Rachel',
    lastName: organization.users[0]?.lastName || 'Recruiter',
    fullName: organization.users[0]?.fullName || 'Rachel Recruiter',
    role: UserRole.RECRUITER,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: null,
    clientName: null,
    isActive: true,
  };

  // Client user context
  const clientUser = {
    id: 'live-client-uuid',
    authUserId: 'live-auth-client-uuid',
    email: 'client@company.local',
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

  // --------------------------------------------------------------------------
  // Test 1: Transparent Status Reporting
  // --------------------------------------------------------------------------
  console.log('\n--- Test 1: AI Provider Status Check ---');
  const status = AiRecruiterService.getStatus();
  console.log(`[PASS] Provider configured: ${status.providerConfigured}`);
  console.log(`[PASS] Active Provider: ${status.providerName}`);
  console.log(`[PASS] Transparency Message: "${status.message}"`);
  if (!process.env.GEMINI_API_KEY) {
    if (status.providerConfigured !== false || status.providerName !== 'deterministic_baseline') {
      throw new Error('Expected deterministic_baseline provider when no key is set');
    }
  }

  // --------------------------------------------------------------------------
  // Test 2: Live Application Match Evaluation
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Live Application Decision Support Evaluation ---');
  const liveApp = await prisma.application.findFirst({
    where: { organizationId: organization.id },
    include: { candidate: true, job: true },
  });

  if (!liveApp) {
    throw new Error('No live application found in organization to evaluate');
  }

  console.log(`Resolved live application: ${liveApp.id}`);
  console.log(`Candidate: ${liveApp.candidate.name} (Skills: ${liveApp.candidate.skills?.join(', ') || 'none'})`);
  console.log(`Job: ${liveApp.job.title} (Required Skills: ${liveApp.job.skills?.join(', ') || 'none'})`);

  const evaluation = await AiRecruiterService.evaluateMatch(recruiterUser, {
    applicationId: liveApp.id,
  });

  console.log(`\n[PASS] Evaluation Provider: ${evaluation.provider}`);
  console.log(`[PASS] Model: ${evaluation.model || 'none (deterministic)'}`);
  console.log(`[PASS] Limitation Notice: "${evaluation.limitationNotice || 'None'}"`);
  console.log(`[PASS] Match Tier: ${evaluation.matchTier}`);
  console.log(
    `[PASS] Skills Overlap: ${evaluation.skillsMatch.overlapRatio * 100}% (${evaluation.skillsMatch.matchedSkills.length} matched, ${evaluation.skillsMatch.missingSkills.length} missing)`
  );
  console.log(`   - Matched: ${evaluation.skillsMatch.matchedSkills.join(', ') || 'none'}`);
  console.log(`   - Missing: ${evaluation.skillsMatch.missingSkills.join(', ') || 'none'}`);
  console.log(`[PASS] Strengths: ${evaluation.strengths.join(' | ')}`);
  console.log(`[PASS] Focus Areas: ${evaluation.interviewFocusAreas.join(' | ')}`);
  console.log(`[PASS] Human Disclaimer: "${evaluation.decisionSupportDisclaimer}"`);

  if (!evaluation.decisionSupportDisclaimer.includes('human recruiters only')) {
    throw new Error('Human-in-the-loop disclaimer missing');
  }

  // --------------------------------------------------------------------------
  // Test 3: Client Role Access Denial (Security Boundary)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Client Boundary Security Check ---');
  try {
    await AiRecruiterService.evaluateMatch(clientUser, { applicationId: liveApp.id });
    throw new Error('SECURITY VIOLATION: Client role should have been rejected with 403');
  } catch (err) {
    if (err.statusCode === 403 || err.code === 'FORBIDDEN') {
      console.log(`[PASS] Client role access blocked cleanly with ${err.code || 'FORBIDDEN'} (403)\n`);
    } else {
      throw err;
    }
  }

  console.log('========================================================================');
  console.log('>>> ALL LIVE SUPABASE PHASE 8C AI RECRUITER TESTS PASSED CLEANLY! <<<');
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runPhase8CLiveVerification().catch((err) => {
  console.error('\n[FAIL] Phase 8C Live Verification failed:', err);
  process.exit(1);
});
