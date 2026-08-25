import { describe, it, expect } from "vitest";
import { resolveToast } from "./action-feedback";

describe("resolveToast", () => {
  it("returns null when there is no message yet", () => {
    expect(resolveToast(undefined)).toBeNull();
  });

  it("returns null for an empty message", () => {
    expect(resolveToast({})).toBeNull();
  });

  it("resolves a success message to the success tone", () => {
    expect(resolveToast({ success: "Saved." })).toEqual({
      tone: "success",
      message: "Saved.",
    });
  });

  it("resolves an error message to the error tone", () => {
    expect(resolveToast({ error: "That did not work." })).toEqual({
      tone: "error",
      message: "That did not work.",
    });
  });

  it("prefers the error when a message somehow carries both", () => {
    expect(resolveToast({ success: "Saved.", error: "Actually, no." })).toEqual({
      tone: "error",
      message: "Actually, no.",
    });
  });
});
