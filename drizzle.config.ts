import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/drizzle-schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data.db",
  },
});
