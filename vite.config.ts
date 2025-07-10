import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import replace from '@rollup/plugin-replace';

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            rollupTypes: true,
        }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
            preventAssignment: true,
        }),
    ],
    build: {
        lib: {
            entry: 'src/unplayable.ts',
            name: 'Unplayable',
            formats: ['es', 'cjs'],
            fileName: (format) => `unplayable.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: [
                'fs',
                'fs/promises',
                'path',
                'os',
                'crypto',
                'child_process',
                'stream',
                'events',
                'util',
                'process',
                'readline',
                'winston',
                'glob',
                'zod',
            ],
            output: {
                globals: {
                    'fs': 'fs',
                    'fs/promises': 'fs',
                    'path': 'path',
                    'os': 'os',
                    'crypto': 'crypto',
                    'child_process': 'child_process',
                    'stream': 'stream',
                    'events': 'events',
                    'util': 'util',
                    'process': 'process',
                    'readline': 'readline',
                    'winston': 'winston',
                    'glob': 'glob',
                    'zod': 'zod',
                },
            },
        },
        target: 'node18',
        minify: false,
        sourcemap: true,
    },
});
