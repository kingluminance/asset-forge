import tseslint from 'typescript-eslint';

// 모듈 경계 (CLAUDE.md 아키텍처 규칙)
const restrict = (files, patterns, message, ...more) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: patterns }, ...more].map((p) => ({ ...p, message })) }] },
});
// 디렉터리 자체(index import)와 하위 경로 모두 막는다
const mods = (...names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);
// server/는 계약 파일(protocol)만 허용 (gitignore 문법: 부정 패턴으로 예외).
// '**/server'(index import)는 group에 넣으면 부모가 무시되어 예외가 안 먹으므로 regex로 따로 막는다
const serverContractOnly = [{ group: ['**/server/**', '!**/server/protocol'] }, { regex: '(^|/)server/?$' }];

export default tseslint.config(
  { ignores: ['dist', 'test-results', 'playwright-report'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  restrict(
    ['src/core/**'],
    ['react', 'react/*', 'react-dom', 'react-dom/*', 'three', 'three/*',
      ...mods('sync', 'canvas', 'preview', 'ai', 'app', 'server')],
    'core/는 순수 TS: React·DOM·Three·다른 src 모듈·server import 금지',
  ),
  { files: ['src/core/**'], rules: { 'no-restricted-globals': ['error', 'window', 'document'] } },
  restrict(['src/canvas/**'], mods('preview', 'sync', 'ai', 'app', 'server'), 'canvas/는 core/만 참조할 수 있다'),
  restrict(['src/preview/**'], mods('canvas', 'sync', 'ai', 'app', 'server'), 'preview/는 core/만 참조할 수 있다'),
  restrict(['src/sync/**'], mods('canvas', 'preview', 'ai', 'app'), 'sync/는 core/와 server/protocol만 참조할 수 있다', ...serverContractOnly),
  restrict(['src/ai/**'], mods('canvas', 'preview', 'sync', 'app'), 'ai/는 core/와 server/protocol만 참조할 수 있다', ...serverContractOnly),
);
