import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function absolutePath(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

async function updateJsonVersion(filePath, version) {
  const source = await readFile(absolutePath(filePath), "utf8");
  const parsed = JSON.parse(source);

  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    fail(`Missing version field in ${filePath}`);
  }

  parsed.version = version;
  await writeFile(absolutePath(filePath), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

async function updateCargoVersion(filePath, version) {
  const source = await readFile(absolutePath(filePath), "utf8");
  const updated = source.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);

  if (updated === source) {
    fail(`Could not locate package version in ${filePath}`);
  }

  await writeFile(absolutePath(filePath), updated, "utf8");
}

async function main() {
  const version = process.argv[2]?.trim();

  if (!version) {
    fail("Usage: bun run release:version <version>");
  }

  if (!VERSION_PATTERN.test(version)) {
    fail(`Invalid version '${version}'. Expected semantic version like 1.2.3 or 1.2.3-beta.1`);
  }

  await updateJsonVersion("package.json", version);
  await updateJsonVersion("src-tauri/tauri.conf.json", version);
  await updateCargoVersion("src-tauri/Cargo.toml", version);

  console.log(`Synchronized release version to ${version}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
