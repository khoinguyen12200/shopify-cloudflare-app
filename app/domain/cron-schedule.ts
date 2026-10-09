/**
 * Which sweeps a cron expression runs. Cron strings are matched against `controller.cron`, so the expression in
 * `wrangler.jsonc` and this constant are one decision: `cron-schedule.test.ts` fails if they drift apart.
 */
export const UNINSTALL_PROBE_CRON = "0 * * * *";

export interface SweepPlan {
  /** Token pruning, upload cleanup and Partner history: once a day is plenty, and they cost CPU and subrequests. */
  readonly includeDailyMaintenance: boolean;
}

/**
 * The probe-only cron is the hourly one; anything else (the daily production cron, the five-minute local one, an
 * unrecognised string) runs everything. Running too much is harmless - every sweep is idempotent - whereas an
 * unrecognised cron that ran nothing would silently stop the maintenance.
 */
export function sweepPlanFor(cron: string): SweepPlan {
  return { includeDailyMaintenance: cron !== UNINSTALL_PROBE_CRON };
}
