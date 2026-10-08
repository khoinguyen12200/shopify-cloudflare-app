import { describe, expect, it } from "vitest";
import { toTimeZone, UTC } from "./time-zone";

describe("toTimeZone", () => {
  it("accepts real IANA zones and UTC", () => {
    expect(toTimeZone("Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh");
    expect(toTimeZone(" America/Toronto ")).toBe("America/Toronto");
    expect(toTimeZone("UTC")).toBe(UTC);
  });

  it("rejects unknown names, shapes that merely look right, and non-strings", () => {
    expect(toTimeZone("Mars/Olympus_Mons")).toBeNull();
    expect(toTimeZone("")).toBeNull();
    expect(toTimeZone(null)).toBeNull();
    expect(toTimeZone(42)).toBeNull();
  });
});
