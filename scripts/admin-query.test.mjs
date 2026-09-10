import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminInsertStatement } from './admin-query.mjs';
test('preserves escaped values and seed conflict policy', () => {
 const row = { id: 'one', email: "o'hara@example.com", name: 'Name', passwordHash: 'hash', role: 'owner', status: 'active', createdAt: 1, updatedAt: 1, lastLoginAt: null };
 assert.match(adminInsertStatement(row), /o''hara@example.com/);
 assert.ok(!adminInsertStatement(row).includes('?'));
 assert.ok(!adminInsertStatement(row).includes('on conflict'));
 assert.match(adminInsertStatement(row, true), /on conflict.*email.*do nothing/);
});
