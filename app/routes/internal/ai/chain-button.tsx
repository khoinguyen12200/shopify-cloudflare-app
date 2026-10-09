import { Form } from "react-router";
import { Button } from "ngk-dashboard";

/** One icon button that posts a single chain intent. */
export function ChainButton({
  role,
  modelId,
  intent,
  busy,
  disabled,
  children,
}: {
  role: string;
  modelId: string;
  intent: "up" | "down" | "remove" | "enable" | "disable";
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="intent" value={intent} />
      <Button type="submit" variant="ghost" size="sm" disabled={busy || disabled}>
        {children}
      </Button>
    </Form>
  );
}
