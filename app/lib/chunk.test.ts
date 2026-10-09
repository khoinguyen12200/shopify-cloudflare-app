import { describe, expect, it } from "vitest";
import { chunk } from "./chunk";

describe("chunk", () => {
  it("splits in order with a short final slice", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns no slices for no items and one slice when it fits", () => {
    expect(chunk([], 3)).toEqual([]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
  it("rejects a non-positive or fractional size", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});
