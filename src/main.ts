import { App, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from 'obsidian';

const TEMPLATE_VERSION = '1.17';
const TEMPLATE_ROOT = 'template-kit';

interface OwenWikiPluginSettings {
  autoInstallOnFirstActivation: boolean;
  overwriteExistingFiles: boolean;
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
  createdFolders: number;
  copiedFiles: number;
  overwrittenFiles: number;
  skippedFiles: number;
}

const DEFAULT_SETTINGS: OwenWikiPluginSettings = {
  autoInstallOnFirstActivation: true,
  overwriteExistingFiles: false,
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

    this.addCommand({
      id: 'configure-owen-wiki-template',
      name: 'Configure Owen Wiki template',
      callback: () => this.installTemplate(false),
    });

    this.addCommand({
      id: 'refresh-owen-wiki-template-files',
      name: 'Refresh Owen Wiki template files',
      callback: () => this.installTemplate(true),
    });

    this.addSettingTab(new OwenWikiSettingTab(this.app, this));

    if (this.settings.autoInstallOnFirstActivation && this.settings.installedTemplateVersion !== TEMPLATE_VERSION) {
      await this.installTemplate(false);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async installTemplate(forceOverwrite: boolean): Promise<void> {
    const overwrite = forceOverwrite || this.settings.overwriteExistingFiles;
    const today = this.today();
    const month = today.slice(0, 7).replace('-', '');
    const stats: InstallStats = {
      createdFolders: 0,
      copiedFiles: 0,
      overwrittenFiles: 0,
      skippedFiles: 0,
    };

    try {
      await this.ensureTemplateKitAvailable();
      await this.createVaultFolders(month, stats);
      await this.copyRootFiles(today, overwrite, stats);
      await this.copyTemplateFolders(today, overwrite, stats);
      await this.createCategoryIndexes(today, overwrite, stats);
      await this.createOutputStub(today, overwrite, stats);
      await this.createSourcesStub(today, overwrite, stats);

      const summary = `folders ${stats.createdFolders}, copied ${stats.copiedFiles}, overwritten ${stats.overwrittenFiles}, skipped ${stats.skippedFiles}`;
      this.settings.installedTemplateVersion = TEMPLATE_VERSION;
      this.settings.installedAt = new Date().toISOString();
      this.settings.lastInstallSummary = summary;
      await this.saveSettings();

      new Notice(`Owen Wiki template configured: ${summary}`);
    } catch (error) {
      console.error('Owen Wiki template setup failed', error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Owen Wiki template setup failed: ${message}`);
    }
  }

  private async ensureTemplateKitAvailable(): Promise<void> {
    const templateReadme = this.templatePath('README.md');
    if (!(await this.app.vault.adapter.exists(templateReadme))) {
      throw new Error(`Template kit not found at ${templateReadme}`);
    }
  }

  private async createVaultFolders(month: string, stats: InstallStats): Promise<void> {
    const folders = [
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

    for (const folder of folders) {
      await this.ensureFolder(folder, stats);
    }
  }

  private async copyRootFiles(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const files: FileTarget[] = [
      { source: 'AGENTS.md', target: 'AGENTS.md' },
      { source: 'README.md', target: 'README.md' },
      { source: 'CHANGELOG.md', target: 'CHANGELOG.md' },
      { source: 'SETUP-GUIDE.md', target: 'SETUP-GUIDE.md' },
      { source: '.gitignore', target: '.gitignore' },
      { source: 'starter-files/index.md', target: 'index.md', replaceDate: true },
      { source: 'starter-files/log.md', target: 'log.md', replaceDate: true },
      { source: 'starter-files/overview.md', target: 'wiki/synthesis/overview.md', replaceDate: true },
    ];

    for (const file of files) {
      await this.copyTextFile(file, today, overwrite, stats);
    }
  }

  private async copyTemplateFolders(today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const folders: FolderTarget[] = [
      { source: 'templates', target: 'templates', enabled: true },
      { source: 'ontology-templates', target: 'wiki/ontology', replaceDate: true, enabled: true },
      { source: 'scripts', target: 'scripts', enabled: this.settings.includeScripts },
      { source: 'assets', target: 'assets', enabled: this.settings.includeAssets },
      { source: '.github', target: '.github', enabled: this.settings.includeGithubWorkflow },
    ];

    for (const folder of folders) {
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
    const sourcePath = this.templatePath(folder.source);
    const targetPath = normalizePath(folder.target);

    await this.ensureFolder(targetPath, stats);
    await this.copyFolderContents(sourcePath, targetPath, Boolean(folder.replaceDate), today, overwrite, stats);
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
      const content = await this.readTemplateFile(file, replaceDate, today);
      await this.writeTextFile(targetFile, content, overwrite, stats);
    }
  }

  private async copyTextFile(file: FileTarget, today: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const content = await this.readTemplateFile(this.templatePath(file.source), Boolean(file.replaceDate), today);
    await this.writeTextFile(file.target, content, overwrite, stats);
  }

  private async readTemplateFile(path: string, replaceDate: boolean, today: string): Promise<string> {
    const content = await this.app.vault.adapter.read(path);
    return replaceDate ? content.split('{{date}}').join(today) : content;
  }

  private async writeTextFile(path: string, content: string, overwrite: boolean, stats: InstallStats): Promise<void> {
    const normalizedPath = normalizePath(path);
    const exists = await this.app.vault.adapter.exists(normalizedPath);

    if (exists && !overwrite) {
      stats.skippedFiles += 1;
      return;
    }

    const parent = this.dirname(normalizedPath);
    if (parent) {
      await this.ensureFolder(parent, stats);
    }

    await this.app.vault.adapter.write(normalizedPath, content);

    if (exists) {
      stats.overwrittenFiles += 1;
    } else {
      stats.copiedFiles += 1;
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
        await this.app.vault.adapter.mkdir(current);
        if (stats) {
          stats.createdFolders += 1;
        }
      }
    }
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

  private basename(path: string): string {
    return path.split('/').filter(Boolean).pop() ?? path;
  }

  private dirname(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }
}

class OwenWikiSettingTab extends PluginSettingTab {
  plugin: OwenWikiPlugin;

  constructor(app: App, plugin: OwenWikiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Owen Wiki Template' });

    const status = containerEl.createDiv({ cls: 'owen-wiki-plugin-status' });
    const installed = this.plugin.settings.installedTemplateVersion || 'not installed';
    status.createEl('div', { text: `Template version: ${TEMPLATE_VERSION}` });
    status.createEl('div', { text: `Installed version: ${installed}` });
    if (this.plugin.settings.lastInstallSummary) {
      status.createEl('div', { text: `Last run: ${this.plugin.settings.lastInstallSummary}` });
    }

    new Setting(containerEl)
      .setName('Configure on first activation')
      .setDesc('Create the Owen-WIKI vault structure automatically when this plugin is first enabled.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoInstallOnFirstActivation)
        .onChange(async (value) => {
          this.plugin.settings.autoInstallOnFirstActivation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Overwrite existing files')
      .setDesc('Replace existing template files during manual setup. Leave this off to preserve vault edits.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.overwriteExistingFiles)
        .onChange(async (value) => {
          this.plugin.settings.overwriteExistingFiles = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include automation scripts')
      .setDesc('Copy the Owen-WIKI Python, PowerShell, shell, and YAML automation files into scripts/.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeScripts)
        .onChange(async (value) => {
          this.plugin.settings.includeScripts = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include visual assets')
      .setDesc('Copy the SVG assets used by the Owen-WIKI README and documentation.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeAssets)
        .onChange(async (value) => {
          this.plugin.settings.includeAssets = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include GitHub Actions workflow')
      .setDesc('Copy the wiki quality-gate workflow into .github/workflows/.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeGithubWorkflow)
        .onChange(async (value) => {
          this.plugin.settings.includeGithubWorkflow = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Run setup now')
      .setDesc('Create missing folders and copy template files using the current settings.')
      .addButton((button) => button
        .setButtonText('Configure')
        .setCta()
        .onClick(async () => {
          await this.plugin.installTemplate(false);
          this.display();
        }));

    new Setting(containerEl)
      .setName('Refresh now')
      .setDesc('Rerun setup and overwrite files for this run only.')
      .addButton((button) => button
        .setButtonText('Refresh')
        .onClick(async () => {
          await this.plugin.installTemplate(true);
          this.display();
        }));
  }
}