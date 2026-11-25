import tseslint from 'typescript-eslint';

// 모듈 경계 (CLAUDE.md 아키텍처 규칙)
const restrict = (files, patterns, message) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }] },
});

export default tseslint.config(
  { ignores: ['dist', 'test-results', 'playwright-report'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  restrict(
    ['src/core/**'],
    ['react', 'react/*', 'react-dom', 'react-dom/*', 'three', 'three/*',
      '**/sync/**', '**/canvas/**', '**/preview/**', '**/ai/**', '**/app/**'],
    'core/는 순수 TS: React·DOM·Three·다른 src 모듈 import 금지',
  ),
  restrict(['src/canvas/**'], ['**/preview/**'], 'canvas/는 preview/를 직접 참조할 수 없다'),
  restrict(['src/preview/**'], ['**/canvas/**'], 'preview/는 canvas/를 직접 참조할 수 없다'),
);
