import { createHash } from "node:crypto";
import { authHeadersForProvider } from "./models";
import { resolveChatCompletionsUrl } from "./urls";
import type { SynthesizeResult, TranscribeResult } from "./types";

export const MAX_SPEECH_AUDIO_BYTES = 8 * 1024 * 1024;

export function providerSupportsSpeech(providerType: string): boolean {
  return ["openai", "openai-compatible", "qwen", "doubao", "gemini"].includes(providerType);
}

export function defaultSttModel(providerType: string): string {
  switch (providerType) {
    case "qwen":
      return "qwen3-asr-flash";
    case "gemini":
      return "gemini-2.5-flash";
    case "doubao":
      return "whisper-1";
    default:
      return "whisper-1";
  }
}

export function defaultTtsModel(providerType: string): string {
  switch (providerType) {
    case "qwen":
      return "qwen3-tts-flash";
    case "gemini":
      return "gemini-2.5-flash-preview-tts";
    case "doubao":
      return "tts-1";
    default:
      return "tts-1";
  }
}

export function ttsCacheKey(input: {
  providerType: string;
  model: string;
  voice?: string;
  locale?: string;
  speed?: number;
  text: string;
}): string {
  const normalized = input.text.replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(
      [
        input.providerType,
        input.model,
        input.voice ?? "alloy",
        input.locale ?? "",
        String(input.speed ?? 1),
        normalized,
      ].join("|"),
    )
    .digest("hex");
}

export function decodeAudioBase64(audioBase64: string): Buffer {
  const buf = Buffer.from(audioBase64, "base64");
  if (!buf.length) throw Object.assign(new Error("empty audio payload"), { code: "AI_VALIDATION" });
  if (buf.length > MAX_SPEECH_AUDIO_BYTES) {
    throw Object.assign(new Error("audio exceeds 8MB limit"), { code: "AI_VALIDATION" });
  }
  return buf;
}

function filenameForMime(mime: string): string {
  switch (mime) {
    case "audio/wav":
      return "speech.wav";
    case "audio/mpeg":
      return "speech.mp3";
    case "audio/mp4":
      return "speech.m4a";
    default:
      return "speech.webm";
  }
}

function resolveAudioEndpoint(
  providerType: string,
  baseUrl: string | null | undefined,
  kind: "transcriptions" | "speech",
): string | null {
  const chat = resolveChatCompletionsUrl(providerType, baseUrl);
  if (!chat?.endsWith("/chat/completions")) return null;
  return `${chat.slice(0, -"/chat/completions".length)}/audio/${kind}`;
}

function pickSpeechModel(conn: { providerType: string; model: string }, purpose: "stt" | "tts"): string {
  const current = conn.model.trim().toLowerCase();
  if (purpose === "stt") {
    if (/whisper|asr|transcrib|speech|gpt-4o-transcribe/.test(current)) return conn.model;
    return defaultSttModel(conn.providerType);
  }
  if (/tts|speech/.test(current)) return conn.model;
  return defaultTtsModel(conn.providerType);
}

export async function transcribeLocal(input: {
  providerType: string;
  baseUrl?: string | null;
  model: string;
  secret: string;
  audio: Buffer;
  mime?: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<TranscribeResult> {
  const traceId = `trc_stt_${Date.now().toString(36)}`;
  if (!providerSupportsSpeech(input.providerType)) {
    throw Object.assign(new Error("STT not supported for this provider"), { code: "AI_PROVIDER_ERROR" });
  }
  if (input.audio.length > MAX_SPEECH_AUDIO_BYTES) {
    throw Object.assign(new Error("audio exceeds 8MB limit"), { code: "AI_VALIDATION" });
  }
  if (input.providerType === "qwen") {
    return transcribeQwen(input, traceId);
  }
  if (input.providerType === "gemini") {
    return transcribeGemini(input, traceId);
  }
  const url = resolveAudioEndpoint(input.providerType, input.baseUrl, "transcriptions");
  if (!url) {
    throw Object.assign(new Error("STT endpoint unavailable for this provider"), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const model = pickSpeechModel(input, "stt");
  const mime = input.mime || "audio/webm";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.audio)], { type: mime }), filenameForMime(mime));
  form.append("model", model);
  form.append("language", input.language || "en");
  form.append("response_format", "json");
  const headers = authHeadersForProvider(input.providerType, input.secret);
  delete headers["Content-Type"];
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form,
    signal: input.signal ?? AbortSignal.timeout(60_000),
  });
  const body = (await res.json()) as { text?: string; error?: { message?: string } };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message || `STT provider error ${res.status}`), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const text = body.text?.trim() ?? "";
  if (!text) {
    throw Object.assign(new Error("STT returned empty transcript"), { code: "AI_PROVIDER_ERROR" });
  }
  return { text, model, providerType: input.providerType, traceId };
}

