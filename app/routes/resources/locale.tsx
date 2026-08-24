import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { localeCookie } from "~/i18n/i18n.server";
import { toLocale } from "~/i18n/config";

/**
 * Persists a language choice from the public switcher, then returns the visitor
 * to where they were. Action-only: there is nothing to render.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  // Untrusted input from a form — narrow it, never trust the raw value.
  const locale = toLocale(form.get("locale"));

  const raw = form.get("returnTo");
  // Only allow same-site paths back: an absolute URL here would be an open
  // redirect.
  const returnTo =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/";

  return redirect(returnTo, {
    headers: { "Set-Cookie": await localeCookie.serialize(locale) },
  });
};

/** Never rendered; a GET here is a misuse. */
export const loader = () => redirect("/");
