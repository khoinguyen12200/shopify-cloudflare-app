import { describe, expect, it } from "vitest";
import { sweepPlanFor, UNINSTALL_PROBE_CRON } from "./cron-schedule";

describe("UNINSTALL_PROBE_CRON", () => {
  // scripts/check-placeholders.mjs (the deploy gate) cannot import TypeScript, so it carries this literal too.
  it("is the literal the deploy gate requires in production triggers.crons", () => {
    expect(UNINSTALL_PROBE_CRON).toBe("0 * * * *");
  });
});

describe("sweepPlanFor", () => {
  it("runs only the probe on the hourly probe cron", () => {
    expect(sweepPlanFor(UNINSTALL_PROBE_CRON)).toEqual({ includeDailyMaintenance: false });
  });

  it.each(["30 3 * * *", "*/5 * * * *", "", "0 0 * * *", "unknown"])("runs everything for %j", (cron) => {
    expect(sweepPlanFor(cron)).toEqual({ includeDailyMaintenance: true });
  });
});
