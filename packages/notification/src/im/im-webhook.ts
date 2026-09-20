import { createHmac } from "node:crypto";

/** Group-robot channels. SMS stays product-specific until a provider contract exists. */
export type ImChannel = "wecom" | "feishu" | "dingtalk";

export interface ImWebhookMessage {
  channel: ImChannel;
  webhookUrl: string;
  /** Body text. WeCom/DingTalk send markdown; Feishu sends plain text. */
  text: string;
  title?: string;
  /** DingTalk optional sign secret. Ignored by WeCom and Feishu. */
  secret?: string;
}

export interface ImWebhookResult {
  delivered: boolean;
  status?: number;
  error?: string;
  /** Origin + path. Feishu hook tokens are stripped. */
  target: string | null;
}

export function redactImWebhookUrl(url: string, channel: ImChannel): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    if (channel === "feishu") path = path.replace(/\/hook\/[^/]+$/, "/hook/***");
    return `${u.origin}${path}`;
  } catch {
    return `(${channel})`;
  }
}

export function imBodyOk(channel: ImChannel, bodyText: string): boolean {
  if (!bodyText.trim()) return true;
  try {
    const body = JSON.parse(bodyText) as {
      errcode?: number;
      code?: number;
      StatusCode?: number;
    };
    if (channel === "wecom" && typeof body.errcode === "number") return body.errcode === 0;
    if (channel === "feishu") {
      if (typeof body.code === "number") return body.code === 0;
      if (typeof body.StatusCode === "number") return body.StatusCode === 0;
    }
  } catch {
    return false;
  }
  return true;
}

export function buildImWebhookRequest(
  message: ImWebhookMessage,
  now = Date.now(),
): { url: string; body: Record<string, unknown>; headers: Record<string, string> } {
  const url = message.webhookUrl.trim();
  if (!url) throw new Error("webhookUrl is required");
  const title = (message.title ?? "LuminaryWorks").slice(0, 64);
  const text = message.text;
  const headers = { "Content-Type": "application/json" };
  if (message.channel === "wecom") {
    return {
      url,
      headers,
      body: { msgtype: "markdown", markdown: { content: text } },
    };
  }
  if (message.channel === "feishu") {
    return {
      url,
      headers,
      body: { msg_type: "text", content: { text: title ? `${title}\n${text}` : text } },
    };
  }
  let signed = url;
  const secret = message.secret?.trim();
  if (secret) {
    const stringToSign = `${now}\n${secret}`;
    const sign = createHmac("sha256", secret).update(stringToSign).digest("base64");
    const sep = signed.includes("?") ? "&" : "?";
    signed = `${signed}${sep}timestamp=${now}&sign=${encodeURIComponent(sign)}`;
  }
  return {
    url: signed,
    headers,
    body: { msgtype: "markdown", markdown: { title, text } },
  };
}

export async function sendImWebhook(
  message: ImWebhookMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<ImWebhookResult> {
  const req = buildImWebhookRequest(message);
  const target = redactImWebhookUrl(message.webhookUrl, message.channel);
  try {
    const res = await fetchImpl(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(4_000),
    });
    const bodyText = typeof res.text === "function" ? await res.text() : "";
    if (res.ok && imBodyOk(message.channel, bodyText)) {
      return { delivered: true, status: res.status, target };
    }
    const snippet = bodyText.replace(/\s+/g, " ").slice(0, 180);
    return {
      delivered: false,
      status: res.status,
      target,
      error: snippet ? `${message.channel} HTTP ${res.status} ${snippet}` : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      delivered: false,
      target,
      error: (err as Error).message || "network error",
    };
  }
}
