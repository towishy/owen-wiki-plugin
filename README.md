# Owen Wiki Template Obsidian Plugin

Owen Wiki Template is an Obsidian plugin that installs the Owen-WIKI Template Kit into the active vault. When the plugin is enabled, it can create the LLM wiki operating structure, starter pages, ontology templates, page templates, automation scripts, assets, and optional GitHub Actions workflow.

## What It Creates

- `AGENTS.md`, `README.md`, `CHANGELOG.md`, `SETUP-GUIDE.md`, `index.md`, and `log.md`
- `raw/articles/YYYYMM/`, `raw/obsidian/Clippings/YYYYMM/`, and `raw/obsidian/outputs/YYYYMM/attachments/`
- `wiki/entities/`, `wiki/concepts/`, `wiki/summaries/`, `wiki/comparisons/`, `wiki/synthesis/`, and `wiki/ontology/`
- `templates/`, `scripts/`, `assets/`, `outputs/wiki-ops/`, and `graphify-out/`
- Optional `.github/workflows/wiki-lint.yml`

Existing files are skipped by default. Enable **Overwrite existing files** in the plugin settings only when you intentionally want to refresh template files.

## Commands

- **Configure Owen Wiki template**: creates missing template files and folders.
- **Refresh Owen Wiki template files**: reruns setup using the current settings.

## Release Build

```bash
npm install
npm run package
```

The package script creates `release/owen-wiki-plugin-1.17.0.zip`, containing the Obsidian install files and bundled template kit.
