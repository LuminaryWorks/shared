import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { experiencePasswordSignIn, fetchSocialConnectors, type ExperienceSocialConnector } from "./experience-client";
import { signInPopup, signInRedirect } from "./oidc-client";
import { isIdpConfigured, type LuminaryAuthSession, type LuminaryIdpConfig } from "./types";
import styles from "./HeadlessLoginPanel.module.scss";

/** @deprecated Prefer dynamic connectors from IdP; kept for prop typing. */
export type SocialProviderTarget = string;

export interface HeadlessLoginLabels {
  title?: string;
  subtitle?: string;
  identifierPlaceholder?: string;
  passwordPlaceholder?: string;
  submitPassword?: string;
  /** @deprecated Use social buttons; kept for backward-compatible label overrides. */
  submitSso?: string;
  submitGoogle?: string;
  submitGithub?: string;
  socialDivider?: string;
  hint?: string;
  cancel?: string;
  experienceUnavailable?: string;
  showPassword?: string;
  hidePassword?: string;
}

export interface HeadlessLoginPanelProps {
  config: Partial<LuminaryIdpConfig>;
  /** Product display name shown as brand signal */
  productName: string;
  logoSrc?: string;
  labels?: HeadlessLoginLabels;
  returnUrl?: string;
  /** Prefer popup (default) for reauth; use redirect for full-page login. */
  mode?: "popup" | "redirect";
  /**
   * Show Experience social connectors (Google / GitHub / …).
   * Default `true`. Set `false` for admin / internal consoles that only allow
   * password (or enterprise SSO via IdP) — hides divider + social buttons and
   * skips fetching connectors.
   * Equivalent to `socialProviders={[]}` when false.
   */
  showSocialConnectors?: boolean;
  /**
   * Social providers (when `showSocialConnectors` is not `false`):
   * - omit / `"auto"` — load enabled connectors from IdP (google, github, x, …)
   * - `string[]` — only these targets (still prefers IdP logos/names when available)
   * - `[]` — hide social buttons
   */
  socialProviders?: "auto" | SocialProviderTarget[];
  showCancel?: boolean;
  onCancel?: () => void;
  /**
   * Called after OIDC session is obtained (popup) or before redirect navigation.
   * Products typically exchange OIDC access token → product JWT here.
   */
  onOidcSession?: (session: LuminaryAuthSession, returnUrl?: string) => Promise<void> | void;
  /** When Experience returns redirectTo, open it (default: same-tab assign). */
  onExperienceRedirect?: (redirectTo: string) => void;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * Brand accent for primary CTA / focus / product label.
   * Defaults to `#3a84ff` (DataLuminary / BlockyEdu).
   */
  themeColor?: string;
}

/** Shared default accent for product login panels. */
export const DEFAULT_LOGIN_THEME_COLOR = "#3a84ff";

const defaults: Required<HeadlessLoginLabels> = {
  title: "Sign in",
  subtitle: "Use your LuminaryWorks unified account",
  identifierPlaceholder: "Email or username",
  passwordPlaceholder: "Password",
  submitPassword: "Sign in with password",
  submitSso: "Continue with unified account",
  submitGoogle: "Google",
  submitGithub: "GitHub",
  socialDivider: "or",
  hint: "Social providers open directly. Password uses your LuminaryWorks account.",
  cancel: "Cancel",
  experienceUnavailable: "Password sign-in is unavailable; use a social provider instead.",
  showPassword: "Show password",
  hidePassword: "Hide password",
};

const FALLBACK_SOCIAL: ExperienceSocialConnector[] = [
  { id: "google", target: "google", name: "Google" },
  { id: "github", target: "github", name: "GitHub" },
];

function resolveSieBase(config: Partial<LuminaryIdpConfig>): string | undefined {
  // Prefer same-origin Experience base (SPA proxies /api/.well-known) to avoid
  // cross-port CORS on local Logto. Fall back to issuer origin only when needed.
  const explicit = config.experienceApiBase?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (config.issuer) {
    try {
      return new URL(config.issuer).origin;
    } catch {
      /* fall through */
    }
  }
  return undefined;
}

