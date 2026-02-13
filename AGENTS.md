# AGENTS.md
Guide for agentic coding assistants working in `openusage-mono`.

## 1) Repo Overview
- Package manager: `bun`
- Monorepo runner: `turbo`
- Web app: `apps/web` (TanStack Router + Vite)
- Backend: `packages/backend` (Convex)
- Desktop: `packages/tauri-src` (Tauri 2 + React + Rust)
- Shared config/env: `packages/config`, `packages/env`

## 2) Setup
- Run from repo root: `bun install --frozen-lockfile`
- Configure Convex once: `bun run dev:setup`

## 3) Build / Typecheck / Test Commands
### Root commands
- `bun run dev`
- `bun run build`
- `bun run check-types`
- `bun run dev:web`
- `bun run dev:tauri-src`
- `bun run dev:server`

### Web (`apps/web`)
- `bun run --cwd apps/web dev`
- `bun run --cwd apps/web build`
- `bun run --cwd apps/web check-types`

### Desktop (`packages/tauri-src`)
- `bun run --cwd packages/tauri-src dev`
- `bun run --cwd packages/tauri-src build`
- `bun run --cwd packages/tauri-src check-types`
- `bun run --cwd packages/tauri-src desktop:dev`
- `bun run --cwd packages/tauri-src desktop:build`

### Tests (`packages/tauri-src`)
- Full: `bun run --cwd packages/tauri-src test`
- Watch: `bun run --cwd packages/tauri-src test:watch`
- Coverage: `bun run --cwd packages/tauri-src test:coverage`

### Single test commands (important)
- `bun run --cwd packages/tauri-src test -- src/lib/color.test.ts`
- `bun run --cwd packages/tauri-src test -- src/App.test.tsx`
- `bun run --cwd packages/tauri-src test -- plugins/codex/plugin.test.js`
- `bun run --cwd packages/tauri-src test -- plugins/codex/plugin.test.js -t "throws when auth missing"`

### Lint status
- `turbo.json` includes a `lint` pipeline key.
- There is no active root lint script/config yet.
- Do not add new lint tooling unless explicitly requested.

## 4) CI/CD Reality
- CI workflow: `.github/workflows/ci.yml`
  - triggers on `main` and `dev`
  - runs `bun run check-types`
  - runs `bun run --cwd apps/web build`
- Dev desktop release: `.github/workflows/release-dev.yml` (push to `dev`)
- Stable desktop release: `.github/workflows/release-stable.yml` (tags `v*`)
- Web deployment is via Vercel Git integration.
- Vercel production behavior depends on Vercel "Production Branch":
  - If Production Branch is `main` (default), `dev` gets preview deploys and `main` gets live web.
  - If Production Branch is `dev`, every push to `dev` updates live web; desktop release flows stay unchanged.

## 5) Day-to-Day Shipping Flow
1. Branch from `dev` (`feature/...`, `fix/...`).
2. Open PR into `dev`.
3. Validate CI + Vercel preview URL from commit checks.
4. Merge to `dev` when preview is correct.
5. Open PR `dev -> main`.
6. Merge to `main` to deploy production web.
7. Tag from `main` (`vX.Y.Z`) for stable desktop release.

When Vercel Production Branch is switched to `dev`, step 6 is no longer required for web deploys (but keep `dev -> main` for stable release promotion/tagging discipline).

## 6) Release Version Sync
- Before stable tagging run: `bun run release:version 0.6.1`
- This updates:
  - `packages/tauri-src/package.json`
  - `packages/tauri-src/src-tauri/tauri.conf.json`
  - `packages/tauri-src/src-tauri/Cargo.toml`

## 7) Code Style Expectations
### General
- Keep changes minimal and focused.
- Prefer readable, explicit code over clever abstractions.
- Preserve local architecture and naming patterns.
- Avoid unrelated refactors.

### Imports
- Use ESM imports.
- Group imports: external -> `@/...` aliases -> relative.
- Use `import type` for type-only imports.
- Keep imports deterministic.

### Formatting
- Follow style in touched files (semicolon usage is mixed across packages).
- Prefer small functions and early returns.
- Favor readability in JSX/TSX and object literals.

### Types
- TypeScript is strict across the workspace.
- Prefer `unknown` at boundaries and narrow via guards.
- Avoid `any` in production code.
- Avoid non-null assertions unless justified.
- Prefer discriminated unions for stateful flows.
- Parse external input (env, JSON, API) at boundaries.

### Naming
- Components/types: `PascalCase`
- Functions/vars/hooks: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- UI file names often use kebab-case; match local conventions.

### Error Handling
- Fail fast at boundaries with actionable messages.
- Catch and degrade gracefully in UI refresh/update paths.
- Log with context (`what failed` + error object).
- Plugin probes should surface useful states (auth missing, token expired, HTTP failure).

### Testing
- Keep tests near source: `*.test.ts`, `*.test.tsx`, `plugins/**/*.test.js`.
- Prefer behavior-focused tests over implementation details.
- Add regression tests for bug fixes when practical.

## 8) Important Gotchas
- Tauri updater pubkey must be base64-encoded minisign public key payload in `packages/tauri-src/src-tauri/tauri.conf.json` at `plugins.updater.pubkey`.
- Using raw `RWS...` key text fails release builds (`failed to decode pubkey`).
- Keep `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in GitHub secrets.
- Landing download CTA logic is in `apps/web/src/routes/index.tsx`; prefer direct installer links over generic releases pages.

## 9) Cursor/Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` exist currently.
- If these files are added later, treat them as authoritative and update this file.

## 10) Agent Completion Checklist
- Run relevant build/typecheck/test commands for touched areas.
- Prefer single-test runs first, then broader suites as needed.
- Confirm branch/release assumptions (`dev` vs `main`) before workflow edits.
- Call out release-impacting changes in PR descriptions.
