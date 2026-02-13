# Release Flow

Two-channel delivery flow:

- `dev` branch: prerelease builds for testing and staging
- `main` branch + `v*` tags: stable production releases

## Branch Strategy

1. Feature PRs merge into `dev`.
2. `dev` triggers CI and prerelease desktop binaries (`Release Dev` workflow).
3. Once validated, merge `dev` into `main`.
4. Create and push a semantic tag (`vX.Y.Z`) from `main` to publish stable binaries.

## Workflows

- `ci.yml`: runs checks on pushes and PRs for `main` and `dev`
- `release-dev.yml`: publishes prerelease artifacts from `dev`
- `publish.yml`: publishes stable artifacts from tags

## Version Sync

Keep versions aligned before stable tags:

```bash
bun run release:version 0.6.3
```

This updates:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Then commit, tag, and push:

```bash
git add .
git commit -m "release: prepare v0.6.3"
git tag v0.6.3
git push origin main --follow-tags
```

## Required Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Optional platform-signing secrets can be added as needed for platform notarization/certificate requirements.
