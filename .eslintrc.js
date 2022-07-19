/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    extends: '@eclipse-glsp',
    ignorePatterns: ['**/{node_modules,lib}', '**/.eslintrc.js'],

    parserOptions: {
        tsconfigRootDir: __dirname,
        project: 'tsconfig.eslint.json'
    },
    rules: {
        'no-shadow': 'off',
        'no-restricted-imports': [
            'warn',
            {
                name: 'sprotty-protocol',
                message:
                    "The sprotty-protocol default exports are customized and reexported by GLSP. Please import from '@eclipse-glsp/client' instead"
            }
        ]
    }
};
