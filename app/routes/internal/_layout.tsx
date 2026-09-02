import { Suspense } from "react";
import {
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
import {
  LayoutGrid,
  Users,
  Receipt,
  Store,
  LifeBuoy,
  User as UserIcon,
  Cpu,
  LogOut,
} from "lucide-react";
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
  InlineStack,
  SkeletonPage,
  Toaster,
  type NavGroupData,
  type RenderLinkArgs,
} from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import {
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
  const user = await requireAdminUser(request, { users: adminUsers() });
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

function UserMenu({ user }: { user: { name: string; email: string } }) {
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
          <Link to="/internal/logout">
            <LogOut />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function InternalLayout() {
  const { user } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const dark = useIsDarkTheme();

  const nav: NavGroupData[] = [
    {
      title: "Overview",
      items: [
        { title: "Dashboard", href: "/internal/dashboard", icon: LayoutGrid },
        { title: "Shops", href: "/internal/shops", icon: Store },
        { title: "Support", href: "/internal/support", icon: LifeBuoy },
      ],
    },
    {
      title: "Team",
      items: [
        { title: "Admins", href: "/internal/admins", icon: Users },
        { title: "Subscriptions", href: "/internal/subscriptions", icon: Receipt },
        { title: "AI", href: "/internal/ai", icon: Cpu },
      ],
    },
    {
      title: "Account",
      items: [
        { title: "Profile", href: "/internal/profile", icon: UserIcon },
      ],
    },
  ];

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <NavProgress />
      <Toaster theme={dark ? "dark" : "light"} />
      <DashboardLayout
        nav={nav}
        logo={
          <InlineStack gap={2} className="px-1 py-2">
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              Internal console
            </span>
          </InlineStack>
        }
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
