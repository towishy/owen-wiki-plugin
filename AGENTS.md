# Owen Wiki Template Obsidian Plugin Agent Instructions

이 저장소는 Owen Wiki Template Obsidian Plugin 프로젝트다.

## Knowledge Source

VS Code에서는 이 프로젝트와 `C:\OWEN\github\wiki`를 멀티 루트 워크스페이스로 함께 연다.

- `C:\OWEN\github\wiki`를 디자인·지식 참고 루트로 상시 취급한다.
- UI/UX, 접근성, 반응형 또는 컴포넌트 작업 전 `lib/ui-foundation/`, `lib/ui-lab/src/`, 관련 `lib/ui-foundation/REFERENCE-STUDY-*.md`를 작업 용어로 검색하고 해당 소스를 확인한다.
- 사용자가 명시적으로 요청하지 않으면 `C:\OWEN\github\wiki`의 파일은 읽기 전용으로 유지한다.
- `C:\OWEN\github\wiki`에 접근할 수 없으면 추측으로 대체하지 않고, 검증하지 못한 사실을 완료 보고에 명시한다.

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
디자인/프론트엔드 작업을 시작하기 전 `C:\OWEN\github\wiki\lib\ui-foundation`의 `README.md`, `DESIGN.md`, `tokens/`, `src/` 컴포넌트 계약을 읽고 현재 프로젝트에 맞게 적용한다.

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
