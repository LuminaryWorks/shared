import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";

const outFile = path.join("dist", "index.js");

export default defineConfig({
  entry: {
    index: "src/index.ts",
    helpers: "src/helpers.ts",
  },
  format: ["cjs"],
  outDir: "dist",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "antd",
    /^antd\//,
    "@ant-design/icons",
    "@luminaryworks/ai-client",
    /^@luminaryworks\/ai-client\//,
  ],
  onSuccess: async () => {
    if (!fs.existsSync(outFile)) return;
    const js = fs.readFileSync(outFile, "utf8");
    if (js.includes('"use client"')) return;
    fs.writeFileSync(outFile, `"use client";\n${js}`);
  },
});
