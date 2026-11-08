import assert from "node:assert/strict";
import test from "node:test";
import { filterNav, navLabel, resolveSelectedNavKey } from "../dist/nav.js";

test("filterNav drops hidden items and empty groups", () => {
  const groups = filterNav([
    {
      key: "commerce",
      labelKey: "nav.groupCommerce",
      items: [
        { key: "/", to: "/", labelKey: "nav.overview", icon: "overview" },
        { key: "/catalog", to: "/catalog", visible: false },
      ],
    },
    {
      key: "trust",
      visible: false,
      items: [{ key: "/legal", to: "/legal" }],
    },
    {
      key: "empty",
      items: [{ key: "/gone", to: "/gone", visible: false }],
    },
  ]);
  assert.deepEqual(
    groups.map((group) => group.key),
    ["commerce"],
  );
  assert.equal(groups[0]?.items.length, 1);
  assert.equal(groups[0]?.items[0]?.icon, "overview");
});

test("navLabel prefers an injected label, then t(labelKey)", () => {
  assert.equal(navLabel((key) => `t:${key}`, "Ready", "nav.overview"), "Ready");
  assert.equal(navLabel((key) => `t:${key}`, undefined, "nav.overview"), "t:nav.overview");
  assert.equal(navLabel(undefined, undefined, "nav.overview"), "nav.overview");
  assert.equal(navLabel(undefined, undefined, undefined), "");
});

test("resolveSelectedNavKey matches child paths and keeps root exact", () => {
  const items = [
    { key: "/", to: "/" },
    { key: "/commerce", to: "/commerce" },
    { key: "/commerce/channels", to: "/commerce/channels" },
    { key: "/orders", to: "/orders" },
  ];
  assert.equal(resolveSelectedNavKey(items, "/"), "/");
  assert.equal(
    resolveSelectedNavKey(items, "/commerce/channels/setup/stripe"),
    "/commerce/channels",
  );
  assert.equal(resolveSelectedNavKey(items, "/commerce/reports"), "/commerce");
  assert.equal(resolveSelectedNavKey(items, "/missing"), "/");
  assert.equal(resolveSelectedNavKey([], "/missing"), "/");
});
