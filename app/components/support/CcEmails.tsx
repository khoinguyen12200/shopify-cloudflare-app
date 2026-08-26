import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { addCcEmail, removeCcEmail, type CcFailure } from "~/support/cc-list";
import { supportErrorKey } from "~/support/error-keys";

/**
 * The "also copy these people" control: a list of addresses, and a button that
 * opens a dialog to add one more.
 *
 * It replaces a free-text "one address per line" box. That box asked the
 * merchant to know a format, gave them no feedback until the whole form was
 * submitted, and reported one failure for the entire list — so a single typo
 * on line three rejected the other four addresses with a message that could not
 * say which line was wrong. Adding one address at a time means each one is
 * accepted or explained on the spot, and the list on screen is exactly what
 * will be saved.
 *
 * The rules — valid, not already listed, under the cap — are NOT here. They are
 * pure functions in `~/support/cc-list`, unit-tested, and shared with the
 * server-side schema, so the dialog cannot drift from what the action accepts.
 */

/** Every string this control can show. Translated by the route; none baked in. */
export interface CcLabels {
  readonly heading: string;
  readonly help: string;
  readonly empty: string;
  readonly add: string;
  readonly remove: (email: string) => string;
  readonly dialogHeading: string;
  readonly field: string;
  readonly fieldPlaceholder: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly error: (reason: CcFailure) => string;
}

export function CcEmails({
  id,
  name,
  emails,
  onChange,
  labels,
}: {
  /** Unique on the page — it is the dialog's id, and the button's target. */
  id: string;
  /** Form field name. The addresses are submitted comma-separated. */
  name: string;
  emails: readonly string[];
  onChange: (next: string[]) => void;
  labels: CcLabels;
}) {
  const dialogId = `${id}-dialog`;
  const dialog = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const field = useRef<HTMLElementTagNameMap["s-email-field"]>(null);
  const [failure, setFailure] = useState<CcFailure | null>(null);

  const submitAddress = () => {
    const input = field.current;
    if (!input) return;

    const result = addCcEmail(emails, input.value ?? "");
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }

    onChange(result.value);
    setFailure(null);
    input.value = "";
    dialog.current?.hideOverlay();
  };

  // Enter in the dialog means "add this address", NOT "submit the ticket".
  //
  // Wired natively rather than with an `onKeyDown` prop for two reasons: the
  // real input lives in the element's shadow root, and the dialog is a DOM
  // descendant of the page's form — so without the preventDefault below, a
  // merchant pressing Enter after typing an address would file the ticket.
  useEffect(() => {
    const input = field.current;
    if (!input) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitAddress();
    };

    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  });

  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="block" gap="small-500">
        <s-text type="strong">{labels.heading}</s-text>
        <s-text color="subdued">{labels.help}</s-text>
      </s-stack>

      {emails.length === 0 ? (
        <s-text color="subdued">{labels.empty}</s-text>
      ) : (
        <s-stack direction="block" gap="small-400">
          {emails.map((email) => (
            <s-grid
              key={email}
              gridTemplateColumns="1fr auto"
              gap="small-200"
              alignItems="center"
            >
              <s-text>{email}</s-text>
              <s-button
                type="button"
                variant="tertiary"
                icon="x"
                accessibilityLabel={labels.remove(email)}
                onClick={() => {
                  setFailure(null);
                  onChange(removeCcEmail(emails, email));
                }}
              ></s-button>
            </s-grid>
          ))}
        </s-stack>
      )}

      <s-stack direction="inline">
        <s-button
          type="button"
          variant="secondary"
          icon="plus"
          commandFor={dialogId}
          onClick={() => setFailure(null)}
        >
          {labels.add}
        </s-button>
      </s-stack>

      {/* What the action actually reads. The visible list IS the value. */}
      <input type="hidden" name={name} value={emails.join(",")} />

      <s-modal
        ref={dialog}
        id={dialogId}
        heading={labels.dialogHeading}
        accessibilityLabel={labels.dialogHeading}
      >
        <s-email-field
          ref={field}
          label={labels.field}
          placeholder={labels.fieldPlaceholder}
          error={failure ? labels.error(failure) : undefined}
          autocomplete="email"
        ></s-email-field>

        <s-button
          slot="primary-action"
          type="button"
          variant="primary"
          onClick={submitAddress}
        >
          {labels.confirm}
        </s-button>
        <s-button
          slot="secondary-actions"
          type="button"
          variant="secondary"
          commandFor={dialogId}
          command="--hide"
        >
          {labels.cancel}
        </s-button>
      </s-modal>
    </s-stack>
  );
}

/**
 * Every string the control shows, translated in one place.
 *
 * Here rather than in a route so the new-ticket page and the thread page cannot
 * label the same control differently — a merchant meets it twice.
 */
export function ccLabels(
  t: TFunction<readonly ["admin", "common"]>,
  max: number,
): CcLabels {
  return {
    heading: t("support.form.cc"),
    help: t("support.form.ccHelp", { max }),
    empty: t("support.form.ccEmpty"),
    add: t("support.form.ccAdd"),
    remove: (email: string) => t("support.form.ccRemove", { email }),
    dialogHeading: t("support.form.ccDialogHeading"),
    field: t("support.form.ccField"),
    fieldPlaceholder: t("support.form.ccFieldPlaceholder"),
    confirm: t("support.form.ccConfirm"),
    cancel: t("common:actions.cancel"),
    error: (reason) => t(supportErrorKey(reason)),
  };
}
