import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";
import { sassPlugin } from "esbuild-sass-plugin";

const outDir = "dist";
const styleId = "lw-auth-react-headless-login";

function injectCssIntoBundle(): void {
  const cssPath = path.join(outDir, "index.css");
  const jsPath = path.join(outDir, "index.js");
  if (!fs.existsSync(cssPath) || !fs.existsSync(jsPath)) return;

  const css = fs.readFileSync(cssPath, "utf8");
  const js = fs.readFileSync(jsPath, "utf8");
  if (js.includes(styleId)) return;

  const banner = `(function(){if(typeof document==="undefined")return;var id=${JSON.stringify(styleId)};if(document.getElementById(id))return;var s=document.createElement("style");s.id=id;s.textContent=${JSON.stringify(css)};document.head.appendChild(s);})();\n`;
  fs.writeFileSync(jsPath, banner + js);

  // Stable export path for consumers that prefer an explicit CSS import (SSR / no FOUC control).
  fs.copyFileSync(cssPath, path.join(outDir, "style.css"));
  if (fs.existsSync(`${cssPath}.map`)) {
    fs.copyFileSync(`${cssPath}.map`, path.join(outDir, "style.css.map"));
  }
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir,
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "oidc-client-ts"],
  esbuildPlugins: [
    sassPlugin({
      filter: /\.module\.scss$/,
      type: "local-css",
    }),
  ],
  onSuccess: async () => {
    injectCssIntoBundle();
  },
});
