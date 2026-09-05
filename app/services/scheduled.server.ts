import type { ScheduledDependencies } from "~/ports/scheduled";

/** Keep spent and expired tokens around briefly, so a replay still reports accurately. */
const TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Everything the cron does, in one place.
 *
 * Each sweep guards its own errors: one failing must never cost the others their
 * tick, and a cron that throws simply does not run the rest.
 */
export async function runScheduledSweeps(now: number, dependencies: ScheduledDependencies): Promise<void> {
  await sweep("password_reset_tokens", async () => {
    const deleted = await dependencies.tokens.deleteExpiredBefore(
      now - TOKEN_RETENTION_MS,
    );
    return { deleted };
  });
  await sweep("pending_uploads", async () => {
    const uploads = await dependencies.uploads.listExpiredUploads(now);
    if (uploads.length === 0) return { deleted: 0 };
    await dependencies.uploads.deleteUploadObjects(uploads.map((upload) => upload.r2Key));
    const deleted = await dependencies.uploads.deleteExpiredUploads(
      uploads.map((upload) => upload.id),
      now,
    );
    return { deleted };
  });
  await sweep("partner_history", async () => {
    const result = await dependencies.history.reconcile(now);
    if (result.status === "failed") throw new Error(`${result.code}: ${result.detail}`);
    return { pages: result.pages, events: result.events };
  });
}

async function sweep(
  name: string,
  run: () => Promise<Record<string, unknown>>,
): Promise<void> {
  try {
    const result = await run();
    console.log(JSON.stringify({ event: "cron.sweep", sweep: name, ...result }));
  } catch (error) {
    // Logged, not rethrown — see above.
    console.error(
      JSON.stringify({
        event: "cron.sweep_failed",
        sweep: name,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
