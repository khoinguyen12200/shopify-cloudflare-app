import { execFileSync } from "node:child_process";

export const SHOPIFY_PATHS = ["shopify.app.toml", "extensions/"];

/** Pure: does this list of changed file paths touch anything `shopify app deploy` would publish? */
export function pathsIncludeShopifyConfig(changedFiles) {
  return changedFiles.some((f) => SHOPIFY_PATHS.some((p) => f.startsWith(p)));
}

/**
 * How many commits back to diff when deciding whether to run `shopify app
 * deploy`. Workers Builds injects only the CURRENT commit SHA
 * (`WORKERS_CI_COMMIT_SHA`) — there is no "previous SHA before this push"
 * variable, so an exact push-boundary diff isn't possible. A plain `HEAD~1`
 * missed a push that bundled several commits where only the LAST one touched
 * `extensions/`/`shopify.app.toml`: the earlier commits' changes were invisible
 * to a one-commit diff, and the whole push silently skipped the Shopify deploy.
 * Widened generously here; over-triggering just re-runs a retryable, non-fatal
 * `shopify app deploy`, while under-triggering silently ships stale Shopify
 * config — the asymmetry is why this errs toward deploying too often.
 */
export const CONFIG_DIFF_LOOKBACK = 20;

function defaultRunGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

/** Did the last CONFIG_DIFF_LOOKBACK commits touch Shopify config? `runGit` is
 *  injectable for tests; falls back to `true` (deploy) when the history is too
 *  shallow to diff — see CONFIG_DIFF_LOOKBACK doc above for why that's safe. */
export function touchesShopifyConfig(runGit = defaultRunGit) {
  try {
    const changed = runGit(["diff", "--name-only", `HEAD~${CONFIG_DIFF_LOOKBACK}`, "HEAD"]);
    return pathsIncludeShopifyConfig(changed.split("\n"));
  } catch {
    // Shallow clone or fewer than CONFIG_DIFF_LOOKBACK commits in history — no
    // diff to read. Deploy rather than skip: a redundant app version is
    // harmless, a silently skipped one is not.
    return true;
  }
}
