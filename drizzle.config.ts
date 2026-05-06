import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Neon上のDDL（docs/SCHEMA.sql）が真実の源。drizzle-kitは型同期と差分確認に利用する。
  strict: true,
  verbose: true,
});
