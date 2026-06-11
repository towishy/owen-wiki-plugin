import { execFileSync } from 'child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import process from 'process';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const releaseDir = join(root, 'release');
const stagingDir = join(releaseDir, manifest.id);
const zipPath = join(releaseDir, `${manifest.id}-${manifest.version}.zip`);

rmSync(releaseDir, { force: true, recursive: true });
mkdirSync(stagingDir, { recursive: true });

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  copyFileSync(join(root, file), join(stagingDir, file));
}

cpSync(join(root, 'template-kit'), join(stagingDir, 'template-kit'), { recursive: true });

if (process.platform === 'win32') {
  const sourceGlob = join(stagingDir, '*');
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Compress-Archive -Path '${sourceGlob}' -DestinationPath '${zipPath}' -Force`,
  ], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', resolve(zipPath), '.'], { cwd: stagingDir, stdio: 'inherit' });
}

console.log(`Created ${zipPath}`);