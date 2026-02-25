# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

ERManager — VS Code / Cursor.ai용 DB ER 다이어그램 편집 도구 익스텐션.

## 파일 포맷

| 파일                | 역할                      | Git 커밋 |
| ------------------- | ------------------------- | -------- |
| `*.erm.json`        | DB 스키마 (네이티브 포맷) | O        |
| `*.erm.layout.json` | 다이어그램 위치 정보      | 팀 결정  |

## 기술 스택

- **Extension host**: TypeScript + VS Code Extension API (`CustomTextEditorProvider`)
- **Webview UI**: React 18 + ReactFlow (`@xyflow/react` v12)
- **빌드**: esbuild — extension과 webview를 각각 별도 번들로 생성

## 프로젝트 구조

```
src/                    # Extension host (Node.js 실행)
  extension.ts          # activate / deactivate
  ErdEditorProvider.ts  # CustomTextEditorProvider 구현체
  types.ts              # 공유 타입 정의 (ErdSchema, Table, Column 등)
webview-src/            # Webview UI (브라우저 실행)
  index.tsx             # React 진입점
  App.tsx               # 메인 컴포넌트
  global.d.ts           # acquireVsCodeApi 타입 선언
out/                    # 빌드 결과물 (gitignore)
  extension.js
  webview.js
  webview.css
```

## 빌드 아키텍처

`esbuild.mjs`가 두 번들을 동시에 생성:

1. `out/extension.js` — Node.js 타겟, `vscode`는 external
2. `out/webview.js` + `out/webview.css` — Browser 타겟, React + ReactFlow 포함

## 개발 명령어

```bash
pnpm install         # 의존성 설치
pnpm compile         # extension + webview 빌드
pnpm watch           # 자동 재빌드 (개발 중)
pnpm lint            # ESLint
pnpm package         # .vsix 패키징
```

F5 (VS Code) → Extension Development Host가 `test-fixtures/` 폴더를 자동으로 열어 디버그 실행.
`test-fixtures/sample.erm.json` 파일로 ERManager 에디터 동작 확인.

## Extension ↔ Webview 메시지 프로토콜

| 방향                | `type`   | payload                             |
| ------------------- | -------- | ----------------------------------- |
| Extension → Webview | `update` | `{ content: string }` (JSON 문자열) |
| Webview → Extension | `ready`  | 없음                                |
| Webview → Extension | `save`   | `{ content: string }` (JSON 문자열) |

## 커뮤니케이션

항상 **한국어**로 대화.
