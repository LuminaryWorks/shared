import type { IdentityMode } from "./types";

/** Frozen default. Do not re-open Logto vs ZITADEL as a product decision. */
export const DEFAULT_IAM_PROVIDER = "logto";

export const IAM_PROVIDER_STATUS = {
  shipped: "shipped",
  reserved: "plugin-reserved",
  devOnly: "dev-only",
} as const;

export type IamProviderStatus = (typeof IAM_PROVIDER_STATUS)[keyof typeof IAM_PROVIDER_STATUS];

export type IamProviderId = "logto" | "oidc" | "zitadel" | "legacy";

export type IamLoginExperience = "logto" | "hosted";

export type IamManagementPlugin = "logto" | null;

export interface IamProviderDescriptor {
  readonly id: IamProviderId;
  readonly status: IamProviderStatus;
  readonly runtimeMode: IdentityMode;
  readonly loginExperience: IamLoginExperience;
  readonly management: IamManagementPlugin;
  readonly license?: string;
}

/**
 * Luminary IAM Adapter catalog.
 *
 * Products talk to Runtime / Login Experience / Management adapters — never to a
 * vendor SDK. Logto is the shipped default (MPL-2.0). ZITADEL is a reserved
 * plugin id: login/runtime reuse standard OIDC Hosted Redirect; management is
 * not shipped. Do not add empty vendor adapters.
 */
export const IAM_PROVIDER_CATALOG: Record<IamProviderId, IamProviderDescriptor> = {
  logto: {
    id: "logto",
    status: IAM_PROVIDER_STATUS.shipped,
    runtimeMode: "logto",
    loginExperience: "logto",
    management: "logto",
    license: "MPL-2.0",
  },
  oidc: {
    id: "oidc",
    status: IAM_PROVIDER_STATUS.shipped,
    runtimeMode: "external_oidc",
    loginExperience: "hosted",
    management: null,
  },
  zitadel: {
    id: "zitadel",
    status: IAM_PROVIDER_STATUS.reserved,
    runtimeMode: "external_oidc",
    loginExperience: "hosted",
    management: null,
    license: "AGPL-3.0",
  },
  legacy: {
    id: "legacy",
    status: IAM_PROVIDER_STATUS.devOnly,
    runtimeMode: "legacy",
    loginExperience: "hosted",
    management: null,
  },
};

const IAM_PROVIDER_ALIASES: Record<string, IamProviderId> = {
  logto: "logto",
  oidc: "oidc",
  external_oidc: "oidc",
  hosted: "oidc",
  zitadel: "zitadel",
  legacy: "legacy",
};

export function knownIamProviderIds(): IamProviderId[] {
  return Object.keys(IAM_PROVIDER_CATALOG) as IamProviderId[];
}

export function normalizeIamProviderId(input?: string | null): IamProviderId {
  const key = (input ?? DEFAULT_IAM_PROVIDER).trim().toLowerCase();
  const id = IAM_PROVIDER_ALIASES[key];
  if (!id) {
    throw new Error(
      `Unknown IAM_PROVIDER "${input}". Shipped: logto (default), oidc. Reserved plugin: zitadel. Dev-only: legacy.`,
    );
  }
  return id;
}

export function resolveIamProvider(input?: string | null): IamProviderDescriptor {
  return IAM_PROVIDER_CATALOG[normalizeIamProviderId(input)];
}

/**
 * Resolve the catalog entry from env.
 * `IAM_PROVIDER` wins over the older `IDP_MODE` alias.
 */
export function resolveIamProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): IamProviderDescriptor {
  return resolveIamProvider(env.IAM_PROVIDER ?? env.IDP_MODE ?? DEFAULT_IAM_PROVIDER);
}

export function resolveIdentityMode(options: {
  mode?: IdentityMode;
  iamProvider?: string;
  issuer?: string;
}): IdentityMode {
  if (options.mode) return options.mode;
  if (options.iamProvider) return resolveIamProvider(options.iamProvider).runtimeMode;
  return options.issuer ? "logto" : "legacy";
}
