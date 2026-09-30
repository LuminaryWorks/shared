import type { IdempotencyRecord } from "./types";

export class ProviderAttemptError extends Error {
  readonly unknownOutcome: boolean;
  readonly quotaExhausted: boolean;
  readonly retryable: boolean;

  constructor(
    message: string,
    flags: {
      unknownOutcome?: boolean;
      quotaExhausted?: boolean;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "ProviderAttemptError";
    this.unknownOutcome = flags.unknownOutcome === true;
    this.quotaExhausted = flags.quotaExhausted === true;
    this.retryable = flags.retryable === true || this.quotaExhausted;
  }
}

export class AuthMailNotConfiguredError extends Error {
  constructor(message = "No email provider is configured") {
    super(message);
    this.name = "AuthMailNotConfiguredError";
  }
}

export class AuthMailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthMailDeliveryError";
  }
}

/** The provider may already have accepted the message. Do not fail over. */
export class AuthMailUnknownOutcomeError extends Error {
  readonly record: IdempotencyRecord;

  constructor(record: IdempotencyRecord) {
    super(`Email delivery outcome is unknown for ${record.key}`);
    this.name = "AuthMailUnknownOutcomeError";
    this.record = record;
  }
}
