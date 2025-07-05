/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**'],
            exclude: [
                'node_modules/',
                'dist/',
                'tests/',
                '**/*.d.ts',
                '**/*.test.ts',
                'docs/',
            ],
            thresholds: {
                statements: 92,
                branches: 93,
                functions: 99,
                lines: 92,
            },
        },
    },
}); 