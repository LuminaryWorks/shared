import zlib from "node:zlib";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface IdpDevProxyOptions {
  /** SPA origin used in discovery rewrite, e.g. http://localhost:3003 */
  spaOrigin: string;
  /** Upstream IdP origin (Logto or Auth Gateway), default http://localhost:3001 */
  target?: string;
  logtoOrigin?: string;
  gatewayOrigin?: string;
}

type ProxyReqLike = { removeHeader: (name: string) => void };

/**
 * Compatible with:
 * - http-proxy-middleware v2 / Vite (`onProxyReq` / `onProxyRes`)
 * - http-proxy-middleware v3+/v4 / Rsbuild 2 (`on.proxyReq` / `on.proxyRes`)
 *
 * Both styles are emitted; each middleware generation only honors its own API,
 * so handlers are not double-invoked.
 */
export interface HttpProxyLikeConfig {
  target: string;
  changeOrigin: true;
  secure: false;
  selfHandleResponse: true;
  /** @deprecated hpm v2 — prefer `on.proxyReq` for Rsbuild 2 */
  onProxyReq: (proxyReq: ProxyReqLike) => void;
  /** @deprecated hpm v2 — prefer `on.proxyRes` for Rsbuild 2 */
  onProxyRes: (
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse,
  ) => void;
  on: {
    proxyReq: (proxyReq: ProxyReqLike) => void;
    proxyRes: (
      proxyRes: IncomingMessage,
      req: IncomingMessage,
      res: ServerResponse,
    ) => void;
  };
}

const DEFAULT_LOGTO = "http://localhost:3001";
const DEFAULT_GATEWAY = "http://localhost:3010";

/**
 * Keep authorize/issuer on Logto in discovery so JWT `iss` and hosted UI stay correct.
 * Token/jwks/userinfo rewrite to SPA. Headless password bootstrap rewrites authorize
 * to the SPA origin in `@luminaryworks/auth-react` so interaction cookies stick on the SPA.
 *
 * Social (`direct_sign_in`) must hit Logto `/oidc/auth` so `/direct/social/*` runs on
 * `:3001` (Experience JS + cookies). Next.js `forwardIdpFetch` often receives
 * `X-Forwarded-Host: <spa>` — Logto then *emits* SPA authorize URLs. Skipping a
 * rewrite is not enough; pin these fields back onto the IdP origin.
 */
const KEEP_ON_IDP = new Set([
  "issuer",
  "authorization_endpoint",
  "device_authorization_endpoint",
  "pushed_authorization_request_endpoint",
]);

/** Resolve upstream from env; prefer explicit proxy target, then gateway, then Logto. */
export function resolveIdpProxyTarget(env: Record<string, string | undefined> = process.env): string {
  const raw =
    env.AUTH_IDP_PROXY_TARGET ||
    env.AUTH_GATEWAY_URL ||
    env.VITE_AUTH_GATEWAY_URL ||
    env.PUBLIC_AUTH_GATEWAY_URL ||
    DEFAULT_LOGTO;
  return String(raw).replace(/\/$/, "");
}

function decompressIfNeeded(buf: Buffer, encoding: string | undefined): Buffer {
  const enc = String(encoding || "").toLowerCase();
  try {
    if (enc.includes("gzip")) return zlib.gunzipSync(buf);
    if (enc.includes("br")) return zlib.brotliDecompressSync(buf);
    if (enc.includes("deflate")) {
      try {
        return zlib.inflateSync(buf);
      } catch {
        return zlib.inflateRawSync(buf);
      }
    }
  } catch {
    /* keep original */
  }
  return buf;
}

