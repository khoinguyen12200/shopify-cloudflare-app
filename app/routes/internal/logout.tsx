import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { destroyAdminSession } from "~/services/admin-auth.server";

/**
 * Sign out. Available as both a POST (the nav's form) and a GET, because a
 * plain link to /internal/logout is what people reach for.
 */
export const action = ({ request }: ActionFunctionArgs) =>
  destroyAdminSession(request);

export const loader = ({ request }: LoaderFunctionArgs) =>
  destroyAdminSession(request);
