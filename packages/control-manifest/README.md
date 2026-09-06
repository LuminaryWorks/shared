# @luminaryworks/control-manifest

Static **Control Manifest** for federated LuminaryWorks deployments: JSON Schema, TypeScript types, parser, environment overlay and startup preflight validation.

The manifest answers one question — *what does this deployment look like?* — and nothing else:

- which deployment `profile` and honesty `stage` is being run;
- which optional central services exist, their base URL, whether they are `required`, and which `apiVersion` / `schemaVersion` they speak;
- which capability mode each shared concern uses (`identity`, `entitlement`, `ai`, `notification`);
- how each capability **degrades** when an optional central service is down.

It deliberately does **not** contain secrets, business resources, tenant data or dynamic service registration. Every product keeps its own database, migrations, Casbin policy and release cadence. See `spec/composable-deployment.md` in the LuminaryWorks MetaRepo for the normative architecture.

## Install

```bash
pnpm add @luminaryworks/control-manifest
```

## Usage

```ts
import { readFileSync } from "node:fs";
import { loadControlManifest, ControlManifestError } from "@luminaryworks/control-manifest";

try {
  const { manifest, warnings, appliedEnvKeys } = loadControlManifest(
    readFileSync(process.env.LW_CONTROL_MANIFEST ?? "./control-manifest.json", "utf8"),
  );

  for (const warning of warnings) console.warn(`[control-manifest] ${warning.path}: ${warning.message}`);
  if (appliedEnvKeys.length) console.log(`[control-manifest] env overlay: ${appliedEnvKeys.join(", ")}`);

  if (manifest.capabilities.entitlement === "enforce") {
    // central Entitlement is authoritative; never fail open
  }
} catch (err) {
  if (err instanceof ControlManifestError) process.exit(78); // EX_CONFIG
  throw err;
}
```

`loadControlManifest` throws instead of guessing: a plane that cannot describe its own topology must not start.

For CI reports that want every problem at once, use `inspectControlManifest` (never throws) or `preflightControlManifest` (adds the required/optional service split).

## Manifest example

```json
{
  "manifestVersion": 1,
  "profile": "control-plane",
  "stage": "dev",
  "capabilities": {
    "identity": "central",
    "entitlement": "shadow_read",
    "ai": "off",
    "notification": "none"
  },
  "services": {
    "identity": { "url": "http://identity:3001/oidc", "required": true, "apiVersion": "v1", "schemaVersion": "1" },
    "authGateway": { "url": "http://auth-gateway:3010", "required": false, "apiVersion": "v1", "schemaVersion": "1" },
    "entitlement": { "url": "http://entitlement:3040", "required": false, "apiVersion": "v1", "schemaVersion": "1" }
  },
  "degradation": { "identity": "fail_closed", "entitlement": "fail_closed" }
}
```

## Capability modes

| Capability | Modes | Notes |
|---|---|---|
| `identity` | `central` \| `external_oidc` \| `local` | `local` is lab-only; rejected for `pilot`/`production` unless the profile is `air-gapped`. |
| `entitlement` | `off` \| `shadow_read` \| `enforce` \| `offline_license` | `enforce` requires `services.entitlement.required = true`; `offline_license` must not hard-depend on the central service. |
| `ai` | `off` \| `central` \| `local_byok` | `central` is **rejected** for `pilot`/`production` — see the AI gate below. |
| `notification` | `none` \| `smtp` | SMTP credentials come from env or a secret store, never from the manifest. |

## Degradation matrix

| Capability | Allowed degradation | Default |
|---|---|---|
| `identity` | `fail_closed` **only** | `fail_closed` |
| `entitlement` | `fail_closed`, `fail_open_local`, `offline_license` | `fail_closed` (`offline_license` when the mode is `offline_license`) |
| `ai` | `fail_closed`, `disable_feature`, `fallback_local_byok` | `disable_feature` (`fallback_local_byok` when the mode is `local_byok`) |
| `notification` | `fail_closed`, `queue`, `drop` | `queue` |

AuthN never degrades to anonymous access. `degradation.identity` is pinned to `fail_closed` in the schema, in the validator and in the env overlay (`LW_IDENTITY_DEGRADATION=fail_open_local` is rejected, not ignored).

`entitlement=enforce` combined with `fail_open_local` is a warning in `dev`/`lab` and an **error** in `pilot`/`production`: it would hand out paid features for free during an outage.

## AI `central` gate

`ai=central` is honestly labelled `lab`. `describeAiCentralGate()` reports the outstanding hardening work (AuthN, Entitlement enforcement, persistent metering, secret vault, real readiness). Until every gate flips to `true` in `src/constants.ts`, preflight refuses `ai=central` for `pilot` and `production` and only allows `off` or `local_byok`.

Flip a gate in the same change that lands the capability — not before.

## Environment overlay

The committed manifest owns the **topology**; env only retargets what it already declares.

| Env | Effect | Legacy alias |
|---|---|---|
| `LW_PROFILE` / `LW_STAGE` | profile / stage | — |
| `LW_IDENTITY_MODE` | `capabilities.identity` | — |
| `LW_ENTITLEMENT_MODE` | `capabilities.entitlement` | `ENTITLEMENT_MODE` |
| `LW_AI_MODE` | `capabilities.ai` | — |
| `LW_NOTIFICATION_MODE` | `capabilities.notification` | — |
| `LW_IDENTITY_URL` | `services.identity.url` | `IDP_ISSUER` |
| `LW_AUTH_GATEWAY_URL` | `services.authGateway.url` | `AUTH_GATEWAY_PUBLIC_URL` |
| `LW_ENTITLEMENT_URL` | `services.entitlement.url` | `ENTITLEMENT_BASE_URL` |
| `LW_AI_URL` | `services.ai.url` | `AI_PLATFORM_BASE_URL` |
| `LW_OBSERVABILITY_URL` | `services.observability.url` | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `LW_<SERVICE>_REQUIRED` | `services.<service>.required` | — |
| `LW_<CAPABILITY>_DEGRADATION` | `degradation.<capability>` | — |

Setting a URL for a service the manifest never declared is **ignored with a warning**: topology must stay auditable in Git, not appear from an env file. Secret-like `LW_*` keys are never consumed by the overlay.

## URL rules

- `http`/`https` only; no userinfo credentials.
- `host.docker.internal` / `gateway.docker.internal` are rejected in **every** stage — use a Compose/Kubernetes service name on a shared network.
- `pilot`/`production` reject loopback hosts, and require `https` for any externally routable hostname (internal DNS names such as `entitlement`, `*.internal`, `*.svc` may stay plaintext inside the cluster network).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm run build` | `tsc` → `dist`, then regenerate `schema/control-manifest.schema.json` |
| `pnpm run check` | type-check only |
| `pnpm run test` | Rstest suite (`src/**/*.spec.ts`) |
| `pnpm run schema:check` | fail if the committed JSON Schema drifted from `src/schema.ts` |

`src/schema.ts` is the single source of truth for the JSON Schema; the committed JSON file exists for editors and generic CI linters and is UTF-8 without BOM. Cross-field rules are enforced by `validateControlManifest`, which is the normative check.
