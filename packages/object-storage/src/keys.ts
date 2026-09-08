/**
 * Object key builder and ownership metadata.
 *
 * Canonical keys put the lifecycle marker first so AIStor `mc ilm` on root
 * prefix `trial/` expires every trial object. Paid keys start with `obj/` and
 * are disjoint. Product, billing owner, and trialRedemptionId stay exact:
 * `trial/{product}/{ownerKind}/{ownerId}/{trialRedemptionId}/` is the only
 * purge prefix (`tr_1/` never matches `tr_10/`).
 */

import { ObjectStorageError } from "./errors";

const CONTROL_CHARS_MAX = 0x1f;
const DELETE_CHAR = 0x7f;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= CONTROL_CHARS_MAX || code === DELETE_CHAR) return true;
  }
  return false;
}
const PRODUCT_CODE_RE = /^[a-z][a-z0-9-]{0,62}$/;
const OWNER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENCODED_DOT_SEGMENT = /^(?:%2e|%2E|\.)+$/;

export const PAID_KEY_MARKER = "obj";
export const TRIAL_KEY_MARKER = "trial";
/** Root prefix the AIStor bootstrap ILM rule matches. All trial keys start here. */
export const TRIAL_LIFECYCLE_PREFIX = `${TRIAL_KEY_MARKER}/`;

export const OWNERSHIP_METADATA_KEYS = {
  productCode: "lw-product-code",
  billingOwnerKind: "lw-billing-owner-kind",
  billingOwnerId: "lw-billing-owner-id",
  trialRedemptionId: "lw-trial-redemption-id",
  contentChecksum: "lw-content-checksum",
} as const;

export type BillingOwnerKind = "user" | "organization";

export interface BillingOwner {
  kind: BillingOwnerKind;
  id: string;
}

export interface ObjectKeyInput {
  productCode: string;
  /** When set, must match the adapter bucket; never embedded in the object key. */
  bucket?: string;
  billingOwner: BillingOwner;
  /** When set, the key is a trial object under an exact purge prefix. */
  trialRedemptionId?: string;
  /** Relative path segments, or a `/`-separated relative path. */
  path: string | readonly string[];
}

export interface ObjectOwnershipMetadata {
  [OWNERSHIP_METADATA_KEYS.productCode]: string;
  [OWNERSHIP_METADATA_KEYS.billingOwnerKind]: BillingOwnerKind;
  [OWNERSHIP_METADATA_KEYS.trialRedemptionId]?: string;
  [OWNERSHIP_METADATA_KEYS.billingOwnerId]: string;
  [OWNERSHIP_METADATA_KEYS.contentChecksum]?: string;
}

export interface BuiltObjectKey {
  key: string;
  productCode: string;
  billingOwner: BillingOwner;
  trialRedemptionId?: string;
  relativePath: string;
  /** Exact prefix (trailing slash) for trial purge. Absent for paid keys. */
  trialPrefix?: string;
  ownerPrefix: string;
  metadata: ObjectOwnershipMetadata;
}

function rejectKey(message: string, details?: Record<string, unknown>): never {
  throw new ObjectStorageError("INVALID_OBJECT_KEY", message, { details });
}

function assertNoControlChars(value: string, label: string): void {
  if (hasControlChars(value)) {
    rejectKey(`${label} must not contain control characters`);
  }
}

export function assertSafeSegment(segment: string, label: string): string {
  if (typeof segment !== "string") {
    rejectKey(`${label} must be a string`);
  }
  if (segment.length === 0) {
    rejectKey(`${label} must not be empty`);
  }
  assertNoControlChars(segment, label);
  if (segment.includes("/") || segment.includes("\\")) {
    rejectKey(`${label} must not contain path separators`);
  }
  if (segment === "." || segment === ".." || ENCODED_DOT_SEGMENT.test(segment)) {
    rejectKey(`${label} must not be '.' or '..'`);
  }
  if (segment.includes("..")) {
    rejectKey(`${label} must not contain '..'`);
  }
  return segment;
}

