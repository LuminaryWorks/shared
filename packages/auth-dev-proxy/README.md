# @luminaryworks/auth-dev-proxy

Same-origin IdP proxy for LuminaryWorks product SPAs.

Browser calls `http://localhost:<spa>/oidc` and `/api/experience` so Headless login
does **not** require Auth Gateway (`:3010`) during local development.

## Transport rules

- Upstream defaults to Logto `http://localhost:3001` (`AUTH_IDP_PROXY_TARGET` / gateway override).
- Discovery always keeps provider-owned fields upstream. The Logto-compatible
  default preserves `issuer`, `authorization_endpoint`,
  `device_authorization_endpoint`, and
  `pushed_authorization_request_endpoint`; token/JWKS/userinfo endpoints are
  rewritten to the SPA origin.
- Rewrites `Location` / strips cookie `Domain` so Experience + consent hops stay on the SPA origin.
- Proxy config emits both hpm v2 (`onProxyRes`) and v3+/v4 (`on.proxyRes`) hooks for Vite and Rsbuild 2.

For another OIDC provider, set `upstreamOrigin` and optionally configure:

```ts
createIdpDevProxyMap({
  spaOrigin,
  target: "https://id.example.com",
  upstreamOrigin: "https://id.example.com",
  // JWT issuer remains provider-owned; these endpoints are reachable via the SPA.
  preserveUpstreamDiscoveryFields: ["issuer"],
  providerPaths: ["/oauth2", "/login", "/callback"],
  rewriteOrigins: ["https://id-alt.example.com"],
});
```

`logtoOrigin` remains as a deprecated alias for `upstreamOrigin`, and the
default provider paths remain `/oidc`, `/api/experience`, `/api/.well-known`,
`/sign-in`, `/consent`, `/direct`, and `/callback`.

## Rsbuild / Vite

```ts
import { createIdpDevProxyMap, resolveIdpProxyTarget } from "@luminaryworks/auth-dev-proxy";

const spaOrigin = `http://localhost:${port}`;
const idpProxy = createIdpDevProxyMap({
  spaOrigin,
  target: resolveIdpProxyTarget(process.env),
});

export default defineConfig({
  server: {
    proxy: {
      ...idpProxy,
      "/api": { target: backendApiUrl, changeOrigin: true },
    },
  },
});
```

Set SPA env:

```bash
VITE_AUTH_EXPERIENCE_URL=http://localhost:<spa-port>
# or PUBLIC_AUTH_EXPERIENCE_URL=...
VITE_IDP_ISSUER=http://localhost:3001/oidc
```

## Next.js App Router

```ts
// app/oidc/[...path]/route.ts
import { forwardIdpFetch, resolveIdpProxyTarget } from "@luminaryworks/auth-dev-proxy";

const opts = {
  spaOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:18082",
  target: resolveIdpProxyTarget(process.env),
  mountPath: "/oidc" as const,
};

async function handle(req: Request) {
  return forwardIdpFetch(req, opts);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
```

Mirror for `app/api/experience/[[...path]]/route.ts` with `mountPath: "/api/experience"`.

Also mount (same handler pattern) so Headless cookies and SIE stay same-origin:

- `app/api/.well-known/[[...path]]` → `/api/.well-known`
- `app/sign-in/[[...path]]` → `/sign-in`
- `app/consent/[[...path]]` → `/consent`
- `app/direct/[[...path]]` → `/direct`
- `app/callback/[[...path]]` → `/callback` (social connector return; not product `/auth/callback`)

`forwardIdpFetch` returns a null body for HTTP 204/205/304 (Logto Experience `PUT /api/experience` is 204)
and strips hop-by-hop headers (`Expect`, `Connection`, …) so Undici/Next.js upstream `fetch` does not throw.
Discovery requests also drop `X-Forwarded-Host` so Logto does not advertise `authorization_endpoint` on the SPA origin
(that made Google/GitHub stick on `/direct/social/*` with a broken Experience shell).
