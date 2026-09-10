import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function violations(source, name) {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const failures = [];
  const statement = /^\s*(?:select\s+.+?\s+from\b|insert\s+into\b|update\s+\S+\s+set\b|delete\s+from\b|(?:create|drop|alter)\s+(?:table|trigger|index)\b|pragma\s+\w)/is;
  function visit(node) {
    const literal = ts.isStringLiteralLike(node) ? node.text : ts.isTemplateExpression(node) ? node.head.text : undefined;
    if (literal !== undefined && statement.test(literal)) failures.push(`${name}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}: handwritten SQL statement`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression.getText(file);
      if ((method === 'raw' && receiver === 'sql') || (['prepare', 'exec'].includes(method) && /(?:^|\.)(?:DB|database)$/.test(receiver))) {
        failures.push(`${name}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}: direct SQL execution`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return failures;
}

test('guard recognizes SQL statements without rejecting regex or tenant ports', () => {
  assert.equal(violations('env.DB.prepare("SELECT id FROM users")', 'sample.ts').length, 2);
  assert.equal(violations('db.run(sql`insert into ${users} values (1)`)', 'sample.ts').length, 1);
  assert.equal(violations('env.DB.exec(`CREATE TABLE test (id TEXT)`)', 'sample.ts').length, 2);
  assert.deepEqual(violations('deps.d1.prepare(shop); /foo/.exec(text); db.select().from(users)', 'sample.ts'), []);
});

async function scan(directory) {
  const failures = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) failures.push(...await scan(path));
    else if (/\.(?:ts|tsx|mjs)$/.test(entry.name)) failures.push(...violations(await readFile(path, 'utf8'), path.pathname));
  }
  return failures;
}

test('application and worker code including tests contain no handwritten SQL statements', async () => {
  const failures = (await Promise.all(['../app/', '../workers/'].map(path => scan(new URL(path, import.meta.url))))).flat();
  assert.deepEqual(failures, []);
});

test('ordinary aggregate adapters use Drizzle aggregate and predicate functions', async () => {
  for (const name of ['ai', 'admin-users', 'password-reset-tokens', 'operational-health']) {
    const source = await readFile(new URL(`../app/models/${name}.server.ts`, import.meta.url), 'utf8');
    assert.ok(!/\bsql(?:<[^>]+>)?`/.test(source), name);
  }
});
