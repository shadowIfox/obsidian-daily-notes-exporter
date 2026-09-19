import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist',
            'node_modules',
            'test-results',
            'playwright-report',
            // перенесены из временных скриптов дословно (см. .prettierignore)
            'tests/e2e/ported',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
    { files: ['tests/**/*.ts', '*.config.{js,ts}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
    prettier,
);
