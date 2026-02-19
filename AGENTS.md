# Repository Guidelines

## Project Structure & Module Organization

This repository is a Yarn workspace monorepo for the GLSP Node server stack.

-   `packages/server`: core framework (`src/common`, `src/node`, `src/browser`).
-   `packages/graph`: TypeScript GModel types and utilities.
-   `packages/layout-elk`: ELK-based layout integration.
-   `examples/workflow-server` and `examples/workflow-server-bundled`: runnable example server and bundling setup.
-   Root config files (`tsconfig.json`, `eslint.config.mjs`, `.mocharc`, `.nycrc`) define shared standards across packages.

## Build, Test, and Development Commands

Run from repository root unless noted.

-   `yarn`: install dependencies and trigger prepare build.
-   `yarn build`: compile TypeScript and bundle the workflow example.
-   `yarn lint`: run ESLint across the repo.
-   `yarn test`: run package tests via Lerna (`--no-bail`).
-   `yarn test:coverage`: run coverage per package (nyc).
-   `yarn format` / `yarn format:check`: apply/check Prettier formatting.
-   `yarn check:all`: full CI-style validation (lint, test, format, header checks).
-   `yarn start` or `yarn start:websocket`: launch bundled workflow example server.

## Coding Style & Naming Conventions

-   Language: TypeScript (`Node >= 20`, Yarn 1.x).
-   Formatting and linting are enforced by `@eclipse-glsp/prettier-config` and `@eclipse-glsp/eslint-config`.
-   Use 4-space indentation and existing import ordering patterns.
-   Prefer descriptive kebab-case filenames; tests use `*.spec.ts`.
-   Keep public API barrel exports current (use `yarn generate:index` when needed).

## Testing Guidelines

-   Framework: Mocha with shared config from `.mocharc`.
-   Place tests next to source files using `*.spec.ts` naming.
-   Run all tests: `yarn test`; package-only tests: `yarn --cwd packages/server test`.
-   Validate coverage with `yarn test:coverage` before opening larger changes.

## Commit & Pull Request Guidelines

-   Open or reference an umbrella issue in `https://github.com/eclipse-glsp/glsp` before implementation.
-   Branch naming convention: `issues/<issue_number>` (for example, `issues/241`).
-   Commit messages should be imperative and include issue linkage with an absolute URL, e.g. `closes https://github.com/eclipse-glsp/glsp/issues/241`.
-   PRs should include: problem statement, scope, test evidence (`yarn test`, `yarn lint`), and screenshots/logs for behavior changes.
-   Ensure ECA requirements are met before requesting merge.
