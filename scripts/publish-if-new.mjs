/**
 * Publish @luminaryworks/* to npmjs (GitHub Actions OIDC Trusted Publishing).
 *
 * - Do NOT set NODE_AUTH_TOKEN / NPM_TOKEN (that disables OIDC).
 * - Auto-bumps patch (or PUBLISH_BUMP) when a package dir has changes since
 *   the last package.json version commit, or when local version already
 *   differs from npmjs.
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

const BUMP_KIND = process.env.PUBLISH_BUMP || "patch";
const AUTO_BUMP = process.env.PUBLISH_AUTO_BUMP !== "0";
const FORCE_ALL = process.env.PUBLISH_FORCE_ALL === "1";

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: false,
    ...opts,
  });
}

function npmBin() {
  return process.env.NPM_BIN || "npm";
}

function git(args) {
  return run("git", args, { cwd: root });
}

function npmViewVersion(name) {
  const r = run(npmBin(), [
    "view",
    name,
    "version",
    "--registry",
    "https://registry.npmjs.org",
  ]);
  if (r.status !== 0) return null;
  const v = (r.stdout || "").trim();
  return v || null;
}

function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function cmpSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function inc(version, kind) {
  const p = parseSemver(version);
  if (!p) throw new Error(`cannot bump non-semver ${version}`);
  if (kind === "major") return `${p.major + 1}.0.0`;
  if (kind === "minor") return `${p.major}.${p.minor + 1}.0`;
  return `${p.major}.${p.minor}.${p.patch + 1}`;
}

function setPackageVersion(pkgPath, version) {
  const t = fs.readFileSync(pkgPath, "utf8");
  const next = t.replace(/("version"\s*:\s*")([^"]+)(")/, `$1${version}$3`);
  if (next === t) throw new Error(`failed to set version in ${pkgPath}`);
  fs.writeFileSync(pkgPath, next);
}

function hasUnpublishedSource(rel) {
  const log = git(["log", "-1", "--format=%H", "--", `${rel}/package.json`]);
  const sha = (log.stdout || "").trim();
  if (!sha) return true;
  const diff = git(["diff", "--name-only", `${sha}..HEAD`, "--", rel]);
  return Boolean((diff.stdout || "").trim());
}

function publishDir(pkgDir) {
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.npm_config__authToken;
  const r = run(npmBin(), ["publish", "--access", "public"], {
    cwd: pkgDir,
    stdio: "inherit",
    env,
  });
  return r.status === 0;
}

function oidcHint(name) {
  return [
    `OIDC publish failed for ${name}.`,
    `The package existing on npmjs is not enough — each package needs Trusted Publisher:`,
    `  https://www.npmjs.com/package/${name}`,
    `  Settings → Trusted Publisher → GitHub Actions`,
    `    Organization or user: LuminaryWorks`,
    `    Repository: shared`,
    `    Workflow filename: publish-packages.yml`,
    `    Environment: (leave empty)`,
    `    Allowed actions: npm publish`,
    `Or after npm login (web 2FA, not a bypass-2FA token):`,
    `  npm trust github ${name} --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y`,
  ].join("\n");
}

console.log(`npm bin: ${npmBin()}`);
console.log(`npm version: ${(run(npmBin(), ["--version"]).stdout || "").trim()}`);
console.log(`GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS || ""}`);
console.log(`OIDC request URL set: ${process.env.ACTIONS_ID_TOKEN_REQUEST_URL ? "yes" : "no"}`);
console.log(`auto-bump=${AUTO_BUMP} bump=${BUMP_KIND} force-all=${FORCE_ALL}`);

let failed = 0;
let published = 0;
let skipped = 0;
const bumped = [];

for (const rel of PACKAGES) {
  const pkgDir = path.join(root, rel);
  const pkgPath = path.join(pkgDir, "package.json");
  const pj = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const name = pj.name;
  let version = pj.version;
  const remote = npmViewVersion(name);

  if (remote === version) {
    const shouldBump = AUTO_BUMP && (FORCE_ALL || hasUnpublishedSource(rel));
    if (!shouldBump) {
      console.log(`skip ${name}@${version} (already on npmjs)`);
      skipped += 1;
      continue;
    }
    version = inc(remote || version, BUMP_KIND);
    setPackageVersion(pkgPath, version);
    bumped.push(`${name}@${version}`);
    console.log(`bump ${name} ${pj.version} → ${version}`);
  } else if (remote && cmpSemver(version, remote) < 0) {
    version = inc(remote, BUMP_KIND);
    setPackageVersion(pkgPath, version);
    bumped.push(`${name}@${version}`);
    console.log(`bump ${name} ${pj.version} → ${version} (behind npmjs ${remote})`);
  }

  console.log(`publish ${name}@${version} (npmjs latest: ${remote ?? "none"})`);
  if (publishDir(pkgDir)) {
    published += 1;
  } else {
    console.error(`failed ${name}@${version}`);
    console.error(oidcHint(name));
    failed += 1;
  }
}

if (bumped.length > 0) {
  console.log(`bumped: ${bumped.join(", ")}`);
}
console.log(`done: published=${published} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
