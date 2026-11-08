import assert from "node:assert/strict";
import test from "node:test";
import {
  requestConfirm,
  resetConfirmQueue,
  settleConfirm,
  subscribeConfirm,
} from "../dist/confirm-queue.js";

test("returns false when no confirm host is subscribed", async () => {
  resetConfirmQueue();
  assert.equal(await requestConfirm("Refund?"), false);
});

test("queues a second confirm until the first settles", async () => {
  resetConfirmQueue();
  const seen = [];
  const stop = subscribeConfirm((request) => {
    seen.push(request?.message ?? null);
  });
  try {
    assert.deepEqual(seen, [null]);
    const first = requestConfirm("one", { typed: "ENABLE" });
    const second = requestConfirm("two", { summary: ["sku"] });
    assert.equal(seen.at(-1), "one");
    settleConfirm(true);
    assert.equal(await first, true);
    assert.equal(seen.at(-1), "two");
    settleConfirm(false);
    assert.equal(await second, false);
    assert.equal(seen.at(-1), null);
  } finally {
    stop();
    resetConfirmQueue();
  }
});

test("resetConfirmQueue resolves leftovers as false", async () => {
  resetConfirmQueue();
  const stop = subscribeConfirm(() => {});
  const pending = requestConfirm("cleanup");
  resetConfirmQueue();
  assert.equal(await pending, false);
  stop();
});
