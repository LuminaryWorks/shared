export interface PostLoginPathOptions {
  /** sessionStorage key (product-scoped), e.g. `dv:postLoginPath` */
  storageKey: string;
  /** Default destination when nothing remembered */
  defaultPath?: string;
  /** Extra paths that must not be used as return targets */
  unsafePrefixes?: string[];
}

const DEFAULT_UNSAFE = ["/login", "/auth", "/exception"];

function normalizeAppPath(path: string, fallback: string): string {
  const raw = path.replace(/^#/, "").trim();
  if (!raw) return fallback.startsWith("/") ? fallback : `/${fallback}`;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function isUnsafeReturnPath(path: string, unsafePrefixes: string[], fallback: string): boolean {
  const p = normalizeAppPath(path, fallback);
  if (p === "/") return true;
  return unsafePrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(prefix));
}

/**
 * sessionStorage helpers for OIDC redirect return paths.
 * Product-specific ACL checks (e.g. 403 fallback) stay in the product.
 */
export function createPostLoginPathHelpers(options: PostLoginPathOptions) {
  const storageKey = options.storageKey;
  const defaultPath = options.defaultPath?.startsWith("/")
    ? options.defaultPath
    : `/${options.defaultPath || "home"}`;
  const unsafePrefixes = [...DEFAULT_UNSAFE, ...(options.unsafePrefixes || [])];

  function rememberPostLoginPath(path: string): void {
    const normalized = normalizeAppPath(path, defaultPath);
    if (isUnsafeReturnPath(normalized, unsafePrefixes, defaultPath)) return;
    try {
      sessionStorage.setItem(storageKey, normalized);
    } catch {
      /* ignore */
    }
  }

  function peekPostLoginPath(): string | undefined {
    try {
      const v = sessionStorage.getItem(storageKey);
      if (!v || isUnsafeReturnPath(v, unsafePrefixes, defaultPath)) return undefined;
      return normalizeAppPath(v, defaultPath);
    } catch {
      return undefined;
    }
  }

  function consumePostLoginPath(fallback = defaultPath): string {
    const remembered = peekPostLoginPath();
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    return remembered ?? normalizeAppPath(fallback, defaultPath);
  }

  return {
    rememberPostLoginPath,
    peekPostLoginPath,
    consumePostLoginPath,
    normalizeAppPath: (path: string) => normalizeAppPath(path, defaultPath),
    isUnsafeReturnPath: (path: string) => isUnsafeReturnPath(path, unsafePrefixes, defaultPath),
  };
}
