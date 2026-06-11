import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, normalizePath, type SettingDefinitionItem } from 'obsidian';
import {
    formatInstallSummary,
    presetOptions,
    reportPreviewItems,
    type SetupPreset,
    type UiLanguage,
} from './setup-utils';
import { TEMPLATE_FILES, TEMPLATE_MANIFEST } from './template-kit.generated';

const TEMPLATE_VERSION = '1.20.3';
const TEMPLATE_ROOT = 'template-kit';
const RELEASE_URL = 'https://github.com/towishy/owen-wiki-plugin/releases/tag/1.20.3';
const START_DOCUMENT = 'wiki/synthesis/overview.md';
type OperationMode = 'install' | 'upgrade' | 'repair' | 'dry-run';

function normalizeUiLanguage(language: unknown): UiLanguage {
  return language === 'ko' ? 'ko' : 'en';
}

function isSettingsRecord(value: unknown): value is Partial<OwenWikiPluginSettings> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface OwenWikiPluginSettings {
  autoInstallOnFirstActivation: boolean;
  initialSetupPromptDismissed: boolean;
  setupPreset: SetupPreset;
  uiLanguage: UiLanguage;
  overwriteExistingFiles: boolean;
  backupBeforeOverwrite: boolean;
  exportSetupReports: boolean;
  openStartDocumentAfterSetup: boolean;
  includeScripts: boolean;
  includeAssets: boolean;
  includeGithubWorkflow: boolean;
  installedTemplateVersion: string;
  installedAt: string;
  lastInstallSummary: string;
}

interface FileTarget {
  source: string;
  target: string;
  replaceDate?: boolean;
}

interface FolderTarget extends FileTarget {
  enabled: boolean;
}

interface InstallStats {
  operation: OperationMode;
  dryRun: boolean;
  createdFolders: number;
  copiedFiles: number;
  overwrittenFiles: number;
  skippedFiles: number;
  backedUpFiles: number;
  createdFolderPaths: string[];
  copiedFilePaths: string[];
  overwrittenFilePaths: string[];
  skippedFilePaths: string[];
  backupFilePaths: string[];
  backupRoot: string;
  reportPath: string;
}

interface InstallOptions {
  dryRun?: boolean;
  operation?: OperationMode;
}

interface HealthCheckResult {
  missingFolders: string[];
  missingFiles: string[];
  presentFolders: string[];
  presentFiles: string[];
  templateManifestFound: boolean;
  templateManifestVersion: string;
  templateManifestFileCount: number;
}

const DEFAULT_SETTINGS: OwenWikiPluginSettings = {
  autoInstallOnFirstActivation: true,
  initialSetupPromptDismissed: false,
  setupPreset: 'full',
  uiLanguage: 'en',
  overwriteExistingFiles: false,
  backupBeforeOverwrite: true,
  exportSetupReports: true,
  openStartDocumentAfterSetup: true,
  includeScripts: true,
  includeAssets: true,
  includeGithubWorkflow: true,
  installedTemplateVersion: '',
  installedAt: '',
  lastInstallSummary: '',
};

const CATEGORY_INDEXES = [
  { path: 'wiki/entities/_index.md', title: 'Entities Index' },
  { path: 'wiki/concepts/_index.md', title: 'Concepts Index' },
  { path: 'wiki/summaries/_index.md', title: 'Summaries Index' },
  { path: 'wiki/comparisons/_index.md', title: 'Comparisons Index' },
  { path: 'wiki/synthesis/_index.md', title: 'Synthesis Index' },
];

export default class OwenWikiPlugin extends Plugin {
  settings: OwenWikiPluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    const ko = this.currentLanguage() === 'ko';

    this.addRibbonIcon('folder-plus', ko ? 'Owen Wiki 구성' : 'Owen Wiki setup', () => this.installTemplate(false, { operation: 'install' }));

    this.addCommand({
      id: 'configure-template',
      name: ko ? 'Owen Wiki 템플릿 구성' : 'Configure Owen Wiki template',
      callback: () => this.installTemplate(false, { operation: 'install' }),
    });

    this.addCommand({
      id: 'preview-template-setup',
      name: ko ? 'Owen Wiki 템플릿 구성 미리보기' : 'Preview Owen Wiki template setup',
      callback: () => this.installTemplate(false, { dryRun: true, operation: 'dry-run' }),
    });

    this.addCommand({
      id: 'upgrade-template-files',
      name: ko ? 'Owen Wiki 템플릿 파일 업그레이드' : 'Upgrade Owen Wiki template files',
      callback: () => this.installTemplate(true, { operation: 'upgrade' }),
    });

    this.addCommand({
      id: 'repair-template',
      name: ko ? '누락된 Owen Wiki 파일 복구' : 'Repair missing Owen Wiki files',
      callback: () => this.installTemplate(false, { operation: 'repair' }),
    });

    this.addCommand({
      id: 'check-health',
      name: ko ? 'Owen Wiki 상태 점검' : 'Check Owen Wiki health',
      callback: () => this.openHealthCheck(),
    });

