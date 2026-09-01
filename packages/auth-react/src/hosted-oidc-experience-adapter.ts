import type { LoginExperienceAdapter, LoginExperienceCapability } from "./login-experience-adapter";

/**
 * Standard OIDC Hosted Redirect adapter.
 *
 * Used for enterprise OIDC and reserved IAM plugins (ZITADEL) that have no
 * shipped Headless Experience API. Password and social stay on the IdP hosted UI.
 */
export class HostedOidcExperienceAdapter implements LoginExperienceAdapter {
  readonly capabilities: readonly LoginExperienceCapability[] = [];

  constructor(readonly provider = "hosted") {}
}
