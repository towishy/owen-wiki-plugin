import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildTemplateManifest,
    formatInstallSummary,
    normalizeManifestPath,
    presetOptions,
    reportPreviewItems,
} from '../src/setup-utils.ts';

test('presetOptions returns expected install scopes', () => {
  assert.deepEqual(presetOptions('minimal'), {
    includeScripts: false,
    includeAssets: false,
    includeGithubWorkflow: false,
  });
  assert.deepEqual(presetOptions('standard'), {
    includeScripts: true,
    includeAssets: true,
    includeGithubWorkflow: false,
  });
  assert.deepEqual(presetOptions('full'), {
    includeScripts: true,
    includeAssets: true,
    includeGithubWorkflow: true,
  });
  assert.equal(presetOptions('custom'), null);
});

test('formatInstallSummary includes backup counts when present', () => {
  assert.equal(
    formatInstallSummary({ createdFolders: 1, copiedFiles: 2, overwrittenFiles: 3, skippedFiles: 4, backedUpFiles: 5 }),
    'folders 1, copied 2, overwritten 3, skipped 4, backups 5',
  );
});

test('reportPreviewItems truncates long lists', () => {
  const result = reportPreviewItems(['a', 'b', 'c'], 2);
  assert.deepEqual(result.visible, ['a', 'b']);
  assert.equal(result.hiddenCount, 1);
});

test('buildTemplateManifest normalizes and sorts file paths', () => {
  const manifest = buildTemplateManifest({
    templateVersion: '1.20',
    source: 'D:/Github/owen-wiki',
    syncedAt: '2026-06-11T00:00:00.000Z',
    files: ['scripts\\b.py', './AGENTS.md', 'template-manifest.json'],
  });

  assert.equal(manifest.fileCount, 2);
  assert.deepEqual(manifest.files, ['AGENTS.md', 'scripts/b.py']);
});

test('normalizeManifestPath removes dot slash and Windows separators', () => {
  assert.equal(normalizeManifestPath('.\\scripts\\wiki.py'), 'scripts/wiki.py');
  assert.equal(normalizeManifestPath('./scripts/wiki.py'), 'scripts/wiki.py');
});