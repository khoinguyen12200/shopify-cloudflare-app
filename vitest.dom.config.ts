import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // React DOM interaction tests need browser APIs unavailable in the Workers pool.
  resolve: { alias: { "~": path.resolve(import.meta.dirname, "app") } },
  test: {
    environment: "jsdom",
    include: [
      "app/components/support/AttachmentPicker.render.test.tsx",
      "app/routes/app/support/use-pending-uploads.test.tsx",
      "app/routes/app/support/dom-outbound-guard.test.ts",
    ],
    setupFiles: ["app/test/dom-outbound-guard.setup.ts"],
  },
});
