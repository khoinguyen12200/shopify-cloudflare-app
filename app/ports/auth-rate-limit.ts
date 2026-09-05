export interface AuthAttemptLimiter {
  check(key: string): Promise<"allowed" | "limited" | "unavailable">;
}
