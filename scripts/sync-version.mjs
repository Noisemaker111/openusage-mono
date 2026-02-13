import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function toAbsolutePath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

async function updateJsonVersion(relativePath, version) {
  const absolutePath = toAbsolutePath(relativePath);
  const source = await readFile(absolutePath, "utf8");
  const data = JSON.parse(source);

  if (typeof data !== "object" || data === null || !("version" in data)) {
    fail(`Missing version field in ${relativePath}`);
  }

  data.version = version;
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function updateCargoVersion(relativePath, version) {
  const absolutePath = toAbsolutePath(relativePath);
  const source = await readFile(absolutePath, "utf8");
  const updated = source.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);

  if (updated === source) {
    fail(`Could not locate package version in ${relativePath}`);
  }

  await writeFile(absolutePath, updated, "utf8");
}

async function main() {
  const version = process.argv[2]?.trim();

  if (!version) {
    fail("Usage: bun run release:version <version>");
  }

  if (!VERSION_PATTERN.test(version)) {
    fail(`Invalid version '${version}'. Expected semantic version like 1.2.3 or 1.2.3-beta.1`);
  }

  await updateJsonVersion("packages/tauri-src/package.json", version);
  await updateJsonVersion("packages/tauri-src/src-tauri/tauri.conf.json", version);
  await updateCargoVersion("packages/tauri-src/src-tauri/Cargo.toml", version);

  console.log(`Synchronized release version to ${version}`);
  console.log("Updated files:");
  console.log("- packages/tauri-src/package.json");
  console.log("- packages/tauri-src/src-tauri/tauri.conf.json");
  console.log("- packages/tauri-src/src-tauri/Cargo.toml");
  console.log(`Next: commit these changes and create tag v${version}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
