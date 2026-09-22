import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  LOGIN_EXPERIENCE_CAPABILITIES,
  resolveLoginExperienceAdapter,
  type ExperienceSocialConnector,
  type LoginExperienceAdapter,
  type SocialSignInRequest,
} from "./login-experience-adapter";
import { LogtoExperienceAdapter } from "./logto-experience-adapter";
import { signInPopup, signInRedirect, prepareSignInRequestUrl } from "./oidc-client";
import {
  evaluateRegisterEmail,
  fetchRegisterEmailPolicy,
  registerEmailDomainsHint,
  registerEmailRejectionMessage,
  resolveRegisterEmailPolicy,
  type RegisterEmailPolicy,
} from "./register-policy";
import { isIdpConfigured, type LuminaryAuthSession, type LuminaryIdpConfig } from "./types";
import styles from "./HeadlessLoginPanel.module.scss";

/** @deprecated Prefer dynamic connectors from IdP; kept for prop typing. */
export type SocialProviderTarget = string;

export interface HeadlessLoginLabels {
  title?: string;
  subtitle?: string;
  identifierPlaceholder?: string;
  /** Placeholder when panel is in register mode (username). */
  registerIdentifierPlaceholder?: string;
  passwordPlaceholder?: string;
  confirmPasswordPlaceholder?: string;
  submitPassword?: string;
  submitRegister?: string;
  /** Hosted OIDC button shown when the adapter has no password capability. */
  submitSso?: string;
  submitGoogle?: string;
  submitGithub?: string;
  socialDivider?: string;
  hint?: string;
  registerHint?: string;
  cancel?: string;
  experienceUnavailable?: string;
  showPassword?: string;
  hidePassword?: string;
  /** Switch link when on sign-in: "Create an account" */
  registerLink?: string;
  /** Switch link when on register: "Already have an account? Sign in" */
  loginLink?: string;
  passwordMismatch?: string;
  registerTitle?: string;
  registerSubtitle?: string;
  registerWithEmail?: string;
  registerWithUsername?: string;
  emailPlaceholder?: string;
  verificationCodePlaceholder?: string;
  sendCode?: string;
  resendCode?: string;
  /** Prefix before the allowlisted domain list, e.g. "Allowed email domains". */
  allowedDomainsPrefix?: string;
  /** Shown when mode is off / unrestricted (aside from disposable blocklist). */
  allowedDomainsOpen?: string;
  /** Shown when only disposable domains are blocked. */
  allowedDomainsBlocklist?: string;
  /**
   * Desktop/mobile system-browser social login: tell the user to finish in the browser
   * and return to the app (loopback / deep link callback).
   */
  waitingExternalBrowser?: string;
}

export interface HeadlessLoginPanelProps {
  config: Partial<LuminaryIdpConfig>;
  /** Login-experience provider. Defaults to the catalog adapter for `config.iamProvider`. */
  experienceAdapter?: LoginExperienceAdapter;
  /** Product display name shown as brand signal */
  productName: string;
  logoSrc?: string;
  labels?: HeadlessLoginLabels;
  returnUrl?: string;
  /** Prefer popup (default) for reauth; redirect for full-page SPA; external for desktop/mobile system browser (RFC 8252). */
  mode?: "popup" | "redirect" | "external";
  /**
   * Open an authorize URL in the OS browser / Custom Tabs / ASWebAuthenticationSession.
   * Required when `mode="external"` (Google / GitHub / hosted SSO). Password Headless stays in-app.
   */
  openExternalUrl?: (url: string) => void | Promise<void>;
  /**
   * Show Experience social connectors (Google / GitHub / …).
   * Default `true`. Set `false` for admin / internal consoles that only allow
   * password (or enterprise SSO via IdP) — hides divider + social buttons and
   * skips fetching connectors.
   * Equivalent to `socialProviders={[]}` when false.
   */
  showSocialConnectors?: boolean;
  /**
   * Show self-register switch + register form.
   * Default `true` for end-user product logins. Set `false` for admin / ops consoles.
   */
  showRegister?: boolean;
  /**
   * Email domain policy for self-register.
   * If omitted, the panel loads `GET {experienceApiBase}/api/register-policy` when available,
   * otherwise uses built-in consumer allowlist defaults.
   */
  registerEmailPolicy?: RegisterEmailPolicy;
  /**
   * When true (default), fetch live policy from Auth Gateway `/api/register-policy`.
   * Set false to use only `registerEmailPolicy` / built-in defaults (e.g. local auth-dev-proxy).
   */
  fetchRegisterPolicy?: boolean;
  /**
   * Optional CAPTCHA token provider (Cloudflare Turnstile / reCAPTCHA).
   * Token is sent as `captchaToken` on Experience Register init when Logto bot protection is on.
   */
  getCaptchaToken?: () => Promise<string | undefined>;
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
   * Defaults to ecosystem primary `#1677ff`.
   */
  themeColor?: string;
}

