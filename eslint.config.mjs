import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "coverage/**", "data/**", "backups/**", "next-env.d.ts"]),
  {
    // ARCHITECTURE §3: the domain layer is pure business logic. It must never depend on
    // the voice/LLM layer, HTTP, the app, or any LLM SDK (the LLM never touches inventory).
    files: ["src/server/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/server/voice/**", "**/voice/**"], message: "domain must not import the voice/LLM layer." },
            { group: ["**/server/http/**", "**/http/**"], message: "domain must not import HTTP helpers." },
            { group: ["@/app/**", "@/components/**", "@/client/**"], message: "domain must not import UI/app code." },
            { group: ["next", "next/*", "@anthropic-ai/*"], message: "domain must not import Next.js or LLM SDKs." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
