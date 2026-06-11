import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const sourceRoot = resolve(process.argv[2] ?? process.env.OWEN_WIKI_SOURCE ?? join(root, '..', 'owen-wiki'));
const targetRoot = join(root, 'template-kit');

const fileCopies = [
  ['AGENTS.md', 'AGENTS.md'],
  ['README.md', 'README.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['SETUP-GUIDE.md', 'SETUP-GUIDE.md'],
  ['.gitignore', '.gitignore'],
  [join('.github', 'workflows', 'wiki-lint.yml'), join('.github', 'workflows', 'wiki-lint.yml')],
];

const directoryCopies = [
  'assets',
  'ontology-templates',
  'scripts',
  'starter-files',
  'templates',
];

if (!existsSync(join(sourceRoot, 'AGENTS.md'))) {
  throw new Error(`Owen-WIKI source not found: ${sourceRoot}`);
}

rmSync(targetRoot, { force: true, recursive: true });
mkdirSync(targetRoot, { recursive: true });

for (const [source, target] of fileCopies) {
  const targetPath = join(targetRoot, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(join(sourceRoot, source), targetPath);
}

for (const directory of directoryCopies) {
  cpSync(join(sourceRoot, directory), join(targetRoot, directory), {
    filter: (source) => !source.includes('__pycache__'),
    recursive: true,
  });
}

console.log(`Synced template-kit from ${sourceRoot}`);