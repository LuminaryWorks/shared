/**
 * @deprecated Import the adapter APIs from the package root instead.
 *
 * This module remains as a compatibility facade for existing consumers.
 */
import {
  LOGIN_EXPERIENCE_CAPABILITIES,
  resolveLoginExperienceAdapter,
} from "./login-experience-adapter";

export type {
  ExperienceIdentifierType,
  ExperiencePasswordSignInInput,
  ExperiencePasswordSignInResult,
  ExperienceSocialConnector,
  FetchSocialConnectorsInput,
} from "./login-experience-adapter";
export { sameOriginAuthorizeUrl } from "./logto-experience-adapter";

import type {
  ExperiencePasswordSignInInput,
  ExperiencePasswordSignInResult,
  ExperienceSocialConnector,
  FetchSocialConnectorsInput,
} from "./login-experience-adapter";

/** @deprecated Use a LoginExperienceAdapter instance. */
export function experiencePasswordSignIn(
  input: ExperiencePasswordSignInInput,
): Promise<ExperiencePasswordSignInResult> {
  const adapter = resolveLoginExperienceAdapter();
  if (
    !adapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.passwordSignIn) ||
    !adapter.experiencePasswordSignIn
  ) {
    return Promise.reject(new Error("Login experience does not support password sign-in"));
  }
  return adapter.experiencePasswordSignIn(input);
}

/** @deprecated Use a LoginExperienceAdapter instance. */
export function fetchSocialConnectors(
  input: FetchSocialConnectorsInput,
): Promise<ExperienceSocialConnector[]> {
  const adapter = resolveLoginExperienceAdapter();
  if (
    !adapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.socialConnectors) ||
    !adapter.fetchSocialConnectors
  ) {
    return Promise.reject(new Error("Login experience does not support social connectors"));
  }
  return adapter.fetchSocialConnectors(input);
}
