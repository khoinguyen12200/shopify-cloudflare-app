import { defineConfig } from "drizzle-kit";

// D1 is SQLite. Migrations are generated from app/db/schema.ts into ./drizzle
// (`npm run db:generate`) and applied with `wrangler d1 migrations apply`
// (`npm run db:migrate:local` / `npm run db:migrate`).
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
