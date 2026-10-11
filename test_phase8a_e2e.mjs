import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import { TalentPoolService } from './apps/api/dist/services/talentPool.js';
import { UserRole } from './packages/shared/dist/index.js';

async function runPhase8ALiveVerification() {
  console.log('=== HiredeskHR Phase 8A Live Supabase Talent Pool Verification ===\n');

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
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!organization) {
    throw new Error('No active organization found in live database');
  }

  console.log(`[PASS] Resolved Organization: "${organization.name}" (${organization.id})\n`);

  // Recruiter user context
  const recruiterUser = {
    id: 'live-recruiter-uuid',
    authUserId: 'live-auth-recruiter-uuid',
    email: 'recruiter.test@agency.local',
    firstName: 'Rachel',
    lastName: 'Recruiter',
    fullName: 'Rachel Recruiter',
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
    email: 'client.test@company.local',
    firstName: 'Charlie',
    lastName: 'Client',
    fullName: 'Charlie Client',
    role: UserRole.CLIENT,
    organizationId: organization.id,
    organizationName: organization.name,
    clientId: organization.clients[0]?.id || null,
    clientName: organization.clients[0]?.name || null,
    isActive: true,
  };

  // [TEST 1] List candidates
  console.log('[TEST 1] Testing TalentPoolService.listCandidates on live Supabase...');
  const candidatesResult = await TalentPoolService.listCandidates(recruiterUser, { page: 1, limit: 10 });
  console.log(`[PASS] Retrieved ${candidatesResult.candidates.length} candidate(s) (Total in DB: ${candidatesResult.pagination.total}):`);
  for (const c of candidatesResult.candidates) {
    console.log(`       - [${c.candidateCode}] ${c.name} (${c.email}) - Apps: ${c.totalApplications}, Folders: [${c.folders.map(f => f.name).join(', ')}]`);
  }
  console.log();

  // [TEST 2] Folder CRUD & Membership Lifecycle
  console.log('[TEST 2] Testing Folder CRUD & Membership on live Supabase...');
  const testFolderName = `TalentPool-Test-${Date.now().toString().slice(-4)}`;
  const createdFolder = await TalentPoolService.createFolder(recruiterUser, {
    name: testFolderName,
    description: 'Automated live test folder for Phase 8A',
  });
  console.log(`[PASS] Created folder: "${createdFolder.name}" (ID: ${createdFolder.id})`);

  // Verify listFolders includes new folder
  const foldersList = await TalentPoolService.listFolders(recruiterUser);
  const foundFolder = foldersList.find(f => f.id === createdFolder.id);
  if (!foundFolder) throw new Error('Created folder not found in listFolders');
  console.log(`[PASS] Verified folder appears in list with candidateCount: ${foundFolder.candidateCount}`);

  // If candidates exist, test adding candidate to folder
  if (candidatesResult.candidates.length > 0) {
    const candidateToTag = candidatesResult.candidates[0];
    console.log(`\n[TEST 3] Adding candidate ${candidateToTag.name} to folder "${createdFolder.name}"...`);
    const addResult = await TalentPoolService.addCandidateToFolder(recruiterUser, createdFolder.id, candidateToTag.id);
    console.log(`[PASS] ${addResult.message}`);

    // Verify folder query filter returns candidate
    const folderFilterResult = await TalentPoolService.listCandidates(recruiterUser, { folderId: createdFolder.id });
    if (!folderFilterResult.candidates.some(c => c.id === candidateToTag.id)) {
      throw new Error('Candidate not returned when filtering by folderId');
    }
    console.log(`[PASS] Verified candidate is returned when querying with folderId filter`);

    // Remove candidate from folder
    console.log(`\n[TEST 4] Removing candidate from folder...`);
    const removeResult = await TalentPoolService.removeCandidateFromFolder(recruiterUser, createdFolder.id, candidateToTag.id);
    console.log(`[PASS] ${removeResult.message}`);

    // Verify candidate person record still exists
    const candidateStillExists = await prisma.candidate.findUnique({ where: { id: candidateToTag.id } });
    if (!candidateStillExists) throw new Error('Candidate record was deleted during folder removal!');
    console.log(`[PASS] Candidate record ${candidateStillExists.name} remains completely intact in database`);
  }

  // Delete folder
  console.log(`\n[TEST 5] Deleting test folder...`);
  const deleteResult = await TalentPoolService.deleteFolder(recruiterUser, createdFolder.id);
  console.log(`[PASS] Folder deleted successfully: ${deleteResult.success}`);

  // [TEST 6] Negative Authorization Check (Client user must be rejected)
  console.log(`\n[TEST 6] Verifying client user cannot access Talent Pool...`);
  try {
    await TalentPoolService.listCandidates(clientUser, {});
    throw new Error('FAILED: Client user was allowed to access talent pool!');
  } catch (err) {
    if (err.statusCode === 403 && err.code === 'FORBIDDEN') {
      console.log(`[PASS] Client user access strictly blocked with 403 FORBIDDEN: "${err.message}"`);
    } else {
      throw err;
    }
  }

  console.log('\n=== All Phase 8A Live Supabase Integration Tests Passed Cleanly! ===\n');
  await prisma.$disconnect();
}

runPhase8ALiveVerification().catch(err => {
  console.error('\n[FAIL] Phase 8A live verification failed:', err);
  process.exit(1);
});
