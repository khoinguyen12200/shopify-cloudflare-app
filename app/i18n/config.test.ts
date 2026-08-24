import { describe, it, expect } from "vitest";
import {
  toLocale,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  LOCALE_DIRECTION,
  DEFAULT_LOCALE,
} from "./config";
import { resources } from "./resources";

describe("locale narrowing", () => {
  it("accepts a supported locale", () => {
    expect(toLocale("es")).toBe("es");
  });

  it("falls back for an unsupported language", () => {
    expect(toLocale("de")).toBe(DEFAULT_LOCALE);
  });

  it("falls back for junk input", () => {
    expect(toLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(toLocale(null)).toBe(DEFAULT_LOCALE);
    expect(toLocale(42)).toBe(DEFAULT_LOCALE);
    expect(toLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("matches the base language of a REGIONAL tag", () => {
    // Shopify sends es-ES / es-MX in the admin's `locale` parameter. Without
    // this, a Spanish merchant silently gets English.
    expect(toLocale("es-ES")).toBe("es");
    expect(toLocale("es-419")).toBe("es");
    expect(toLocale("en-GB")).toBe("en");
  });

  it("is case-insensitive on the base language", () => {
    expect(toLocale("ES-es")).toBe("es");
  });

  it("narrows correctly", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(isSupportedLocale(7)).toBe(false);
  });
});

describe("every supported locale is fully wired", () => {
  it("has a label, a direction, and resources", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale], `label for ${locale}`).toBeTruthy();
      expect(LOCALE_DIRECTION[locale], `direction for ${locale}`).toMatch(
        /^(ltr|rtl)$/,
      );
      expect(resources[locale], `resources for ${locale}`).toBeTruthy();
    }
  });
});

/** Flatten to dotted key paths so two locales can be compared structurally. */
function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? keys(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("translation completeness", () => {
  const namespaces = ["common", "public", "admin"] as const;

  it.each(namespaces)(
    "%s has identical keys in every locale",
    (namespace) => {
      const base = keys(resources[DEFAULT_LOCALE][namespace]).sort();

      for (const locale of SUPPORTED_LOCALES) {
        const other = keys(resources[locale][namespace]).sort();
        // A missing key renders the raw key path to a merchant; an extra key is
        // dead weight that will drift.
        expect(other, `${locale}/${namespace}`).toEqual(base);
      }
    },
  );

  it.each(namespaces)("%s has no empty strings", (namespace) => {
    for (const locale of SUPPORTED_LOCALES) {
      const walk = (value: object, path = ""): void => {
        for (const [k, v] of Object.entries(value)) {
          if (typeof v === "object" && v !== null) walk(v as object, `${path}${k}.`);
          else
            expect(
              String(v).trim(),
              `${locale}/${namespace} ${path}${k}`,
            ).not.toBe("");
        }
      };
      walk(resources[locale][namespace]);
    }
  });

  it("keeps interpolation placeholders identical across locales", () => {
    // `{{shop}}` renamed in a translation silently renders the literal braces.
    const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();

    const walk = (base: object, other: object, path: string): void => {
      for (const [k, v] of Object.entries(base)) {
        const o = (other as Record<string, unknown>)[k];
        if (typeof v === "object" && v !== null) {
          walk(v as object, o as object, `${path}${k}.`);
        } else {
          expect(placeholders(String(o)), `${path}${k}`).toEqual(
            placeholders(String(v)),
          );
        }
      }
    };

    for (const locale of SUPPORTED_LOCALES) {
      for (const ns of ["common", "public", "admin"] as const) {
        walk(resources[DEFAULT_LOCALE][ns], resources[locale][ns], `${locale}/${ns} `);
      }
    }
  });
});
