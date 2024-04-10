# `@luminaryworks/entitlement-client`

NestJS client for the central Entitlement service.

## Modes (`ENTITLEMENT_MODE`)

| Mode | Behavior |
|------|----------|
| `off` | Do not call central; local decision path (rollback) |
| `shadow_read` | Dual-read: local decision still wins; log diffs |
| `enforce` | Central result is authoritative; fail closed on uncertainty |

## Usage

```ts
import { EntitlementClientModule, EntitlementClient } from "@luminaryworks/entitlement-client";

EntitlementClientModule.forRoot({
  baseUrl: process.env.ENTITLEMENT_BASE_URL!,
  mode: (process.env.ENTITLEMENT_MODE as "off" | "shadow_read" | "enforce") ?? "off",
  serviceApiKey: process.env.ENTITLEMENT_SERVICE_API_KEY,
  cacheTtlMs: 60_000,
  // Private deployment: public keys only
  licensePublicKeys: process.env.ENTITLEMENT_LICENSE_PUBLIC_KEYS
    ? JSON.parse(process.env.ENTITLEMENT_LICENSE_PUBLIC_KEYS)
    : undefined,
});
```

Guard order in products:

```text
LuminaryJwtAuthGuard → EntitlementGuard(feature) → PermissionGuard(Casbin)
```

### Local License verify

```ts
const result = await client.verifyLicenseLocal(signedLicense, {
  productCode: "dataluminary",
  featureCode: "dashboard.export",
  allowGrace: true, // false on first install with no prior successful cache
});
// result.casbinBypass === false — always; License is commercial entitlement only
```

Commercial rights are never read from JWT. Partner redemption and trial notify are server-side; products consume `/v1/entitlements` and local License verify for offline private deployments.

## Module format (Nest backends)

Source TypeScript uses **ES `import` / `export`**. The published `dist/` is compiled to **CommonJS** (`require` / `module.exports`) because NestJS product backends still load this package via CommonJS.

```text
src/*.ts   →  import / export
dist/*.js  →  require / module.exports   (intentional for Nest)
```

Do not assume “Node 24 = must be ESM-only”. Node 24 supports both; Nest 10/11 + typical `nest start` remain CJS-first. A dual ESM+CJS publish can be added later without dropping CJS.

After shared package changes, consumers using `file:` deps must refresh:

```bash
# from LuminaryWorks MetaRepo
pnpm ent:client:sync
```

This rebuilds `dist/` (including `trial.js`) and forces pnpm to replace stale content-addressable copies. Otherwise `index.js` may `require('./trial')` while `trial.js` is missing in `node_modules`.
