import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import process from 'process';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const releaseName = manifest.version.replace(/\.0$/, '');
const zipPath = join(root, 'release', `${manifest.id}-${manifest.version}.zip`);
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

run(npmExecutable, ['run', 'test']);
run(npmExecutable, ['run', 'package']);

if (!existsSync(zipPath)) {
  throw new Error(`Release zip not found: ${zipPath}`);
}

run('git', ['diff', '--check']);
run('gh', [
  'release',
  'create',
  releaseName,
  zipPath,
  join(root, 'main.js'),
  join(root, 'manifest.json'),
  join(root, 'styles.css'),
  '--repo',
  'towishy/owen-wiki-plugin',
  '--target',
  'main',
  '--title',
  releaseName,
  '--notes',
  `Owen Wiki Template ${releaseName} release.`,
]);

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}