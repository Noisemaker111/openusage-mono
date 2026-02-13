# Release and Deployment Flow

This repository now supports a two-channel flow:

- `dev` branch -> prerelease desktop builds + dev website build channel
- `main` branch -> production website + stable desktop releases (tagged)

## Branch Strategy

1. Open PRs into `dev` for ongoing feature work.
2. Merge to `dev` to trigger:
   - CI checks (`.github/workflows/ci.yml`)
   - Vercel preview deployment via Git integration
   - desktop prerelease artifacts (`.github/workflows/release-dev.yml`)
3. When stable, open PR from `dev` -> `main`.
4. Merge to `main`, then cut a tag (`vX.Y.Z`) to publish a stable desktop release.

## Workflows

- `ci.yml`
  - runs on pushes/PRs to `main` and `dev`
  - checks types and builds the web app
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

When deployed on Vercel Git integration:

- `VITE_RELEASE_CHANNEL` can be set explicitly in Vercel project env vars (`dev` for preview, `stable` for production)
- if unset, the app falls back to `VITE_VERCEL_ENV` (`preview` -> `dev`, everything else -> `stable`)

## Required Secrets and Variables

### Required for desktop release signing

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### Vercel deployment

- no GitHub Actions secrets required when using Vercel Git integration
- `RELEASE_REPOSITORY` can be set as a Vercel environment variable (optional override)

Use these Vercel project settings for this monorepo:

- Root Directory: `apps/web`
- Install Command: `cd ../.. && bun install --frozen-lockfile`
- Build Command: `cd ../.. && cd packages/backend && npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd "bun run --cwd ../../apps/web build"`
- Output Directory: `dist`

Required Vercel environment variables:

- `CONVEX_DEPLOY_KEY` (Production deploy key, Production environment)
- `CONVEX_DEPLOY_KEY` (Preview deploy key, Preview environment)

Optional Convex deployment variables (for private GitHub repository metadata):

- `GITHUB_TOKEN` (set in Convex deployment env vars, not Vercel)

## Feature Gating Approach

Use branch/channel gating as the default safety mechanism:

- ship new features to `dev` first
- validate with prerelease binaries and dev website channel
- merge to `main` only after validation

For risky features, add explicit runtime flags (for example `VITE_FEATURE_<NAME>`) and keep them disabled in `main` deployments until stable.
