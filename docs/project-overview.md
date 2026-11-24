# asset-forge

생성형 AI 게임 에셋을 브라우저에서 편집하고, 3D로 바로 확인하고, 여럿이 동시에 만지는 미니 에디터.

## 왜
넥슨 AI본부 웹 프론트엔드 인턴(판교, 마감 2026-12-18) 공고의 업무를 축소 재현한 지원용 포트폴리오.

| 공고 | 이 프로젝트 |
|---|---|
| 생성형 AI 에셋 제작 도구 웹 FE | 프롬프트 → 에셋 생성 → 캔버스 배치 (W-06) |
| 캔버스, 드래그 | 2D 에디터: 드래그·리사이즈·회전 (W-02) |
| 실시간 프리뷰 | Three.js 3D 프리뷰, 캔버스 변경 즉시 반영 (W-03, W-04) |
| 필수 React / TS / Vite | 그대로 사용 (Next.js 쓰지 않음) |
| 우대 Yjs·WebSocket | y-websocket 실시간 협업 (W-05) |
| 우대 Three.js | 3D 프리뷰 |

## 범위 밖
로그인, DB 영속화, 모바일 대응, 디자인 다듬기.

## 스택
Vite + React + TypeScript, Three.js, Yjs + y-websocket, Vitest, Playwright, 배포는 Vercel(앱) + 무료 WS 호스트.
