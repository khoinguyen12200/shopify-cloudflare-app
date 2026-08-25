import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "ngk-dashboard";

export const THEME_KEY = "internal-theme";

/**
 * Render-blocking script that applies the stored (or system) theme to <html>
 * before first paint, so there is no light→dark flash on load. Embed once, near
 * the top of the console layout.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_KEY}');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

/**
 * Watch the `class` attribute on <html>. The theme lives in the DOM (the init
 * script above puts it there before React exists), so the DOM is the source of
 * truth and React subscribes to it — rather than keeping a second copy in state
 * and syncing it in an effect, which would be a second source of truth and a
 * hydration mismatch waiting to happen.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");
/** The server has no DOM and renders the light icon; the observer corrects it. */
const isDarkOnServer = () => false;

/**
 * The console's current theme, read from the DOM `subscribe`/`isDark` above —
 * shared with anything else that needs to match it (the toast layer's
 * `Toaster theme=`), so there is exactly one source of truth for "is it dark".
 */
export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDark, isDarkOnServer);
}

/** Light/dark switch — flips `.dark` on <html> and remembers the choice. */
export function ThemeToggle() {
  const dark = useIsDarkTheme();

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // Private mode / storage disabled — the toggle still works in-session.
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
