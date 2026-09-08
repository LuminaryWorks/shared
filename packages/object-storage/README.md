# `@luminaryworks/object-storage`

Server-side **MinIO-compatible** object storage for LuminaryWorks products: an `ObjectStoragePort` (`put` / `get` / `delete` / `head` / `presignUpload` / `presignDownload` / `listPrefix`), a path-style S3 adapter, scoped object keys, and injected storage-admission checks.

The package talks **S3-compatible APIs only**. It does not assume Amazon S3, Cloudflare R2, GCS, OSS, or any other public-cloud provider. Hosted SaaS uses official [AIStor Free](https://www.min.io/legal/aistor-free-agreement) standalone; private customers bring their own MinIO-compatible endpoint.

This package **never** reads host files, Docker sockets, or named volumes. Admission JSON is injected by the caller.

## Install

```bash
pnpm add @luminaryworks/object-storage
```

Node.js `>=24`. Server-side only — do not import this package into a browser bundle.

## AIStor Free endpoint (Hosted SaaS)

On the control-plane network the API is typically:

```text
http://object-storage:9000
```

Loopback publish is `127.0.0.1:9000` (API) / `127.0.0.1:9001` (Console, SSH tunnel). Products use **path-style** addressing (`forcePathStyle: true`) and that internal endpoint for `put` / `get` / `delete` / `head` / `listPrefix`.

Set `publicEndpoint` to the CDN / Caddy origin hostname when browsers need presigned PUT/GET. Signing uses `publicEndpoint`; the data plane keeps using `endpoint`.

## Per-product credentials

Each product receives **one least-privilege access key for its bucket**. Never copy `AISTOR_ROOT_USER` / `AISTOR_ROOT_PASSWORD` into a product env file. Never send list APIs, prefix-delete, or root credentials to a browser.

| Product | Typical bucket | Access key env (Hosted) |
|---|---|---|
| DataLuminary | `dataluminary-media` | `AISTOR_DATALUMINARY_ACCESS_KEY` |
| BlockyEdu | `blockyedu-media` | `AISTOR_BLOCKYEDU_ACCESS_KEY` |
| VistaRemote | `vistaremote-recordings` | `AISTOR_VISTAREMOTE_ACCESS_KEY` |
| VistaCast | `vistacast-recordings` | `AISTOR_VISTACAST_ACCESS_KEY` |
| Platform | `luminary-media` | `AISTOR_LUMINARY_ACCESS_KEY` |

DoerFlow and SyncroBrain have no bucket in the current Hosted layout.

## CDN limitations

- CDN **only** cuts origin bandwidth and latency. It **does not** reduce cold-disk usage (D-STOR-3). Trial watermarks still apply.
- Presigned URLs carry SigV4 query parameters. The proxy must forward the query string; it must not long-cache private objects as public.
- Default buckets are **private**. Do not set public ACLs. Do not expose directory listing.
- Thumbnails may be published only when an operator explicitly opts a prefix in.

## Trial purge

The AIStor bootstrap ILM rule expires the **root** prefix `trial/`. Every trial object therefore starts with that marker so lifecycle and product purge see the same keys:

```text
trial/{product}/{ownerKind}/{ownerId}/{trialRedemptionId}/{relative}
```

Paid keys are disjoint under `obj/` (they are not expired by the `trial/` rule):

```text
obj/{product}/{ownerKind}/{ownerId}/{relative}
```

`trial.purge` must call `deletePrefix(trialObjectPrefix({ productCode, billingOwner, trialRedemptionId }))`. That prefix is the only accepted purge root — exact (`tr_1/` does not match `tr_10/`), product- and owner-scoped. `deletePrefix` rejects `trial/` alone, a product-wide `trial/{product}/`, an owner-wide trial prefix, and any `obj/` key. Deletes are idempotent. Batches default to 100 (max 1000) and honor `AbortSignal`.

## Storage admission (70 / 80 / 90)

Callers inject the current status from the host `object-storage-status.mjs` JSON (same schema as `deploy/object-storage/admission-contract.json`):

| Watermark | Trial recording | Trial object write | Paid write | Delete |
|---|---|---|---|---|
| ok | allow | allow | allow | allow |
| 70% | **deny** | allow | allow | allow |
| 80% | deny | **deny** | allow | allow |
| 90% | deny | deny | **deny** | allow |

Deletes and trial purge are **always** allowed, even if a caller sets `admit.objectDelete = false`.

## Example

```ts
import {
  MinioObjectStorage,
  buildObjectKey,
  trialObjectPrefix,
  evaluateStorageAdmission,
} from "@luminaryworks/object-storage";

const storage = new MinioObjectStorage({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT!, // http://object-storage:9000
  publicEndpoint: process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT, // https://media.example.com
  bucket: "vistaremote-recordings",
  productCode: "vistaremote",
  accessKeyId: process.env.AISTOR_VISTAREMOTE_ACCESS_KEY!,
  secretAccessKey: process.env.AISTOR_VISTAREMOTE_SECRET_KEY!,
  forcePathStyle: true,
  maxPresignTtlSeconds: 900,
});

const key = buildObjectKey({
  productCode: "vistaremote",
  billingOwner: { kind: "organization", id: orgId },
  trialRedemptionId,
  path: ["recordings", `${sessionId}.webm`],
});

// Host injects used-bytes JSON; this package does not exec docker or df.
const admission = evaluateStorageAdmission(usedBytes);

await storage.put({
  key: key.key,
  body,
  contentType: "video/webm",
  contentLength: body.byteLength,
  checksum: { algorithm: "SHA256", value: checksumSha256Base64 },
  admission,
  intent: "trialRecording",
});

const upload = await storage.presignUpload({
  key: key.key,
  contentType: "video/webm",
  expiresInSeconds: 300,
  admission,
  intent: "trialRecording",
});
// Browser: HTTP PUT upload.url with upload.headers. Do not list from the browser.

await storage.deletePrefix(
  trialObjectPrefix({
    productCode: "vistaremote",
    billingOwner: { kind: "organization", id: orgId },
    trialRedemptionId,
  }),
  { signal: abortController.signal },
);

console.info("object-storage", storage.redactConfig()); // secrets stripped
```

Presigned PUT/GET TTL is clamped to a configurable max (default 15 minutes, hard max 1 hour). Requesting more throws `PRESIGN_TTL_EXCEEDED`.

## Private deployment (customer-owned endpoint)

Private / air-gapped customers **must not** receive AIStor binaries or `minio.license` inside a product pack. They either:

1. download and accept [AIStor Free](https://www.min.io/legal/aistor-free-agreement) themselves, or
2. point this client at **their** MinIO-compatible endpoint:

```ts
new MinioObjectStorage({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT!, // customer URL
  publicEndpoint: process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT,
  bucket: process.env.OBJECT_STORAGE_BUCKET!,
  productCode: "vistaremote",
  accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY!,
  secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY!,
  forcePathStyle: true,
});
```

Application code stays on `ObjectStoragePort`. Migrating Hosted SaaS to a dedicated node is an endpoint (and key) change, not an API change.

## Logging

Use `redactObjectStorageConfig` / `storage.redactConfig()` before logs. Raw `secretAccessKey` / `sessionToken` never belong in errors.
