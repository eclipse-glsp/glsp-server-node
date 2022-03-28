/** @type {import('eslint').Linter.Config} */
module.exports = {
    extends: '@eclipse-glsp',
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: 'tsconfig.json'
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
