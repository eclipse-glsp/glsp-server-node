/** @type {import('eslint').Linter.Config} */
const year = new Date().getFullYear();
module.exports = {
  extends: "@eclipse-glsp",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "tsconfig.json",
  },
  plugins: ["chai-friendly"],
  rules: {
    "no-shadow": "off",
    "@typescript-eslint/no-this-alias": "off",
    // chai friendly
    "no-unused-expressions": 0,
    "chai-friendly/no-unused-expressions": 2,
  },
};
