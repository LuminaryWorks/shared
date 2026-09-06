#!/usr/bin/env node
/**
 * Emits `schema/control-manifest.schema.json` from the compiled schema module.
 *
 * The TypeScript module is the single source of truth; the JSON file exists for
 * editors and generic CI linters. Run with `--check` in CI to fail on drift.
 * Output is UTF-8 without BOM and ends with a newline.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const require = createRequire(import.meta.url);

const { controlManifestJsonSchema } = require(join(packageRoot, "dist", "schema.js"));
const target = join(packageRoot, "schema", "control-manifest.schema.json");
const serialized = `${JSON.stringify(controlManifestJsonSchema, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    console.error(`[control-manifest] missing ${target}; run "pnpm run build".`);
    process.exit(1);
  }
  if (current !== serialized) {
    console.error(
      `[control-manifest] ${target} is out of date with src/schema.ts; run "pnpm run build".`,
    );
    process.exit(1);
  }
  console.log("[control-manifest] JSON Schema is in sync.");
  process.exit(0);
}

mkdirSync(join(packageRoot, "schema"), { recursive: true });
writeFileSync(target, serialized, { encoding: "utf8" });
console.log(`[control-manifest] wrote ${target}`);
