import { completeLocal, streamLocal } from "./providers";
import type {
  AiClientOptions,
  AiCompleteResult,
  CompleteChatInput,
  EmbedInput,
  EmbedResult,
  StreamEvent,
} from "./types";

export class LuminaryAiClient {
  constructor(private readonly options: AiClientOptions = {}) {}

  private platformUrl(): string | undefined {
    const fromOpt = this.options.baseUrl?.trim();
    const fromEnv = process.env.LUMINARY_AI_BASE_URL?.trim();
    return fromOpt || fromEnv || undefined;
  }

  async complete(input: CompleteChatInput): Promise<AiCompleteResult> {
    const platform = this.platformUrl();
    if (platform) return this.completeViaPlatform(platform, input);
    const eph = input.ephemeral;
    if (!eph) throw new Error("ephemeral provider required when LUMINARY_AI_BASE_URL is unset");
    return completeLocal({
      providerType: eph.providerType,
      baseUrl: eph.baseUrl,
      model: eph.model,
      secret: eph.secret,
      messages: input.messages,
      jsonMode: Boolean(input.jsonSchema),
      maxTokens: input.maxTokens,
      signal: input.signal,
    });
  }

  async *stream(input: CompleteChatInput): AsyncGenerator<StreamEvent> {
    const platform = this.platformUrl();
    if (platform) {
      yield* this.streamViaPlatform(platform, input);
      return;
    }
    const eph = input.ephemeral;
    if (!eph) throw new Error("ephemeral provider required when LUMINARY_AI_BASE_URL is unset");
    yield* streamLocal({
      providerType: eph.providerType,
      baseUrl: eph.baseUrl,
      model: eph.model,
      secret: eph.secret,
      messages: input.messages,
      signal: input.signal,
    });
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    const platform = this.platformUrl();
    if (platform) {
      const res = await fetch(`${platform.replace(/\/$/, "")}/v1/embeddings`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`AI platform embed ${res.status}`);
      return (await res.json()) as EmbedResult;
    }
    const dim = 8;
    return {
      vectors: input.texts.map((t) => hashEmbed(t, dim)),
      model: input.model || "local-hash",
      usage: { promptTokens: input.texts.join(" ").length, completionTokens: 0 },
      traceId: `trc_emb_${Date.now().toString(36)}`,
    };
  }

  async transcribe(_audio: Buffer, _mime = "audio/webm"): Promise<{ text: string; traceId: string }> {
    const platform = this.platformUrl();
    if (!platform) {
      return { text: "", traceId: `trc_stt_${Date.now().toString(36)}` };
    }
    const res = await fetch(`${platform.replace(/\/$/, "")}/v1/audio/transcribe`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ mime: _mime, bytes: _audio.length }),
    });
    if (!res.ok) throw new Error(`STT ${res.status}`);
    return (await res.json()) as { text: string; traceId: string };
  }

  async synthesize(text: string): Promise<{ audioBase64: string; mime: string; traceId: string }> {
    const platform = this.platformUrl();
    if (!platform) {
      return { audioBase64: "", mime: "audio/mpeg", traceId: `trc_tts_${Date.now().toString(36)}` };
    }
    const res = await fetch(`${platform.replace(/\/$/, "")}/v1/audio/synthesize`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return (await res.json()) as { audioBase64: string; mime: string; traceId: string };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`;
    return headers;
  }

  private async completeViaPlatform(
    baseUrl: string,
    input: CompleteChatInput,
  ): Promise<AiCompleteResult> {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/complete`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        connectionUid: input.connectionUid,
        ephemeral: input.ephemeral,
        messages: input.messages,
        jsonSchema: input.jsonSchema,
        maxTokens: input.maxTokens,
      }),
      signal: input.signal,
    });
    if (!res.ok) throw new Error(`AI platform error ${res.status}`);
    return (await res.json()) as AiCompleteResult;
  }

  private async *streamViaPlatform(
    baseUrl: string,
    input: CompleteChatInput,
  ): AsyncGenerator<StreamEvent> {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/stream`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        connectionUid: input.connectionUid,
        ephemeral: input.ephemeral,
        messages: input.messages,
      }),
      signal: input.signal,
    });
    if (!res.ok || !res.body) throw new Error(`AI platform stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          yield JSON.parse(line.slice(5).trim()) as StreamEvent;
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export function createAIClient(options: AiClientOptions = {}): LuminaryAiClient {
  return new LuminaryAiClient(options);
}

function hashEmbed(text: string, dim: number): number[] {
  const out = new Array<number>(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    out[i % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}
