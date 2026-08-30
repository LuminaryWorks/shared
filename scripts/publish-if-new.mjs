/**
 * Publish @luminaryworks/* to npmjs only when the local version is not on the registry.
 * Uses npm CLI OIDC (GitHub Actions trusted publishing). Do NOT set NODE_AUTH_TOKEN.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES = [
  "packages/ai-client",
  "packages/ai-react",
  "packages/auth-core",
  "packages/auth-react",
  "packages/auth-dev-proxy",
  "packages/pal",
  "packages/notification",
  "packages/entitlement-client",
];

function npmViewVersion(name) {
  const r = spawnSync(
    "npm",
    ["view", name, "version", "--registry", "https://registry.npmjs.org"],
    { encoding: "utf8", shell: true },
  );
  if (r.status !== 0) return null;
  const v = (r.stdout || "").trim();
  return v || null;
}

function publishDir(pkgDir) {
  const env = { ...process.env };
  // Empty NODE_AUTH_TOKEN still disables OIDC; the key must be absent.
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.npm_config__authToken;
  const r = spawnSync("npm", ["publish", "--access", "public"], {
    cwd: pkgDir,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
    env,
  });
  return r.status === 0;
}

let failed = 0;
let published = 0;
let skipped = 0;

for (const rel of PACKAGES) {
  const pkgDir = path.join(root, rel);
  const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const name = pj.name;
  const version = pj.version;
  const remote = npmViewVersion(name);
  if (remote === version) {
    console.log(`skip ${name}@${version} (already on npmjs)`);
    skipped += 1;
    continue;
  }
  console.log(`publish ${name}@${version} (npmjs latest: ${remote ?? "none"})`);
  if (publishDir(pkgDir)) {
    published += 1;
  } else {
    console.error(`failed ${name}@${version}`);
    failed += 1;
  }
}

console.log(`done: published=${published} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
