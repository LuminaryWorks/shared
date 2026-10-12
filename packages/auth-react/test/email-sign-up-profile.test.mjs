import assert from "node:assert/strict";
import test from "node:test";
import { LogtoExperienceAdapter } from "../dist/index.js";

function jsonResponse(status, data) {
  const text = data == null ? "" : JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async text() {
      return text;
    },
  };
}

function installFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: String(url), method: init?.method, body });
    return handler(String(url), body, calls);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const signUpInput = {
  apiBase: "http://localhost:3003",
  email: "634117608@qq.com",
  username: "andyzhou",
  password: "SmokeTest123",
  code: "010386",
  verificationId: "ver-1",
};

test("email sign-up saves profile before verifying, then continues after missing_profile", async () => {
  const fetchMock = installFetch((url, body) => {
    if (url.endsWith("/profile") || (url.endsWith("/identification") && !body?.verificationId)) {
      return jsonResponse(204, null);
    }
    if (url.endsWith("/verification/verification-code/verify")) {
      return jsonResponse(200, { verificationId: "ver-1" });
    }
    if (url.endsWith("/identification") && body?.verificationId) {
      return jsonResponse(422, {
        code: "user.missing_profile",
        message: "You need to provide additional info before signing-in.",
        data: { missingProfile: ["username", "password"] },
      });
    }
    if (url.endsWith("/submit")) {
      return jsonResponse(200, { redirectTo: "http://localhost:3003/auth/callback" });
    }
    return jsonResponse(500, { message: `unexpected ${url}` });
  });

  try {
    const result = await new LogtoExperienceAdapter().experienceEmailPasswordSignUp(signUpInput);
    assert.equal(result.redirectTo, "http://localhost:3003/auth/callback");
    const order = fetchMock.calls.map((call) => {
      const path = new URL(call.url).pathname.replace("/api/experience", "");
      if (path === "/profile") return `profile:${call.body.type}`;
      if (path === "/identification") return call.body?.verificationId ? "identify:code" : "identify:session";
      return path;
    });
    assert.deepEqual(order, [
      "profile:username",
      "profile:password",
      "/verification/verification-code/verify",
      "identify:code",
      "identify:session",
      "/submit",
    ]);
  } finally {
    fetchMock.restore();
  }
});

test("taken username is reported before the verification code is consumed", async () => {
  const fetchMock = installFetch((url) => {
    if (url.endsWith("/profile")) {
      return jsonResponse(422, {
        code: "user.username_already_in_use",
        message: "This username is already in use.",
      });
    }
    return jsonResponse(500, { message: `unexpected ${url}` });
  });

  try {
    await assert.rejects(
      () => new LogtoExperienceAdapter().experienceEmailPasswordSignUp(signUpInput),
      (error) => {
        assert.equal(error.code, "user.username_already_in_use");
        return true;
      },
    );
    assert.equal(
      fetchMock.calls.some((call) => call.url.includes("verification-code/verify")),
      false,
    );
  } finally {
    fetchMock.restore();
  }
});

test("email sign-up still surfaces identifier conflicts after the code is verified", async () => {
  const fetchMock = installFetch((url) => {
    if (url.endsWith("/profile")) return jsonResponse(204, null);
    if (url.endsWith("/verification/verification-code/verify")) {
      return jsonResponse(200, { verificationId: "ver-1" });
    }
    if (url.endsWith("/identification")) {
      return jsonResponse(422, {
        code: "user.email_already_in_use",
        message: "Email already in use.",
      });
    }
    return jsonResponse(500, { message: `unexpected ${url}` });
  });

  try {
    await assert.rejects(
      () => new LogtoExperienceAdapter().experienceEmailPasswordSignUp(signUpInput),
      /Email already in use/,
    );
  } finally {
    fetchMock.restore();
  }
});