function labelFor(connector: ExperienceSocialConnector, labels: Required<HeadlessLoginLabels>): string {
  if (connector.target === "google" && labels.submitGoogle) return labels.submitGoogle;
  if (connector.target === "github" && labels.submitGithub) return labels.submitGithub;
  return connector.name;
}

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

export function HeadlessLoginPanel({
  config,
  productName,
  logoSrc,
  labels: labelsProp,
  returnUrl,
  mode = "popup",
  showSocialConnectors = true,
  socialProviders = "auto",
  showCancel,
  onCancel,
  onOidcSession,
  onExperienceRedirect,
  footer,
  className,
  style,
  themeColor = DEFAULT_LOGIN_THEME_COLOR,
}: HeadlessLoginPanelProps) {
  const labels = { ...defaults, ...labelsProp };
  const configured = isIdpConfigured(config);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const panelStyle: CSSProperties = {
    ...style,
    ["--lw-auth-theme" as string]: themeColor || DEFAULT_LOGIN_THEME_COLOR,
  };
  const [loading, setLoading] = useState<"password" | string | null>(null);
  const [error, setError] = useState("");
  const [connectors, setConnectors] = useState<ExperienceSocialConnector[]>([]);
  const socialEnabled =
    showSocialConnectors !== false &&
    !(Array.isArray(socialProviders) && socialProviders.length === 0);

  // Browser back from IdP restores bfcache with loading still set → "…".
  useEffect(() => {
    const resetBusy = () => setLoading(null);
    window.addEventListener("pageshow", resetBusy);
    window.addEventListener("popstate", resetBusy);
    return () => {
      window.removeEventListener("pageshow", resetBusy);
      window.removeEventListener("popstate", resetBusy);
    };
  }, []);

  useEffect(() => {
    if (!socialEnabled) {
      setConnectors([]);
      return;
    }
    let cancelled = false;
    const sieBase = resolveSieBase(config);
    const allowlist =
      socialProviders === "auto" || socialProviders === undefined
        ? null
        : new Set(socialProviders.map((t) => t.toLowerCase()));

    const apply = (list: ExperienceSocialConnector[]) => {
      const filtered = allowlist
        ? list.filter((c) => allowlist.has(c.target.toLowerCase()))
        : list;
      if (!cancelled) setConnectors(filtered);
    };

    if (!sieBase) {
      apply(
        allowlist
          ? FALLBACK_SOCIAL.filter((c) => allowlist.has(c.target))
          : FALLBACK_SOCIAL,
      );
      return;
    }

    void fetchSocialConnectors({ apiBase: sieBase, appId: config.clientId })
      .then((list) => {
        if (list.length) {
          apply(list);
          return;
        }
        apply(
          allowlist
            ? FALLBACK_SOCIAL.filter((c) => allowlist.has(c.target))
            : FALLBACK_SOCIAL,
        );
      })
      .catch(() => {
        apply(
          allowlist
            ? FALLBACK_SOCIAL.filter((c) => allowlist.has(c.target))
            : FALLBACK_SOCIAL,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [config.clientId, config.experienceApiBase, config.issuer, socialEnabled, socialProviders]);

  const runOidc = async (directSignIn?: string) => {
    if (!configured) throw new Error("IdP not configured");
    if (mode === "redirect") {
      await signInRedirect(config, { returnUrl, directSignIn });
      return;
    }
    const { session, returnUrl: next } = await signInPopup(config, { returnUrl, directSignIn });
    await onOidcSession?.(session, next);
  };

  const runSocial = async (target: string) => {
    setError("");
    setLoading(target);
    try {
      await runOidc(`social:${target}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
    }
  };

  const followExperienceRedirect = (redirectTo: string) => {
    if (onExperienceRedirect) {
      onExperienceRedirect(redirectTo);
      return;
    }
    window.location.assign(redirectTo);
  };

  const runPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    setError("");
    setLoading("password");
    try {
      const apiBase = config.experienceApiBase?.trim();
      if (!apiBase) {
        throw new Error(labels.experienceUnavailable);
      }
      const result = await experiencePasswordSignIn({
        apiBase,
        identifier: identifier.trim(),
        password,
        issuer: config.issuer,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        audience: config.audience,
        scopes: config.scopes,
        returnUrl,
      });
      if (result.redirectTo) {
        // Completes the PKCE interaction from bootstrap — do NOT start a new
        // authorize (that re-opens Logto hosted /sign-in).
        followExperienceRedirect(result.redirectTo);
        return;
      }
      throw new Error("Experience API did not return redirectTo");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
    }
  };

  const busy = loading !== null;
  const showSocial = socialEnabled && connectors.length > 0;
  const showHint = Boolean(labelsProp?.hint) || showSocial;

  return (
    <div className={cx(styles.panel, className)} style={panelStyle}>
      <header className={styles.brand}>
        {logoSrc ? <img src={logoSrc} alt="" width={48} height={48} className={styles.logo} /> : null}
        <div>
          <p className={styles.product}>{productName}</p>
          <h2 className={styles.title}>{labels.title}</h2>
        </div>
      </header>
      <p className={styles.subtitle}>{labels.subtitle}</p>

      {configured ? (
        <>
          <form onSubmit={(e) => void runPassword(e)} className={styles.form}>
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder={labels.identifierPlaceholder}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={styles.input}
              disabled={busy}
            />
            <div className={styles.passwordField}>
              <input
                type={passwordVisible ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder={labels.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cx(styles.input, styles.passwordInput)}
                disabled={busy}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                disabled={busy}
                aria-label={passwordVisible ? labels.hidePassword : labels.showPassword}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((v) => !v)}
              >
                <PasswordVisibilityIcon visible={passwordVisible} />
              </button>
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={busy || !identifier || !password}>
              {loading === "password" ? "…" : labels.submitPassword}
            </button>
          </form>
          {showHint ? <p className={styles.hint}>{labels.hint}</p> : null}

          {showSocial ? (
            <div className={styles.divider} aria-hidden>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>{labels.socialDivider}</span>
              <span className={styles.dividerLine} />
            </div>
          ) : null}
          {showSocial ? (
            <div className={styles.socialStack}>
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  className={styles.socialBtn}
                  disabled={busy}
                  onClick={() => void runSocial(connector.target)}
                >
                  <SocialLogo connector={connector} />
                  {loading === connector.target ? "…" : labelFor(connector, labels)}
                </button>
              ))}
            </div>
          ) : null}

        </>
      ) : (
        <p className={styles.error}>IdP is not configured (issuer / clientId / redirectUri).</p>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      {showCancel ? (
        <button type="button" className={styles.cancelBtn} disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </button>
      ) : null}

      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}

function SocialLogo({ connector }: { connector: ExperienceSocialConnector }) {
  if (connector.logo) {
    return <img src={connector.logo} alt="" width={18} height={18} className={styles.socialLogo} />;
  }
  return (
    <span className={styles.logoFallback} aria-hidden>
      {connector.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  // Filled icons (antd Eye / EyeInvisible style) — no dependency.
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
        <path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-57.9 0-111.5 9.8-160.3 27.7l72.3 72.3C457 273.3 483.5 266 512 266c161.3 0 279.4 81.8 362.7 254-26.3 54.4-57.5 100.2-93.3 136.1l59.6 59.6C891.4 655.7 932.5 578.5 942.2 537.7a60.3 60.3 0 000-51.5zM336.6 278.6l-59.9-59.9C230.6 255.4 182.8 296.4 141.9 348.1 95.4 412.1 64.6 486.5 51.8 512a60.3 60.3 0 000 51.5C115.3 719.5 224.6 814.8 365.4 860.1l72.5-72.5C353.6 761.6 286.3 698.3 241.3 612.5 220.6 573.1 205 528.6 194.5 486.2c24.5-50.4 55.1-92.1 90.8-124.9l51.3-51.3zM606.6 556.6A112 112 0 01467.4 417.4L606.6 556.6zM508 624c-26.5 0-50.9-9.2-70.2-24.6l-59.9 59.9A175.3 175.3 0 00508 688c97.2 0 176-78.8 176-176 0-26.5-9.2-50.9-24.6-70.2l-59.9 59.9c15.4 19.3 24.6 43.7 24.6 70.2 0 61.9-50.1 112-112 112zM880 112L112 880l48 48 768-768z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden>
      <path d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3a60.3 60.3 0 000 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3a60.3 60.3 0 000-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766z" />
      <path d="M508 336c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176zm0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z" />
    </svg>
  );
}
