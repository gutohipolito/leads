import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignorar tracker e seus módulos (são arquivos parciais de JS puro e geram erros no linter do Next.js)
    "src/tracker/**",
    "src/tracker-source.js",
    "public/tracker.js"
  ]),
]);

export default eslintConfig;
