export type SetupPreset = 'minimal' | 'standard' | 'full' | 'custom';
export type UiLanguage = 'en' | 'ko';

export interface PresetOptions {
  includeScripts: boolean;
  includeAssets: boolean;
  includeGithubWorkflow: boolean;
}

export interface InstallStatsLike {
  createdFolders: number;
  copiedFiles: number;
  overwrittenFiles: number;
  skippedFiles: number;
  backedUpFiles?: number;
}

export interface TemplateManifest {
  templateVersion: string;
  source: string;
  syncedAt: string;
  fileCount: number;
  files: string[];
}

export function presetOptions(preset: SetupPreset): PresetOptions | null {
  if (preset === 'minimal') {
    return {
      includeScripts: false,
      includeAssets: false,
      includeGithubWorkflow: false,
    };
  }

  if (preset === 'standard') {
    return {
      includeScripts: true,
      includeAssets: true,
      includeGithubWorkflow: false,
    };
  }

  if (preset === 'full') {
    return {
      includeScripts: true,
      includeAssets: true,
      includeGithubWorkflow: true,
    };
  }

  return null;
}

export function formatInstallSummary(stats: InstallStatsLike): string {
  const backupPart = stats.backedUpFiles === undefined ? '' : `, backups ${stats.backedUpFiles}`;
  return `folders ${stats.createdFolders}, copied ${stats.copiedFiles}, overwritten ${stats.overwrittenFiles}, skipped ${stats.skippedFiles}${backupPart}`;
}

export function reportPreviewItems(paths: string[], limit = 25): { visible: string[]; hiddenCount: number } {
  return {
    visible: paths.slice(0, limit),
    hiddenCount: Math.max(0, paths.length - limit),
  };
}

export function normalizeManifestPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function buildTemplateManifest(options: {
  templateVersion: string;
  source: string;
  syncedAt: string;
  files: string[];
}): TemplateManifest {
  const files = options.files
    .map(normalizeManifestPath)
    .filter((file) => file !== 'template-manifest.json')
    .sort((left, right) => left.localeCompare(right));

  return {
    templateVersion: options.templateVersion,
    source: options.source,
    syncedAt: options.syncedAt,
    fileCount: files.length,
    files,
  };
}