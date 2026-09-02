export interface ScheduledDependencies {
  readonly tokens: { deleteExpiredBefore(cutoff: number): Promise<number> };
  readonly history: { reconcile(now: number): Promise<{ status: "succeeded"; pages: number; events: number } | { status: "failed"; code: string; detail: string }> };
}
