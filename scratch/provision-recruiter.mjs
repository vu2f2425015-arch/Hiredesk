import { createClient } from '@supabase/supabase-js';
import { prisma } from '@hiredesk/database';

async function main() {
  const sb = createClient(
    'https://osrbdzeyqbresvineakk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcmJkemV5cWJyZXN2aW5lYWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTY1NjM0MSwiZXhwIjoyMTA3MjMyMzQxfQ.u2jL2_OT9AO4BPaR2TMQgZadAPFrT1Dx3ggSEzBMiR4'
  );

  const email = 'recruiter@agency.com';
  const password = 'Password123!';

  // Check if exists in Supabase
  const { data: { users } } = await sb.auth.admin.listUsers();
  let user = users.find(u => u.email === email);

  if (!user) {
    console.log('Creating auth user in Supabase...');
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName: 'Recruiter',
        lastName: 'Lead',
        organizationName: 'hvhgv',
      },
    });
    if (error) throw error;
    user = data.user;
    console.log('Created Supabase user:', user.id);
  } else {
    console.log('User already exists in Supabase, updating password and confirming email...');
    await sb.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
  }

  // Find organization 'hvhgv'
  const org = await prisma.organization.findFirst({
    where: { slug: 'hvhgv-1' },
  });

  if (!org) {
    throw new Error('Organization hvhgv-1 not found');
  }

  // Upsert user profile in DB
  const profile = await prisma.userProfile.upsert({
    where: { authUserId: user.id },
    update: {
      email,
      organizationId: org.id,
      role: 'manager',
      isActive: true,
    },
    create: {
      authUserId: user.id,
      email,
      firstName: 'Recruiter',
      lastName: 'Lead',
      fullName: 'Recruiter Lead',
      role: 'manager',
      organizationId: org.id,
      isActive: true,
    },
  });

  console.log('Upserted UserProfile:', profile);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
