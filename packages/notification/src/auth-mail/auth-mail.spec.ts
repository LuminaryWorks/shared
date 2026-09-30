import { NotificationValidationError } from "../contracts";
import { assertPrivateMatchDomains, isPublicMailDomain } from "./domains";
import { buildAuthMailIdempotencyKey } from "./idempotency";
import { resolveByoProfile } from "./resolve";
import type { ByoMailProfile } from "./types";
import { createBrevoProvider } from "./providers/brevo";
import { createResendProvider } from "./providers/resend";
import { createSmtpProvider } from "./providers/smtp";
import { classifyHttpFailure } from "./http";
import { ProviderAttemptError } from "./errors";

function profile(overrides: Partial<ByoMailProfile> & Pick<ByoMailProfile, "id" | "scope">): ByoMailProfile {
  return {
    from: "auth@acme.test",
    fromName: "Acme",
    matchDomains: [],
    verified: true,
    enabled: true,
    priority: 10,
    organizationId: null,
    ...overrides,
  };
}

describe("auth mail routing", () => {
  it("builds a stable idempotency key and changes it when the code changes", () => {
    const first = buildAuthMailIdempotencyKey({
      to: "User@Example.com",
      type: "Register",
      code: "123456",
    });
    const second = buildAuthMailIdempotencyKey({
      to: "user@example.com",
      type: "Register",
      code: "123456",
    });
    const third = buildAuthMailIdempotencyKey({
      to: "user@example.com",
      type: "Register",
      code: "654321",
    });
    expect(first).toBe(second);
    expect(third).not.toBe(first);
  });

  it("rejects public match domains", () => {
    expect(isPublicMailDomain("Gmail.com")).toBe(true);
    expect(() => assertPrivateMatchDomains(["gmail.com"])).toThrow(NotificationValidationError);
    expect(assertPrivateMatchDomains(["Acme.com"])).toEqual(["acme.com"]);
  });

  it("prefers organization, then recipient domain, then deployment", () => {
    const profiles = [
      profile({
        id: "deploy",
        scope: "deployment",
        priority: 1,
        from: "deploy@luminaryworks.dev",
      }),
      profile({
        id: "domain",
        scope: "organization",
        organizationId: "other",
        matchDomains: ["acme.test"],
        priority: 5,
      }),
      profile({
        id: "org",
        scope: "organization",
        organizationId: "org-1",
        priority: 3,
        from: "org@acme.test",
      }),
    ];

    expect(
      resolveByoProfile({ organizationId: "org-1", recipient: "a@acme.test", profiles })?.id,
    ).toBe("org");
    expect(
      resolveByoProfile({ organizationId: null, recipient: "a@acme.test", profiles })?.id,
    ).toBe("domain");
    expect(
      resolveByoProfile({ recipient: "a@gmail.com", profiles })?.id,
    ).toBe("deploy");
    expect(
      resolveByoProfile({
        recipient: "a@gmail.com",
        profiles: profiles.map((item) =>
          item.scope === "deployment" ? { ...item, verified: false } : item,
        ),
      }),
    ).toBeNull();
  });
});

describe("email providers", () => {
  const mail = {
    from: "auth@luminaryworks.dev",
    fromName: "LuminaryWorks",
    to: "user@example.com",
    subject: "code",
    text: "123456",
    html: "<p>123456</p>",
    usage: "auth" as const,
    idempotencyKey: "k",
  };

  it("posts to Resend and Brevo and classifies quota versus timeout", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      calls.push({ url: String(url), headers });
      if (String(url).includes("resend")) {
        return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ messageId: "br_1" }), { status: 201 });
    };

    const resend = await createResendProvider({ apiKey: "rk", fetchImpl }).send(mail);
    const brevo = await createBrevoProvider({ apiKey: "bk", fetchImpl }).send(mail);
    expect(resend.providerMessageId).toBe("re_1");
    expect(brevo.providerMessageId).toBe("br_1");
    expect(calls[0]?.headers.authorization).toBe("Bearer rk");
    expect(calls[1]?.headers["api-key"]).toBe("bk");
    expect(classifyHttpFailure(429, "quota").quotaExhausted).toBe(true);
    expect(classifyHttpFailure(504, "timeout").unknownOutcome).toBe(true);
    expect(classifyHttpFailure(400, "bad").retryable).toBe(false);
  });

  it("sends SMTP through the injected transport and treats timeout as unknown", async () => {
    const smtp = createSmtpProvider({
      host: "smtp.example",
      sendMail: async () => ({ messageId: "smtp-1" }),
    });
    await expect(smtp.send(mail)).resolves.toEqual({ providerMessageId: "smtp-1" });

    const timingOut = createSmtpProvider({
      host: "smtp.example",
      sendMail: async () => {
        const error = new Error("timed out") as Error & { code?: string };
        error.code = "ETIMEDOUT";
        throw error;
      },
    });
    await expect(timingOut.send(mail)).rejects.toBeInstanceOf(ProviderAttemptError);
    await expect(timingOut.send(mail)).rejects.toMatchObject({ unknownOutcome: true });
  });
});