export function normalizeProductCode(productCode: string): string {
  const value = String(productCode ?? "").trim();
  if (!PRODUCT_CODE_RE.test(value)) {
    rejectKey("productCode must be a lowercase kebab-case identifier");
  }
  return value;
}

export function normalizeOwnerKind(kind: string): BillingOwnerKind {
  const raw = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (raw === "user") return "user";
  if (raw === "organization" || raw === "org") return "organization";
  rejectKey("billingOwner.kind must be 'user' or 'organization'");
}

export function normalizeOwnerId(id: string): string {
  const value = String(id ?? "").trim();
  if (!OWNER_ID_RE.test(value) || value.includes("..")) {
    rejectKey("billingOwner.id contains unsupported characters");
  }
  return assertSafeSegment(value, "billingOwner.id");
}

export function normalizeTrialRedemptionId(id: string): string {
  const value = String(id ?? "").trim();
  if (!OWNER_ID_RE.test(value) || value.includes("..")) {
    rejectKey("trialRedemptionId contains unsupported characters");
  }
  return assertSafeSegment(value, "trialRedemptionId");
}

function rejectAbsolutePath(path: string): void {
  if (path.startsWith("/") || path.startsWith("\\")) {
    rejectKey("object path must be relative (absolute paths are rejected)");
  }
  if (/^[a-zA-Z]:/.test(path)) {
    rejectKey("object path must not include a drive letter");
  }
  if (path.includes("://")) {
    rejectKey("object path must not include a URI scheme");
  }
}

export function splitRelativePath(path: string | readonly string[]): string[] {
  if (Array.isArray(path)) {
    if (path.length === 0) rejectKey("object path must include at least one segment");
    return path.map((segment, index) => assertSafeSegment(String(segment), `path[${index}]`));
  }
  if (typeof path !== "string") {
    rejectKey("object path must be a string or string array");
  }
  assertNoControlChars(path, "object path");
  rejectAbsolutePath(path);
  if (path.includes("\\")) {
    rejectKey("object path must not contain backslashes");
  }
  if (path.includes("..")) {
    rejectKey("object path must not contain '..'");
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    rejectKey("object path must not contain empty segments");
  }
  return segments.map((segment, index) => assertSafeSegment(segment, `path[${index}]`));
}

export function ownerObjectPrefix(input: {
  productCode: string;
  billingOwner: BillingOwner;
  /** When true, prefix is under `trial/`; otherwise under `obj/`. */
  trial?: boolean;
}): string {
  const productCode = normalizeProductCode(input.productCode);
  const kind = normalizeOwnerKind(input.billingOwner.kind);
  const id = normalizeOwnerId(input.billingOwner.id);
  const marker = input.trial ? TRIAL_KEY_MARKER : PAID_KEY_MARKER;
  return `${marker}/${productCode}/${kind}/${id}/`;
}

export function trialObjectPrefix(input: {
  productCode: string;
  billingOwner: BillingOwner;
  trialRedemptionId: string;
}): string {
  const owner = ownerObjectPrefix({ ...input, trial: true });
  const trialRedemptionId = normalizeTrialRedemptionId(input.trialRedemptionId);
  return `${owner}${trialRedemptionId}/`;
}

export function isKeyUnderPrefix(key: string, prefix: string): boolean {
  if (!prefix.endsWith("/")) return false;
  return key.startsWith(prefix);
}

export function buildOwnershipMetadata(
  input: Pick<BuiltObjectKey, "productCode" | "billingOwner" | "trialRedemptionId">,
  extra?: { contentChecksum?: string },
): ObjectOwnershipMetadata {
  const metadata: ObjectOwnershipMetadata = {
    [OWNERSHIP_METADATA_KEYS.productCode]: input.productCode,
    [OWNERSHIP_METADATA_KEYS.billingOwnerKind]: input.billingOwner.kind,
    [OWNERSHIP_METADATA_KEYS.billingOwnerId]: input.billingOwner.id,
  };
  if (input.trialRedemptionId) {
    metadata[OWNERSHIP_METADATA_KEYS.trialRedemptionId] = input.trialRedemptionId;
  }
  if (extra?.contentChecksum) {
    metadata[OWNERSHIP_METADATA_KEYS.contentChecksum] = extra.contentChecksum;
  }
  return metadata;
}

