import { describe, expect, it } from "vitest";
import {
  aggregateUninstallReasons,
  filterMerchantFeedback,
  formatReason,
} from "./uninstall-feedback";

describe("uninstall feedback domain helpers", () => {
  describe("formatReason", () => {
    it("formats screaming snake case into title case", () => {
      expect(formatReason("TOO_EXPENSIVE")).toBe("Too Expensive");
      expect(formatReason("COULD_NOT_SET_UP")).toBe("Could Not Set Up");
      expect(formatReason("MISSING_FEATURES")).toBe("Missing Features");
      expect(formatReason("TEMPORARY")).toBe("Temporary");
    });

    it("falls back to Unspecified for empty or null reason", () => {
      expect(formatReason(null)).toBe("Unspecified");
      expect(formatReason("")).toBe("Unspecified");
      expect(formatReason("   ")).toBe("Unspecified");
    });
  });

  describe("aggregateUninstallReasons", () => {
    it("returns empty array when no items have reasons", () => {
      expect(aggregateUninstallReasons([])).toEqual([]);
      expect(aggregateUninstallReasons([{ reason: null }, { reason: "" }])).toEqual([]);
    });

    it("aggregates counts and calculates percentages ordered by count descending", () => {
      const items = [
        { reason: "TOO_EXPENSIVE" },
        { reason: "TOO_EXPENSIVE" },
        { reason: "TOO_EXPENSIVE" },
        { reason: "COULD_NOT_SET_UP" },
        { reason: null },
      ];

      const result = aggregateUninstallReasons(items);
      expect(result).toEqual([
        {
          reason: "TOO_EXPENSIVE",
          label: "Too Expensive",
          count: 3,
          percentage: 75,
        },
        {
          reason: "COULD_NOT_SET_UP",
          label: "Could Not Set Up",
          count: 1,
          percentage: 25,
        },
      ]);
    });
  });

  describe("filterMerchantFeedback", () => {
    it("filters to items with non-empty reasonDescription", () => {
      const items = [
        { id: "1", reasonDescription: "Too hard to use with our theme" },
        { id: "2", reasonDescription: null },
        { id: "3", reasonDescription: "   " },
        { id: "4", reasonDescription: "Switching to another provider" },
      ];

      const filtered = filterMerchantFeedback(items);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.id).toBe("1");
      expect(filtered[1]?.id).toBe("4");
    });
  });
});
