// ESLint 10 flat config.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      // Vendored agent skills + editor/agent config — not our source.
      ".agents/**",
      ".claude/**",
      ".cursor/**",
      ".gemini/**",
      ".shopify-home/**",
      "agent/**",
      "build/**",
      ".react-router/**",
      "node_modules/**",
      "drizzle/**",
      "extensions/**",
      "app/types/**",
      "worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  // `configs.flat[...]` is the flat-config variant; the top-level
  // `configs["recommended-latest"]` is still eslintrc-shaped (plugins as an
  // array), which ESLint 10 rejects.
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      // `const { passwordHash: _x, ...safe } = user` is how a field is
      // deliberately DISCARDED. Allow the underscore convention so stripping a
      // secret from an object does not need an eslint-disable.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // The Workers runtime has no `process`; app code must read config from
      // the `env` binding via getEnv(). Config files (below) are exempt —
      // they run in Node under Vite/the CLI.
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "No process.env in the Workers runtime — use getEnv() from ~/request-context.server.",
        },
      ],
    },
  },
  {
    // Build-time config + Node scripts: these DO run in Node.
    files: [
      "*.config.ts",
      "*.config.js",
      ".graphqlrc.ts",
      "react-router.config.ts",
      "scripts/**/*.mjs",
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-restricted-globals": "off",
      // Same underscore convention as the app code: `const { env: _env, ...rest }`
      // is how a key is deliberately discarded. Repeated here because the .ts
      // block above does not match .mjs scripts — and it must be the
      // typescript-eslint rule, since that plugin's recommended config applies to
      // these files too and would otherwise win.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
