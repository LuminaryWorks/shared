import assert from "node:assert/strict";
import test from "node:test";
import { ExperienceApiError, toLoginErrorLine } from "../dist/index.js";

const labels = {
  codeSendFailed: "The verification code could not be sent. Try again in a moment.",
  actionFailed: "That didn't work. Try again in a moment.",
};

test("connector dumps become one send-code line", () => {
  const dumped = new ExperienceApiError(
    400,
    "connector.general",
    'Error occurred in connector: {"code":"ECONNREFUSED","url":"http://host.docker.internal:3090/internal/logto/email"}',
  );
  assert.equal(toLoginErrorLine(dumped, labels, "send-code"), labels.codeSendFailed);
  assert.equal(toLoginErrorLine(dumped, labels, "register").includes("ECONNREFUSED"), false);
});

test("short validation messages stay visible", () => {
  assert.equal(
    toLoginErrorLine(new Error("Password must be 8–32 characters"), labels, "register"),
    "Password must be 8–32 characters",
  );
});
