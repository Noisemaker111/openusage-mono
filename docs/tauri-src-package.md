# Tauri Source Package

`packages/tauri-src` is the embedded OpenUsage desktop app source package.

## Scope

- standalone Tauri application codebase (macOS + Windows support)
- release workflows run from repository root and publish `packages/tauri-src`
- root monorepo scripts proxy common package operations

## Run Locally

```bash
bun run dev:tauri-src
```

Desktop runtime:

```bash
cd packages/tauri-src
bun run desktop:dev
```

## Build

Web/app UI build:

```bash
bun run build:tauri-src
```

Desktop binaries:

```bash
cd packages/tauri-src
bun run desktop:build
```

## Version Sync

From repository root:

```bash
bun run release:version 0.6.3
```

From `packages/tauri-src` (package-local helper):

```bash
bun run release:version 0.6.3
```

This updates:

- `packages/tauri-src/package.json`
- `packages/tauri-src/src-tauri/tauri.conf.json`
- `packages/tauri-src/src-tauri/Cargo.toml`

## Notes

- release signing secrets are configured in the GitHub repository secrets, not in local files
- updater endpoint and updater public key are pinned for releases in `packages/tauri-src/src-tauri/tauri.conf.json`
