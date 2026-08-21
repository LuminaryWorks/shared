import {
  OidcClient,
  UserManager,
  WebStorageStateStore,
  type User,
} from "oidc-client-ts";
import { createLogtoDirectSignInRequest } from "./logto-experience-adapter";
import type { LuminaryAuthSession, LuminaryIdpConfig } from "./types";

let manager: UserManager | null = null;

function storageKey(config: LuminaryIdpConfig): string {
  return config.tokenStorageKey ?? "luminary_access_token";
}

function popupRedirectUri(config: LuminaryIdpConfig): string {
  return config.popupRedirectUri ?? config.redirectUri;
}

function sharedStateStore() {
  // localStorage so popup/redirect/Experience callback windows can resolve PKCE state.
  return new WebStorageStateStore({ store: window.localStorage });
}

function clientSettings(config: LuminaryIdpConfig) {
  const resource = config.audience?.trim() || undefined;
  return {
    authority: config.issuer.replace(/\/$/, ""),
    metadataUrl: resolveOidcMetadataUrl(config),
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri ?? config.redirectUri,
    response_type: "code" as const,
    scope: config.scopes ?? "openid profile email offline_access",
    stateStore: sharedStateStore(),
    extraQueryParams: resource ? { resource } : undefined,
    extraTokenParams: resource ? { resource } : undefined,
  };
}

function userManagerSettings(config: LuminaryIdpConfig) {
  const resource = config.audience?.trim() || undefined;
  return {
    ...clientSettings(config),
    popup_redirect_uri: popupRedirectUri(config),
    automaticSilentRenew: true,
    loadUserInfo: !resource,
    userStore: sharedStateStore(),
  };
}

export function createUserManager(config: LuminaryIdpConfig): UserManager {
  if (manager) return manager;
  manager = new UserManager(userManagerSettings(config));
  return manager;
}

/**
 * When Experience/Gateway base differs from the IdP issuer origin, fetch OIDC discovery
 * via the gateway (CORS) while keeping `authority` = Logto issuer (JWT `iss`).
 */
function resolveOidcMetadataUrl(config: LuminaryIdpConfig): string | undefined {
  const proxyBase = config.experienceApiBase?.replace(/\/$/, "");
  if (!proxyBase) return undefined;
  try {
    if (new URL(proxyBase).origin === new URL(config.issuer).origin) return undefined;
  } catch {
    return undefined;
  }
  return `${proxyBase}/oidc/.well-known/openid-configuration`;
}

export function resetUserManager(): void {
  manager = null;
}

export interface SignInOptions {
  returnUrl?: string;
  /** Provider-specific authorize parameters supplied by an experience adapter. */
  extraQueryParams?: Record<string, string>;
  /**
   * Logto direct sign-in, e.g. `social:google` / `social:github` / `sso:<connectorId>`.
   * Skips the hosted password page and opens the provider immediately.
   * @deprecated Prefer a LoginExperienceAdapter, which supplies extraQueryParams.
   */
  directSignIn?: string;
}

function signInArgs(config: LuminaryIdpConfig, options?: SignInOptions | string) {
  const normalized: SignInOptions =
    typeof options === "string" ? { returnUrl: options } : (options ?? {});
  const resource = config.audience?.trim();
  const extraQueryParams: Record<string, string> = { ...normalized.extraQueryParams };
  if (resource) extraQueryParams.resource = resource;
  if (normalized.directSignIn) {
    Object.assign(
      extraQueryParams,
      createLogtoDirectSignInRequest(normalized.directSignIn).extraQueryParams,
    );
  }
  return {
    state: normalized.returnUrl ? { returnUrl: normalized.returnUrl } : undefined,
    extraQueryParams: Object.keys(extraQueryParams).length ? extraQueryParams : undefined,
  };
}

export async function signInRedirect(
  config: LuminaryIdpConfig,
  returnUrlOrOptions?: string | SignInOptions,
): Promise<void> {
  resetUserManager();
  const um = createUserManager(config);
  await um.signinRedirect(signInArgs(config, returnUrlOrOptions));
}

