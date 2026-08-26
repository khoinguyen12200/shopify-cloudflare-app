import type { AdminRole } from "~/db/schema";
import {
  createAdmin,
  removeAdmin,
  resetAdminPassword,
  setAdminRole,
  setAdminStatus,
} from "~/services/admin-management.server";
import type { SuccessKey } from "./success-message";

/**
 * The admin screen's intent dispatch, beside its route.
 *
 * `.server.ts` because every branch calls a service that touches D1 — keeping
 * it out of the route file also keeps that file under the size target
 * (@rules/architecture.md).
 */
/** The role field, narrowed by comparison rather than asserted with `as`. */
export function readRole(form: FormData): AdminRole {
  return form.get("role") === "owner" ? "owner" : "admin";
}

/**
 * Command dispatch on `intent`, per @rules/design-patterns.md: the action is a
 * thin lookup, and each intent's logic lives in the service.
 */
export const INTENTS = {
  async create(form: FormData) {
    return createAdmin({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role: readRole(form),
    });
  },
  async disable(form: FormData, actorId: string) {
    return setAdminStatus({
      actorId,
      targetId: String(form.get("id") ?? ""),
      status: "disabled",
    });
  },
  async enable(form: FormData, actorId: string) {
    return setAdminStatus({
      actorId,
      targetId: String(form.get("id") ?? ""),
      status: "active",
    });
  },
  async makeOwner(form: FormData, actorId: string) {
    return setAdminRole({
      actorId,
      targetId: String(form.get("id") ?? ""),
      role: "owner",
    });
  },
  async makeAdmin(form: FormData, actorId: string) {
    return setAdminRole({
      actorId,
      targetId: String(form.get("id") ?? ""),
      role: "admin",
    });
  },
  async remove(form: FormData, actorId: string) {
    return removeAdmin({ actorId, targetId: String(form.get("id") ?? "") });
  },
  async resetPassword(form: FormData, actorId: string) {
    const result = await resetAdminPassword({
      actorId,
      targetId: String(form.get("id") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
    });
    // Normalise to the same { name, role } shape the other intents return, so
    // the action stays a thin dispatch.
    return result.ok
      ? ({ ok: true, value: result.value.user } as const)
      : result;
  },
} as const;

export type Intent = keyof typeof INTENTS;

/**
 * The submitted intent, or null.
 *
 * A GUARD, not `as Intent`. The value comes off a form, so it is attacker-
 * controlled; casting it would tell the compiler a forged string is one of our
 * intents and make `SUCCESS_KEY[intent]` a lookup on a key that does not exist.
 * @rules/code-craft.md: parse at the edge, trust inside.
 */
function isIntent(value: string): value is Intent {
  return Object.prototype.hasOwnProperty.call(INTENTS, value);
}

export function readIntent(form: FormData): Intent | null {
  const value = String(form.get("intent") ?? "");
  return isIntent(value) ? value : null;
}

/** Which confirmation each intent earns. Keyed by Intent, so a new intent
 * cannot ship without one. */
export const SUCCESS_KEY: Record<Intent, SuccessKey> = {
  create: "created",
  disable: "disabled",
  enable: "enabled",
  makeOwner: "roleChanged",
  makeAdmin: "roleChanged",
  remove: "removed",
  resetPassword: "passwordReset",
};
