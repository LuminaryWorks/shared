import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { LuminaryAuthSession, LuminaryIdpConfig } from "./types";

let manager: UserManager | null = null;

function storageKey(config: LuminaryIdpConfig): string {
  return config.tokenStorageKey ?? "luminary_access_token";
}

export function createUserManager(config: LuminaryIdpConfig): UserManager {
  if (manager) return manager;

  manager = new UserManager({
    authority: config.issuer.replace(/\/$/, ""),
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri ?? config.redirectUri,
    response_type: "code",
    scope: config.scopes ?? "openid profile email offline_access",
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });

  return manager;
}

export function resetUserManager(): void {
  manager = null;
}

export async function signInRedirect(config: LuminaryIdpConfig, returnUrl?: string): Promise<void> {
  const um = createUserManager(config);
  await um.signinRedirect({
    state: returnUrl ? { returnUrl } : undefined,
  });
}

export async function handleSignInCallback(config: LuminaryIdpConfig): Promise<{
  session: LuminaryAuthSession;
  returnUrl?: string;
}> {
  const um = createUserManager(config);
  const user = await um.signinRedirectCallback();
  const session = toSession(user);
  localStorage.setItem(storageKey(config), session.accessToken);
  const returnUrl =
    typeof user.state === "object" && user.state && "returnUrl" in user.state
      ? String((user.state as { returnUrl?: string }).returnUrl ?? "")
      : undefined;
  return { session, returnUrl: returnUrl || undefined };
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

export async function getCurrentUser(config: LuminaryIdpConfig): Promise<LuminaryAuthSession | null> {
  const um = createUserManager(config);
  const user = await um.getUser();
  if (!user || user.expired) return null;
  return toSession(user);
}