export function buildObjectKey(input: ObjectKeyInput): BuiltObjectKey {
  const productCode = normalizeProductCode(input.productCode);
  const billingOwner: BillingOwner = {
    kind: normalizeOwnerKind(input.billingOwner.kind),
    id: normalizeOwnerId(input.billingOwner.id),
  };
  const relativeSegments = splitRelativePath(input.path);
  const relativePath = relativeSegments.join("/");

  const trialRedemptionId = input.trialRedemptionId
    ? normalizeTrialRedemptionId(input.trialRedemptionId)
    : undefined;

  if (relativeSegments[0] === TRIAL_KEY_MARKER || relativeSegments[0] === PAID_KEY_MARKER) {
    rejectKey(`object path must not start with reserved segment '${relativeSegments[0]}'`);
  }

  const ownerPrefix = ownerObjectPrefix({
    productCode,
    billingOwner,
    trial: Boolean(trialRedemptionId),
  });

  const key = trialRedemptionId
    ? `${ownerPrefix}${trialRedemptionId}/${relativePath}`
    : `${ownerPrefix}${relativePath}`;

  const trialPrefix = trialRedemptionId
    ? trialObjectPrefix({ productCode, billingOwner, trialRedemptionId })
    : undefined;

  return {
    key,
    productCode,
    billingOwner,
    trialRedemptionId,
    relativePath,
    trialPrefix,
    ownerPrefix,
    metadata: buildOwnershipMetadata({ productCode, billingOwner, trialRedemptionId }),
  };
}

export function parseObjectKey(key: string): BuiltObjectKey {
  if (typeof key !== "string" || key.length === 0) {
    rejectKey("object key must be a non-empty string");
  }
  assertNoControlChars(key, "object key");
  rejectAbsolutePath(key);
  if (key.includes("\\") || key.includes("..")) {
    rejectKey("object key must not contain backslashes or '..'");
  }
  if (key.startsWith("/") || key.endsWith("/")) {
    rejectKey("object key must not be absolute or a directory prefix");
  }
  const segments = key.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    rejectKey("object key must not contain empty segments");
  }
  for (let i = 0; i < segments.length; i += 1) {
    assertSafeSegment(segments[i]!, `key[${i}]`);
  }
  const marker = segments[0]!;
  let productCode: string;
  let billingOwner: BillingOwner;
  let trialRedemptionId: string | undefined;
  let relativeSegments: string[];

  if (marker === TRIAL_KEY_MARKER) {
    if (segments.length < 6) {
      rejectKey(
        "trial object key must be 'trial/{product}/{ownerKind}/{ownerId}/{trialRedemptionId}/{path}'",
      );
    }
    productCode = normalizeProductCode(segments[1]!);
    billingOwner = {
      kind: normalizeOwnerKind(segments[2]!),
      id: normalizeOwnerId(segments[3]!),
    };
    trialRedemptionId = normalizeTrialRedemptionId(segments[4]!);
    relativeSegments = segments.slice(5);
  } else if (marker === PAID_KEY_MARKER) {
    if (segments.length < 5) {
      rejectKey("paid object key must be 'obj/{product}/{ownerKind}/{ownerId}/{path}'");
    }
    productCode = normalizeProductCode(segments[1]!);
    billingOwner = {
      kind: normalizeOwnerKind(segments[2]!),
      id: normalizeOwnerId(segments[3]!),
    };
    relativeSegments = segments.slice(4);
  } else {
    rejectKey("object key must start with 'trial/' or 'obj/'");
  }

  const relativePath = relativeSegments.join("/");
  const ownerPrefix = ownerObjectPrefix({
    productCode,
    billingOwner,
    trial: Boolean(trialRedemptionId),
  });
  const rebuilt = trialRedemptionId
    ? `${ownerPrefix}${trialRedemptionId}/${relativePath}`
    : `${ownerPrefix}${relativePath}`;
  if (rebuilt !== key) {
    rejectKey("object key failed canonical rebuild");
  }

  const trialPrefix = trialRedemptionId
    ? trialObjectPrefix({ productCode, billingOwner, trialRedemptionId })
    : undefined;

  return {
    key,
    productCode,
    billingOwner,
    trialRedemptionId,
    relativePath,
    trialPrefix,
    ownerPrefix,
    metadata: buildOwnershipMetadata({ productCode, billingOwner, trialRedemptionId }),
  };
}

