export interface ExpiredUpload {
  readonly id: string;
  readonly r2Key: string;
}

export interface ScheduledDependencies {
  readonly tokens: { deleteExpiredBefore(cutoff: number): Promise<number> };
  readonly uploads: {
    listExpiredUploads(cutoff: number): Promise<readonly ExpiredUpload[]>;
    deleteExpiredUploads(ids: readonly string[], cutoff: number): Promise<number>;
    deleteUploadObjects(keys: readonly string[]): Promise<void>;
  };
  readonly history: { reconcile(now: number): Promise<{ status: "succeeded"; pages: number; events: number } | { status: "failed"; code: string; detail: string }> };
}
