import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const job = await prisma.job.findFirst({
      where: {
        jobCode: 'JOB-1030',
      },
      include: {
        organization: true,
        client: true,
      },
    });

    if (!job) {
      console.log('Job JOB-1030 not found. Listing recent jobs:');
      const jobs = await prisma.job.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { organization: true },
      });
      console.log(jobs.map(j => ({ id: j.id, jobCode: j.jobCode, title: j.title, status: j.status, org: j.organization?.name })));
    } else {
      console.log('Found JOB-1030:', {
        id: job.id,
        jobCode: job.jobCode,
        title: job.title,
        status: job.status,
        department: job.department,
        location: job.location,
        orgId: job.organizationId,
        orgName: job.organization?.name,
        clientName: job.client?.name,
      });
    }
  } catch (err) {
    console.error('Error finding job:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
