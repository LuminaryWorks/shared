import {
  AuthMailDeliveryError,
  AuthMailNotConfiguredError,
  AuthMailUnknownOutcomeError,
  ProviderAttemptError,
} from "./errors";
import { MemoryIdempotencyStore } from "./idempotency";
import { sendWithChain } from "./chain";
import type { AuthMailMessage, ChainProvider, EmailProvider } from "./types";

function message(): AuthMailMessage {
  return {
    from: "auth@luminaryworks.dev",
    fromName: "LuminaryWorks",
    to: "user@example.com",
    subject: "code",
    text: "123456",
    usage: "auth",
    idempotencyKey: "key-1",
  };
}

function provider(
  id: string,
  send: EmailProvider["send"],
  kind: EmailProvider["kind"] = "resend",
): EmailProvider {
  return { id, kind, send };
}

function chainProvider(
  emailProvider: EmailProvider,
  overrides: Partial<ChainProvider> = {},
): ChainProvider {
  return {
    provider: emailProvider,
    usage: "auth",
    enabled: true,
    priority: 1,
    dailyQuota: 100,
    monthlyQuota: 3000,
    sentToday: 0,
    sentThisMonth: 0,
    ...overrides,
  };
}

describe("sendWithChain", () => {
  it("does not send a second time after success", async () => {
    const send = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [chainProvider(provider("resend", send.fn))];

    const first = await sendWithChain({ message: message(), providers, idempotency });
    const second = await sendWithChain({ message: message(), providers, idempotency });

    expect(first.idempotentReplay).toBe(false);
    expect(second).toEqual({
      providerId: "resend",
      providerMessageId: "m1",
      idempotentReplay: true,
    });
    expect(send.calls).toBe(1);
  });

  it("does not fail over when the outcome is unknown", async () => {
    const primary = viSend(() => {
      throw new ProviderAttemptError("timeout", { unknownOutcome: true });
    });
    const fallback = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [
      chainProvider(provider("resend", primary.fn), { priority: 1 }),
      chainProvider(provider("brevo", fallback.fn, "brevo"), { priority: 2 }),
    ];

    await expect(sendWithChain({ message: message(), providers, idempotency })).rejects.toBeInstanceOf(
      AuthMailUnknownOutcomeError,
    );
    await expect(sendWithChain({ message: message(), providers, idempotency })).rejects.toBeInstanceOf(
      AuthMailUnknownOutcomeError,
    );

    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it("switches at 95% quota and fails over on a definite quota response", async () => {
    const resend = viSend(() => {
      throw new ProviderAttemptError("quota", { quotaExhausted: true });
    });
    const brevo = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [
      chainProvider(provider("resend", resend.fn), { priority: 1, sentToday: 95, dailyQuota: 100 }),
      chainProvider(provider("brevo", brevo.fn, "brevo"), { priority: 2 }),
    ];

    const result = await sendWithChain({ message: message(), providers, idempotency });
    expect(result.providerId).toBe("brevo");
    expect(resend.calls).toBe(0);
    expect(brevo.calls).toBe(1);
  });

  it("fails over a retryable rejection to the next provider exactly once", async () => {
    const resend = viSend(() => {
      throw new ProviderAttemptError("HTTP 429", { retryable: true });
    });
    const brevo = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [
      chainProvider(provider("resend", resend.fn), { priority: 1, dailyQuota: 0, monthlyQuota: 0 }),
      chainProvider(provider("brevo", brevo.fn, "brevo"), { priority: 2 }),
    ];

    const result = await sendWithChain({ message: message(), providers, idempotency });
    expect(result.providerId).toBe("brevo");
    expect(resend.calls).toBe(1);
    expect(brevo.calls).toBe(1);
  });

  it("stops on a non-retryable rejection", async () => {
    const resend = viSend(() => {
      throw new ProviderAttemptError("bad from", { retryable: false });
    });
    const brevo = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [
      chainProvider(provider("resend", resend.fn)),
      chainProvider(provider("brevo", brevo.fn, "brevo"), { priority: 2 }),
    ];

    await expect(sendWithChain({ message: message(), providers, idempotency })).rejects.toBeInstanceOf(
      AuthMailDeliveryError,
    );
    expect(brevo.calls).toBe(0);
  });

  it("fails when nothing is configured", async () => {
    const idempotency = new MemoryIdempotencyStore();
    await expect(
      sendWithChain({ message: message(), providers: [], idempotency }),
    ).rejects.toBeInstanceOf(AuthMailNotConfiguredError);
  });

  it("ignores product quota when sending auth mail", async () => {
    const product = viSend();
    const auth = viSend();
    const idempotency = new MemoryIdempotencyStore();
    const providers = [
      chainProvider(provider("product-brevo", product.fn, "brevo"), {
        usage: "product",
        priority: 1,
      }),
      chainProvider(provider("auth-resend", auth.fn), { priority: 2 }),
    ];

    const result = await sendWithChain({ message: message(), providers, idempotency });
    expect(result.providerId).toBe("auth-resend");
    expect(product.calls).toBe(0);
  });
});

function viSend(impl?: () => { providerMessageId: string } | never): {
  fn: EmailProvider["send"];
  calls: number;
} {
  const state = { calls: 0 };
  const fn: EmailProvider["send"] = async () => {
    state.calls += 1;
    if (impl) return impl();
    return { providerMessageId: "m1" };
  };
  return {
    fn,
    get calls() {
      return state.calls;
    },
  };
}
