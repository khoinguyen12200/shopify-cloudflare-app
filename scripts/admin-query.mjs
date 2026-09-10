import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { adminUsers } from '../app/db/schema/admin-users.ts';

export function adminInsertStatement(row, seed = false) {
  const db = drizzle(() => { throw new Error('Query compilation must not execute'); });
  const insert = db.insert(adminUsers).values(row);
  const query = seed ? insert.onConflictDoNothing({ target: adminUsers.email }) : insert;
  return new SQLiteSyncDialect().sqlToQuery(query.getSQL().inlineParams()).sql;
}
