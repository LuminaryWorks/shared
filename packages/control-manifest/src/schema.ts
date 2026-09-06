import {
  AI_MODES,
  CONTROL_PROFILES,
  DEPLOYMENT_STAGES,
  ENTITLEMENT_MODES,
  IDENTITY_MODES,
  MANIFEST_VERSION,
  NOTIFICATION_MODES,
  PRODUCT_CODES,
} from "./constants";

/**
 * JSON Schema for editors and generic CI linters.
 *
 * The schema covers *shape* only. Cross-field rules — capability/service
 * consistency, secret-like key rejection, stage maturity gates, AuthN never
 * degrading — live in `validateControlManifest`, which is the normative check.
 */
export const CONTROL_MANIFEST_SCHEMA_ID =
  "https://schemas.luminaryworks.dev/control-manifest/v1.json";

const serviceRef = {
  type: "object",
  additionalProperties: false,
  required: ["url", "required", "apiVersion", "schemaVersion"],
  properties: {
    url: {
      type: "string",
      format: "uri",
      pattern: "^https?://",
      description: "Base URL reachable by the consuming plane. Must not embed credentials.",
    },
    required: {
      type: "boolean",
      description: "false means the consumer still starts and degrades as declared.",
    },
    apiVersion: { type: "string", minLength: 1, description: "HTTP surface version, e.g. v1." },
    schemaVersion: {
      type: "string",
      minLength: 1,
      description: "DTO / event payload schema major version, e.g. 1.",
    },
  },
} as const;

const productRef = {
  type: "object",
  additionalProperties: false,
  required: ["url", "required"],
  properties: {
    url: { type: "string", format: "uri", pattern: "^https?://" },
    required: { type: "boolean" },
    apiVersion: { type: "string", minLength: 1 },
    schemaVersion: { type: "string", minLength: 1 },
  },
} as const;

export const controlManifestJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: CONTROL_MANIFEST_SCHEMA_ID,
  title: "LuminaryWorks Control Manifest",
  description:
    "Static description of a federated LuminaryWorks deployment: profile, optional central services, contract versions, capability modes and degradation. Never contains secrets, business resources or dynamic service registration.",
  type: "object",
  additionalProperties: false,
  required: ["manifestVersion", "profile", "stage", "capabilities", "services"],
  properties: {
    manifestVersion: { const: MANIFEST_VERSION },
    profile: { enum: [...CONTROL_PROFILES] },
    stage: {
      enum: [...DEPLOYMENT_STAGES],
      description: "Honesty boundary: dev | lab | pilot | production.",
    },
    capabilities: {
      type: "object",
      additionalProperties: false,
      required: ["identity", "entitlement", "ai", "notification"],
      properties: {
        identity: { enum: [...IDENTITY_MODES] },
        entitlement: { enum: [...ENTITLEMENT_MODES] },
        ai: { enum: [...AI_MODES] },
        notification: { enum: [...NOTIFICATION_MODES] },
      },
    },
    services: {
      type: "object",
      additionalProperties: false,
      properties: {
        identity: serviceRef,
        authGateway: serviceRef,
        entitlement: serviceRef,
        ai: serviceRef,
        notification: serviceRef,
        observability: serviceRef,
      },
    },
    degradation: {
      type: "object",
      additionalProperties: false,
      properties: {
        identity: {
          const: "fail_closed",
          description: "AuthN never degrades to anonymous access.",
        },
        entitlement: { enum: ["fail_closed", "fail_open_local", "offline_license"] },
        ai: { enum: ["fail_closed", "disable_feature", "fallback_local_byok"] },
        notification: { enum: ["fail_closed", "queue", "drop"] },
      },
    },
    products: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(PRODUCT_CODES.map((code) => [code, productRef])),
    },
  },
} as const;

export type ControlManifestJsonSchema = typeof controlManifestJsonSchema;
