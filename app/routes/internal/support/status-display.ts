import type { SupportStatus } from "~/support/status";

/** From the STAFF side, "open" is the one that needs work — hence the alarm. */
export const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  answered: "secondary",
  closed: "outline",
};

export const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Needs reply",
  answered: "Waiting on merchant",
  closed: "Closed",
};
