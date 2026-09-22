import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Placeholder so drizzle-kit has a valid schema; app data lives in Supabase and CSV/JSON. */
export const schemaMeta = sqliteTable("schema_meta", {
  key: text("key").primaryKey(),
  version: integer("version").notNull(),
});