async function transcribeQwen(
  input: {
    providerType: string;
    baseUrl?: string | null;
    model: string;
    secret: string;
    audio: Buffer;
    signal?: AbortSignal;
  },
  traceId: string,
): Promise<TranscribeResult> {
  const url = resolveChatCompletionsUrl(input.providerType, input.baseUrl);
  if (!url) throw Object.assign(new Error("STT endpoint unavailable"), { code: "AI_PROVIDER_ERROR" });
  const model = pickSpeechModel(input, "stt");
  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersForProvider(input.providerType, input.secret),
    signal: input.signal ?? AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: `data:;base64,${input.audio.toString("base64")}` } },
          ],
        },
      ],
      asr_options: { language: "en", enable_itn: false },
    }),
  });
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message || `STT provider error ${res.status}`), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw Object.assign(new Error("STT returned empty transcript"), { code: "AI_PROVIDER_ERROR" });
  return { text, model, providerType: input.providerType, traceId };
}

async function transcribeGemini(
  input: {
    providerType: string;
    baseUrl?: string | null;
    model: string;
    secret: string;
    audio: Buffer;
    mime?: string;
    signal?: AbortSignal;
  },
  traceId: string,
): Promise<TranscribeResult> {
  const root = (input.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const model = pickSpeechModel(input, "stt").replace(/^models\//, "");
  const mime = input.mime || "audio/webm";
  const res = await fetch(`${root}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(input.secret)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal ?? AbortSignal.timeout(60_000),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this English audio. Return only the transcript." },
            { inlineData: { mimeType: mime, data: input.audio.toString("base64") } },
          ],
        },
      ],
    }),
  });
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message || `STT provider error ${res.status}`), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (!text) throw Object.assign(new Error("STT returned empty transcript"), { code: "AI_PROVIDER_ERROR" });
  return { text, model, providerType: input.providerType, traceId };
}

export async function synthesizeLocal(input: {
  providerType: string;
  baseUrl?: string | null;
  model: string;
  secret: string;
  text: string;
  voice?: string;
  signal?: AbortSignal;
}): Promise<SynthesizeResult> {
  const traceId = `trc_tts_${Date.now().toString(36)}`;
  if (!providerSupportsSpeech(input.providerType)) {
    throw Object.assign(new Error("TTS not supported for this provider"), { code: "AI_PROVIDER_ERROR" });
  }
  const url = resolveAudioEndpoint(input.providerType, input.baseUrl, "speech");
  if (!url) {
    throw Object.assign(new Error("TTS endpoint unavailable for this provider"), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const model = pickSpeechModel(input, "tts");
  const headers = authHeadersForProvider(input.providerType, input.secret);
  const res = await fetch(url, {
    method: "POST",
    headers,
    signal: input.signal ?? AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      voice: input.voice || "alloy",
      input: input.text.slice(0, 4000),
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw Object.assign(new Error(body.error?.message || `TTS provider error ${res.status}`), {
      code: "AI_PROVIDER_ERROR",
    });
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) {
    throw Object.assign(new Error("TTS returned empty audio"), { code: "AI_PROVIDER_ERROR" });
  }
  return {
    audioBase64: buf.toString("base64"),
    mime: "audio/mpeg",
    model,
    providerType: input.providerType,
    traceId,
  };
}