export function assertKeyProductScope(key: string, productCode: string): BuiltObjectKey {
  const parsed = parseObjectKey(key);
  const expected = normalizeProductCode(productCode);
  if (parsed.productCode !== expected) {
    rejectKey("object key is outside this product scope", {
      productCode: expected,
    });
  }
  return parsed;
}

export function assertTrialPurgePrefix(prefix: string, productCode: string): string {
  if (typeof prefix !== "string" || !prefix.endsWith("/")) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "trial purge prefix must be a directory prefix ending with '/'",
    );
  }
  assertNoControlChars(prefix, "purge prefix");
  rejectAbsolutePath(prefix);
  if (prefix.includes("\\") || prefix.includes("..")) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "trial purge prefix must not contain backslashes or '..'",
    );
  }
  const withoutSlash = prefix.slice(0, -1);
  const segments = withoutSlash.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "trial purge prefix must not contain empty segments",
    );
  }
  if (segments.length !== 5 || segments[0] !== TRIAL_KEY_MARKER) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "trial purge prefix must be 'trial/{product}/{ownerKind}/{ownerId}/{trialRedemptionId}/'",
    );
  }
  const canonical = trialObjectPrefix({
    productCode: segments[1]!,
    billingOwner: { kind: segments[2] as BillingOwnerKind, id: segments[3]! },
    trialRedemptionId: segments[4]!,
  });
  if (canonical !== prefix) {
    throw new ObjectStorageError("PREFIX_NOT_ALLOWED", "trial purge prefix is not canonical");
  }
  if (normalizeProductCode(segments[1]!) !== normalizeProductCode(productCode)) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "trial purge prefix is outside this product scope",
    );
  }
  return canonical;
}

export function assertListPrefix(prefix: string, productCode: string): string {
  if (typeof prefix !== "string" || prefix.length === 0 || !prefix.endsWith("/")) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "list prefix must be a non-empty directory prefix ending with '/'",
    );
  }
  assertNoControlChars(prefix, "list prefix");
  rejectAbsolutePath(prefix);
  if (prefix.includes("\\") || prefix.includes("..")) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "list prefix must not contain backslashes or '..'",
    );
  }
  const segments = prefix.slice(0, -1).split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "list prefix must not contain empty segments",
    );
  }
  const marker = segments[0];
  if (marker !== TRIAL_KEY_MARKER && marker !== PAID_KEY_MARKER) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "list prefix must start with 'trial/' or 'obj/'",
    );
  }
  if (segments.length < 4) {
    throw new ObjectStorageError(
      "PREFIX_NOT_ALLOWED",
      "list prefix must be at least '{trial|obj}/{product}/{ownerKind}/{ownerId}/'",
    );
  }
  for (let i = 0; i < segments.length; i += 1) {
    assertSafeSegment(segments[i]!, `prefix[${i}]`);
  }
  if (normalizeProductCode(segments[1]!) !== normalizeProductCode(productCode)) {
    throw new ObjectStorageError("PREFIX_NOT_ALLOWED", "list prefix is outside this product scope");
  }
  normalizeOwnerKind(segments[2]!);
  normalizeOwnerId(segments[3]!);
  if (marker === TRIAL_KEY_MARKER && segments.length >= 5) {
    normalizeTrialRedemptionId(segments[4]!);
  }
  return prefix;
}
