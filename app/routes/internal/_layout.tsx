import { Suspense } from "react";
import {
  Form,
  Link,
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { User as UserIcon, LogOut } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  DashboardLayout,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ErrorState,
  SkeletonPage,
  Toaster,
  type RenderLinkArgs,
} from "ngk-dashboard";
import { INTERNAL_NAV } from "./layout-nav";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminSessionUsers } from "~/wiring.server";
import {
  AppLogo,
  INTERNAL_FONT_LINKS,
  ThemeToggle,
  THEME_INIT_SCRIPT,
  useIsDarkTheme,
} from "~/internal/components";
// Tailwind v4 + ngk-dashboard styles, scoped to /internal by THIS route's
// links(): React Router only injects it while an internal route is matched, so
// Tailwind's Preflight never reaches the Polaris merchant app or the SCSS public
// pages. See .claude/rules/styling.md.
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

export const meta: MetaFunction = () => [
  { title: "Staff Console" },
  { name: "robots", content: "noindex, nofollow" },
];

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // The auth guard for the whole console. Child loaders still enforce their own
  // requirements (an owner-only page calls requireOwner), so this is defence in
  // depth, not the only check.
  const user = await requireAdminUser(request, { users: adminSessionUsers() });
  return { user };
};

/**
 * The shell's only data is the signed-in user. It does not change while moving
 * between console pages, so skip re-running this loader on client navigations —
 * one less round-trip per click.
 */
export const shouldRevalidate = () => false;

/** Router-neutral link renderer that DashboardLayout requires. */
function renderLink({ href, className, children, onClick, ...rest }: RenderLinkArgs) {
  return (
    <Link to={href} prefetch="intent" className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Top progress bar — immediate feedback on every client navigation, so a slow
 * loader never makes the console feel frozen.
 */
function NavProgress() {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 transition-opacity duration-300"
      style={{ opacity: active ? 1 : 0 }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: active ? "92%" : "0%",
          transition: active
            ? "width 8s cubic-bezier(0.1,0.75,0.15,1)"
            : "width .2s ease",
        }}
      />
    </div>
  );
}

export function UserMenu({ user }: { user: { name: string; email: string } }) {
  const initial = (user.name || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/internal/profile" prefetch="intent">
            <UserIcon />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild variant="destructive">
          <SignOutControl />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutControl() {
  return (
    <Form method="post" action="/internal/logout">
      <button type="submit">
        <LogOut />
        Sign out
      </button>
    </Form>
  );
}

export default function InternalLayout() {
  const { user } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const dark = useIsDarkTheme();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <NavProgress />
      <Toaster theme={dark ? "dark" : "light"} />
      <DashboardLayout
        nav={INTERNAL_NAV}
        logo={<AppLogo />}
        currentPath={pathname}
        renderLink={renderLink}
        headerEnd={
          <>
            <ThemeToggle />
            <UserMenu user={user} />
          </>
        }
      >
        <Suspense fallback={<SkeletonPage sections={2} />}>
          <Outlet />
        </Suspense>
      </DashboardLayout>
    </>
  );
}

/**
 * Console-scoped error boundary: a failed child route shows ngk's ErrorState
 * instead of a raw stack. This route's links() still apply, so the stylesheet is
 * present here.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const is403 = isRouteErrorResponse(error) && error.status === 403;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <ErrorState
          heading={
            is404
              ? "Page not found"
              : is403
                ? "You do not have access to that"
                : "Something went wrong"
          }
        />
      </div>
    </>
  );
}
