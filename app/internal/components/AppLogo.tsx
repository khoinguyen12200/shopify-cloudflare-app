import { identity } from "~/identity";

/**
 * The app's mark plus its name, for the staff console's sidebar and sign-in.
 *
 * PLACEHOLDER MARK: the Remix logo, until the app has its own. Swap `LOGO_PATH`
 * (a single 24x24 path) for the real one; nothing else here changes. It is
 * drawn with `currentColor`, so it follows the light/dark theme without a second
 * asset. The name comes from `identity.brandName`, the one place the product
 * name is authored.
 */
const LOGO_PATH =
  "M21.511 18.508c.216 2.773.216 4.073.216 5.492H15.31c0-.309.006-.592.011-.878.018-.892.036-1.821-.109-3.698-.19-2.747-1.374-3.358-3.55-3.358H1.574v-5h10.396c2.748 0 4.122-.835 4.122-3.049 0-1.946-1.374-3.125-4.122-3.125H1.573V0h11.541c6.221 0 9.313 2.938 9.313 7.632 0 3.511-2.176 5.8-5.114 6.182 2.48.497 3.93 1.909 4.198 4.694ZM1.573 24v-3.727h6.784c1.133 0 1.379.84 1.379 1.342V24Z";

export function AppMark({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={LOGO_PATH} />
    </svg>
  );
}

/** Mark + name. In a collapsed sidebar only the mark stays visible. */
export function AppLogo() {
  return (
    <span className="flex items-center gap-2 px-1 py-2">
      <AppMark className="size-6 shrink-0" />
      <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
        {identity.brandName}
      </span>
    </span>
  );
}
