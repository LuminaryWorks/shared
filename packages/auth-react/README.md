# `@luminaryworks/auth-react`

LuminaryWorks unified OIDC SPA client + **AuthGate** (401 pause / single-flight reauth).

## AuthGate

```ts
import { authGate, withAuthGateRetry, AuthGateProvider, ReauthOverlay } from "@luminaryworks/auth-react";

authGate.configure({
  tryRefresh: async () => {
    /* refresh product JWT; return true if ok */
    return false;
  },
});

// In API client:
await withAuthGateRetry(() => fetch(...), {
  isUnauthorized: (e) => e.status === 401,
});
```

On first 401: try refresh → else open reauth UI (overlay + OIDC **popup**, not IdP iframe) → retry queued callers.

## Headless login panel

Branded panel with **social buttons** (auto-loaded from IdP Experience `socialConnectors` — google / github / x / …) plus **unified account** password. The default `LogtoExperienceAdapter` keeps Logto's `direct_sign_in=social:<target>` parameter inside provider-specific code. Buttons are hidden when the IdP has no social connectors (do not invent Google/GitHub — that dumped users on Logto `/sign-in`).

Styles ship as **CSS Modules (SCSS)**. The built bundle auto-injects panel CSS in the browser. Optional explicit import (SSR / style control):

```ts
import "@luminaryworks/auth-react/style.css";
```

Override layout via `className` / `style` on the root.

```tsx
// End-user product login (social on by default)
<HeadlessLoginPanel
  config={idpConfig}
  productName="DataLuminary"
  mode="redirect"
  // socialProviders: "auto" | ["google","github"] | []
/>

// Admin / internal console — hide Experience social connectors
<HeadlessLoginPanel
  config={idpConfig}
  productName="DataLuminary Admin"
  mode="redirect"
  showSocialConnectors={false}
/>
```

| Prop | Default | Notes |
|------|---------|--------|
| `showSocialConnectors` | `true` | `false` skips fetch and hides divider + social buttons |
| `socialProviders` | `"auto"` | allowlist, or `[]` (same effect as `showSocialConnectors={false}`) |
| `experienceAdapter` | catalog default | optional custom `LoginExperienceAdapter`; otherwise `config.iamProvider` |
| `config.iamProvider` | `logto` | `logto` Headless; `oidc` / `zitadel` Hosted Redirect |

IdP hosted `/sign-in` social row layout: `node scripts/apply-branding.mjs` (customCss wrap). Enable connectors: `ensure-sign-in-experience.mjs` + `verify-social-direct-signin.mjs`.

### Login experience adapters

`HeadlessLoginPanel` delegates non-standard password and social-connector flows
to `LoginExperienceAdapter`; standard OIDC authorization code + PKCE remains in
the OIDC client. Adapter methods are optional and are used only when both the
matching capability and method are present. Without password support, the panel
renders `labels.submitSso` and starts a standard hosted OIDC flow. Built-in
factory ids: `logto` (default Headless), `hosted` / `oidc` / `zitadel` (Hosted
Redirect). ZITADEL is a reserved plugin — there is no empty Experience stub:

```ts
import {
  createLoginExperienceAdapter,
  HostedOidcExperienceAdapter,
  LogtoExperienceAdapter,
  resolveLoginExperienceAdapter,
  type LoginExperienceAdapter,
  type LoginExperienceCapability,
} from "@luminaryworks/auth-react";

const logto = new LogtoExperienceAdapter();
const sameDefault = createLoginExperienceAdapter("logto");
const resolved = resolveLoginExperienceAdapter(logto);
const zitadelLogin = createLoginExperienceAdapter("zitadel"); // HostedOidcExperienceAdapter

// Hosted-only enterprise IdP: no Experience API methods are required.
const hostedOnly = {
  provider: "enterprise",
  capabilities: [],
} satisfies LoginExperienceAdapter;
```

Existing `experiencePasswordSignIn` and `fetchSocialConnectors` imports remain
available as compatibility functions backed by the default Logto adapter.

## Popup callback

Callback route must detect popup windows and call `handleSignInPopupCallback` (do not SSO-exchange inside the popup).
