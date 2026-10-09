import { useEffect } from "react";
import { Alert, AlertDescription, toast } from "ngk-dashboard";
import type { AdminErrorReason } from "~/services/admin-management.server";
import { ADMIN_ERRORS, ADMIN_ROLE_LABEL } from "~/internal/admin-messages";
import { useActionToast } from "~/internal/use-action-toast";
import { formatSuccessMessage, type SuccessKey } from "./success-message";

/** Every field an admin action result may carry; the action returns one shape or the other. */
export interface AdminActionResult {
  readonly error?: AdminErrorReason;
  readonly success?: SuccessKey;
  readonly name?: string;
  readonly role?: string;
}

interface AdminFeedback {
  readonly errorMessage: string | undefined;
  readonly successMessage: string | undefined;
}

/** The role label, looked up by comparison rather than asserted with `as`. */
function roleLabel(role: string): string {
  return role === "owner" || role === "admin" ? ADMIN_ROLE_LABEL[role] : "";
}

function describeResult(result: AdminActionResult | undefined): AdminFeedback {
  const errorMessage = result?.error ? ADMIN_ERRORS[result.error] : undefined;
  const successMessage = result?.success
    ? formatSuccessMessage(result.success, result.name ?? "", roleLabel(result.role ?? ""))
    : undefined;
  return { errorMessage, successMessage };
}

/**
 * Messages for the inline alerts, plus the toasts layered on top of them. The
 * Alert stays the no-JS-safe, authoritative feedback.
 */
export function useAdminFeedback(
  result: AdminActionResult | undefined,
  resetSuccess: boolean,
): AdminFeedback {
  const feedback = describeResult(result);
  useActionToast(result, { success: feedback.successMessage, error: feedback.errorMessage });

  // reset.tsx redirects here after a password reset — a distinct arrival, not
  // a submission on THIS page, so it can't ride the actionData-keyed hook
  // above.
  useEffect(() => {
    if (resetSuccess) {
      toast.success("Password reset. Give them the new password directly.");
    }
  }, [resetSuccess]);

  return feedback;
}

export function AdminAlerts({
  feedback,
  resetSuccess,
}: {
  feedback: AdminFeedback;
  resetSuccess: boolean;
}) {
  return (
    <>
      {feedback.errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{feedback.errorMessage}</AlertDescription>
        </Alert>
      )}
      {feedback.successMessage && (
        <Alert>
          <AlertDescription>{feedback.successMessage}</AlertDescription>
        </Alert>
      )}
      {resetSuccess && (
        <Alert>
          <AlertDescription>
            Password reset. Give them the new password directly.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
