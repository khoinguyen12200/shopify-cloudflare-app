/**
 * The confirmation shown after an admin action, as one sentence.
 *
 * A plain module rather than `.server.ts`: the COMPONENT renders this, so it
 * has to reach the client bundle. Route-local, beside its route and suffixed,
 * per @rules/architecture.md. Knows nothing about intents — the intent-to-key
 * map lives with the intents, so this stays pure and has no server import.
 */
export type SuccessKey =
  | "created"
  | "disabled"
  | "enabled"
  | "removed"
  | "roleChanged"
  | "passwordReset";

export function formatSuccessMessage(
  key: SuccessKey,
  name: string,
  role: string,
): string {
  switch (key) {
    case "created":
      return `${name} can now sign in.`;
    case "disabled":
      return `${name} can no longer sign in.`;
    case "enabled":
      return `${name} can sign in again.`;
    case "removed":
      return `${name} was removed.`;
    case "roleChanged":
      return `${name} is now ${role}.`;
    case "passwordReset":
      return `Password reset for ${name}. Give them the new password directly.`;
  }
}
