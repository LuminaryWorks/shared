import { defineConfig } from "@rstest/core";

export default defineConfig({
  testEnvironment: "node",
  globals: true,
  include: ["src/**/*.spec.ts"],
  source: {
    decorators: {
      version: "legacy",
    },
  },
  tools: {
    swc: {
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    },
  },
});
