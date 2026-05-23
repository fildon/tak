// @ts-check
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/pkg/**', '**/node_modules/**'] },

  // TypeScript rules for all TS/TSX source files
  {
    files: ['packages/shared/src/**/*.ts', 'packages/frontend/src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },

  // React Hooks rules for frontend only
  {
    files: ['packages/frontend/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Disabled: the codebase intentionally calls setState inside effects to
      // drive UI phase from game state. Refactoring is a separate concern.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Prettier last — disables all ESLint formatting rules
  prettier,
);
