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

Branded panel with **social buttons** (auto-loaded from IdP Experience `socialConnectors` — google / github / x / …) plus **unified account** password. Social uses `direct_sign_in=social:<target>`. Buttons are hidden when the IdP has no social connectors (do not invent Google/GitHub — that dumped users on Logto `/sign-in`).

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

IdP hosted `/sign-in` social row layout: `node scripts/apply-branding.mjs` (customCss wrap). Enable connectors: `ensure-sign-in-experience.mjs` + `verify-social-direct-signin.mjs`.

## Popup callback

Callback route must detect popup windows and call `handleSignInPopupCallback` (do not SSO-exchange inside the popup).
