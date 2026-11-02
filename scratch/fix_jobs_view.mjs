import fs from 'fs';

const filePath = 'apps/web/src/pages/JobsView.tsx';
let file = fs.readFileSync(filePath, 'utf8');

// Fix in CreateJobModal
const badBlock = `  const { session, profile } = useAuth();
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const orgSlug = profile?.organizationSlug || (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'agency';
  const publicJobUrl = \`\${window.location.origin}/career/\${orgSlug}/\${job.jobCode}\`;
  const token = session?.access_token;`;

file = file.replace(
  badBlock,
  `  const { session } = useAuth();
  const token = session?.access_token;`
);

// Fix in JobDetailModal
const jobDetailTarget = `function JobDetailModal({
  job,
  onClose,
  onDuplicate,
  onPublish,
  onCloseJob,
  onOpenCandidateProfile,
}: {
  job: ApiJob;
  onClose: () => void;
  onDuplicate?: () => void;
  onPublish?: () => void;
  onCloseJob?: () => void;
  onOpenCandidateProfile?: (candidateId: string) => void;
}) {
  const { session } = useAuth();`;

const jobDetailReplacement = `function JobDetailModal({
  job,
  onClose,
  onDuplicate,
  onPublish,
  onCloseJob,
  onOpenCandidateProfile,
}: {
  job: ApiJob;
  onClose: () => void;
  onDuplicate?: () => void;
  onPublish?: () => void;
  onCloseJob?: () => void;
  onOpenCandidateProfile?: (candidateId: string) => void;
}) {
  const { session, profile } = useAuth();
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const orgSlug = profile?.organizationSlug || (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'agency';
  const publicJobUrl = \`\${window.location.origin}/career/\${orgSlug}/\${job.jobCode}\`;`;

file = file.replace(jobDetailTarget, jobDetailReplacement);

fs.writeFileSync(filePath, file, 'utf8');
console.log('Fixed JobsView.tsx');

