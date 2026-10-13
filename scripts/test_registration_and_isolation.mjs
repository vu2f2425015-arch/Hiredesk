import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:4000/api';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://osrbdzeyqbresvineakk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('SUPABASE_ANON_KEY is missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Starting Verification: Registration, Clean Workspace & Isolation');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST CASE 1: Brand-New User Registration & Clean Workspace Verification
  // -------------------------------------------------------------------------
  const timestamp = Date.now();
  const testEmail = `new.agency.${timestamp}@testpilot.org`;
  const testPassword = 'StrongPassword123!#';
  const orgName = `Apex Search Partners ${timestamp}`;

  console.log(`[TEST 1] Registering brand-new agency user: ${testEmail}...`);
  const registerRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      firstName: 'Marcus',
      lastName: 'Vance',
      organizationName: orgName,
    }),
  });

  const registerJson = await registerRes.json();
  if (!registerRes.ok || !registerJson.success) {
    throw new Error(`Registration failed (${registerRes.status}): ${JSON.stringify(registerJson)}`);
  }

  const { user: regUser, organization: regOrg, defaultClientId } = registerJson.data;
  console.log(`✅ Registration succeeded!`);
  console.log(`   - User ID: ${regUser.id}`);
  console.log(`   - Email: ${regUser.email}`);
  console.log(`   - Role: ${regUser.role} (strictly verified NOT super_admin)`);
  console.log(`   - Organization: ${regOrg.name} (ID: ${regOrg.id}, Slug: ${regOrg.slug})`);
  console.log(`   - Default Client ID: ${defaultClientId}`);

  if (regUser.role === 'super_admin') {
    throw new Error('SECURITY VIOLATION: Self-registered user was granted super_admin!');
  }

  // Sign in via Supabase to obtain JWT
  console.log(`\n[TEST 1] Signing in with registered credentials via Supabase Auth...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authError || !authData.session) {
    throw new Error(`Sign in failed for newly registered user: ${authError?.message}`);
  }

  const newAuthToken = authData.session.access_token;
  console.log(`✅ Supabase Auth session established. Verified JWT acquired.`);

  // Verify /api/me profile
  const meRes = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${newAuthToken}` },
  });
  const meJson = await meRes.json();
  if (!meRes.ok || !meJson.success) {
    throw new Error(`Failed /api/me verification: ${JSON.stringify(meJson)}`);
  }
  console.log(`✅ GET /api/me verified: Authenticated as ${meJson.data.user.email} in org ${meJson.data.user.organizationName}`);

  // Verify Dashboard Metrics for new user is 100% CLEAN (Zero Mock Data)
  console.log(`\n[TEST 1] Verifying dashboard metrics contains ZERO mock business data...`);
  const metricsRes = await fetch(`${API_BASE}/analytics/dashboard`, {
    headers: { Authorization: `Bearer ${newAuthToken}` },
  });
  const metricsJson = await metricsRes.json();
  if (!metricsRes.ok || !metricsJson.success) {
    throw new Error(`Failed to fetch dashboard metrics: ${JSON.stringify(metricsJson)}`);
  }

  const metrics = metricsJson.data;
  console.log('   Metrics received:', {
    totalJobs: metrics.totalJobs,
    publishedJobs: metrics.publishedJobs,
    totalCandidates: metrics.totalCandidates,
    totalApplications: metrics.totalApplications,
    approachingDeadlines: (metrics.jobsApproachingDeadline || []).length,
    recentActivity: (metrics.recentActivity || []).length,
  });

  if (metrics.totalJobs !== 0 || metrics.totalCandidates !== 0 || metrics.totalApplications !== 0) {
    throw new Error(`MOCK DATA LEAK: Newly registered user has non-zero mock metrics! (Jobs: ${metrics.totalJobs}, Candidates: ${metrics.totalCandidates})`);
  }
  console.log(`✅ Verified: Brand-new workspace contains 0 jobs, 0 candidates, 0 applications. Clean database state confirmed!`);

  // Verify Jobs list is empty
  const jobsRes = await fetch(`${API_BASE}/jobs`, {
    headers: { Authorization: `Bearer ${newAuthToken}` },
  });
  const jobsJson = await jobsRes.json();
  const jobsList = Array.isArray(jobsJson.data) ? jobsJson.data : (jobsJson.data?.jobs || []);
  if (jobsList.length !== 0) {
    throw new Error(`MOCK DATA LEAK: Found ${jobsList.length} jobs in new user's vacancy list!`);
  }
  console.log(`✅ Verified: Vacancy list is empty (0 jobs).`);

  // Verify creating a real job works seamlessly using the default client
  console.log(`\n[TEST 1] Creating a real vacancy in new user's workspace...`);
  const createJobRes = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${newAuthToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: defaultClientId,
      title: 'Principal Software Architect',
      employmentType: 'full_time',
      workplaceModel: 'remote',
      country: 'United States',
      currency: 'USD',
      salaryMin: 180000,
      salaryMax: 240000,
      experienceYears: 8,
      openings: 1,
      skills: ['TypeScript', 'Distributed Systems', 'PostgreSQL'],
      description: 'Lead engineering architectural decisions across scalable multi-tenant services.',
      status: 'draft',
    }),
  });
  const createJobJson = await createJobRes.json();
  if (!createJobRes.ok || !createJobJson.success) {
    throw new Error(`Failed to create first job: ${JSON.stringify(createJobJson)}`);
  }
  const newJob = createJobJson.data;
  console.log(`✅ Real vacancy created: [${newJob.jobCode}] "${newJob.title}" (Status: ${newJob.status})`);

  // Check metrics again: exactly 1 totalJob, 1 draftJob
  const postJobMetricsRes = await fetch(`${API_BASE}/analytics/dashboard`, {
    headers: { Authorization: `Bearer ${newAuthToken}` },
  });
  const postMetrics = (await postJobMetricsRes.json()).data;
  if (postMetrics.totalJobs !== 1 || postMetrics.draftJobs !== 1) {
    throw new Error(`Expected exactly 1 job in metrics, got ${postMetrics.totalJobs}`);
  }
  console.log(`✅ Database-backed metrics updated immediately: Total Jobs: ${postMetrics.totalJobs}, Drafts: ${postMetrics.draftJobs}`);


  // -------------------------------------------------------------------------
  // TEST CASE 2: Existing User Signing In
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('[TEST 2] Testing existing user sign in (admin@hiredesk.io)...');
  const { data: adminAuth, error: adminError } = await supabase.auth.signInWithPassword({
    email: 'admin@hiredesk.io',
    password: 'AdminPassword123!',
  });

  if (adminError || !adminAuth.session) {
    throw new Error(`Admin sign in failed: ${adminError?.message}`);
  }

  const adminToken = adminAuth.session.access_token;
  const adminMeRes = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminMe = (await adminMeRes.json()).data;
  console.log(`✅ Admin sign in verified: ${adminMe.user.email} (Role: ${adminMe.user.role})`);

  // Find an existing job belonging to Acme Talent Agency
  const existingJobsRes = await fetch(`${API_BASE}/jobs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const existingData = (await existingJobsRes.json()).data;
  const existingJobs = Array.isArray(existingData) ? existingData : (existingData?.jobs || []);
  const acmeJob = existingJobs.find((j) => j.organizationId !== regOrg.id);
  console.log(`✅ Existing jobs retrieved: ${existingJobs.length} jobs found. Picked Acme job: ${acmeJob ? acmeJob.jobCode : 'none'}`);


  // -------------------------------------------------------------------------
  // TEST CASE 3: Multi-Tenant Isolation & Cross-Agency Guard
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('[TEST 3] Testing tenant boundary enforcement (User attempting cross-tenant access)...');

  if (acmeJob) {
    console.log(`   New user (${testEmail}) attempting to update Acme Job ${acmeJob.jobCode} (${acmeJob.id})...`);
    const crossTenantUpdateRes = await fetch(`${API_BASE}/jobs/${acmeJob.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${newAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Hacked Job Title',
      }),
    });

    console.log(`   Response status: ${crossTenantUpdateRes.status}`);
    const updateJson = await crossTenantUpdateRes.json();
    console.log(`   Response payload:`, updateJson);

    if (crossTenantUpdateRes.status === 200) {
      throw new Error(`CRITICAL SECURITY FAILURE: Cross-tenant job modification succeeded!`);
    } else {
      console.log(`✅ Cross-tenant job modification was REJECTED with status ${crossTenantUpdateRes.status} (${updateJson.error?.code || 'BLOCKED'})`);
    }

    // Attempting to close/publish Acme Job
    const crossTenantCloseRes = await fetch(`${API_BASE}/jobs/${acmeJob.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newAuthToken}` },
    });
    console.log(`   Attempt to close Acme Job response: ${crossTenantCloseRes.status}`);
    if (crossTenantCloseRes.status === 200) {
      throw new Error(`CRITICAL SECURITY FAILURE: Cross-tenant job close succeeded!`);
    }
    console.log(`✅ Cross-tenant job status mutation was REJECTED (${crossTenantCloseRes.status})`);
  }

  // Attempting to create user with SUPER_ADMIN role (Privilege Escalation Guard)
  console.log(`\n[TEST 3] Attempting privilege escalation: New manager trying to create a super_admin...`);
  const escalationRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${newAuthToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authUserId: '00000000-0000-0000-0000-000000000000',
      email: 'hacker@exploit.com',
      firstName: 'Evil',
      lastName: 'Hacker',
      role: 'super_admin',
    }),
  });
  console.log(`   Privilege escalation attempt response: ${escalationRes.status}`);
  const escalationJson = await escalationRes.json();
  if (escalationRes.status === 201) {
    throw new Error('CRITICAL SECURITY FAILURE: Non-super-admin was allowed to create super_admin!');
  }
  console.log(`✅ Privilege escalation BLOCKED with status ${escalationRes.status} (${escalationJson.error?.code})`);

  console.log('\n================================================================');
  console.log('🎉 ALL THREE TEST CASES PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
