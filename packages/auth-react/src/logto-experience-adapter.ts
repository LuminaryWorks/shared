/**
 * Logto Experience API (Headless) adapter.
 * Prefer same-origin Experience base (SPA proxies /api/experience) so cookies
 * work on HTTP localhost.
 */

import { prepareSignInRequestUrl } from "./oidc-client";
import {
  LOGIN_EXPERIENCE_CAPABILITIES,
  type ExperienceIdentifierType,
  type ExperiencePasswordSignInInput,
  type ExperiencePasswordSignInResult,
  type ExperienceSocialConnector,
  type FetchSocialConnectorsInput,
  type LoginExperienceAdapter,
  type LoginExperienceCapability,
  type SocialSignInRequest,
} from "./login-experience-adapter";
import type { LuminaryIdpConfig } from "./types";

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
 * Force authorize onto the Experience/SPA origin so Set-Cookie lands on the
 * same host as subsequent `/api/experience` calls (dev proxy strips Domain).
 */
export function sameOriginAuthorizeUrl(authorizeUrl: string, apiBase: string): string {
  const u = new URL(authorizeUrl);
  const base = new URL(apiBase);
  if (u.origin === base.origin) return authorizeUrl;
  return `${base.origin}${u.pathname}${u.search}${u.hash}`;
}

/**
 * Logto creates its interaction cookie after an authorize request. The
 * standard OIDC client creates and persists the PKCE request; this adapter only
 * applies Logto's same-origin interaction bootstrap.
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

/** Build Logto's provider-specific direct sign-in authorize parameter. */
export function createLogtoDirectSignInRequest(directSignIn: string): SocialSignInRequest {
  return { extraQueryParams: { direct_sign_in: directSignIn } };
}

/** Built-in adapter for Logto's non-standard Experience API. */
export class LogtoExperienceAdapter implements LoginExperienceAdapter {
  readonly provider = "logto";
  readonly capabilities: readonly LoginExperienceCapability[] = [
    LOGIN_EXPERIENCE_CAPABILITIES.passwordSignIn,
    LOGIN_EXPERIENCE_CAPABILITIES.socialConnectors,
    LOGIN_EXPERIENCE_CAPABILITIES.socialDirectSignIn,
  ];

  async experiencePasswordSignIn(
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

        const submitted = await experienceFetch<{ redirectTo?: string }>(
          apiBase,
          "/submit",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        return { redirectTo: submitted?.redirectTo, raw: submitted };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError ?? new Error("Experience password sign-in failed");
  }

  async fetchSocialConnectors(
    input: FetchSocialConnectorsInput,
  ): Promise<ExperienceSocialConnector[]> {
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
      .filter(
        (
          connector,
        ): connector is {
          id: string;
          target: string;
          name?: string | Record<string, string>;
          logo?: string;
        } => Boolean(connector?.id && connector?.target),
      )
      .map((connector) => ({
        id: connector.id,
        target: connector.target,
        name: localizeName(connector.name) || titleCase(connector.target),
        logo: connector.logo,
      }));
  }

  createSocialSignInRequest(target: string): SocialSignInRequest {
    return createLogtoDirectSignInRequest(`social:${target}`);
  }
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
