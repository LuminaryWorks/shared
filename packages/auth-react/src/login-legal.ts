export const DEFAULT_PLATFORM_TERMS_URL = "https://luminaryworks.dev/legal/terms";
export const DEFAULT_PLATFORM_PRIVACY_URL = "https://luminaryworks.dev/legal/privacy";

export type LoginLegalUrls = {
  platformTermsUrl: string;
  platformPrivacyUrl: string;
  productTermsUrl: string;
  productPrivacyUrl: string;
};

export type LoginLegalDocument = {
  id: string;
  href: string;
  label: string;
};

function pickEnv(
  env: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const keys = [`VITE_${name}`, `PUBLIC_${name}`, `NEXT_PUBLIC_${name}`, name];
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Login clickwrap URLs. The checkbox links the product terms and the privacy
 * notice. Product terms must incorporate the LuminaryWorks platform terms by
 * reference; those platform URLs stay configurable for the legal pages.
 */
export function readLoginLegalConfigFromEnv(
  env: Record<string, string | undefined>,
  defaults?: Partial<LoginLegalUrls>,
): LoginLegalUrls {
  return {
    platformTermsUrl:
      pickEnv(env, "LEGAL_PLATFORM_TERMS_URL") ||
      defaults?.platformTermsUrl ||
      DEFAULT_PLATFORM_TERMS_URL,
    platformPrivacyUrl:
      pickEnv(env, "LEGAL_PLATFORM_PRIVACY_URL") ||
      defaults?.platformPrivacyUrl ||
      DEFAULT_PLATFORM_PRIVACY_URL,
    productTermsUrl:
      pickEnv(env, "LEGAL_PRODUCT_TERMS_URL") ||
      defaults?.productTermsUrl ||
      "/legal/terms",
    productPrivacyUrl:
      pickEnv(env, "LEGAL_PRODUCT_PRIVACY_URL") ||
      defaults?.productPrivacyUrl ||
      "/legal/privacy",
  };
}

export function buildLoginLegalDocuments(
  urls: LoginLegalUrls,
  labels: {
    /** Kept so existing callers compile. Not shown; product terms incorporate it. */
    platformTerms?: string;
    productTerms: string;
    privacy: string;
  },
): LoginLegalDocument[] {
  const docs: LoginLegalDocument[] = [
    {
      id: "product-terms",
      href: urls.productTermsUrl,
      label: labels.productTerms,
    },
    {
      id: "privacy",
      href: urls.productPrivacyUrl || urls.platformPrivacyUrl,
      label: labels.privacy,
    },
  ];
  return docs.filter((row) => row.href.length > 0 && row.label.length > 0);
}
