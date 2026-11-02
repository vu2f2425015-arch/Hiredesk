import fs from 'fs';
import path from 'path';

const cssPath = path.resolve('apps/web/src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Light theme accents
css = css.replace('--accent: #4f46e5;', '--accent: #2563eb;');
css = css.replace('--accent-hover: #4338ca;', '--accent-hover: #1d4ed8;');
css = css.replace('--accent-text: #4338ca;', '--accent-text: #1d4ed8;');
css = css.replace('--accent-subtle: #eef0ff;', '--accent-subtle: #eff6ff;');

// 2. Dark theme accents
css = css.replace('--accent: #625cf5;', '--accent: #3b82f6;');
css = css.replace('--accent-hover: #756ffc;', '--accent-hover: #60a5fa;');
css = css.replace('--accent-text: #aaa6ff;', '--accent-text: #93c5fd;');
css = css.replace('--accent-subtle: rgba(115, 109, 252, 0.16);', '--accent-subtle: rgba(59, 130, 246, 0.16);');
css = css.replace('--primary-subtle: rgba(115, 109, 252, 0.18);', '--primary-subtle: rgba(59, 130, 246, 0.18);');

// 3. Remove blurry backdrop-filter on glass-card
css = css.replace('backdrop-filter: blur(12px);', 'box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);');

// 4. Hero card top border: replace rainbow gradient with crisp brand accent
css = css.replace(
  'background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #3b82f6 100%);',
  'background: var(--primary);'
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('index.css successfully refined!');

