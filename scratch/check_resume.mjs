import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const job = await prisma.job.findFirst({
    where: { jobCode: 'JOB-1030' },
    include: {
      applications: {
        include: {
          candidate: true,
          resumes: true,
        }
      }
    }
  });

  console.log('JOB-1030:', JSON.stringify(job, null, 2));
}

main().finally(() => prisma.$disconnect());

