import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@rstest/core";
import { CONTROL_PROFILES, DEPLOYMENT_STAGES } from "./constants";
import { CONTROL_MANIFEST_SCHEMA_ID, controlManifestJsonSchema } from "./schema";

const SCHEMA_FILE = join(__dirname, "..", "schema", "control-manifest.schema.json");

describe("JSON Schema", () => {
  test("enumerates every profile and stage", () => {
    expect(controlManifestJsonSchema.properties.profile.enum).toEqual([...CONTROL_PROFILES]);
    expect(controlManifestJsonSchema.properties.stage.enum).toEqual([...DEPLOYMENT_STAGES]);
  });

  test("pins identity degradation to fail_closed", () => {
    expect(controlManifestJsonSchema.properties.degradation.properties.identity.const).toBe(
      "fail_closed",
    );
  });

  test("requires an explicit contract version on every service", () => {
    expect(controlManifestJsonSchema.properties.services.properties.entitlement.required).toEqual([
      "url",
      "required",
      "apiVersion",
      "schemaVersion",
    ]);
  });

  test("committed schema file matches the module and has no BOM", () => {
    const raw = readFileSync(SCHEMA_FILE, "utf8");
    expect(raw.charCodeAt(0)).not.toBe(0xfeff);
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(JSON.parse(JSON.stringify(controlManifestJsonSchema)));
    expect(JSON.parse(raw).$id).toBe(CONTROL_MANIFEST_SCHEMA_ID);
  });
});
