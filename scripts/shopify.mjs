#!/usr/bin/env node
// Project-isolated Shopify CLI wrapper.
//
// Two kinds of "local, not global" are going on here:
//
// 1. THE BINARY. We run this project's own `@shopify/cli` devDependency
//    (node_modules/.bin/shopify), never whatever `shopify` happens to be on
//    your PATH. So the CLI version is pinned in package.json and every dev and
//    CI runner uses the same one.
//
// 2. THE LOGIN SESSION. The CLI stores its session in a `conf` store whose
//    location the `env-paths` package derives, with different rules PER
//    PLATFORM:
//      • macOS   → <homedir>/Library/{Preferences,Caches,Application Support}
//                  (XDG vars are IGNORED)
//      • Linux   → $XDG_CONFIG_HOME | <homedir>/.config  (+ other XDG dirs)
//      • Windows → %APPDATA% | <homedir>/AppData/Roaming (+ %LOCALAPPDATA%)
//    The only lever common to all three is `os.homedir()`, which Node derives
//    from $HOME on POSIX and %USERPROFILE% on Windows. So we repoint the CLI's
//    home at a project-local `.shopify-home/` and — belt and braces — also set
//    the platform-specific vars, so nothing leaks to the machine-global session
//    no matter what the parent shell already exports.
//
//    Result on any OS: you can stay logged into your company account globally
//    and be logged into a different account for THIS project at the same time,
//    with no logging in and out.
//
// NOTE: redirecting HOME applies to the CLI subprocess only, so tools the CLI
// shells out to (git, npm) won't see ~/.gitconfig or ~/.npmrc during the
// command. Fine for public packages; if you need a private registry, copy the
// relevant rc file into `.shopify-home/`.
//
// Usage (via package.json): node scripts/shopify.mjs app dev --config dev
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = join(repoRoot, ".shopify-home");

// Compute the isolating env for the child. Exported + pure so it can be tested.
export function isolatedEnv(home) {
  return {
    // Base lever: os.homedir() reads these (HOME on POSIX, USERPROFILE on Win).
    // macOS relies entirely on this — Library/* lives under homedir().
    HOME: home,
    USERPROFILE: home,
    // Linux: env-paths honours these over the homedir() fallback.
    XDG_CONFIG_HOME: join(home, "config"),
    XDG_CACHE_HOME: join(home, "cache"),
    XDG_STATE_HOME: join(home, "state"),
    XDG_DATA_HOME: join(home, "data"),
    // Windows: env-paths honours these over the homedir() fallback.
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
  };
}

const overrides = isolatedEnv(home);
for (const dir of [
  overrides.HOME,
  overrides.XDG_CONFIG_HOME,
  overrides.XDG_CACHE_HOME,
  overrides.XDG_STATE_HOME,
  overrides.XDG_DATA_HOME,
  overrides.APPDATA,
  overrides.LOCALAPPDATA,
  join(home, "Library", "Preferences"),
  join(home, "Library", "Caches"),
  join(home, "Library", "Application Support"),
]) {
  mkdirSync(dir, { recursive: true });
}

/**
 * Wrangler runs INSIDE `shopify app dev` (the Cloudflare Vite plugin starts it)
 * and resolves its credentials from the same HOME/XDG vars we just redirected.
 * Cloudflare auth is orthogonal to Shopify-session isolation, so expose the
 * machine's real wrangler config inside the isolated home via a symlink.
 */
function linkWranglerConfig() {
  const real = [
    process.env.XDG_CONFIG_HOME &&
      join(process.env.XDG_CONFIG_HOME, ".wrangler"),
    join(homedir(), "Library", "Preferences", ".wrangler"), // macOS
    join(homedir(), ".config", ".wrangler"), // Linux
    process.env.APPDATA && join(process.env.APPDATA, ".wrangler"), // Windows
    join(homedir(), ".wrangler"), // legacy
  ].find((p) => p && existsSync(p));
  if (!real) return; // never logged into wrangler — its own error is accurate

  // We always set XDG_CONFIG_HOME, and wrangler reads
  // $XDG_CONFIG_HOME/.wrangler on every platform.
  const target = join(overrides.XDG_CONFIG_HOME, ".wrangler");
  if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink()) return; // already linked
    // A real dir here is only wrangler's auto-created cache — safe to replace.
    rmSync(target, { recursive: true, force: true });
  }
  symlinkSync(real, target, process.platform === "win32" ? "junction" : "dir");
}

linkWranglerConfig();

// Resolve THIS project's CLI, not the global one.
const localBin = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "shopify.cmd" : "shopify",
);
if (!existsSync(localBin)) {
  console.error(
    "Local @shopify/cli not found at node_modules/.bin/shopify — run `npm install` first.",
  );
  process.exit(1);
}

// `shopify app dev` opens a TryCloudflare quick tunnel via the bundled
// cloudflared, which defaults to QUIC (UDP :7844). QUIC registration is
// unreliable behind many NATs and fails intermittently — the tunnel URL prints
// but its hostname never provisions, so the browser reports "server IP address
// could not be found". HTTP/2 rides plain TCP and registers deterministically.
// Force it, overridable: TUNNEL_TRANSPORT_PROTOCOL=quic npm run dev
const child = spawn(localBin, process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    ...overrides,
    TUNNEL_TRANSPORT_PROTOCOL: process.env.TUNNEL_TRANSPORT_PROTOCOL ?? "http2",
  },
  shell: false,
});

// Forward Ctrl-C etc. so interactive login / the dev server exit cleanly.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
