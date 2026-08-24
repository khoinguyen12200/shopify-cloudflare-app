import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdminUser, HOME_PATH } from "~/services/admin-auth.server";

/** /internal is not a page — it authenticates and forwards to the dashboard. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request);
  throw redirect(HOME_PATH);
};
