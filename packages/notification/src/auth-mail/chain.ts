import {
  AuthMailDeliveryError,
  AuthMailNotConfiguredError,
  AuthMailUnknownOutcomeError,
  ProviderAttemptError,
} from "./errors";
import { selectProviders } from "./resolve";
import type {
  AuthMailMessage,
  AuthMailSendResult,
  ChainProvider,
  IdempotencyStore,
} from "./types";

/**
 * Send once. A prior success replays. A timeout or in-flight attempt does not
 * call another provider. Only a definite rejection or quota response fails over.
 */
export async function sendWithChain(input: {
  message: AuthMailMessage;
  providers: ChainProvider[];
  idempotency: IdempotencyStore;
  onAccepted?: (providerId: string) => Promise<void>;
}): Promise<AuthMailSendResult> {
  const key = input.message.idempotencyKey;
  let claimed = await input.idempotency.claim(key);
  if (!claimed.owned && claimed.record.status === "failed") {
    claimed = await input.idempotency.reclaimFailed(key);
  }
  if (!claimed.owned) {
    if (
      claimed.record.status === "sent" &&
      claimed.record.providerId &&
      claimed.record.providerMessageId
    ) {
      return {
        providerId: claimed.record.providerId,
        providerMessageId: claimed.record.providerMessageId,
        idempotentReplay: true,
      };
    }
    throw new AuthMailUnknownOutcomeError(claimed.record);
  }

  const candidates = selectProviders(input.providers, input.message.usage);
  if (candidates.length === 0) {
    await input.idempotency.save({ key, status: "failed" });
    throw new AuthMailNotConfiguredError("No email provider is configured under quota");
  }

  let last: Error | undefined;
  for (const candidate of candidates) {
    try {
      const result = await candidate.provider.send(input.message);
      const providerMessageId = result.providerMessageId || "accepted";
      await input.idempotency.save({
        key,
        status: "sent",
        providerId: candidate.provider.id,
        providerMessageId,
      });
      if (input.onAccepted) {
        try {
          await input.onAccepted(candidate.provider.id);
        } catch {
          // The provider already accepted. Quota drift is preferable to a second send.
        }
      }
      return {
        providerId: candidate.provider.id,
        providerMessageId,
        idempotentReplay: false,
      };
    } catch (err) {
      const attempt =
        err instanceof ProviderAttemptError
          ? err
          : new ProviderAttemptError(err instanceof Error ? err.message : "email send failed", {
              unknownOutcome: true,
            });
      if (attempt.unknownOutcome) {
        const record = {
          key,
          status: "unknown" as const,
          providerId: candidate.provider.id,
        };
        await input.idempotency.save(record);
        throw new AuthMailUnknownOutcomeError(record);
      }
      if (attempt.retryable) {
        last = attempt;
        continue;
      }
      await input.idempotency.save({
        key,
        status: "failed",
        providerId: candidate.provider.id,
      });
      throw new AuthMailDeliveryError(attempt.message);
    }
  }

  await input.idempotency.save({ key, status: "failed" });
  throw new AuthMailDeliveryError(last?.message ?? "all email providers failed");
}