/**
 * Persist PKCE state (same store as {@link createUserManager}) and return the
 * authorize URL — used by Experience headless bootstrap before navigating to
 * `redirectTo` from `/api/experience/submit`.
 */
export async function prepareSignInRequestUrl(
  config: LuminaryIdpConfig,
  returnUrlOrOptions?: string | SignInOptions,
): Promise<string> {
  resetUserManager();
  // Warm the singleton so callback uses identical settings/stores.
  createUserManager(config);
  const client = new OidcClient(clientSettings(config));
  const args = signInArgs(config, returnUrlOrOptions);
  const request = await client.createSigninRequest({
    state: args.state,
    extraQueryParams: {
      ...(args.extraQueryParams ?? {}),
      prompt: "login",
    },
  });
  return request.url;
}

/**
 * OIDC login in a popup window (not an iframe). Opener keeps SPA state;
 * callback page in the popup must call {@link handleSignInPopupCallback}.
 */
export async function signInPopup(
  config: LuminaryIdpConfig,
  returnUrlOrOptions?: string | SignInOptions,
): Promise<{ session: LuminaryAuthSession; returnUrl?: string }> {
  resetUserManager();
  const um = createUserManager(config);
  const user = await um.signinPopup(signInArgs(config, returnUrlOrOptions));
  const session = toSession(user);
  if (!session.accessToken) {
    throw new Error("IdP did not return access_token (check audience / API resource)");
  }
  assertJwtAccessToken(session.accessToken);
  localStorage.setItem(storageKey(config), session.accessToken);
  const stateReturnUrl =
    typeof user.state === "object" && user.state && "returnUrl" in user.state
      ? String((user.state as { returnUrl?: string }).returnUrl ?? "")
      : undefined;
  return { session, returnUrl: stateReturnUrl || undefined };
}

export async function handleSignInCallback(config: LuminaryIdpConfig): Promise<{
  session: LuminaryAuthSession;
  returnUrl?: string;
}> {
  const um = createUserManager(config);
  const user = await um.signinRedirectCallback();
  const session = toSession(user);
  assertJwtAccessToken(session.accessToken);
  localStorage.setItem(storageKey(config), session.accessToken);
  const returnUrl =
    typeof user.state === "object" && user.state && "returnUrl" in user.state
      ? String((user.state as { returnUrl?: string }).returnUrl ?? "")
      : undefined;
  return { session, returnUrl: returnUrl || undefined };
}

/**
 * Complete popup OIDC in the popup window. Notifies the opener and closes.
 * Do not run product SSO exchange here — the opener handles that after signInPopup resolves.
 */
export async function handleSignInPopupCallback(config: LuminaryIdpConfig): Promise<void> {
  const um = createUserManager(config);
  await um.signinPopupCallback();
}

/** True when this window is likely an OIDC popup callback. */
export function isOidcPopupWindow(): boolean {
  try {
    return Boolean(window.opener && window.opener !== window);
  } catch {
    return false;
  }
}

export async function signOutRedirect(config: LuminaryIdpConfig): Promise<void> {
  localStorage.removeItem(storageKey(config));
  const um = createUserManager(config);
  await um.signoutRedirect();
}

export function getStoredAccessToken(config: LuminaryIdpConfig): string | null {
  return localStorage.getItem(storageKey(config));
}

export function clearStoredSession(config: LuminaryIdpConfig): void {
  localStorage.removeItem(storageKey(config));
}

function toSession(user: User): LuminaryAuthSession {
  return {
    accessToken: user.access_token,
    idToken: user.id_token,
    expiresAt: user.expires_at ? user.expires_at * 1000 : undefined,
    profile: user.profile as Record<string, unknown>,
  };
}

function assertJwtAccessToken(accessToken: string): void {
  if (accessToken.split(".").length !== 3) {
    throw new Error(
      "Received non-JWT access_token. Pass resource (audience) on authorize/token and register the API resource at the IdP.",
    );
  }
}

export async function getCurrentUser(config: LuminaryIdpConfig): Promise<LuminaryAuthSession | null> {
  const um = createUserManager(config);
  const user = await um.getUser();
  if (!user || user.expired) return null;
  return toSession(user);
}
