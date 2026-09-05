import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

test("local admin seed output does not advertise a fixed dev server URL", async () => {
  const source = await readFile(new URL("./seed-admin.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /http:\/\/localhost:3000\/internal\/login/);
});
