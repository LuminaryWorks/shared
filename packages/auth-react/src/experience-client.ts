/**
 * Logto Experience API (Headless) client.
 * Prefer same-origin Experience base (SPA proxies /api/experience) so cookies work on HTTP localhost.
 * @see https://docs.logto.io/docs/recipes/customize-token-claims (Experience API recipes)
 */

import { prepareSignInRequestUrl } from "./oidc-client";
import type { LuminaryIdpConfig } from "./types";

export type ExperienceIdentifierType = "email" | "username" | "phone";

export interface ExperiencePasswordSignInInput {
  /** Experience API origin (no trailing slash). Prefer SPA origin when proxied. */
  apiBase: string;
  identifier: string;
  password: string;
  identifierType?: ExperienceIdentifierType;
  /** Required to bootstrap the OIDC interaction cookie before Experience calls. */
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
  audience?: string;
  scopes?: string;
  /** Carried in OIDC state for post-login return (UserManager PKCE). */
  returnUrl?: string;
}

export interface ExperiencePasswordSignInResult {
  /** Continue URL from Experience submit (complete OIDC interaction). */
  redirectTo?: string;
  raw?: unknown;
}

function experienceUrl(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/$/, "")}/api/experience${path}`;
}

async function experienceFetch<T>(apiBase: string, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(experienceUrl(apiBase, path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `Experience API ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function guessIdentifierType(identifier: string): ExperienceIdentifierType {
  if (identifier.includes("@")) return "email";
  if (/^\+?\d{6,}$/.test(identifier.trim())) return "phone";
  return "username";
}

/**
 * Force authorize onto the Experience/SPA origin so Set-Cookie lands on the same
 * host as subsequent `/api/experience` calls (dev proxy strips Domain).
 */
export function sameOriginAuthorizeUrl(authorizeUrl: string, apiBase: string): string {
  const u = new URL(authorizeUrl);
  const base = new URL(apiBase);
  if (u.origin === base.origin) return authorizeUrl;
  return `${base.origin}${u.pathname}${u.search}${u.hash}`;
}

/**
 * Logto only creates the interaction cookie after an authorize request.
 * Use UserManager.createSigninRequest so PKCE state matches `/auth/callback`,
 * then load authorize via the SPA proxy (same-origin cookies).
 */
async function bootstrapOidcInteraction(input: ExperiencePasswordSignInInput): Promise<void> {
  if (!input.issuer || !input.clientId || !input.redirectUri) return;
  if (typeof document === "undefined") return;

  const config: LuminaryIdpConfig = {
    issuer: input.issuer,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    audience: input.audience,
    scopes: input.scopes,
    experienceApiBase: input.apiBase,
  };

  const signinUrl = await prepareSignInRequestUrl(config, {
    returnUrl: input.returnUrl,
  });
  const authorizeUrl = sameOriginAuthorizeUrl(signinUrl, input.apiBase);

  await new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve();
    };
    iframe.addEventListener("load", () => {
      window.setTimeout(finish, 400);
    });
    iframe.src = authorizeUrl;
    document.body.appendChild(iframe);
    window.setTimeout(finish, 2500);
  });
}

/**
 * Headless password sign-in via Logto Experience API.
 * Requires an OIDC interaction cookie (see {@link bootstrapOidcInteraction}) and
 * same-site Experience calls (SPA proxy or Auth Gateway on the SPA origin).
 *
 * On success, follow {@link ExperiencePasswordSignInResult.redirectTo} in the same
 * window — that URL completes the PKCE round-trip started by createSigninRequest.
 * Do not start a second authorize (that shows Logto `/sign-in` again).
 *
 * Tries the guessed identifier type first, then the alternate email/username so
 * users can sign in with either when both methods are enabled on the IdP.
 */
export async function experiencePasswordSignIn(
  input: ExperiencePasswordSignInInput,
): Promise<ExperiencePasswordSignInResult> {
  const { apiBase, identifier, password } = input;
  await bootstrapOidcInteraction(input);

  const primary = input.identifierType ?? guessIdentifierType(identifier);
  const alternates: ExperienceIdentifierType[] =
    primary === "phone"
      ? [primary]
      : primary === "email"
        ? ["email", "username"]
        : ["username", "email"];

  let lastError: Error | undefined;
  for (const identifierType of alternates) {
    try {
      await experienceFetch(apiBase, "", {
        method: "PUT",
        body: JSON.stringify({ interactionEvent: "SignIn" }),
      });

      const verified = await experienceFetch<{ verificationId?: string }>(
        apiBase,
        "/verification/password",
        {
          method: "POST",
          body: JSON.stringify({
            identifier: { type: identifierType, value: identifier },
            password,
          }),
        },
      );

      const verificationId = verified?.verificationId;
      if (!verificationId) {
        throw new Error("Experience API did not return verificationId");
      }

      await experienceFetch(apiBase, "/identification", {
        method: "POST",
        body: JSON.stringify({ verificationId }),
      });

      const submitted = await experienceFetch<{ redirectTo?: string }>(apiBase, "/submit", {
        method: "POST",
        body: JSON.stringify({}),
      });

      return { redirectTo: submitted?.redirectTo, raw: submitted };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Experience password sign-in failed");
}

export interface ExperienceSocialConnector {
  id: string;
  target: string;
  name: string;
  logo?: string;
}

/**
 * Public Logto sign-in experience (no auth). Returns enabled social connectors
 * in SIE order — use for Headless social buttons (google / github / x / …).
 */
export async function fetchSocialConnectors(input: {
  /** Same origin as Experience / IdP (e.g. SPA proxy or http://localhost:3001). */
  apiBase: string;
  appId?: string;
}): Promise<ExperienceSocialConnector[]> {
  const url = new URL(`${input.apiBase.replace(/\/$/, "")}/api/.well-known/sign-in-exp`);
  if (input.appId?.trim()) url.searchParams.set("appId", input.appId.trim());
  const res = await fetch(url.toString(), {
    // Public metadata — omit cookies so browsers do not require credentialed CORS.
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`sign-in-exp ${res.status}`);
  }
  const data = (await res.json()) as {
    socialConnectors?: Array<{
      id?: string;
      target?: string;
      name?: string | Record<string, string>;
      logo?: string;
    }>;
  };
  return (data.socialConnectors ?? [])
    .filter((c): c is { id: string; target: string; name?: string | Record<string, string>; logo?: string } =>
      Boolean(c?.id && c?.target),
    )
    .map((c) => ({
      id: c.id,
      target: c.target,
      name: localizeName(c.name) || titleCase(c.target),
      logo: c.logo,
    }));
}

function localizeName(name: string | Record<string, string> | undefined): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name["zh-CN"] || name.en || Object.values(name)[0] || "";
}

function titleCase(target: string): string {
  if (!target) return "";
  return target.charAt(0).toUpperCase() + target.slice(1);
}
