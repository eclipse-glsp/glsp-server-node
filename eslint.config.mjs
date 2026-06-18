import glspConfig from '@eclipse-glsp/eslint-config';

// Relative index and src imports restricted by the shared @eclipse-glsp/eslint-config.
// Must be included in every `no-restricted-imports` override since flat config replaces the entire rule value.
const restrictedBaseImports = ['..', '../index', '../..', '../../index', 'src'];

export default [
    ...glspConfig,
    // Ignore JS config/build files that are not part of the TS project
    {
        ignores: ['**/*.js', '**/*.mjs', '**/*.cjs', '.worktrees/']
    },
    // Apply parserOptions.project only to TypeScript files
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    // Repository-specific rule overrides
    {
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-shadow': 'off',
            '@typescript-eslint/padding-line-between-statements': 'off',
            // The MCP SDK uses `exports` subpath patterns with explicit `.js` suffixes (e.g.
            // `@modelcontextprotocol/sdk/server/mcp.js`). The TypeScript import resolver does
            // not match these against the `./*` wildcard, even though tsc and Node resolve
            // them correctly at compile- and runtime.
            'import-x/no-unresolved': ['error', { ignore: ['^@modelcontextprotocol/sdk/'] }]
        }
    },
    // Default rules for all TS files: restrict direct sprotty-protocol and uuid imports.
    // Covers the lower-layer packages (graph, server) which may consume '@eclipse-glsp/protocol' directly.
    {
        files: ['**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'warn',
                ...restrictedBaseImports,
                {
                    name: 'sprotty-protocol',
                    message:
                        "The sprotty-protocol default exports are customized and reexported by GLSP. Please import from '@eclipse-glsp/protocol' instead"
                },
                {
                    name: 'sprotty-protocol/*',
                    message:
                        "The sprotty-protocol default exports are customized and reexported by GLSP. Please import from '@eclipse-glsp/protocol' instead"
                },
                {
                    name: 'uuid',
                    message: "Use the 'generateUuid'/'isUuid' helpers (from '@eclipse-glsp/protocol') instead of importing 'uuid' directly."
                },
                {
                    name: 'uuid/*',
                    message: "Use the 'generateUuid'/'isUuid' helpers (from '@eclipse-glsp/protocol') instead of importing 'uuid' directly."
                }
            ]
        }
    },
    // examples, layout-elk and server-mcp: only consume the public '@eclipse-glsp/server' API;
    // the lower layers (protocol, sprotty-protocol) are re-exported through it.
    {
        files: ['examples/**/*.{ts,tsx}', 'packages/layout-elk/src/**/*.{ts,tsx}', 'packages/server-mcp/src/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'warn',
                ...restrictedBaseImports,
                {
                    name: 'sprotty-protocol',
                    message: 'Please import from @eclipse-glsp/server instead'
                },
                {
                    name: 'sprotty-protocol/*',
                    message: 'Please import from @eclipse-glsp/server instead'
                },
                {
                    name: '@eclipse-glsp/protocol',
                    message: 'Please import from @eclipse-glsp/server instead'
                },
                {
                    name: '@eclipse-glsp/protocol/*',
                    message: 'Please import from @eclipse-glsp/server instead'
                },
                {
                    name: 'uuid',
                    message: "Use the 'generateUuid'/'isUuid' helpers (from '@eclipse-glsp/server') instead of importing 'uuid' directly."
                },
                {
                    name: 'uuid/*',
                    message: "Use the 'generateUuid'/'isUuid' helpers (from '@eclipse-glsp/server') instead of importing 'uuid' directly."
                }
            ]
        }
    },
    // Test file overrides
    {
        files: ['**/*.spec.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unused-expressions': 'off',
            'import-x/namespace': 'off'
        }
    }
];
