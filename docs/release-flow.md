# Release and Deployment Flow

This repository now supports a two-channel flow:

- `dev` branch -> prerelease desktop builds + dev website build channel
- `main` branch -> production website + stable desktop releases (tagged)

## Branch Strategy

1. Open PRs into `dev` for ongoing feature work.
2. Merge to `dev` to trigger:
   - CI checks (`.github/workflows/ci.yml`)
   - website deploy pipeline (`.github/workflows/deploy-web.yml` with `VITE_RELEASE_CHANNEL=dev`)
   - desktop prerelease artifacts (`.github/workflows/release-dev.yml`)
3. When stable, open PR from `dev` -> `main`.
4. Merge to `main`, then cut a tag (`vX.Y.Z`) to publish a stable desktop release.

## Workflows

- `ci.yml`
  - runs on pushes/PRs to `main` and `dev`
  - checks types and builds the web app
- `deploy-web.yml`
  - builds website with branch-based release channel
  - deploys to Cloudflare Pages when configured
  - falls back to GitHub Pages for `main` when Cloudflare is not configured
- `release-dev.yml`
  - runs on `dev` branch pushes
  - validates versions and publishes prerelease desktop binaries
- `release-stable.yml`
  - runs on `v*` tags (or manual dispatch)
  - validates tag/version alignment and publishes stable desktop binaries

## Versioning

Keep the desktop app versions aligned before a stable tag:

```bash
bun run release:version 1.2.3
```

This updates:

- `packages/tauri-src/package.json`
- `packages/tauri-src/src-tauri/tauri.conf.json`
- `packages/tauri-src/src-tauri/Cargo.toml`

Then commit and tag:

```bash
git add .
git commit -m "release: prepare v1.2.3"
git tag v1.2.3
git push origin main --follow-tags
```

## Website Release Source

The website download logic reads release metadata from GitHub and supports channels:

- stable channel: latest stable release
- dev channel: latest prerelease

Configure via env vars at build time:

- `VITE_RELEASE_REPOSITORY` (default: `Noisemaker111/opencode-mono`)
- `VITE_RELEASE_CHANNEL` (`stable` or `dev`)

`deploy-web.yml` sets these automatically from branch context.

## Required Secrets and Variables

### Required for desktop release signing

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### Optional for Cloudflare Pages deployment

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT` (Repository Variable)
- `RELEASE_REPOSITORY` (Repository Variable, optional override)

If Cloudflare is not configured, `main` deploys to GitHub Pages as fallback.

## Feature Gating Approach

Use branch/channel gating as the default safety mechanism:

- ship new features to `dev` first
- validate with prerelease binaries and dev website channel
- merge to `main` only after validation

For risky features, add explicit runtime flags (for example `VITE_FEATURE_<NAME>`) and keep them disabled in `main` deployments until stable.
