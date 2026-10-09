import { Form } from "react-router";
import { ConfirmDialog } from "ngk-dashboard";
import type { SafeAdminUser } from "~/db/schema";

/** id of the hidden removal form that the ConfirmDialog submits. */
const REMOVE_FORM_ID = "remove-admin";

/**
 * The dialog's confirm button submits THIS form by id, so removal stays a
 * normal POST to the action — no fetch, no client-side mutation path, and
 * the same server guards apply. Closing on submit is a plain event
 * handler rather than an effect watching the navigation state.
 */
export function RemoveAdminDialog({
  confirming,
  busy,
  onClose,
}: {
  confirming: SafeAdminUser | null;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <Form method="post" id={REMOVE_FORM_ID} className="hidden" onSubmit={onClose}>
        <input type="hidden" name="intent" value="remove" />
        <input type="hidden" name="id" value={confirming?.id ?? ""} />
      </Form>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        form={REMOVE_FORM_ID}
        destructive
        isLoading={busy}
        title={`Remove ${confirming?.name ?? ""}?`}
        desc="They will lose access to the console immediately. This cannot be undone."
        confirmText="Remove"
        cancelBtnText="Cancel"
      />
    </>
  );
}