function pinToOrigin(url: string, origin: string): string {
  try {
    const parsed = new URL(url);
    const target = new URL(origin);
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Keep authorize/issuer on Logto; rewrite token/jwks/userinfo to SPA origin.
 * KEEP_ON_IDP fields are forced onto Logto even when upstream already used the SPA host.
 */
export function rewriteOidcDiscoveryJson(text: string, options: IdpDevProxyOptions): string {
  const spaOrigin = options.spaOrigin.replace(/\/$/, "");
  const logtoOrigin = (options.logtoOrigin || DEFAULT_LOGTO).replace(/\/$/, "");
  const gatewayOrigin = (options.gatewayOrigin || DEFAULT_GATEWAY).replace(/\/$/, "");
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== "string") continue;
      if (KEEP_ON_IDP.has(key)) {
        data[key] = pinToOrigin(
          value
            .replaceAll(spaOrigin, logtoOrigin)
            .replaceAll(gatewayOrigin, logtoOrigin)
            .replaceAll("http://127.0.0.1:3001", logtoOrigin)
            .replaceAll("http://127.0.0.1:3010", logtoOrigin),
          logtoOrigin,
        );
        continue;
      }
      data[key] = value
        .replaceAll(gatewayOrigin, spaOrigin)
        .replaceAll(logtoOrigin, spaOrigin)
        .replaceAll("http://127.0.0.1:3001", spaOrigin)
        .replaceAll("http://127.0.0.1:3010", spaOrigin);
    }
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

/** Keep OIDC / Experience / consent hops on the SPA origin so cookies stay aligned. */
export function rewriteIdpLocation(location: string, options: IdpDevProxyOptions): string {
  const spaOrigin = options.spaOrigin.replace(/\/$/, "");
  const logtoOrigin = (options.logtoOrigin || DEFAULT_LOGTO).replace(/\/$/, "");
  const gatewayOrigin = (options.gatewayOrigin || DEFAULT_GATEWAY).replace(/\/$/, "");
  const target = (options.target || logtoOrigin).replace(/\/$/, "");
  return location
    .replaceAll(gatewayOrigin, spaOrigin)
    .replaceAll(logtoOrigin, spaOrigin)
    .replaceAll(target, spaOrigin)
    .replaceAll("http://127.0.0.1:3001", spaOrigin)
    .replaceAll("http://127.0.0.1:3010", spaOrigin);
}

function stripCookieDomain(setCookies: string | string[] | undefined): string[] | undefined {
  if (!setCookies) return undefined;
  const list = Array.isArray(setCookies) ? setCookies : [setCookies];
  return list.map((c) =>
    c
      .split(";")
      .map((p) => p.trim())
      .filter((p) => !/^domain=/i.test(p))
      .join("; "),
  );
}

function applyRewrittenProxyBody(
  proxyRes: IncomingMessage,
  res: ServerResponse,
  options: IdpDevProxyOptions,
  body: Buffer,
): void {
  let buf = decompressIfNeeded(body, proxyRes.headers["content-encoding"] as string | undefined);
  const ct = String(proxyRes.headers["content-type"] || "");
  if (ct.includes("json")) {
    buf = Buffer.from(rewriteOidcDiscoveryJson(buf.toString("utf8"), options), "utf8");
  }

  for (const [key, value] of Object.entries(proxyRes.headers)) {
    if (
      key === "transfer-encoding" ||
      key === "content-length" ||
      key === "content-encoding" ||
      key === "set-cookie" ||
      key === "cross-origin-resource-policy" ||
      key === "cross-origin-embedder-policy" ||
      key === "cross-origin-opener-policy" ||
      key === "x-frame-options"
    ) {
      continue;
    }
    if (key === "location" && typeof value === "string") {
      res.setHeader("location", rewriteIdpLocation(value, options));
      continue;
    }
    if (value !== undefined) res.setHeader(key, value);
  }

  const cookies = stripCookieDomain(proxyRes.headers["set-cookie"]);
  if (cookies) res.setHeader("set-cookie", cookies);

  res.setHeader("content-length", String(buf.length));
  res.writeHead(proxyRes.statusCode || 502);
  res.end(buf);
}

/** http-proxy / Rsbuild / Vite `server.proxy` entry for IdP paths. */
export function createIdpHttpProxy(options: IdpDevProxyOptions): HttpProxyLikeConfig {
  const target = (options.target || resolveIdpProxyTarget()).replace(/\/$/, "");
  const onProxyReq = (proxyReq: ProxyReqLike) => {
    proxyReq.removeHeader("accept-encoding");
  };
  const onProxyRes = (
    proxyRes: IncomingMessage,
    _req: IncomingMessage,
    res: ServerResponse,
  ) => {
    const chunks: Buffer[] = [];
    proxyRes.on("data", (c: Buffer) => chunks.push(c));
    proxyRes.on("end", () => {
      applyRewrittenProxyBody(proxyRes, res, options, Buffer.concat(chunks));
    });
  };
  return {
    target,
    changeOrigin: true,
    secure: false,
    // Required so we can rewrite discovery JSON / Set-Cookie / Location.
    // Without a matching on.proxyRes (hpm v3+), the response never ends — hang.
    selfHandleResponse: true,
    onProxyReq,
    onProxyRes,
    on: {
      proxyReq: onProxyReq,
      proxyRes: onProxyRes,
    },
  };
}

export type IdpDevProxyPath =
  | "/oidc"
  | "/api/experience"
  | "/api/.well-known"
  | "/sign-in"
  | "/consent"
  | "/direct"
  | "/callback";

/**
 * Map suitable for Rsbuild/Vite `server.proxy`.
 * Includes Logto UI hops (`/sign-in`, `/consent`, `/direct`) so Headless Experience
 * cookies on the SPA origin survive authorize → consent → callback.
 */
export function createIdpDevProxyMap(
  options: IdpDevProxyOptions,
): Record<IdpDevProxyPath, HttpProxyLikeConfig> {
  const proxy = createIdpHttpProxy(options);
  return {
    "/oidc": proxy,
    "/api/experience": proxy,
    "/api/.well-known": proxy,
    "/sign-in": proxy,
    "/consent": proxy,
    "/direct": proxy,
    // Social connector return URLs registered on Logto (`/callback/:connectorId`)
    "/callback": proxy,
  };
}

/**
 * Fetch-based forwarder for Next.js App Router catch-all routes.
 * Mount at `/oidc/[...path]` and `/api/experience/[[...path]]`
 * (optional: `/api/.well-known/[...path]`, `/sign-in`, `/consent`, `/direct`).
 */
export async function forwardIdpFetch(
  request: Request,
  options: IdpDevProxyOptions & {
    mountPath?: IdpDevProxyPath;
  },
): Promise<Response> {
  const target = (options.target || resolveIdpProxyTarget()).replace(/\/$/, "");
  const url = new URL(request.url);
  const upstream = new URL(`${target}${url.pathname}${url.search}`);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("accept-encoding");
  // Next.js sets X-Forwarded-Host to the SPA. Logto would then advertise
  // authorization_endpoint on :18082, and social login dies on /direct/social/*.
  if (url.pathname.includes("/.well-known/openid-configuration")) {
    headers.delete("x-forwarded-host");
    headers.delete("x-forwarded-proto");
    headers.delete("x-forwarded-port");
    headers.delete("x-forwarded-for");
    headers.delete("forwarded");
  }
  // Undici (Next.js) rejects Expect: 100-continue and other hop-by-hop headers.
  headers.delete("expect");
  headers.delete("connection");
  headers.delete("keep-alive");
  headers.delete("transfer-encoding");
  headers.delete("te");
  headers.delete("trailer");
  headers.delete("upgrade");
  headers.delete("proxy-connection");
  headers.delete("content-length");
  headers.set("accept-encoding", "identity");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Buffer.from(await request.arrayBuffer());
  }

  const upstreamRes = await fetch(upstream, init);
  const status = upstreamRes.status;
  // Fetch Response forbids a body for 204/205/304 — Logto Experience PUT returns 204.
  const nullBody = status === 204 || status === 205 || status === 304;

  const raw = Buffer.from(await upstreamRes.arrayBuffer());
  const encoding = upstreamRes.headers.get("content-encoding") || undefined;
  let buf = decompressIfNeeded(raw, encoding);
  const ct = upstreamRes.headers.get("content-type") || "";
  if (!nullBody && ct.includes("json")) {
    buf = Buffer.from(rewriteOidcDiscoveryJson(buf.toString("utf8"), options), "utf8");
  }

  const outHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === "transfer-encoding" ||
      k === "content-length" ||
      k === "content-encoding" ||
      k === "set-cookie" ||
      k.startsWith("cross-origin-") ||
      k === "x-frame-options"
    ) {
      return;
    }
    if (k === "location") {
      outHeaders.set(key, rewriteIdpLocation(value, options));
      return;
    }
    outHeaders.set(key, value);
  });

  const setCookie = upstreamRes.headers.getSetCookie?.() ?? [];
  for (const c of stripCookieDomain(setCookie) ?? []) {
    outHeaders.append("set-cookie", c);
  }

  if (nullBody) {
    return new Response(null, { status, headers: outHeaders });
  }

  outHeaders.set("content-length", String(buf.length));
  return new Response(buf, { status, headers: outHeaders });
}
