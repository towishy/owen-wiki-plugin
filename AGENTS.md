# Owen Wiki Template Obsidian Plugin Agent Instructions

이 저장소는 Owen Wiki Template Obsidian Plugin 프로젝트다.

## Knowledge Source

VS Code에서는 이 프로젝트와 `C:\OWEN\github\wiki`를 멀티 루트 워크스페이스로 함께 연다.

Owen WIKI 구조, Obsidian plugin, template kit, wiki sync 관련 작업은 wiki를 먼저 참조한다.

```powershell
Push-Location C:\OWEN\github\wiki
.\.venv\Scripts\python.exe scripts\wiki-query.py "Owen WIKI template Obsidian plugin" --limit 7 --json
Pop-Location
```

우선 참조:

- `wiki/AGENTS.md`
- `wiki/docs/project-agents-with-wiki.md`
- `wiki/templates/project-agents-template.md`
- `wiki/wiki/concepts/ui-design-system-knowledge.md`

## UI Direction

UI 작업 전 sibling workspace folder `wiki`의 `wiki/concepts/ui-design-system-knowledge.md`를 우선 참조한다.

기본 조합:

- Extend-UI / shadcn component structure
- Owen Graphite Liquid Glass visual surface
- Reicon for richer icon options
- Border Beam only for focused emphasis
- Boneyard only for data-heavy app skeleton loading

## Project Commands

```powershell
npm run dev
npm run build
npm run test
npm run package
npm run sync:template
npm run release:plugin
```

## Local Rules

- 템플릿 kit 변경은 wiki canonical 구조와 동기화한다.
- Obsidian plugin API 변경은 실제 manifest, command, settings UI 영향을 확인한다.
- 릴리스 전 `npm run test`와 `npm run package`를 우선한다.
