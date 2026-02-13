# openusage-mono

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Convex** - Reactive backend-as-a-service platform
- **Tauri** - Build native desktop applications
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Copy environment variables from `packages/backend/.env.local` to `apps/*/.env`.

For release-link behavior in the website, you can start from `apps/web/.env.example`.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.

## Project Structure

```
openusage-mono/
├── apps/
│   ├── web/         # Marketing website (TanStack Router)
├── packages/
│   ├── backend/     # Convex backend functions and schema
│   ├── tauri-src/   # OpenUsage Tauri app source (macOS + Windows fork)
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:tauri-src`: Start only the Tauri app web UI
- `bun run build:tauri-src`: Build only the Tauri app web UI
- `bun run check-types:tauri-src`: Typecheck only the Tauri app package
- `bun run dev:setup`: Setup and configure your Convex project
- `bun run check-types`: Check TypeScript types across all apps
- `cd packages/tauri-src && bun run desktop:dev`: Start Tauri desktop app in development
- `cd packages/tauri-src && bun run desktop:build`: Build Tauri desktop app
- `bun run release:version <version>`: Sync release version across Tauri and package manifests

## Release Flow

See `docs/release-flow.md` for the end-to-end branch, release, and deployment process.

See `docs/tauri-src-package.md` for package-level Tauri app operations inside this monorepo.
