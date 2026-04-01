# AGENTS.md

## Project Overview

Eclipse GLSP Server Node monorepo. Provides the TypeScript-based server framework for the Graphical Language Server Platform (GLSP). Contains core server packages, graph model, ELK layout integration, and example workflow server. Uses Lerna with Yarn workspaces.

## Build & Development

-   **Package manager**: Yarn 1.x (classic) — do not use Yarn 2+/Berry or npm
-   **Build**: `yarn` from root installs and compiles everything
-   **Clean**: `yarn clean`
-   **Start example server**: `yarn start` (TCP on 5007) or `yarn start:websocket` (WebSocket on 8081)

## Validation

-   After completing any code changes, always run the `/verify` skill before reporting completion
-   If verification fails, run the `/fix` skill to auto-fix issues, then re-run `/verify`

## Import Rules

These are enforced by ESLint and are easy to get wrong:

-   **Never import from `sprotty-protocol` directly** — use `@eclipse-glsp/protocol` instead
