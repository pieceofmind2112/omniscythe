import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const auditNotes = sqliteTable("audit_notes", {
  id: text("id").primaryKey(),
  checkId: text("check_id").notNull(),
  rsid: text("rsid").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const auditOverrides = sqliteTable("audit_overrides", {
  id: text("id").primaryKey(),
  checkId: text("check_id").notNull(),
  rsid: text("rsid").notNull(),
  overrideStatus: text("override_status").notNull(), // "pass" | "fail" | "not_applicable"
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});
