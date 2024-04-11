/**
 * AuthGate — single-flight 401 recovery with optional token refresh + reauth UI.
 * Products wire tryRefresh / onReauthRequired; API clients call handleUnauthorized + waitIfBlocked.
 */

export type AuthGatePhase = "idle" | "refreshing" | "reauth";

export type UnauthorizedDisposition = "retry" | "fail";

export interface AuthGateSnapshot {
  phase: AuthGatePhase;
  /** True while refresh or interactive reauth is in flight. */
  blocked: boolean;
  lastError?: string;
}

export interface AuthGateConfig {
  /**
   * Attempt silent product-token (or OIDC) refresh before showing reauth UI.
   * Return true if a new session was established.
   */
  tryRefresh?: () => Promise<boolean>;
  /** Called once when interactive reauth is required (open modal / popup). */
  onReauthRequired?: () => void;
  /** Called when reauth succeeds or is cancelled (phase back to idle). */
  onSettled?: (ok: boolean) => void;
}

type Waiter = {
  resolve: (disposition: UnauthorizedDisposition) => void;
};

class AuthGateCoordinator {
  private phase: AuthGatePhase = "idle";
  private lastError?: string;
  /** Cached for useSyncExternalStore — must keep referential equality when unchanged. */
  private snapshot: AuthGateSnapshot = { phase: "idle", blocked: false };
  private config: AuthGateConfig = {};
  private flight: Promise<UnauthorizedDisposition> | null = null;
  private reauthWaiters: Waiter[] = [];
  private listeners = new Set<() => void>();

  configure(config: AuthGateConfig): void {
    this.config = { ...this.config, ...config };
  }

  getSnapshot = (): AuthGateSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private setPhase(phase: AuthGatePhase, lastError?: string): void {
    if (this.phase === phase && this.lastError === lastError) return;
    this.phase = phase;
    this.lastError = lastError;
    this.snapshot = {
      phase,
      blocked: phase !== "idle",
      lastError,
    };
    this.emit();
  }

  /** Await while a recovery is in flight (pause outbound API traffic). */
  async waitIfBlocked(): Promise<void> {
    if (!this.flight) return;
    await this.flight;
  }

  /**
   * Single-flight 401 handler.
   * Concurrent callers share one recovery; all receive the same disposition.
   */
  handleUnauthorized(errorMessage?: string): Promise<UnauthorizedDisposition> {
    if (this.flight) return this.flight;
    this.flight = this.runRecovery(errorMessage).finally(() => {
      this.flight = null;
    });
    return this.flight;
  }

  /** Open reauth UI without a preceding 401 (cold start / deep link). */
  requestReauth(errorMessage?: string): Promise<UnauthorizedDisposition> {
    return this.handleUnauthorized(errorMessage);
  }

  /** Product calls after popup / Headless login restored the session. */
  completeReauth(): void {
    if (this.phase !== "reauth") return;
    const waiters = this.reauthWaiters.splice(0, this.reauthWaiters.length);
    this.setPhase("idle");
    this.config.onSettled?.(true);
    for (const w of waiters) w.resolve("retry");
  }

  /** User dismissed reauth; fail queued recovery waiters. */
  cancelReauth(errorMessage?: string): void {
    if (this.phase !== "reauth") return;
    const waiters = this.reauthWaiters.splice(0, this.reauthWaiters.length);
    this.setPhase("idle", errorMessage);
    this.config.onSettled?.(false);
    for (const w of waiters) w.resolve("fail");
  }

  private async runRecovery(errorMessage?: string): Promise<UnauthorizedDisposition> {
    this.lastError = errorMessage;

    if (this.config.tryRefresh) {
      this.setPhase("refreshing", errorMessage);
      try {
        const ok = await this.config.tryRefresh();
        if (ok) {
          this.setPhase("idle");
          this.config.onSettled?.(true);
          return "retry";
        }
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
      }
    }

    this.setPhase("reauth", this.lastError);
    this.config.onReauthRequired?.();

    return new Promise<UnauthorizedDisposition>((resolve) => {
      this.reauthWaiters.push({ resolve });
    });
  }
}

/** Process-wide gate (one per SPA bundle). */
export const authGate = new AuthGateCoordinator();

/**
 * Run an async request; on 401, recover via AuthGate and retry once.
 * `isUnauthorized` defaults to checking `status === 401` or `statusCode === 401`.
 */
export async function withAuthGateRetry<T>(
  execute: () => Promise<T>,
  options?: {
    isUnauthorized?: (error: unknown) => boolean;
    /** Skip gate (e.g. refresh / sso / login endpoints). */
    bypass?: boolean;
  },
): Promise<T> {
  if (options?.bypass) return execute();

  await authGate.waitIfBlocked();

  try {
    return await execute();
  } catch (error) {
    if (!(options?.isUnauthorized ?? defaultIsUnauthorized)(error)) throw error;
    const disposition = await authGate.handleUnauthorized(messageOf(error));
    if (disposition !== "retry") throw error;
    return execute();
  }
}

function defaultIsUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return e.status === 401 || e.statusCode === 401 || e.response?.status === 401;
}

function messageOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}