    this.addCommand({
      id: 'refresh-template-files',
      name: ko ? 'Owen Wiki 템플릿 파일 새로 고침' : 'Refresh Owen Wiki template files',
      callback: () => this.installTemplate(true, { operation: 'upgrade' }),
    });

    this.addSettingTab(new OwenWikiSettingTab(this.app, this));

    if (
      this.settings.autoInstallOnFirstActivation
      && this.settings.installedTemplateVersion !== TEMPLATE_VERSION
      && !this.settings.initialSetupPromptDismissed
    ) {
      const confirmed = await this.confirmInitialSetup();
      if (confirmed) {
        await this.installTemplate(false, { operation: 'install' });
      } else {
        this.settings.initialSetupPromptDismissed = true;
        await this.saveSettings();
      }
    }
  }

  async loadSettings(): Promise<void> {
    const loadedData = (await this.loadData()) as unknown;
    const savedSettings = isSettingsRecord(loadedData) ? loadedData : {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiLanguage: normalizeUiLanguage(savedSettings.uiLanguage),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async confirmInitialSetup(): Promise<boolean> {
    return new Promise((resolve) => {
      new InitialSetupModal(this.app, this.currentLanguage(), (confirmed) => resolve(confirmed)).open();
    });
  }

  async applyPreset(preset: SetupPreset): Promise<void> {
    this.settings.setupPreset = preset;
    const options = presetOptions(preset);

    if (options) {
      this.settings.includeScripts = options.includeScripts;
      this.settings.includeAssets = options.includeAssets;
      this.settings.includeGithubWorkflow = options.includeGithubWorkflow;
    }

    await this.saveSettings();
  }

  async installTemplate(forceOverwrite: boolean, options: InstallOptions = {}): Promise<void> {
    const operation = options.operation ?? (forceOverwrite ? 'upgrade' : 'install');
    const dryRun = Boolean(options.dryRun);
    const overwrite = operation === 'repair' ? false : forceOverwrite || this.settings.overwriteExistingFiles;
    const today = this.today();
    const month = today.slice(0, 7).replace('-', '');
    const runId = this.timestamp();
    const stats: InstallStats = {
      operation,
      dryRun,
      createdFolders: 0,
      copiedFiles: 0,
      overwrittenFiles: 0,
      skippedFiles: 0,
      backedUpFiles: 0,
      createdFolderPaths: [],
      copiedFilePaths: [],
      overwrittenFilePaths: [],
      skippedFilePaths: [],
      backupFilePaths: [],
      backupRoot: `.owen-wiki-backups/${runId}`,
      reportPath: '',
    };

    try {
      await this.ensureTemplateKitAvailable();
      await this.createVaultFolders(month, stats);
      await this.copyRootFiles(today, overwrite, stats);
      await this.copyTemplateFolders(today, overwrite, stats);
      await this.createCategoryIndexes(today, overwrite, stats);
      await this.createOutputStub(today, overwrite, stats);
      await this.createSourcesStub(today, overwrite, stats);

      const summary = formatInstallSummary(stats);

      if (!dryRun) {
        if (this.settings.exportSetupReports) {
          await this.exportSetupReport(stats, today);
        }

        this.settings.installedTemplateVersion = TEMPLATE_VERSION;
        this.settings.installedAt = new Date().toISOString();
        this.settings.initialSetupPromptDismissed = true;
        this.settings.lastInstallSummary = summary;
        await this.saveSettings();
      }

      const noticePrefix = dryRun ? this.text('previewReady') : this.text('configured');
      new Notice(`${noticePrefix}: ${summary}`);
      new InstallReportModal(this.app, this.currentLanguage(), stats).open();

      if (!dryRun && this.settings.openStartDocumentAfterSetup) {
        await this.openStartDocument();
      }
    } catch (error) {
      console.error('Owen Wiki template setup failed', error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${this.text('setupFailed')}: ${message}`);
    }
  }

  async openHealthCheck(): Promise<void> {
    try {
      const result = await this.runHealthCheck();
      new HealthCheckModal(this.app, this.currentLanguage(), result).open();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${this.text('healthFailed')}: ${message}`);
    }
  }

  private async ensureTemplateKitAvailable(): Promise<void> {
    if (TEMPLATE_FILES['README.md']) {
      return;
    }

    const templateReadme = this.templatePath('README.md');
    if (!(await this.app.vault.adapter.exists(templateReadme))) {
      throw new Error(`Template kit not found at ${templateReadme}`);
    }
  }

  private requiredFolders(month: string): string[] {
    return [
      'raw',
      'raw/articles',
      `raw/articles/${month}`,
      'raw/obsidian',
      'raw/obsidian/Clippings',
      `raw/obsidian/Clippings/${month}`,
      'raw/obsidian/outputs',
      `raw/obsidian/outputs/${month}`,
      `raw/obsidian/outputs/${month}/attachments`,
      'wiki',
      'wiki/entities',
      'wiki/concepts',
      'wiki/summaries',
      'wiki/comparisons',
      'wiki/synthesis',
      'wiki/ontology',
      'outputs',
      'outputs/wiki-ops',
      'graphify-out',
      'templates',
      'docs',
      'lib',
    ];
  }

  private async createVaultFolders(month: string, stats: InstallStats): Promise<void> {
    for (const folder of this.requiredFolders(month)) {
      await this.ensureFolder(folder, stats);
    }
  }

  private rootFiles(): FileTarget[] {
    return [
      { source: 'AGENTS.md', target: 'AGENTS.md' },
      { source: 'README.md', target: 'README.md' },
      { source: 'CHANGELOG.md', target: 'CHANGELOG.md' },
      { source: 'SETUP-GUIDE.md', target: 'SETUP-GUIDE.md' },
      { source: '.gitignore', target: '.gitignore' },
      { source: 'starter-files/index.md', target: 'index.md', replaceDate: true },
      { source: 'starter-files/log.md', target: 'log.md', replaceDate: true },
      { source: 'starter-files/overview.md', target: START_DOCUMENT, replaceDate: true },
    ];
  }

  private async copyRootFiles(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    for (const file of this.rootFiles()) {
      await this.copyTextFile(file, today, overwrite, stats);
    }
  }

  private templateFolders(): FolderTarget[] {
    return [
      { source: 'templates', target: 'templates', enabled: true },
      { source: 'ontology-templates', target: 'wiki/ontology', replaceDate: true, enabled: true },
      { source: 'scripts', target: 'scripts', enabled: this.settings.includeScripts },
      { source: 'assets', target: 'assets', enabled: this.settings.includeAssets },
      { source: '.github', target: '.github', enabled: this.settings.includeGithubWorkflow },
    ];
  }

  private async copyTemplateFolders(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    for (const folder of this.templateFolders()) {
      if (!folder.enabled) {
        continue;
      }

      await this.copyFolder(folder, today, overwrite, stats);
    }
  }

  private async createCategoryIndexes(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    for (const index of CATEGORY_INDEXES) {
      const content = [
        '---',
        `title: "${index.title}"`,
        'type: index',
        `updated: ${today}`,
        '---',
        '',
        `# ${index.title}`,
        '',
        '_새 페이지가 생성되면 여기에 1줄 요약으로 추가합니다._',
        '',
      ].join('\n');

      await this.writeTextFile(index.path, content, overwrite, stats);
    }
  }

  private async createOutputStub(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const content = [
      '---',
      'title: "Outputs Stub"',
      'type: index',
      `updated: ${today}`,
      '---',
      '',
      '# Outputs Stub',
      '',
      '신규 산출물은 `raw/obsidian/outputs/YYYYMM/` 아래에 생성합니다.',
      '`outputs/wiki-ops/`는 운영 대시보드와 리포트 산출물을 위한 호환 위치입니다.',
      '',
    ].join('\n');

    await this.writeTextFile('outputs/README.md', content, overwrite, stats);
  }

  private async createSourcesStub(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const content = [
      '---',
      'title: "Sources"',
      'type: index',
      `updated: ${today}`,
      '---',
      '',
      '# Sources',
      '',
      '- `raw/articles/YYYYMM/`: 웹 클리핑, 기사, 외부 자료',
      '- `raw/obsidian/Clippings/YYYYMM/`: Obsidian Web Clipper 저장 위치',
      '',
    ].join('\n');

    await this.writeTextFile('SOURCES.md', content, overwrite, stats);
  }

  private async copyFolder(folder: FileTarget, today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const targetPath = normalizePath(folder.target);

    await this.ensureFolder(targetPath, stats);
    if (this.hasEmbeddedFolder(folder.source)) {
      await this.copyEmbeddedFolderContents(folder.source, targetPath, Boolean(folder.replaceDate), today, overwrite, stats);
      return;
    }

    await this.copyFolderContents(this.templatePath(folder.source), targetPath, Boolean(folder.replaceDate), today, overwrite, stats);
  }

  private hasEmbeddedFolder(sourceFolder: string): boolean {
    const prefix = `${normalizePath(sourceFolder)}/`;
    return Object.keys(TEMPLATE_FILES).some((path) => path.startsWith(prefix));
  }

  private async copyEmbeddedFolderContents(
    sourceFolder: string,
    targetFolder: string,
    replaceDate: boolean,
    today: string,
    overwrite: boolean,
    stats: InstallStats,
  ): Promise<void> {
    const sourcePrefix = `${normalizePath(sourceFolder)}/`;
    for (const sourcePath of Object.keys(TEMPLATE_FILES).filter((path) => path.startsWith(sourcePrefix)).sort()) {
      const relativePath = sourcePath.slice(sourcePrefix.length);
      const targetFile = normalizePath(`${targetFolder}/${relativePath}`);
      const content = this.readEmbeddedTemplateFile(sourcePath, replaceDate, today);
      await this.writeTextFile(targetFile, content, overwrite, stats);
    }
  }

  private async copyFolderContents(
    sourceFolder: string,
    targetFolder: string,
    replaceDate: boolean,
    today: string,
    overwrite: boolean,
    stats: InstallStats,
  ): Promise<void> {
    const listed = await this.app.vault.adapter.list(sourceFolder);

    for (const folder of listed.folders.sort()) {
      const targetChildFolder = normalizePath(`${targetFolder}/${this.basename(folder)}`);
      await this.ensureFolder(targetChildFolder, stats);
      await this.copyFolderContents(folder, targetChildFolder, replaceDate, today, overwrite, stats);
    }

    for (const file of listed.files.sort()) {
      const targetFile = normalizePath(`${targetFolder}/${this.basename(file)}`);
      const content = await this.readTemplateAdapterFile(file, replaceDate, today);
      await this.writeTextFile(targetFile, content, overwrite, stats);
    }
  }

  private async copyTextFile(file: FileTarget, today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const content = await this.readTemplateFile(file.source, Boolean(file.replaceDate), today);
    await this.writeTextFile(file.target, content, overwrite, stats);
  }

  private async readTemplateFile(sourcePath: string, replaceDate: boolean, today: string): Promise<string> {
    const normalizedSourcePath = normalizePath(sourcePath);
    if (TEMPLATE_FILES[normalizedSourcePath] !== undefined) {
      return this.readEmbeddedTemplateFile(normalizedSourcePath, replaceDate, today);
    }

    const content = await this.app.vault.adapter.read(this.templatePath(normalizedSourcePath));
    return replaceDate ? content.split('{{date}}').join(today) : content;
  }

  private async readTemplateAdapterFile(adapterPath: string, replaceDate: boolean, today: string): Promise<string> {
    const content = await this.app.vault.adapter.read(adapterPath);
    return replaceDate ? content.split('{{date}}').join(today) : content;
  }

  private readEmbeddedTemplateFile(sourcePath: string, replaceDate: boolean, today: string): string {
    const content = TEMPLATE_FILES[sourcePath];
    return replaceDate ? content.split('{{date}}').join(today) : content;
  }

  private async writeTextFile(path: string, content: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const normalizedPath = normalizePath(path);
    const exists = await this.app.vault.adapter.exists(normalizedPath);

    if (exists && !overwrite) {
      stats.skippedFiles += 1;
      stats.skippedFilePaths.push(normalizedPath);
      return;
    }

    if (stats.dryRun) {
      if (exists) {
        stats.overwrittenFiles += 1;
        stats.overwrittenFilePaths.push(normalizedPath);
      } else {
        stats.copiedFiles += 1;
        stats.copiedFilePaths.push(normalizedPath);
      }
      return;
    }

    const parent = this.dirname(normalizedPath);
    if (parent) {
      await this.ensureFolder(parent, stats);
    }

    if (exists && overwrite && this.settings.backupBeforeOverwrite) {
      await this.backupExistingFile(normalizedPath, stats);
    }

    await this.app.vault.adapter.write(normalizedPath, content);

    if (exists) {
      stats.overwrittenFiles += 1;
      stats.overwrittenFilePaths.push(normalizedPath);
    } else {
      stats.copiedFiles += 1;
      stats.copiedFilePaths.push(normalizedPath);
    }
  }

  private async ensureFolder(path: string, stats?: InstallStats): Promise<void> {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath || normalizedPath === '/') {
      return;
    }

    const parts = normalizedPath.split('/').filter(Boolean);
    let current = '';

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;

      if (!(await this.app.vault.adapter.exists(current))) {
        if (stats) {
          stats.createdFolders += 1;
          stats.createdFolderPaths.push(current);
        }

        if (!stats?.dryRun) {
          await this.app.vault.adapter.mkdir(current);
        }
      }
    }
  }

  private async backupExistingFile(path: string, stats: InstallStats): Promise<void> {
    const backupPath = normalizePath(`${stats.backupRoot}/${path}`);
    const backupParent = this.dirname(backupPath);
    if (backupParent) {
      await this.ensureFolder(backupParent);
    }

    const currentContent = await this.app.vault.adapter.read(path);
    await this.app.vault.adapter.write(backupPath, currentContent);
    stats.backedUpFiles += 1;
    stats.backupFilePaths.push(backupPath);
  }

  private async exportSetupReport(stats: InstallStats, today: string): Promise<void> {
    const reportPath = normalizePath(`outputs/wiki-ops/setup-report-${this.timestamp()}.md`);
    const content = this.createReportMarkdown(stats, today);
    await this.ensureFolder('outputs/wiki-ops');
    await this.app.vault.adapter.write(reportPath, content);
    stats.reportPath = reportPath;
  }

  private createReportMarkdown(stats: InstallStats, today: string): string {
    const lines = [
      '---',
      'title: "Owen Wiki Setup Report"',
      'type: report',
      `created: ${today}`,
      '---',
      '',
      '# Owen Wiki Setup Report',
      '',
      `- Operation: ${stats.operation}`,
      `- Dry run: ${stats.dryRun ? 'yes' : 'no'}`,
      `- Folders created: ${stats.createdFolders}`,
      `- Files copied: ${stats.copiedFiles}`,
      `- Files overwritten: ${stats.overwrittenFiles}`,
      `- Files skipped: ${stats.skippedFiles}`,
      `- Files backed up: ${stats.backedUpFiles}`,
      '',
    ];

    this.appendReportList(lines, 'Created folders', stats.createdFolderPaths);
    this.appendReportList(lines, 'Copied files', stats.copiedFilePaths);
    this.appendReportList(lines, 'Overwritten files', stats.overwrittenFilePaths);
    this.appendReportList(lines, 'Skipped files', stats.skippedFilePaths);
    this.appendReportList(lines, 'Backup files', stats.backupFilePaths);

    return `${lines.join('\n')}\n`;
  }

  private appendReportList(lines: string[], title: string, paths: string[]): void {
    lines.push(`## ${title}`, '');
    if (paths.length === 0) {
      lines.push('_None._', '');
      return;
    }

    for (const path of paths) {
      lines.push(`- ${path}`);
    }
    lines.push('');
  }

  private async openStartDocument(): Promise<void> {
    if (await this.app.vault.adapter.exists(START_DOCUMENT)) {
      await this.app.workspace.openLinkText(START_DOCUMENT, '', false);
    }
  }

  private async runHealthCheck(): Promise<HealthCheckResult> {
    const month = this.today().slice(0, 7).replace('-', '');
    const requiredFiles = [
      ...this.rootFiles().map((file) => file.target),
      ...CATEGORY_INDEXES.map((index) => index.path),
      'outputs/README.md',
      'SOURCES.md',
    ];
    const result: HealthCheckResult = {
      missingFolders: [],
      missingFiles: [],
      presentFolders: [],
      presentFiles: [],
      templateManifestFound: false,
      templateManifestVersion: '',
      templateManifestFileCount: 0,
    };

    for (const folder of this.requiredFolders(month)) {
      if (await this.app.vault.adapter.exists(folder)) {
        result.presentFolders.push(folder);
      } else {
        result.missingFolders.push(folder);
      }
    }

    for (const file of requiredFiles) {
      if (await this.app.vault.adapter.exists(file)) {
        result.presentFiles.push(file);
      } else {
        result.missingFiles.push(file);
      }
    }

    if (TEMPLATE_MANIFEST) {
      result.templateManifestFound = true;
      result.templateManifestVersion = TEMPLATE_MANIFEST.templateVersion;
      result.templateManifestFileCount = TEMPLATE_MANIFEST.fileCount;
      return result;
    }

    const manifestPath = this.templatePath('template-manifest.json');
    if (await this.app.vault.adapter.exists(manifestPath)) {
      result.templateManifestFound = true;
      try {
        const manifest = JSON.parse(await this.app.vault.adapter.read(manifestPath)) as { templateVersion?: string; fileCount?: number };
        result.templateManifestVersion = manifest.templateVersion ?? '';
        result.templateManifestFileCount = manifest.fileCount ?? 0;
      } catch (error) {
        console.warn('Failed to parse template manifest', error);
      }
    }

    return result;
  }

  private text(key: 'configured' | 'previewReady' | 'setupFailed' | 'healthFailed'): string {
    const ko: Record<typeof key, string> = {
      configured: 'Owen Wiki 템플릿 구성이 완료되었습니다',
      previewReady: 'Owen Wiki 미리보기가 준비되었습니다',
      setupFailed: 'Owen Wiki 템플릿 구성 실패',
      healthFailed: 'Owen Wiki 상태 점검 실패',
    };
    const en: Record<typeof key, string> = {
      configured: 'Owen Wiki template configured',
      previewReady: 'Owen Wiki preview ready',
      setupFailed: 'Owen Wiki template setup failed',
      healthFailed: 'Owen Wiki health check failed',
    };
    return this.currentLanguage() === 'ko' ? ko[key] : en[key];
  }

  currentLanguage(): UiLanguage {
    return normalizeUiLanguage(this.settings.uiLanguage);
  }

  private templatePath(relativePath: string): string {
    return normalizePath(`${this.pluginBasePath()}/${TEMPLATE_ROOT}/${relativePath}`);
  }

  private pluginBasePath(): string {
    return normalizePath(this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private basename(path: string): string {
    return path.split('/').filter(Boolean).pop() ?? path;
  }

  private dirname(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }
}

class InitialSetupModal extends Modal {
  private readonly language: UiLanguage;
  private readonly onDecision: (confirmed: boolean) => void;
  private resolved = false;

  constructor(app: App, language: UiLanguage, onDecision: (confirmed: boolean) => void) {
    super(app);
    this.language = language;
    this.onDecision = onDecision;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.language === 'ko' ? '템플릿을 구성할까요?' : 'Configure template?')
      .setHeading();
    contentEl.createEl('p', {
      text: this.language === 'ko'
        ? '현재 볼트에 Owen-WIKI 폴더 구조와 시작 템플릿 파일을 생성합니다. 덮어쓰기를 켜지 않는 한 기존 파일은 건너뜁니다.'
        : 'This will create the Owen-WIKI folder structure and starter template files in the current vault. Existing files are skipped unless overwrite is enabled in settings.',
    });

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText(this.language === 'ko' ? '구성' : 'Configure')
        .setCta()
        .onClick(() => this.resolve(true)))
      .addButton((button) => button
        .setButtonText(this.language === 'ko' ? '나중에' : 'Not now')
        .onClick(() => this.resolve(false)));
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolved = true;
      this.onDecision(false);
    }
  }

  private resolve(confirmed: boolean): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.onDecision(confirmed);
    this.close();
  }
}

