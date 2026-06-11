# Testing

Use this smoke test before publishing a release.

## Local Vault Install

1. Build the plugin package.

```bash
npm run package
```

Run the unit tests for pure setup helpers.

```bash
npm test
```

1. Copy the release files into a test vault plugin folder.

```powershell
$pluginDir = 'D:\TEST\.obsidian\plugins\owen-wiki'
New-Item -ItemType Directory -Force $pluginDir | Out-Null
Get-ChildItem -Path $pluginDir -Force | Remove-Item -Recurse -Force
Copy-Item 'D:\Github\owen-wiki-plugin\main.js' $pluginDir -Force
Copy-Item 'D:\Github\owen-wiki-plugin\manifest.json' $pluginDir -Force
Copy-Item 'D:\Github\owen-wiki-plugin\styles.css' $pluginDir -Force
Copy-Item 'D:\Github\owen-wiki-plugin\template-kit' (Join-Path $pluginDir 'template-kit') -Recurse -Force
```

1. Enable the plugin in the test vault.

```json
[
  "owen-wiki"
]
```

Save that JSON as `.obsidian/community-plugins.json`, and make sure `.obsidian/app.json` has `"safeMode": false`.

## Smoke Checks

- Obsidian loads **Owen Wiki Template** without console errors.
- First activation shows the setup confirmation prompt.
- **Configure** creates the Owen-WIKI folder structure.
- Existing files are skipped when overwrite is off.
- The setup report lists copied and skipped files.
- Minimal, Standard, Full, and Custom preset states update correctly in plugin settings.
- Dry Run shows planned changes without writing files.
- Upgrade backs up overwritten files when backup is enabled.
- Health Check reports missing folders/files and template manifest metadata.
- Settings and setup dialogs switch between English and Korean.
