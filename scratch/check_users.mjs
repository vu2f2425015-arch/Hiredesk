import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.userProfile.findMany({
    select: { id: true, email: true, fullName: true, organizationId: true, role: true }
  });
  console.log('UserProfiles:', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