class InstallReportModal extends Modal {
  private readonly language: UiLanguage;
  private readonly stats: InstallStats;

  constructor(app: App, language: UiLanguage, stats: InstallStats) {
    super(app);
    this.language = language;
    this.stats = stats;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.language === 'ko' ? '설정 리포트' : 'Setup report')
      .setHeading();
    contentEl.createEl('p', {
      text: this.language === 'ko'
        ? `작업: ${this.operationLabel()}. 폴더: ${this.stats.createdFolders}. 복사: ${this.stats.copiedFiles}. 덮어쓰기: ${this.stats.overwrittenFiles}. 건너뜀: ${this.stats.skippedFiles}. 백업: ${this.stats.backedUpFiles}.`
        : `Operation: ${this.stats.operation}. Folders: ${this.stats.createdFolders}. Copied: ${this.stats.copiedFiles}. Overwritten: ${this.stats.overwrittenFiles}. Skipped: ${this.stats.skippedFiles}. Backups: ${this.stats.backedUpFiles}.`,
    });
    if (this.stats.reportPath) {
      contentEl.createEl('p', { text: this.language === 'ko' ? `리포트 저장 위치: ${this.stats.reportPath}` : `Report saved: ${this.stats.reportPath}` });
    }

    this.renderFileGroup(contentEl, this.language === 'ko' ? '생성 예정/생성 폴더' : 'Created folders', this.stats.createdFolderPaths);
    this.renderFileGroup(contentEl, this.language === 'ko' ? '복사 파일' : 'Copied files', this.stats.copiedFilePaths);
    this.renderFileGroup(contentEl, this.language === 'ko' ? '덮어쓴 파일' : 'Overwritten files', this.stats.overwrittenFilePaths);
    this.renderFileGroup(contentEl, this.language === 'ko' ? '건너뛴 기존 파일' : 'Skipped existing files', this.stats.skippedFilePaths);
    this.renderFileGroup(contentEl, this.language === 'ko' ? '백업 파일' : 'Backup files', this.stats.backupFilePaths);

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText(this.language === 'ko' ? '닫기' : 'Close')
        .setCta()
        .onClick(() => this.close()));
  }

  private renderFileGroup(containerEl: HTMLElement, title: string, paths: string[]): void {
    const details = containerEl.createEl('details');
    details.createEl('summary', { text: `${title} (${paths.length})` });

    if (paths.length === 0) {
      details.createEl('p', { text: this.language === 'ko' ? '없음' : 'None' });
      return;
    }

    const preview = reportPreviewItems(paths);
    const list = details.createEl('ul');
    for (const path of preview.visible) {
      list.createEl('li', { text: path });
    }

    if (preview.hiddenCount > 0) {
      details.createEl('p', { text: this.language === 'ko' ? `${preview.hiddenCount}개 파일은 더 표시하지 않았습니다.` : `${preview.hiddenCount} more files not shown.` });
    }
  }

  private operationLabel(): string {
    const labels: Record<OperationMode, string> = {
      install: '설치',
      upgrade: '업그레이드',
      repair: '복구',
      'dry-run': '미리보기',
    };
    return labels[this.stats.operation];
  }
}

