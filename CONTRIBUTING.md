# Contributing to openusage-mono

Thanks for contributing.

This repository is a Bun + Turbo monorepo with three primary surfaces:

- `apps/web`: marketing/download website (TanStack Router + Vite)
- `packages/backend`: Convex backend
- `packages/tauri-src`: desktop app (Tauri 2 + React + Rust)

Please read this guide before opening a PR.

## Prerequisites

- Bun installed (`packageManager` is pinned in `package.json`)
- Node.js available for tooling scripts used in CI
- Rust toolchain for desktop builds (`packages/tauri-src/src-tauri`)
- Convex account/project for backend-connected local dev

## Local Setup

From repo root:

```bash
bun install --frozen-lockfile
bun run dev:setup
```

Then run the workspace:

```bash
bun run dev
```

Useful scoped commands:

```bash
bun run dev:web
bun run dev:tauri-src
bun run dev:server
```

## Build and Typecheck

From repo root:

```bash
bun run check-types
bun run build
```

Web only:

```bash
bun run --cwd apps/web check-types
bun run --cwd apps/web build
```

Desktop only:

```bash
bun run --cwd packages/tauri-src check-types
bun run --cwd packages/tauri-src build
bun run --cwd packages/tauri-src desktop:build
```

## Tests

Tests are currently centered in `packages/tauri-src`:

```bash
bun run --cwd packages/tauri-src test
bun run --cwd packages/tauri-src test:watch
bun run --cwd packages/tauri-src test:coverage
```

Single-file test examples:

```bash
bun run --cwd packages/tauri-src test -- src/lib/color.test.ts
bun run --cwd packages/tauri-src test -- plugins/codex/plugin.test.js
```

Single named test case:

```bash
bun run --cwd packages/tauri-src test -- plugins/codex/plugin.test.js -t "throws when auth missing"
```

## Branching and Release Flow

Primary branches:

- `dev`: integration branch and prerelease desktop channel
- `main`: production branch and stable release source

Day-to-day shipping flow:

1. Branch off `dev` (`feature/...`).
2. Open PR into `dev`.
3. Validate on PR preview deployment (Vercel URL from the commit checks), plus CI.
4. Merge to `dev` when preview looks right.
5. For release, open PR `dev -> main`.
6. Merge to `main` to deploy production web.
7. When ready for desktop stable, tag from `main` (`v0.6.x`) to trigger `release-stable`.

## CI and Deploy Notes

- CI workflow: `.github/workflows/ci.yml`
  - checks `bun run check-types`
  - builds web with `bun run --cwd apps/web build`
- Dev desktop release workflow: `.github/workflows/release-dev.yml`
- Stable desktop release workflow: `.github/workflows/release-stable.yml`
- Web deployment is via Vercel Git integration.

Important: the production Vercel alias follows the configured production branch (typically `main`), while `dev` updates preview deployments.

## Versioning and Tagging

Before creating a stable tag, sync version numbers:

```bash
bun run release:version 0.6.1
```

This updates:

- `packages/tauri-src/package.json`
- `packages/tauri-src/src-tauri/tauri.conf.json`
- `packages/tauri-src/src-tauri/Cargo.toml`

## Code Quality Expectations

- Keep changes focused and minimal.
- Avoid unrelated refactors in feature/fix PRs.
- Follow local file style (semicolon use varies by package).
- Use strict TypeScript patterns (`unknown` + narrowing at boundaries).
- Prefer `import type` for type-only imports.
- Add or update tests for behavior changes and regressions.

## Updater Signing Gotcha

For Tauri updater configuration, `plugins.updater.pubkey` in `packages/tauri-src/src-tauri/tauri.conf.json` must be the base64-encoded minisign public key payload.

Do not paste only the raw `RWS...` line, or release builds will fail to decode the pubkey.

## Pull Request Checklist

Before requesting review:

- Run relevant typecheck/build/test commands locally.
- Ensure CI is green.
- Validate Vercel preview for web-facing changes.
- Include clear PR notes for behavior changes and release-impacting changes.
- Keep PR scope single-purpose.

Thanks again for helping improve OpenUsage.
