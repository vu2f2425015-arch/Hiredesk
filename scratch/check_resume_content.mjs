import { PrismaClient } from '@prisma/client';
import { StorageService } from '../apps/api/dist/services/storage.js';

const prisma = new PrismaClient();

async function main() {
  const resume = await prisma.resume.findFirst({
    where: { originalFilename: 'Alex_Mercer_Resume.pdf' }
  });
  console.log('Resume metadata:', resume);

  // Download resume buffer from storage
  const signedUrl = await StorageService.getSignedResumeUrl(resume.storagePath, 60);
  const res = await fetch(signedUrl);
  const buf = await res.arrayBuffer();
  const text = Buffer.from(buf).toString('utf8');
  console.log('Resume buffer content (first 500 chars):', text.slice(0, 500));
}

main().finally(() => prisma.$disconnect());