class HealthCheckModal extends Modal {
  private readonly language: UiLanguage;
  private readonly result: HealthCheckResult;

  constructor(app: App, language: UiLanguage, result: HealthCheckResult) {
    super(app);
    this.language = language;
    this.result = result;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.language === 'ko' ? '상태 점검' : 'Health check')
      .setHeading();
    contentEl.createEl('p', {
      text: this.language === 'ko'
        ? `누락 폴더: ${this.result.missingFolders.length}. 누락 파일: ${this.result.missingFiles.length}. 템플릿 매니페스트: ${this.result.templateManifestFound ? '있음' : '없음'}.`
        : `Missing folders: ${this.result.missingFolders.length}. Missing files: ${this.result.missingFiles.length}. Template manifest: ${this.result.templateManifestFound ? 'found' : 'missing'}.`,
    });
    if (this.result.templateManifestFound) {
      contentEl.createEl('p', {
        text: this.language === 'ko'
          ? `템플릿 매니페스트 버전: ${this.result.templateManifestVersion || '알 수 없음'}, 파일: ${this.result.templateManifestFileCount}`
          : `Template manifest version: ${this.result.templateManifestVersion || 'unknown'}, files: ${this.result.templateManifestFileCount}`,
      });
    }

    this.renderList(contentEl, this.language === 'ko' ? '누락 폴더' : 'Missing folders', this.result.missingFolders);
    this.renderList(contentEl, this.language === 'ko' ? '누락 파일' : 'Missing files', this.result.missingFiles);

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText(this.language === 'ko' ? '닫기' : 'Close')
        .setCta()
        .onClick(() => this.close()));
  }

  private renderList(containerEl: HTMLElement, title: string, paths: string[]): void {
    const details = containerEl.createEl('details');
    details.createEl('summary', { text: `${title} (${paths.length})` });
    if (paths.length === 0) {
      details.createEl('p', { text: this.language === 'ko' ? '없음' : 'None' });
      return;
    }

    const list = details.createEl('ul');
    for (const path of paths) {
      list.createEl('li', { text: path });
    }
  }
}

