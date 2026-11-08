export type ConfirmOptions = {
  typed?: string;
  acknowledge?: string;
  summary?: string[];
};

export type ConfirmRequest = ConfirmOptions & {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
};

type Listener = (request: ConfirmRequest | null) => void;

let seq = 0;
let active: ConfirmRequest | null = null;
const pending: ConfirmRequest[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  const current = active;
  for (const listener of listeners) listener(current);
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolves `false` when no `ConfirmDialogHost` is subscribed. Later requests wait in order. */
export function requestConfirm(
  message: string,
  options?: ConfirmOptions,
): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      id: ++seq,
      message,
      ...options,
      resolve,
    };
    if (!active) {
      active = request;
      emit();
    } else {
      pending.push(request);
    }
  });
}

export function settleConfirm(ok: boolean): void {
  if (!active) return;
  const current = active;
  active = pending.shift() ?? null;
  current.resolve(ok);
  emit();
}

/** Rejects queued confirms and detaches listeners. For tests and host teardown. */
export function resetConfirmQueue(): void {
  const leftover: ConfirmRequest[] = [];
  if (active) leftover.push(active);
  leftover.push(...pending);
  active = null;
  pending.length = 0;
  listeners.clear();
  for (const request of leftover) request.resolve(false);
}
