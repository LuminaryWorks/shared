import type { EntitlementSnapshot, TrialPolicy } from "./types";

export function isTrialEligible(snapshot: Pick<EntitlementSnapshot, "trial">): boolean {
  return snapshot.trial.eligible;
}

export function supportsTrial(policy: TrialPolicy): boolean {
  return policy === "standard_7d";
}
