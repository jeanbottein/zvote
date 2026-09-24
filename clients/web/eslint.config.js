import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The reference results visualisation is kept unchanged on purpose (see
    // CLAUDE.md). Its one `as any` sets a CSS custom property through `style`.
    files: ['src/features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
]);
