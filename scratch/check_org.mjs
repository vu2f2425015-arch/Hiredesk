import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, status: true }
  });
  console.log('Organizations:', JSON.stringify(orgs, null, 2));

  const jobs = await prisma.job.findMany({
    where: { status: 'published' },
    select: { id: true, jobCode: true, title: true, status: true, organizationId: true }
  });
  console.log('Published Jobs:', JSON.stringify(jobs, null, 2));
}

main().finally(() => prisma.$disconnect());

