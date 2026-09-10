import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fkParent = sqliteTable("fk_parent", { id: text().primaryKey() });
export const fkChild = sqliteTable("fk_child", {
  id: text().primaryKey(),
  parentId: text("parent_id").notNull().references(() => fkParent.id),
});
