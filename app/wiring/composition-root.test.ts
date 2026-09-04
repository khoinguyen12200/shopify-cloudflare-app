import { describe, expect, test } from "vitest";

const sourceFiles = import.meta.glob("../**/*.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
});

describe("composition root", () => {
  test("keeps model imports and repository construction inside wiring", async () => {
    const files = Object.entries(sourceFiles).filter(([file]) =>
      !file.includes("/models/") &&
      !file.includes("/wiring/") &&
      !file.startsWith("./") &&
      !file.endsWith("wiring.server.ts") &&
      !/\.test\.[^.]+$/.test(file),
    );
    const violations: string[] = [];
    for (const [file, source] of files) {
      if (source.includes('from "~/models/')) violations.push(`${file}: model import`);
      if (/new [A-Za-z][A-Za-z0-9]*Repo\(/.test(source)) violations.push(`${file}: repository construction`);
    }
    expect(violations).toEqual([]);
  });
});
