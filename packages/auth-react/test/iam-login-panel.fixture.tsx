import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createLoginExperienceAdapter, HeadlessLoginPanel } from "../dist/index.js";

const provider = new URLSearchParams(window.location.search).get("provider") || "logto";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  createElement(HeadlessLoginPanel, {
    config: {
      issuer: "http://idp.test/oidc",
      clientId: "spa-fixture",
      redirectUri: "http://app.test/auth/callback",
      iamProvider: provider,
    },
    productName: `IAM ${provider}`,
    experienceAdapter: createLoginExperienceAdapter(provider),
    showSocialConnectors: false,
    mode: "redirect",
  }),
);
