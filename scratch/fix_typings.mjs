import fs from 'fs';

let content = fs.readFileSync('apps/web/src/pages/JobsView.tsx', 'utf8');
content = content.replace("import { useDebounce } from '../hooks/useDebounce';\n", '');
content = content.replace("import { useDebounce } from '../hooks/useDebounce';\r\n", '');
fs.writeFileSync('apps/web/src/pages/JobsView.tsx', content, 'utf8');
console.log('Removed useDebounce from JobsView.tsx');
