import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const TEMPLATE_VERSION = '1.20';
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

const files = listFiles(targetRoot)
  .filter((file) => file !== 'template-manifest.json')
  .sort((left, right) => left.localeCompare(right));

writeFileSync(join(targetRoot, 'template-manifest.json'), `${JSON.stringify({
  templateVersion: TEMPLATE_VERSION,
  source: sourceRoot,
  syncedAt: new Date().toISOString(),
  fileCount: files.length,
  files,
}, null, 2)}\n`);

console.log(`Synced template-kit from ${sourceRoot}`);

function listFiles(rootDir, currentDir = rootDir) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(rootDir, absolutePath));
      continue;
    }

    if (entry.isFile() && statSync(absolutePath).isFile()) {
      files.push(absolutePath.slice(rootDir.length + 1).replace(/\\/g, '/'));
    }
  }

  return files;
}