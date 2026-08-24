import { describe, it, expect } from "vitest";
// The deploy gate's JSONC parser and walker. Imported from the script so the
// tested code IS the code that runs — not a copy of it.
import {
  stripJsonComments,
  findPlaceholders,
  configForEnv,
} from "../../scripts/check-placeholders.mjs";

describe("stripJsonComments", () => {
  it("removes line and block comments", () => {
    const out = stripJsonComments('{\n // a\n /* b */ "x": 1\n}');
    expect(JSON.parse(out)).toEqual({ x: 1 });
  });

  it("keeps a // inside a string — a URL must survive", () => {
    // A naive regex eats this and the config stops parsing.
    const out = stripJsonComments('{"url": "https://example.test/a"}');
    expect(JSON.parse(out)).toEqual({ url: "https://example.test/a" });
  });

  it("handles an escaped quote without ending the string early", () => {
    const out = stripJsonComments('{"q": "a \\" // b"}');
    expect(JSON.parse(out)).toEqual({ q: 'a " // b' });
  });

  it("parses the real wrangler.jsonc shape", () => {
    const out = stripJsonComments(`{
      // comment mentioning REPLACE_ME
      "name": "x", /* inline */ "env": { "production": { "id": "REPLACE_ME" } }
    }`);
    expect(JSON.parse(out)).toEqual({
      name: "x",
      env: { production: { id: "REPLACE_ME" } },
    });
  });
});

describe("findPlaceholders", () => {
  it("reports the path to each placeholder", () => {
    const hits = findPlaceholders({
      kv_namespaces: [{ binding: "SESSION", id: "REPLACE_ME" }],
    });
    expect(hits).toEqual([
      { path: "kv_namespaces[0].id", value: "REPLACE_ME" },
    ]);
  });

  it("finds nothing in a fully configured env", () => {
    expect(
      findPlaceholders({ id: "abc123", vars: { A: "1" } }),
    ).toEqual([]);
  });

  it("catches the other spellings people leave behind", () => {
    const hits = findPlaceholders({
      a: "CHANGE_ME",
      b: "TODO: fill in",
      c: "your-domain.com",
    });
    expect(hits).toHaveLength(3);
  });

  it("ignores numbers and booleans", () => {
    expect(findPlaceholders({ n: 1, b: true, z: null })).toEqual([]);
  });
});

describe("configForEnv", () => {
  it("returns the named env, not a merge", () => {
    // Named envs inherit NOTHING from the top level, so merging would report a
    // top-level id as if production had it.
    const config = { id: "top", env: { production: { id: "prod" } } };
    expect(configForEnv(config, "production")).toEqual({ id: "prod" });
  });

  it("returns the top level without its env block", () => {
    const config = { id: "top", env: { production: { id: "prod" } } };
    expect(configForEnv(config, "top-level")).toEqual({ id: "top" });
  });

  it("returns undefined for an unknown env", () => {
    expect(configForEnv({ env: {} }, "staging")).toBeUndefined();
  });
});