/** Shared default accent for product login panels (shared/brand --lw-primary). */
export const DEFAULT_LOGIN_THEME_COLOR = "#1677ff";

const defaults: Required<HeadlessLoginLabels> = {
  title: "Sign in",
  subtitle: "Use your LuminaryWorks unified account",
  identifierPlaceholder: "Email or username",
  registerIdentifierPlaceholder: "Username",
  passwordPlaceholder: "Password",
  confirmPasswordPlaceholder: "Confirm password",
  submitPassword: "Sign in with password",
  submitRegister: "Create account",
  submitSso: "Continue with unified account",
  submitGoogle: "Google",
  submitGithub: "GitHub",
  socialDivider: "or",
  hint: "Social providers open directly. Password uses your LuminaryWorks account.",
  registerHint:
    "Email register needs a code (Gmail / Outlook / QQ / 163 / iCloud …). Username is an alternative. Prefer one-click? Use a social provider.",
  cancel: "Cancel",
  experienceUnavailable: "Password sign-in is unavailable; use a social provider instead.",
  showPassword: "Show password",
  hidePassword: "Hide password",
  registerLink: "Create an account",
  loginLink: "Already have an account? Sign in",
  passwordMismatch: "Passwords do not match",
  registerTitle: "Create account",
  registerSubtitle: "Create your LuminaryWorks unified account",
  registerWithEmail: "Email",
  registerWithUsername: "Username",
  emailPlaceholder: "Email",
  verificationCodePlaceholder: "Verification code",
  sendCode: "Send code",
  resendCode: "Resend code",
  allowedDomainsPrefix: "Allowed email domains",
  allowedDomainsOpen: "Email registration is open for most providers.",
  allowedDomainsBlocklist:
    "Most email providers are accepted. Temporary / disposable addresses are blocked.",
  waitingExternalBrowser:
    "Finish signing in with your browser, then return to this app.",
};

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
  experienceAdapter: experienceAdapterProp,
  productName,
  logoSrc,
  labels: labelsProp,
  returnUrl,
  mode = "popup",
  openExternalUrl,
  showSocialConnectors = true,
  showRegister = true,
  registerEmailPolicy: registerEmailPolicyProp,
  fetchRegisterPolicy = true,
  getCaptchaToken,
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
  const experienceAdapter = resolveLoginExperienceAdapter(
    experienceAdapterProp,
    config.iamProvider,
  );
  const [emailPolicy, setEmailPolicy] = useState<RegisterEmailPolicy>(
    () => registerEmailPolicyProp ?? resolveRegisterEmailPolicy(),
  );
  useEffect(() => {
    if (registerEmailPolicyProp) {
      setEmailPolicy(registerEmailPolicyProp);
      return;
    }
    if (!fetchRegisterPolicy || !showRegister) {
      setEmailPolicy(resolveRegisterEmailPolicy());
      return;
    }
    const base = config.experienceApiBase?.trim();
    if (!base) {
      setEmailPolicy(resolveRegisterEmailPolicy());
      return;
    }
    let cancelled = false;
    void fetchRegisterEmailPolicy(base).then((policy) => {
      if (!cancelled) setEmailPolicy(policy);
    });
    return () => {
      cancelled = true;
    };
  }, [
    config.experienceApiBase,
    fetchRegisterPolicy,
    registerEmailPolicyProp,
    showRegister,
  ]);
  useEffect(() => {
    if (experienceAdapter instanceof LogtoExperienceAdapter) {
      experienceAdapter.emailPolicy = emailPolicy;
    }
  }, [emailPolicy, experienceAdapter]);
  const labels = { ...defaults, ...labelsProp };
  const configured = isIdpConfigured(config);
  const [panelMode, setPanelMode] = useState<"sign-in" | "register">("sign-in");
  const [registerChannel, setRegisterChannel] = useState<"email" | "username">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerificationId, setEmailVerificationId] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const panelStyle: CSSProperties = {
    ...style,
    ["--lw-auth-theme" as string]: themeColor || DEFAULT_LOGIN_THEME_COLOR,
  };
  const [loading, setLoading] = useState<"password" | string | null>(null);
  const [error, setError] = useState("");
  const [awaitingExternal, setAwaitingExternal] = useState(false);
  const [connectors, setConnectors] = useState<ExperienceSocialConnector[]>([]);
  const socialEnabled =
    showSocialConnectors !== false &&
    !(Array.isArray(socialProviders) && socialProviders.length === 0) &&
    experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.socialConnectors) &&
    experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.socialDirectSignIn) &&
    typeof experienceAdapter.fetchSocialConnectors === "function" &&
    typeof experienceAdapter.createSocialSignInRequest === "function";
  const passwordEnabled =
    experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.passwordSignIn) &&
    typeof experienceAdapter.experiencePasswordSignIn === "function";
  const registerEnabled =
    showRegister !== false &&
    ((experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.passwordSignUp) &&
      typeof experienceAdapter.experiencePasswordSignUp === "function") ||
      (experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.emailCodeSignUp) &&
        typeof experienceAdapter.sendRegisterEmailCode === "function" &&
        typeof experienceAdapter.experienceEmailPasswordSignUp === "function"));
  const emailRegisterEnabled =
    experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.emailCodeSignUp) &&
    typeof experienceAdapter.sendRegisterEmailCode === "function" &&
    typeof experienceAdapter.experienceEmailPasswordSignUp === "function";
  const usernameRegisterEnabled =
    experienceAdapter.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.passwordSignUp) &&
    typeof experienceAdapter.experiencePasswordSignUp === "function";
  const isRegister = panelMode === "register" && registerEnabled;
  const useEmailRegister = isRegister && registerChannel === "email" && emailRegisterEnabled;

  // Browser back from IdP restores bfcache with loading still set → "…".
  useEffect(() => {
    const resetBusy = () => {
      setLoading(null);
      setAwaitingExternal(false);
    };
    window.addEventListener("pageshow", resetBusy);
    window.addEventListener("popstate", resetBusy);
    return () => {
      window.removeEventListener("pageshow", resetBusy);
      window.removeEventListener("popstate", resetBusy);
    };
  }, []);

  useEffect(() => {
    const fetchConnectors = experienceAdapter.fetchSocialConnectors;
    if (!socialEnabled || !fetchConnectors) {
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
      // No Experience base — do not invent Google/GitHub buttons. Fake fallbacks
      // start OIDC `direct_sign_in` and dump users on Logto `/sign-in`.
      if (!cancelled) setConnectors([]);
      return;
    }

    void fetchConnectors.call(experienceAdapter, { apiBase: sieBase, appId: config.clientId })
      .then((list) => {
        apply(list);
      })
      .catch(() => {
        if (!cancelled) setConnectors([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    config.clientId,
    config.experienceApiBase,
    config.issuer,
    experienceAdapter,
    socialEnabled,
    socialProviders,
  ]);

  const runOidc = async (experienceRequest?: SocialSignInRequest) => {
    if (!configured) throw new Error("IdP not configured");
    if (mode === "external") {
      if (!openExternalUrl) {
        throw new Error("openExternalUrl is required when mode is \"external\"");
      }
      const url = await prepareSignInRequestUrl(config as LuminaryIdpConfig, {
        returnUrl,
        ...experienceRequest,
      });
      setAwaitingExternal(true);
      await openExternalUrl(url);
      setLoading(null);
      return;
    }
    if (mode === "redirect") {
      await signInRedirect(config, { returnUrl, ...experienceRequest });
      return;
    }
    const { session, returnUrl: next } = await signInPopup(config, {
      returnUrl,
      ...experienceRequest,
    });
    await onOidcSession?.(session, next);
  };

  const runSocial = async (target: string) => {
    setError("");
    setLoading(target);
    try {
      if (
        !socialEnabled ||
        !experienceAdapter.capabilities.includes(
          LOGIN_EXPERIENCE_CAPABILITIES.socialDirectSignIn,
        ) ||
        !experienceAdapter.createSocialSignInRequest
      ) {
        throw new Error("Login experience does not support direct social sign-in");
      }
      await runOidc(experienceAdapter.createSocialSignInRequest(target));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
      setAwaitingExternal(false);
    }
  };

  const runHostedOidc = async () => {
    setError("");
    setLoading("sso");
    try {
      await runOidc();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
      setAwaitingExternal(false);
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
      const captchaToken = getCaptchaToken ? await getCaptchaToken() : undefined;
      if (isRegister) {
        if (password !== confirmPassword) {
          throw new Error(labels.passwordMismatch);
        }
        if (useEmailRegister) {
          if (!experienceAdapter.experienceEmailPasswordSignUp || !emailVerificationId) {
            throw new Error("Send and enter the email verification code first");
          }
          const decision = evaluateRegisterEmail(identifier.trim(), emailPolicy);
          if (!decision.ok) throw new Error(registerEmailRejectionMessage(decision));
          const result = await experienceAdapter.experienceEmailPasswordSignUp({
            apiBase,
            identifier: identifier.trim(),
            email: identifier.trim(),
            password,
            code: verificationCode,
            verificationId: emailVerificationId,
            captchaToken,
            issuer: config.issuer,
            clientId: config.clientId,
            redirectUri: config.redirectUri,
            audience: config.audience,
            scopes: config.scopes,
            returnUrl,
          });
          if (result.redirectTo) {
            followExperienceRedirect(result.redirectTo);
            return;
          }
          throw new Error("Experience API did not return redirectTo");
        }
        if (!usernameRegisterEnabled || !experienceAdapter.experiencePasswordSignUp) {
          throw new Error(labels.experienceUnavailable);
        }
        const result = await experienceAdapter.experiencePasswordSignUp({
          apiBase,
          identifier: identifier.trim(),
          password,
          captchaToken,
          issuer: config.issuer,
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          audience: config.audience,
          scopes: config.scopes,
          returnUrl,
        });
        if (result.redirectTo) {
          followExperienceRedirect(result.redirectTo);
          return;
        }
        throw new Error("Experience API did not return redirectTo");
      }
      if (
        !passwordEnabled ||
        !experienceAdapter.capabilities.includes(
          LOGIN_EXPERIENCE_CAPABILITIES.passwordSignIn,
        ) ||
        !experienceAdapter.experiencePasswordSignIn
      ) {
        throw new Error(labels.experienceUnavailable);
      }
      const result = await experienceAdapter.experiencePasswordSignIn({
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
        followExperienceRedirect(result.redirectTo);
        return;
      }
      throw new Error("Experience API did not return redirectTo");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
    }
  };

  const runSendCode = async () => {
    if (!configured || !useEmailRegister) return;
    setError("");
    setLoading("send-code");
    try {
      const apiBase = config.experienceApiBase?.trim();
      if (!apiBase || !experienceAdapter.sendRegisterEmailCode) {
        throw new Error(labels.experienceUnavailable);
      }
      const email = identifier.trim();
      const decision = evaluateRegisterEmail(email, emailPolicy);
      if (!decision.ok) throw new Error(registerEmailRejectionMessage(decision));
      const captchaToken = getCaptchaToken ? await getCaptchaToken() : undefined;
      const sent = await experienceAdapter.sendRegisterEmailCode({
        apiBase,
        identifier: email,
        email,
        captchaToken,
        issuer: config.issuer,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        audience: config.audience,
        scopes: config.scopes,
        returnUrl,
      });
      setEmailVerificationId(sent.verificationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const switchPanelMode = (next: "sign-in" | "register") => {
    setPanelMode(next);
    setError("");
    setConfirmPassword("");
    setVerificationCode("");
    setEmailVerificationId(null);
  };

  const busy = loading !== null;
  const showSocial = socialEnabled && connectors.length > 0;
  const showHint = Boolean(labelsProp?.hint) || showSocial || isRegister;
  const formReady =
    Boolean(identifier.trim()) &&
    Boolean(password) &&
    (!isRegister || Boolean(confirmPassword)) &&
    (!useEmailRegister || (Boolean(verificationCode.trim()) && Boolean(emailVerificationId)));
  const titleText = isRegister ? labels.registerTitle : labels.title;
  const subtitleText = isRegister ? labels.registerSubtitle : labels.subtitle;
  const identifierPlaceholder = isRegister
    ? useEmailRegister
      ? labels.emailPlaceholder
      : labels.registerIdentifierPlaceholder
    : labels.identifierPlaceholder;
  const submitLabel = isRegister ? labels.submitRegister : labels.submitPassword;
  const hintText = isRegister ? labels.registerHint : labels.hint;
  const domainsHint =
    useEmailRegister
      ? registerEmailDomainsHint(emailPolicy, {
          allowedDomainsPrefix: labels.allowedDomainsPrefix,
          allowedDomainsOpen: labels.allowedDomainsOpen,
          allowedDomainsBlocklist: labels.allowedDomainsBlocklist,
        })
      : null;

  return (
    <div className={cx(styles.panel, className)} style={panelStyle}>
      <header className={styles.brand}>
        {logoSrc ? <img src={logoSrc} alt="" width={48} height={48} className={styles.logo} /> : null}
        <div>
          <p className={styles.product}>{productName}</p>
          <h2 className={styles.title}>{titleText}</h2>
        </div>
      </header>
      <p className={styles.subtitle}>{subtitleText}</p>

      {configured ? (
        <>
          {passwordEnabled ? (
            <form onSubmit={(e) => void runPassword(e)} className={styles.form}>
              {isRegister && emailRegisterEnabled && usernameRegisterEnabled ? (
                <div className={styles.channelTabs} role="tablist" aria-label="Register method">
                  <button
                    type="button"
                    role="tab"
                    className={cx(
                      styles.channelTab,
                      registerChannel === "email" && styles.channelTabActive,
                    )}
                    aria-selected={registerChannel === "email"}
                    disabled={busy}
                    onClick={() => {
                      setRegisterChannel("email");
                      setEmailVerificationId(null);
                      setVerificationCode("");
                      setError("");
                    }}
                  >
                    {labels.registerWithEmail}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={cx(
                      styles.channelTab,
                      registerChannel === "username" && styles.channelTabActive,
                    )}
                    aria-selected={registerChannel === "username"}
                    disabled={busy}
                    onClick={() => {
                      setRegisterChannel("username");
                      setEmailVerificationId(null);
                      setVerificationCode("");
                      setError("");
                    }}
                  >
                    {labels.registerWithUsername}
                  </button>
                </div>
              ) : null}
              <input
                type={useEmailRegister ? "email" : "text"}
                name="identifier"
                autoComplete={isRegister ? "username" : "username"}
                placeholder={identifierPlaceholder}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (useEmailRegister) {
                    setEmailVerificationId(null);
                  }
                }}
                className={styles.input}
                disabled={busy}
              />
              {domainsHint ? (
                <p className={styles.domainsHint} data-testid="register-allowed-domains">
                  {domainsHint}
                </p>
              ) : null}
              {useEmailRegister ? (
                <div className={styles.codeRow}>
                  <input
                    type="text"
                    name="verificationCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={labels.verificationCodePlaceholder}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className={cx(styles.input, styles.codeInput)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy || !identifier.trim()}
                    onClick={() => void runSendCode()}
                  >
                    {loading === "send-code"
                      ? "…"
                      : emailVerificationId
                        ? labels.resendCode
                        : labels.sendCode}
                  </button>
                </div>
              ) : null}
              <div className={styles.passwordField}>
                <input
                  type={passwordVisible ? "text" : "password"}
                  name="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
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
              {isRegister ? (
                <div className={styles.passwordField}>
                  <input
                    type={passwordVisible ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder={labels.confirmPasswordPlaceholder}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cx(styles.input, styles.passwordInput)}
                    disabled={busy}
                  />
                </div>
              ) : null}
              <button type="submit" className={styles.primaryBtn} disabled={busy || !formReady}>
                {loading === "password" ? "…" : submitLabel}
              </button>
            </form>
          ) : (
            <div className={styles.form}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void runHostedOidc()}
              >
                {loading === "sso" ? "…" : labels.submitSso}
              </button>
            </div>
          )}
          {showHint ? <p className={styles.hint}>{hintText}</p> : null}

          {registerEnabled && passwordEnabled ? (
            <p className={styles.switchMode}>
              <button
                type="button"
                className={styles.switchModeBtn}
                disabled={busy}
                onClick={() => switchPanelMode(isRegister ? "sign-in" : "register")}
              >
                {isRegister ? labels.loginLink : labels.registerLink}
              </button>
            </p>
          ) : null}

          {awaitingExternal ? (
            <p className={styles.hint} role="status">
              {labels.waitingExternalBrowser}
            </p>
          ) : null}

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
