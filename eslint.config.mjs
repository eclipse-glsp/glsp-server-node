import glspConfig from '@eclipse-glsp/eslint-config';

export default [
    ...glspConfig,
    // Ignore JS config/build files that are not part of the TS project
    {
        ignores: ['**/*.js', '**/*.mjs', '**/*.cjs']
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
            'no-restricted-imports': [
                'warn',
                {
                    name: 'sprotty-protocol',
                    message:
                        "The sprotty-protocol default exports are customized and reexported by GLSP. Please import from '@eclipse-glsp/protocol' instead"
                },
                '.',
                '..',
                '../..'
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
