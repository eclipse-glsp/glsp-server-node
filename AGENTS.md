# AGENTS.md

> **This repository is deprecated and will be archived.** Active development happens in the [`glsp-core`](https://github.com/eclipse-glsp/glsp-core) monorepo — do not implement changes here.

## Project Overview

Eclipse GLSP Server Node monorepo. Provides the TypeScript-based server framework for the Graphical Language Server Platform (GLSP). Contains core server packages, graph model, ELK layout integration, and example workflow server. Uses pnpm workspaces.

## Build & Development

- **Package manager**: pnpm — do not use yarn or npm
- **Build**: `pnpm install` from root installs and compiles everything
- **Clean**: `pnpm clean`
- **Start example server**: `pnpm start` (TCP on 5007) or `pnpm start:websocket` (WebSocket on 8081)

## Validation

- After completing any code changes, always run the `/verify` skill before reporting completion
- If verification fails, run the `/fix` skill to auto-fix issues, then re-run `/verify`

## Import Rules

These are enforced by ESLint and are easy to get wrong:

- **Never import from `sprotty-protocol` directly** — use `@eclipse-glsp/protocol` instead