class OwenWikiSettingTab extends PluginSettingTab {
  plugin: OwenWikiPlugin;

  constructor(app: App, plugin: OwenWikiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const ko = this.plugin.currentLanguage() === 'ko';
    return [{
      name: ko ? '템플릿 구성' : 'Template setup',
      searchable: false,
      render: (setting) => {
        const containerEl = setting.settingEl;
        containerEl.empty();
        containerEl.addClass('owen-wiki-plugin-settings-root');
        void this.renderSettings(containerEl);
      },
    }];
  }

  private async renderSettings(containerEl: HTMLElement): Promise<void> {
    await this.plugin.loadSettings();
    const ko = this.plugin.currentLanguage() === 'ko';

    new Setting(containerEl)
      .setName(ko ? '템플릿 구성' : 'Template setup')
      .setHeading();

    const status = containerEl.createDiv({ cls: 'owen-wiki-plugin-status' });
    const installed = this.plugin.settings.installedTemplateVersion || (ko ? '설치되지 않음' : 'not installed');
    status.createEl('div', { text: ko ? `템플릿 버전: ${TEMPLATE_VERSION}` : `Template version: ${TEMPLATE_VERSION}` });
    status.createEl('div', { text: ko ? `설치된 버전: ${installed}` : `Installed version: ${installed}` });
    status.createEl('a', {
      attr: { href: RELEASE_URL },
      text: ko ? '현재 릴리즈 보기' : 'View current release',
    });
    status.createEl('div', {
      text: ko
        ? '모바일에서는 볼트 구조와 문서 생성 중심으로 사용하세요. Python/PowerShell 스크립트 실행은 데스크톱을 권장합니다.'
        : 'Mobile note: vault structure and documents can be created on mobile, but Python/PowerShell scripts are desktop-oriented.',
    });
    if (this.plugin.settings.lastInstallSummary) {
      status.createEl('div', { text: ko ? `마지막 실행: ${this.plugin.settings.lastInstallSummary}` : `Last run: ${this.plugin.settings.lastInstallSummary}` });
    }

    new Setting(containerEl)
      .setName(ko ? 'UI 언어' : 'UI language')
      .setDesc(ko ? '설정 화면과 모달의 표시 언어를 선택합니다.' : 'Choose the display language for settings and setup dialogs.')
      .addDropdown((dropdown) => dropdown
        .addOption('en', 'English')
        .addOption('ko', '한국어')
        .setValue(this.plugin.currentLanguage())
        .onChange(async (value) => {
          this.plugin.settings.uiLanguage = normalizeUiLanguage(value);
          await this.plugin.saveSettings();
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '설치 프리셋' : 'Setup preset')
      .setDesc(ko ? 'Owen-WIKI 킷을 기본적으로 어느 범위까지 설치할지 선택합니다.' : 'Choose how much of the Owen-WIKI kit should be installed by default.')
      .addDropdown((dropdown) => dropdown
        .addOption('minimal', ko ? '최소: 스키마, 위키 폴더, 템플릿' : 'Minimal: schema, wiki folders, templates')
        .addOption('standard', ko ? '표준: 스크립트와 자산 포함' : 'Standard: scripts and assets')
        .addOption('full', ko ? '전체: 스크립트, 자산, GitHub 워크플로 포함' : 'Full: scripts, assets, GitHub workflow')
        .addOption('custom', ko ? '사용자 지정' : 'Custom')
        .setValue(this.plugin.settings.setupPreset)
        .onChange(async (value) => {
          await this.plugin.applyPreset(value as SetupPreset);
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '첫 활성화 시 구성' : 'Configure on first activation')
      .setDesc(ko ? '플러그인을 처음 활성화할 때 Owen-WIKI 볼트 구조를 자동으로 구성합니다.' : 'Create the Owen-WIKI vault structure automatically when this plugin is first enabled.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoInstallOnFirstActivation)
        .onChange(async (value) => {
          this.plugin.settings.autoInstallOnFirstActivation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(ko ? '기존 파일 덮어쓰기' : 'Overwrite existing files')
      .setDesc(ko ? '수동 구성 중 기존 템플릿 파일을 교체합니다. 볼트의 기존 편집을 보존하려면 끄세요.' : 'Replace existing template files during manual setup. Leave this off to preserve vault edits.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.overwriteExistingFiles)
        .onChange(async (value) => {
          this.plugin.settings.overwriteExistingFiles = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(ko ? '덮어쓰기 전 백업' : 'Back up before overwrite')
      .setDesc(ko ? '덮어쓰기 대상 기존 파일을 .owen-wiki-backups/ 아래에 먼저 저장합니다.' : 'Save existing files under .owen-wiki-backups/ before replacing them.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.backupBeforeOverwrite)
        .onChange(async (value) => {
          this.plugin.settings.backupBeforeOverwrite = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(ko ? '설정 리포트 저장' : 'Export setup reports')
      .setDesc(ko ? '설치 결과를 outputs/wiki-ops/setup-report-*.md 파일로 저장합니다.' : 'Save setup results to outputs/wiki-ops/setup-report-*.md.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.exportSetupReports)
        .onChange(async (value) => {
          this.plugin.settings.exportSetupReports = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(ko ? '설치 후 시작 문서 열기' : 'Open start document after setup')
      .setDesc(ko ? '설치가 끝나면 wiki/synthesis/overview.md를 엽니다.' : 'Open wiki/synthesis/overview.md after setup completes.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openStartDocumentAfterSetup)
        .onChange(async (value) => {
          this.plugin.settings.openStartDocumentAfterSetup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(ko ? '자동화 스크립트 포함' : 'Include automation scripts')
      .setDesc(ko ? 'Owen-WIKI Python, PowerShell, shell, YAML 자동화 파일을 scripts/에 복사합니다.' : 'Copy the Owen-WIKI Python, PowerShell, shell, and YAML automation files into scripts/.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeScripts)
        .onChange(async (value) => {
          this.plugin.settings.setupPreset = 'custom';
          this.plugin.settings.includeScripts = value;
          await this.plugin.saveSettings();
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '시각 자산 포함' : 'Include visual assets')
      .setDesc(ko ? 'Owen-WIKI README와 문서에서 사용하는 SVG 자산을 복사합니다.' : 'Copy the SVG assets used by the Owen-WIKI README and documentation.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeAssets)
        .onChange(async (value) => {
          this.plugin.settings.setupPreset = 'custom';
          this.plugin.settings.includeAssets = value;
          await this.plugin.saveSettings();
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? 'GitHub Actions 워크플로 포함' : 'Include GitHub Actions workflow')
      .setDesc(ko ? '위키 품질 게이트 워크플로를 .github/workflows/에 복사합니다.' : 'Copy the wiki quality-gate workflow into .github/workflows/.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeGithubWorkflow)
        .onChange(async (value) => {
          this.plugin.settings.setupPreset = 'custom';
          this.plugin.settings.includeGithubWorkflow = value;
          await this.plugin.saveSettings();
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '실행 전 미리보기' : 'Dry run preview')
      .setDesc(ko ? '실제 파일을 만들지 않고 생성/복사/건너뜀 예정 목록을 확인합니다.' : 'Preview folders and files without writing anything to the vault.')
      .addButton((button) => button
        .setButtonText(ko ? '미리보기' : 'Preview')
        .onClick(async () => {
          await this.plugin.installTemplate(false, { dryRun: true, operation: 'dry-run' });
        }));

    new Setting(containerEl)
      .setName(ko ? '누락 파일 복구' : 'Repair missing files')
      .setDesc(ko ? '기존 파일은 보존하고 누락된 Owen-WIKI 파일과 폴더만 다시 만듭니다.' : 'Preserve existing files and recreate only missing Owen-WIKI files and folders.')
      .addButton((button) => button
        .setButtonText(ko ? '복구' : 'Repair')
        .onClick(async () => {
          await this.plugin.installTemplate(false, { operation: 'repair' });
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '상태 점검' : 'Health check')
      .setDesc(ko ? '필수 폴더, 파일, 템플릿 매니페스트 상태를 확인합니다.' : 'Check required folders, files, and bundled template manifest status.')
      .addButton((button) => button
        .setButtonText(ko ? '점검' : 'Check')
        .onClick(async () => {
          await this.plugin.openHealthCheck();
        }));

    new Setting(containerEl)
      .setName(ko ? '지금 구성 실행' : 'Run setup now')
      .setDesc(ko ? '현재 설정으로 누락된 폴더를 만들고 템플릿 파일을 복사합니다.' : 'Create missing folders and copy template files using the current settings.')
      .addButton((button) => button
        .setButtonText(ko ? '구성' : 'Configure')
        .setCta()
        .onClick(async () => {
          await this.plugin.installTemplate(false, { operation: 'install' });
          this.update();
        }));

    new Setting(containerEl)
      .setName(ko ? '지금 업그레이드' : 'Refresh now')
      .setDesc(ko ? '이번 실행에서만 템플릿 파일을 업그레이드하고 기존 파일을 덮어씁니다.' : 'Upgrade template files and overwrite files for this run only.')
      .addButton((button) => button
        .setButtonText(ko ? '업그레이드' : 'Upgrade')
        .onClick(async () => {
          await this.plugin.installTemplate(true, { operation: 'upgrade' });
          this.update();
        }));
  }
}