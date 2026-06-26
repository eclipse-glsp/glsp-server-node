# CLAUDE.md

## Project Overview

Eclipse GLSP Server Node monorepo. Provides the TypeScript-based server framework for the Graphical Language Server Platform (GLSP). Contains core server packages, graph model, ELK layout integration, and example workflow server. Uses pnpm workspaces.

## Build & Development

- **Package manager**: pnpm — do not use yarn or npm
- **Build**: `pnpm install` from root installs and compiles everything
- **Compile**: `pnpm compile` (runs `tsc -b` with project references)
- **Clean**: `pnpm clean`
- **Bundle**: `pnpm bundle` (esbuild bundles the workflow example, node + webworker targets)
- **Start example server**: `pnpm start` (TCP on 5007) or `pnpm start:websocket` (WebSocket on 8081) — runs the pre-built bundle
- **Dev server (hot reload)**: `pnpm dev` (TCP on 5007) or `pnpm dev:ws` (WebSocket on 8081) — esbuild watches `src` and restarts the server on change

## Validation

- **Tests**: `pnpm test` (Mocha), runs across all packages
- After completing any code changes, always run the `/fix` skill before reporting completion. It auto-fixes lint/format/header issues and runs the tests; manually resolve anything it could not auto-fix (remaining lint errors, test failures) and re-run it.

## Changelog

- Do not hand-edit `CHANGELOG.md`. Entries are produced collectively before each release via the `/generate-changelog` skill, so skip manual changelog updates when implementing a change.

## Import Rules

These are enforced by ESLint and are easy to get wrong:

- **Never import from `sprotty-protocol` directly** — use `@eclipse-glsp/protocol` instead
