import { ProviderAttemptError } from "./errors";

export function formatMailbox(from: string, fromName?: string): string {
  const address = from.trim();
  const name = fromName?.trim();
  if (!name) return address;
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${address}>`;
}

export function classifyHttpFailure(status: number, body: string): ProviderAttemptError {
  const snippet = body.replace(/\s+/g, " ").slice(0, 180);
  const message = `email provider HTTP ${status}${snippet ? `: ${snippet}` : ""}`;
  if (status === 402 || status === 429) {
    return new ProviderAttemptError(message, { quotaExhausted: true, retryable: true });
  }
  if (status === 401 || status === 403) {
    return new ProviderAttemptError(message, { retryable: true });
  }
  if (status === 408 || status >= 500) {
    return new ProviderAttemptError(message, { unknownOutcome: true });
  }
  return new ProviderAttemptError(message, { retryable: false });
}

export async function postJson(input: {
  url: string;
  headers?: Record<string, string>;
  body: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<unknown> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(input.url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...input.headers,
      },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
    });
  } catch (err) {
    throw new ProviderAttemptError(err instanceof Error ? err.message : "email provider request failed", {
      unknownOutcome: true,
    });
  }

  const text = await response.text();
  if (!response.ok) throw classifyHttpFailure(response.status, text);
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
