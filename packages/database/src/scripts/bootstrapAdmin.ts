import { prisma } from '../index.js';

/**
 * CLI Bootstrap Script for Platform Super Administrator
 * Usage:
 *   npx tsx src/scripts/bootstrapAdmin.ts <authUserId> <email> <firstName> <lastName>
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error('Usage: bootstrapAdmin <authUserId> <email> <firstName> <lastName>');
    process.exit(1);
  }

  const [authUserId, email, firstName, lastName] = args;

  console.log(`Checking existing platform administrators...`);
  const existing = await prisma.userProfile.findFirst({
    where: { role: 'super_admin' },
  });

  if (existing) {
    console.error(`ERROR: Platform super-admin already exists (Profile ID: ${existing.id}, Email: ${existing.email}).`);
    console.error('Bootstrap procedure is locked. Use authorized admin APIs for further administration.');
    process.exit(1);
  }

  const existingProfile = await prisma.userProfile.findUnique({
    where: { authUserId },
  });

  if (existingProfile) {
    console.error(`ERROR: A profile already exists for Supabase Auth UUID: ${authUserId}`);
    process.exit(1);
  }

  const profile = await prisma.userProfile.create({
    data: {
      authUserId,
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      role: 'super_admin',
      organizationId: null,
      clientId: null,
      isActive: true,
    },
  });

  console.log('SUCCESS: Platform super-admin bootstrapped:');
  console.log(`- Profile ID: ${profile.id}`);
  console.log(`- Auth User ID: ${profile.authUserId}`);
  console.log(`- Email: ${profile.email}`);
  console.log(`- Role: ${profile.role}`);
}

main()
  .catch((e) => {
    console.error('Bootstrap script encountered an unexpected error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
