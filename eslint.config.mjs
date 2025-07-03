import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import globals from 'globals';

export default [
    {
        ignores: [
            '**/dist',
            '**/node_modules',
            '**/coverage',
            '**/docs/dist',
            '**/docs/node_modules',
            // Ignore all files outside of src directory
            '*',
            '!src/**'
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            import: _import,
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },

            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',

            parserOptions: {
                project: './tsconfig.json',
            },
        },

        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                },
            },
        },

        rules: {
            // TypeScript ESLint recommended rules
            ...typescriptEslint.configs.recommended.rules,

            // Custom overrides
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],

            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'import/order': ['error', { 'newlines-between': 'always' }],
            'import/no-unresolved': 'error',
        },
    },
    // Separate config for config files that don't need strict TypeScript project parsing
    {
        files: ['*.config.ts', '*.config.js', '*.config.mjs'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            // Don't use project for config files
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
]; 